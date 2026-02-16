import type { WinClawPluginApi } from "winclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "winclaw/plugin-sdk";
import { createDiagnosticsOtelService } from "./src/service.js";

const plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: emptyPluginConfigSchema(),
  register(api: WinClawPluginApi) {
    api.registerService(createDiagnosticsOtelService());
  },
};

export default plugin;
