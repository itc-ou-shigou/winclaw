---
name: free-llm-updater
description: Fetch, validate, and register free LLM API providers in WinClaw from the cheahjs/free-llm-api-resources GitHub repository. Use when the user asks to update free model sources, add free APIs, refresh the free LLM provider list, check which free models are available, or set up automated daily free model updates. Validates each provider API key is configured and actually responds before adding.
metadata: { "winclaw": { "emoji": "🆓", "os": ["win32", "darwin", "linux"], "requires": { "bins": ["python3"] } } }
---

# Free LLM Updater

Fetch free LLM API providers from GitHub, validate they work, and update WinClaw's model list.

Source: https://github.com/cheahjs/free-llm-api-resources

## Quick run

```bash
python3 {baseDir}/scripts/update-free-models.py --output /tmp/free-providers.json --top 10
```

Flags:
- `--output FILE` - Write JSON to file (default: stdout)
- `--top N` - Max providers (default: 10)
- `--timeout SECONDS` - Per-provider timeout (default: 10)
- `--dry-run` - Check env vars only, skip live API calls

## Workflow

### Step 1: Run validation script

```bash
python3 {baseDir}/scripts/update-free-models.py --output /tmp/free-providers.json --top 10
```

The script:
1. Fetches README.md from cheahjs/free-llm-api-resources
2. Parses the "Free Providers" section headings
3. For each provider, checks the API key env var is set
4. Calls `GET /v1/models` to verify the API responds
5. Outputs validated provider configs as JSON

Review stderr output for PASS/FAIL/MISS summary.

### Step 2: Read current config hash

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -H "Content-Type: application/json" \
  -d '{"method":"config.get","params":{}}'
```

Save the `hash` field from the response. Required as `baseHash` for patching.

### Step 3: Patch config with validated providers

Read the JSON from Step 1 and build a config patch. Use `models.mode: "merge"` to preserve existing providers.

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -H "Content-Type: application/json" \
  -d '{
    "method": "config.patch",
    "params": {
      "raw": "{ \"models\": { \"mode\": \"merge\", \"providers\": <JSON_FROM_SCRIPT> } }",
      "baseHash": "<HASH_FROM_STEP_2>"
    }
  }'
```

### Step 4: Register daily cron job

Check for existing job first:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"cron.list","params":{"includeDisabled":true}}'
```

If no job named `free-llm-updater:daily` exists, create it:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{
    "method": "cron.add",
    "params": {
      "name": "free-llm-updater:daily",
      "schedule": "0 10 * * *",
      "prompt": "Run the free-llm-updater skill to fetch and validate free LLM providers, then update the model list. Report results.",
      "enabled": true,
      "tags": ["models", "maintenance"]
    }
  }'
```

If the job already exists, use `cron.update` with the existing job `id` instead.

### Step 5: Verify

Confirm providers are in the model list:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"config.get","params":{}}' | python3 -c "
import json, sys
cfg = json.load(sys.stdin)
providers = cfg.get('config', {}).get('models', {}).get('providers', {})
print(f'Providers in config: {len(providers)}')
for k in providers:
    print(f'  - {k}')
"
```

Confirm cron job:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"cron.list","params":{"includeDisabled":false}}'
```

## Required API keys

Each free provider requires a free API key. See `references/provider-mapping.json` for the full mapping.

Common providers and their env vars:
| Provider | Env Var | Signup URL |
|----------|---------|------------|
| Groq | `GROQ_API_KEY` | https://console.groq.com |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai |
| Google AI Studio | `GEMINI_API_KEY` | https://aistudio.google.com |
| Cerebras | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai |
| Mistral | `MISTRAL_API_KEY` | https://console.mistral.ai |
| GitHub Models | `GH_TOKEN` | https://github.com/marketplace/models |
| NVIDIA NIM | `NVIDIA_API_KEY` | https://build.nvidia.com |
| HuggingFace | `HF_TOKEN` | https://huggingface.co |
| Cohere | `COHERE_API_KEY` | https://cohere.com |

If fewer than 10 providers pass validation, the script reports which API keys are missing.
