import type { WinClawConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: WinClawConfig, pluginId: string): WinClawConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}
