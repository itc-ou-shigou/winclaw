import type { GatewayBrowserClient } from "../gateway.ts";
import type { ModelsListResult, ModelCatalogEntry } from "../types.ts";

export type ModelsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  modelCatalog: ModelCatalogEntry[] | null;
  modelCatalogLoading: boolean;
};

export async function loadModelCatalog(state: ModelsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelCatalogLoading) {
    return;
  }
  state.modelCatalogLoading = true;
  try {
    const res = await state.client.request<ModelsListResult>("models.list", {});
    if (res?.models) {
      state.modelCatalog = res.models;
    }
  } catch (err) {
    console.error("[models] loadModelCatalog error:", err);
  } finally {
    state.modelCatalogLoading = false;
  }
}
