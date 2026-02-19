import fs from "node:fs/promises";
import path from "node:path";
import { type WinClawConfig, loadConfig } from "../config/config.js";
import { isRecord } from "../utils.js";
import { resolveWinClawAgentDir } from "./agent-paths.js";
import {
  normalizeProviders,
  type ProviderConfig,
  resolveImplicitBedrockProvider,
  resolveImplicitCopilotProvider,
  resolveImplicitProviders,
} from "./models-config.providers.js";

type ModelsConfig = NonNullable<WinClawConfig["models"]>;

const DEFAULT_MODE: NonNullable<ModelsConfig["mode"]> = "merge";

function mergeProviderModels(implicit: ProviderConfig, explicit: ProviderConfig): ProviderConfig {
  const implicitModels = Array.isArray(implicit.models) ? implicit.models : [];
  const explicitModels = Array.isArray(explicit.models) ? explicit.models : [];
  if (implicitModels.length === 0) {
    return { ...implicit, ...explicit };
  }

  const getId = (model: unknown): string => {
    if (!model || typeof model !== "object") {
      return "";
    }
    const id = (model as { id?: unknown }).id;
    return typeof id === "string" ? id.trim() : "";
  };
  const seen = new Set(explicitModels.map(getId).filter(Boolean));

  const mergedModels = [
    ...explicitModels,
    ...implicitModels.filter((model) => {
      const id = getId(model);
      if (!id) {
        return false;
      }
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    }),
  ];

  return {
    ...implicit,
    ...explicit,
    models: mergedModels,
  };
}

function mergeProviders(params: {
  implicit?: Record<string, ProviderConfig> | null;
  explicit?: Record<string, ProviderConfig> | null;
}): Record<string, ProviderConfig> {
  const out: Record<string, ProviderConfig> = params.implicit ? { ...params.implicit } : {};
  for (const [key, explicit] of Object.entries(params.explicit ?? {})) {
    const providerKey = key.trim();
    if (!providerKey) {
      continue;
    }
    const implicit = out[providerKey];
    out[providerKey] = implicit ? mergeProviderModels(implicit, explicit) : explicit;
  }
  return out;
}

async function readJson(pathname: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(pathname, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function ensureWinClawModelsJson(
  config?: WinClawConfig,
  agentDirOverride?: string,
): Promise<{ agentDir: string; wrote: boolean }> {
  const cfg = config ?? loadConfig();
  const agentDir = agentDirOverride?.trim() ? agentDirOverride.trim() : resolveWinClawAgentDir();

  const explicitProviders = cfg.models?.providers ?? {};
  const mode = cfg.models?.mode ?? DEFAULT_MODE;

  let providers: Record<string, ProviderConfig>;
  if (mode === "replace") {
    // replace mode: only use providers explicitly defined in winclaw.json,
    // skip all implicit/auto-discovered providers (copilot, bedrock, etc.)
    providers = {};
    for (const [key, val] of Object.entries(explicitProviders)) {
      const k = key.trim();
      if (k) providers[k] = val;
    }
  } else {
    // merge mode (default): combine implicit + explicit + bedrock + copilot
    const implicitProviders = await resolveImplicitProviders({ agentDir });
    providers = mergeProviders({
      implicit: implicitProviders,
      explicit: explicitProviders,
    });
    const implicitBedrock = await resolveImplicitBedrockProvider({ agentDir, config: cfg });
    if (implicitBedrock) {
      const existing = providers["amazon-bedrock"];
      providers["amazon-bedrock"] = existing
        ? mergeProviderModels(implicitBedrock, existing)
        : implicitBedrock;
    }
    const implicitCopilot = await resolveImplicitCopilotProvider({ agentDir });
    if (implicitCopilot && !providers["github-copilot"]) {
      providers["github-copilot"] = implicitCopilot;
    }
  }

  if (Object.keys(providers).length === 0) {
    return { agentDir, wrote: false };
  }
  const targetPath = path.join(agentDir, "models.json");

  let mergedProviders = providers;
  let existingRaw = "";
  if (mode === "merge") {
    const existing = await readJson(targetPath);
    if (isRecord(existing) && isRecord(existing.providers)) {
      const existingProviders = existing.providers as Record<
        string,
        NonNullable<ModelsConfig["providers"]>[string]
      >;
      mergedProviders = { ...existingProviders, ...providers };
    }
  }

  const normalizedProviders = normalizeProviders({
    providers: mergedProviders,
    agentDir,
  });
  const next = `${JSON.stringify({ providers: normalizedProviders }, null, 2)}\n`;
  try {
    existingRaw = await fs.readFile(targetPath, "utf8");
  } catch {
    existingRaw = "";
  }

  if (existingRaw === next) {
    return { agentDir, wrote: false };
  }

  await fs.mkdir(agentDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(targetPath, next, { mode: 0o600 });
  return { agentDir, wrote: true };
}
