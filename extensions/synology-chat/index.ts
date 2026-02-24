import type { WinClawPluginApi } from "winclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "winclaw/plugin-sdk";
import { createSynologyChatPlugin } from "./src/channel.js";
import { setSynologyRuntime } from "./src/runtime.js";

const plugin = {
  id: "synology-chat",
  name: "Synology Chat",
  description: "Native Synology Chat channel plugin for WinClaw",
  configSchema: emptyPluginConfigSchema(),
  register(api: WinClawPluginApi) {
    setSynologyRuntime(api.runtime);
    api.registerChannel({ plugin: createSynologyChatPlugin() });
  },
};

export default plugin;
