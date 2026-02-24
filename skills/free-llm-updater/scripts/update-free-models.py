#!/usr/bin/env python3
"""
update-free-models.py - Fetch, validate, and output free LLM provider configs for WinClaw.

Fetches the free-llm-api-resources README from GitHub, parses the free provider
table, validates each provider via GET /v1/models, and outputs WinClaw-compatible
ModelProviderConfig JSON.

Usage:
    python3 update-free-models.py [--output FILE] [--top N] [--timeout SECONDS] [--dry-run]

Output: JSON object keyed by provider winclaw_key, value is WinClaw ModelProviderConfig.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

README_URL = (
    "https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def eprint(msg: str) -> None:
    """Print to stderr."""
    print(msg, file=sys.stderr)


def load_provider_mapping(script_dir: str) -> dict[str, dict[str, Any]]:
    """Load from references/provider-mapping.json."""
    ref_path = os.path.normpath(
        os.path.join(script_dir, "..", "references", "provider-mapping.json")
    )
    if not os.path.isfile(ref_path):
        eprint(f"ERROR: provider-mapping.json not found at {ref_path}")
        sys.exit(1)
    with open(ref_path, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# README Fetching & Parsing
# ---------------------------------------------------------------------------

def fetch_readme(timeout: int = 30) -> str:
    """Fetch README.md from GitHub raw URL."""
    req = urllib.request.Request(
        README_URL,
        headers={"User-Agent": "WinClaw-free-llm-updater/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def parse_free_providers_table(readme: str) -> list[str]:
    """
    Extract provider names from the '## Free Providers' section.

    The README uses ### sub-headings for each provider, not a table:
        ## Free Providers
        ### [OpenRouter](https://openrouter.ai)
        ### [Google AI Studio](https://aistudio.google.com)
        ...
        ## Providers with trial credits   <-- end of free section

    Returns provider names in lowercase for matching against provider-mapping.json keys.
    """
    providers: list[str] = []
    in_free_section = False

    for line in readme.splitlines():
        stripped = line.strip()

        # Detect ## level headers (section boundaries)
        h2_match = re.match(r"^##\s+(.+)", stripped)
        if h2_match and not stripped.startswith("###"):
            header_text = h2_match.group(1).strip().lower()
            if "free provider" in header_text and "trial" not in header_text:
                in_free_section = True
            elif in_free_section:
                # New ## section started, exit free providers
                break
            continue

        if not in_free_section:
            continue

        # Detect ### level headers (individual providers)
        h3_match = re.match(r"^###\s+(.+)", stripped)
        if h3_match:
            heading = h3_match.group(1).strip()
            # Extract link text: [ProviderName](url)
            link_match = re.match(r"\[([^\]]+)\]\([^)]*\)", heading)
            if link_match:
                name = link_match.group(1).strip().lower()
            else:
                name = heading.strip().lower()
            if name:
                providers.append(name)

    return providers


# ---------------------------------------------------------------------------
# API Key & Validation
# ---------------------------------------------------------------------------

def check_env_var(mapping: dict[str, Any]) -> str | None:
    """Return the API key value if the env var is set, else None."""
    env_var = mapping.get("env_var", "")
    if not env_var:
        return None
    # Support comma-separated fallbacks: "GH_TOKEN,GITHUB_TOKEN"
    for var in env_var.split(","):
        val = os.environ.get(var.strip(), "").strip()
        if val:
            return val
    return None


def get_env_var_name(mapping: dict[str, Any]) -> str:
    """Get the primary env var name for display."""
    env_var = mapping.get("env_var", "")
    return env_var.split(",")[0].strip() if env_var else "?"


def resolve_base_url(mapping: dict[str, Any]) -> str | None:
    """Resolve base URL, handling template variables like {account_id}."""
    base_url = mapping.get("base_url", "").rstrip("/")

    if "{account_id}" in base_url:
        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
        if not account_id:
            return None
        base_url = base_url.replace("{account_id}", account_id)

    return base_url


def validate_provider(
    name: str,
    mapping: dict[str, Any],
    api_key: str,
    base_url: str,
    timeout: int,
) -> tuple[bool, str, Any]:
    """
    Call the provider's models endpoint to verify the API key works.
    Returns (ok, error_message, response_payload).
    HTTP 429 (rate limited) is treated as PASS since the key is valid.
    The response_payload is cached and reused by build_provider_config to
    avoid a second API call to the same endpoint.
    """
    models_ep = mapping.get("models_endpoint", "/models")
    auth_header = mapping.get("auth_header", "Authorization")
    auth_query_param = mapping.get("auth_query_param")

    if auth_query_param:
        url = f"{base_url}{models_ep}?{auth_query_param}={api_key}"
        headers: dict[str, str] = {"Accept": "application/json"}
    else:
        url = f"{base_url}{models_ep}"
        headers = {
            "Accept": "application/json",
            auth_header: f"Bearer {api_key}",
        }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = None
            return True, "", payload
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            # Rate limited means the key IS valid
            return True, "", None
        if exc.code == 401:
            return False, "HTTP 401 Unauthorized (invalid API key)", None
        if exc.code == 403:
            return False, "HTTP 403 Forbidden", None
        return False, f"HTTP {exc.code}", None
    except urllib.error.URLError as exc:
        return False, f"URL error: {exc.reason}", None
    except Exception as exc:
        return False, f"Error: {exc}", None


# ---------------------------------------------------------------------------
# Model List Fetching
# ---------------------------------------------------------------------------

def fetch_model_list(
    mapping: dict[str, Any],
    api_key: str,
    base_url: str,
    timeout: int,
    max_models: int = 5,
    cached_payload: Any = None,
) -> list[dict[str, Any]]:
    """
    Parse or fetch actual model list from the provider.
    If cached_payload is provided (from validate_provider), reuse it
    instead of making another HTTP request.
    Returns up to max_models entries in WinClaw ModelDefinitionConfig format.
    """
    payload = cached_payload

    if payload is None:
        # No cache - make the HTTP request
        models_ep = mapping.get("models_endpoint", "/models")
        auth_header = mapping.get("auth_header", "Authorization")
        auth_query_param = mapping.get("auth_query_param")

        if auth_query_param:
            url = f"{base_url}{models_ep}?{auth_query_param}={api_key}"
            headers: dict[str, str] = {"Accept": "application/json"}
        else:
            url = f"{base_url}{models_ep}"
            headers = {
                "Accept": "application/json",
                auth_header: f"Bearer {api_key}",
            }

        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return _placeholder_model(mapping.get("winclaw_key", "unknown"))

    if not isinstance(payload, dict) and not isinstance(payload, list):
        return _placeholder_model(mapping.get("winclaw_key", "unknown"))

    # OpenAI format: { "data": [...] }
    data = payload.get("data", []) if isinstance(payload, dict) else []
    # Google AI format: { "models": [...] }
    if not data and isinstance(payload, dict) and isinstance(payload.get("models"), list):
        data = payload["models"]
    # Plain list
    if not data and isinstance(payload, list):
        data = payload

    if not isinstance(data, list):
        return _placeholder_model(mapping.get("winclaw_key", "unknown"))

    models = []
    for item in data[:max_models]:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id", item.get("name", ""))
        if not model_id:
            continue
        display_name = item.get("name", item.get("displayName", model_id))
        # For Google, the id is like "models/gemini-2.0-flash" - strip prefix
        if model_id.startswith("models/"):
            model_id = model_id[7:]

        ctx_window = (
            item.get("context_length")
            or item.get("context_window")
            or item.get("inputTokenLimit")
            or 128000
        )
        max_tokens = (
            item.get("max_completion_tokens")
            or item.get("max_output_tokens")
            or item.get("outputTokenLimit")
            or 4096
        )

        models.append({
            "id": model_id,
            "name": display_name if isinstance(display_name, str) else model_id,
            "reasoning": False,
            "input": ["text"],
            "contextWindow": int(ctx_window) if ctx_window else 128000,
            "maxTokens": int(max_tokens) if max_tokens else 4096,
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
        })

    return models if models else _placeholder_model(mapping.get("winclaw_key", "unknown"))


def _placeholder_model(provider_key: str) -> list[dict[str, Any]]:
    """Fallback model entry when we can't fetch the actual model list."""
    return [{
        "id": f"{provider_key}-default",
        "name": f"{provider_key} (default)",
        "reasoning": False,
        "input": ["text"],
        "contextWindow": 128000,
        "maxTokens": 4096,
        "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
    }]


# ---------------------------------------------------------------------------
# Build WinClaw Provider Config
# ---------------------------------------------------------------------------

def build_provider_config(
    mapping: dict[str, Any],
    api_key: str,
    base_url: str,
    timeout: int,
    cached_payload: Any = None,
) -> dict[str, Any]:
    """Build a WinClaw ModelProviderConfig dict.
    If cached_payload is provided (from validate_provider), it is passed through
    to fetch_model_list to avoid a duplicate API call.
    """
    env_var_name = get_env_var_name(mapping)
    models = fetch_model_list(mapping, api_key, base_url, timeout, cached_payload=cached_payload)

    config: dict[str, Any] = {
        "baseUrl": base_url,
        "apiKey": f"env:{env_var_name}",  # Use env reference, not literal key
        "auth": "api-key",
        "api": mapping.get("api", "openai-completions"),
        "models": models,
    }

    # Google uses query param auth, not header - note for reference
    if mapping.get("auth_query_param"):
        config["_note"] = f"Auth via query param: ?{mapping['auth_query_param']}=KEY"

    return config


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch and validate free LLM providers for WinClaw."
    )
    parser.add_argument(
        "--output", help="Write JSON to this file path (default: stdout)"
    )
    parser.add_argument(
        "--top", type=int, default=10,
        help="Max providers to include (default: 10)"
    )
    parser.add_argument(
        "--timeout", type=int, default=10,
        help="Per-provider HTTP timeout in seconds (default: 10)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse README and check env vars only, skip live API calls"
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    mapping = load_provider_mapping(script_dir)

    # ---- Fetch README ----
    eprint("=" * 60)
    eprint("  WinClaw Free LLM Updater")
    eprint("=" * 60)
    eprint("")
    eprint("Fetching free-llm-api-resources README from GitHub...")

    try:
        readme = fetch_readme(timeout=args.timeout * 3)
    except Exception as exc:
        eprint(f"ERROR: Failed to fetch README: {exc}")
        return 1

    # ---- Parse providers ----
    eprint("Parsing free providers table...")
    provider_names = parse_free_providers_table(readme)
    eprint(f"Found {len(provider_names)} providers: {', '.join(provider_names)}")
    eprint("")

    # ---- Validate each provider ----
    validated: dict[str, dict[str, Any]] = {}
    no_key: list[str] = []
    failed: list[tuple[str, str]] = []
    skipped: list[tuple[str, str]] = []

    for name in provider_names:
        if len(validated) >= args.top:
            break

        # Find matching mapping (try exact match, then fuzzy)
        pmap = mapping.get(name)
        if pmap is None:
            # Normalize: strip parentheses for comparison
            norm_name = re.sub(r"[()]", "", name).strip()
            norm_name = re.sub(r"\s+", " ", norm_name)
            for key in mapping:
                norm_key = re.sub(r"[()]", "", key).strip()
                norm_key = re.sub(r"\s+", " ", norm_key)
                if norm_key in norm_name or norm_name in norm_key:
                    pmap = mapping[key]
                    break

        if pmap is None:
            eprint(f"  SKIP  {name!r}: no entry in provider-mapping.json")
            skipped.append((name, "no mapping"))
            continue

        # Skip providers with complex auth
        note = pmap.get("note", "")
        if "gcloud" in note.lower() or "complex auth" in note.lower():
            eprint(f"  SKIP  {name!r}: {note}")
            skipped.append((name, note))
            continue

        # Check API key
        api_key = check_env_var(pmap)
        env_var_name = get_env_var_name(pmap)

        if not api_key:
            eprint(f"  MISS  {name!r}: {env_var_name} not set")
            no_key.append(f"{name} ({env_var_name})")
            continue

        # Resolve base URL
        base_url = resolve_base_url(pmap)
        if not base_url:
            eprint(f"  MISS  {name!r}: CLOUDFLARE_ACCOUNT_ID not set")
            no_key.append(f"{name} (CLOUDFLARE_ACCOUNT_ID)")
            continue

        provider_key = pmap.get("winclaw_key", name.replace(" ", "-"))

        if args.dry_run:
            # Bug fix: --dry-run must NOT make any API calls
            eprint(f"  DRY   {name!r}: key found ({env_var_name}), skipping live check")
            env_var_name_for_config = get_env_var_name(pmap)
            validated[provider_key] = {
                "baseUrl": base_url,
                "apiKey": f"env:{env_var_name_for_config}",
                "auth": "api-key",
                "api": pmap.get("api", "openai-completions"),
                "models": _placeholder_model(provider_key),
            }
            continue

        # Live validation (returns cached response payload to avoid double request)
        eprint(f"  TEST  {name!r} ({provider_key})...")
        ok, err, resp_payload = validate_provider(name, pmap, api_key, base_url, args.timeout)

        if ok:
            eprint(f"  PASS  {name!r}")
            validated[provider_key] = build_provider_config(
                pmap, api_key, base_url, args.timeout, cached_payload=resp_payload
            )
        else:
            eprint(f"  FAIL  {name!r}: {err}")
            failed.append((name, err))

    # ---- Summary ----
    eprint("")
    eprint("=" * 60)
    eprint(f"  Results: {len(validated)} validated / {len(provider_names)} total")
    eprint("=" * 60)

    if validated:
        eprint("")
        eprint("Validated providers:")
        for key in validated:
            model_count = len(validated[key].get("models", []))
            eprint(f"  + {key} ({model_count} models)")

    if no_key:
        eprint("")
        eprint("Missing API keys (set these env vars to include more providers):")
        for item in no_key:
            eprint(f"  - {item}")

    if failed:
        eprint("")
        eprint("Failed validation:")
        for name, err in failed:
            eprint(f"  ! {name}: {err}")

    if skipped:
        eprint("")
        eprint("Skipped:")
        for name, reason in skipped:
            eprint(f"  ~ {name}: {reason}")

    # ---- Output ----
    output = json.dumps(validated, indent=2, ensure_ascii=False)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        eprint(f"\nWritten to {args.output}")
    else:
        print(output)

    return 0 if validated else 2


if __name__ == "__main__":
    raise SystemExit(main())
