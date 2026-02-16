import type {
  AnyAgentTool,
  WinClawPluginApi,
  WinClawPluginToolFactory,
} from "../../src/plugins/types.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: WinClawPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as WinClawPluginToolFactory,
    { optional: true },
  );
}
