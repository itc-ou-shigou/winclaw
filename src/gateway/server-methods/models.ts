import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import type { ModelCatalogEntry } from "../../agents/model-catalog.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * When explicit model providers are configured (e.g. via GRC sync),
 * restrict the catalog to only those configured models instead of
 * exposing the entire built-in model registry.
 */
function filterByConfiguredProviders(
  catalog: ModelCatalogEntry[],
  cfg: ReturnType<typeof loadConfig>,
): ModelCatalogEntry[] {
  const providers = cfg.models?.providers;
  if (!providers || Object.keys(providers).length === 0) {
    return catalog;
  }

  // Build a set of "provider/modelId" keys from the configured providers
  const configuredKeys = new Set<string>();
  for (const [providerName, providerCfg] of Object.entries(providers)) {
    if (providerCfg?.models) {
      for (const model of providerCfg.models) {
        configuredKeys.add(`${providerName}/${model.id}`);
      }
    }
  }

  if (configuredKeys.size === 0) {
    return catalog;
  }

  // Filter catalog to only include configured models
  const filtered = catalog.filter((entry) =>
    configuredKeys.has(`${entry.provider}/${entry.id}`),
  );

  // Synthesize entries for configured models that are NOT in the built-in catalog
  // (e.g. custom providers like GLM added via GRC key distribution).
  // This ensures ALL configured models appear in the UI, not just those that
  // happen to match a built-in catalog entry.
  const filteredKeys = new Set(filtered.map((e) => `${e.provider}/${e.id}`));
  for (const [providerName, providerCfg] of Object.entries(providers)) {
    if (providerCfg?.models) {
      for (const model of providerCfg.models) {
        const key = `${providerName}/${model.id}`;
        if (!filteredKeys.has(key)) {
          filtered.push({
            id: model.id,
            name: model.name || model.id,
            provider: providerName,
          });
        }
      }
    }
  }

  return filtered;
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const catalog = await context.loadGatewayModelCatalog();
      const cfg = loadConfig();
      const { allowedCatalog, allowAny } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });

      let models: ModelCatalogEntry[];
      if (!allowAny && allowedCatalog.length > 0) {
        // Explicit allowlist via agents.defaults.models — use it directly
        models = allowedCatalog;
      } else {
        // No explicit allowlist; fall back to filtering by configured providers
        models = filterByConfiguredProviders(catalog, cfg);
      }

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
