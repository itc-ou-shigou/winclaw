import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Read models.json and extract the set of explicitly configured model keys
 * (`provider/modelId`).  Returns `null` when models.json cannot be read or
 * parsed so callers can fall back to the full catalog.
 */
function loadConfiguredModelIds(): Set<string> | null {
  try {
    const agentDir = resolveWinClawAgentDir();
    const modelsPath = join(agentDir, "models.json");
    const raw = readFileSync(modelsPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      providers?: Record<string, { models?: Array<{ id?: string }> }>;
    };
    const ids = new Set<string>();
    const providers = parsed?.providers ?? {};
    for (const [providerId, providerConfig] of Object.entries(providers)) {
      const models = providerConfig?.models ?? [];
      for (const model of models) {
        const id = typeof model?.id === "string" ? model.id.trim() : "";
        if (id) {
          ids.add(`${providerId}/${id}`);
        }
      }
    }
    return ids.size > 0 ? ids : null;
  } catch {
    return null;
  }
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
      const { allowedCatalog } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });
      const models = allowedCatalog.length > 0 ? allowedCatalog : catalog;
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
