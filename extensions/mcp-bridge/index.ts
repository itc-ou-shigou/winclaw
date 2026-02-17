/**
 * MCP Bridge Plugin for WinClaw
 *
 * Bridges MCP (Model Context Protocol) servers into WinClaw's agent tool system.
 * Allows any MCP-compatible server to provide tools to WinClaw agents.
 *
 * Servers can be configured from two sources:
 * 1. Static config in winclaw.json (under plugins.entries.mcp-bridge.config.servers)
 * 2. Dynamic config from IDE via ACP protocol (mcpServers in newSession/loadSession)
 *
 * Configuration in winclaw.json:
 * ```json
 * {
 *   "plugins": {
 *     "entries": {
 *       "mcp-bridge": {
 *         "enabled": true,
 *         "config": {
 *           "servers": [
 *             {
 *               "name": "chrome-devtools",
 *               "transport": "stdio",
 *               "command": "npx",
 *               "args": ["-y", "@anthropic-ai/claude-code-mcp-chrome"]
 *             }
 *           ]
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
import type { WinClawPluginApi, AnyAgentTool } from "winclaw/plugin-sdk";
import { McpBridgeManager, type McpBridgeConfig, type McpServerConfig } from "./mcp-bridge-manager.js";

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

type McpBridgePluginConfig = {
  servers?: McpServerConfig[];
};

// ---------------------------------------------------------------------------
// Singleton manager (shared across tool factory invocations)
// ---------------------------------------------------------------------------

let globalManager: McpBridgeManager | null = null;
let managerInitPromise: Promise<void> | null = null;
let lastConfigHash = "";

function computeConfigHash(servers: McpServerConfig[]): string {
  return JSON.stringify(servers);
}

/**
 * Dynamically import IDE MCP server configs if available.
 * Uses dynamic import to avoid hard dependency on ACP module.
 */
async function getIdeMcpServers(): Promise<McpServerConfig[]> {
  try {
    const mod = await import("../../src/acp/mcp-config-bridge.js");
    return mod.getIdeMcpServerConfigs?.() ?? [];
  } catch {
    // ACP module not available — no IDE servers
    return [];
  }
}

function getIdeMcpServersSync(): McpServerConfig[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../../src/acp/mcp-config-bridge.js") as {
      getIdeMcpServerConfigs?: () => McpServerConfig[];
    };
    return mod.getIdeMcpServerConfigs?.() ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const mcpBridgePlugin = {
  id: "mcp-bridge",
  name: "MCP Bridge",
  description: "Bridge MCP (Model Context Protocol) servers into WinClaw agent tools",
  version: "1.0.0",

  register(api: WinClawPluginApi) {
    const pluginConfig = (api.pluginConfig ?? {}) as McpBridgePluginConfig;
    const staticServers = pluginConfig.servers ?? [];

    api.logger.info(
      `[mcp-bridge] Plugin loaded with ${staticServers.length} static server(s) configured`,
    );

    // Validate static server configs
    for (const server of staticServers) {
      if (!server.name) {
        api.logger.error("[mcp-bridge] Server config missing 'name'");
        return;
      }
      if (!server.transport) {
        api.logger.error(`[mcp-bridge] Server "${server.name}" missing 'transport'`);
        return;
      }
      if (server.transport === "stdio" && !server.command) {
        api.logger.error(`[mcp-bridge] Server "${server.name}" (stdio) missing 'command'`);
        return;
      }
      if (server.transport === "sse" && !server.url) {
        api.logger.error(`[mcp-bridge] Server "${server.name}" (sse) missing 'url'`);
        return;
      }
    }

    // Register tool factory
    // Tool factories are called lazily per agent session
    api.registerTool(
      (_ctx) => {
        // Merge static config servers with IDE-provided servers
        const ideServers = getIdeMcpServersSync();
        const allServers = mergeServerConfigs(staticServers, ideServers);

        if (allServers.length === 0) {
          return null; // No servers configured — no tools to provide
        }

        const configHash = computeConfigHash(allServers);

        // If manager is already initialized with the same config, return cached tools
        if (globalManager && lastConfigHash === configHash) {
          const tools = globalManager.getAllTools();
          if (tools.length > 0) {
            return tools;
          }
        }

        // Initialize manager if needed (first call triggers async connect)
        if (!globalManager || lastConfigHash !== configHash) {
          // Clean up previous manager if config changed
          if (globalManager) {
            globalManager.dispose().catch((err) => {
              api.logger.error(`[mcp-bridge] Dispose error: ${String(err)}`);
            });
          }

          globalManager = createManager(api);
          lastConfigHash = configHash;

          const bridgeConfig: McpBridgeConfig = { servers: allServers };

          // Start async connection — tools will be available after connect completes
          managerInitPromise = globalManager.connect(bridgeConfig).catch((err) => {
            api.logger.error(`[mcp-bridge] Connection failed: ${String(err)}`);
          });
        }

        // Return tools if already available (connect completed from a previous call)
        const currentTools = globalManager?.getAllTools() ?? [];
        if (currentTools.length > 0) {
          return currentTools;
        }

        // Tools not yet available — return a placeholder tool that waits for connection
        return [createMcpStatusTool(api)];
      },
      {
        names: staticServers.length > 0
          ? staticServers.map((s) => `mcp__${s.name.replace(/[^a-zA-Z0-9_]/g, "_")}`)
          : ["mcp__bridge_status"],
      },
    );

    // ── Chrome process protection hook ──────────────────────────────────
    // Block exec/process tool calls that would kill Chrome or launch it in
    // a way that replaces the running session (destroying all user tabs).
    // Allowed: running the safe launcher script "ensure-chrome-debug.ps1"
    // which checks for existing Chrome before acting.
    const hasChromeDevtools = staticServers.some((s) => s.name === "chrome-devtools");
    if (hasChromeDevtools) {
      api.on("before_tool_call", (event, _ctx) => {
        const tool = event.toolName;
        if (tool !== "exec" && tool !== "process") {
          return; // Not an exec/process call — allow
        }

        // Extract the command string from params
        const command = String(event.params.command ?? event.params.cmd ?? "").toLowerCase();

        // Allow the safe launcher script — it handles Chrome lifecycle safely
        if (/ensure-chrome-debug\.ps1/.test(command)) {
          return; // Safe launcher script — allow
        }

        // Patterns that KILL Chrome — always dangerous, always blocked
        const killPatterns: RegExp[] = [
          /taskkill\b.*\bchrome/,
          /stop-process\b.*\bchrome/,
          /kill\b.*\bchrome/,
          /pkill\b.*\bchrome/,
          /killall\b.*\bchrome/,
        ];

        for (const pattern of killPatterns) {
          if (pattern.test(command)) {
            api.logger.warn(
              `[mcp-bridge] BLOCKED: kill-Chrome command: "${command.slice(0, 120)}"`,
            );
            return {
              block: true,
              blockReason:
                `Command BLOCKED: "${command.slice(0, 80)}" would kill Chrome and destroy all open tabs. `
                + `NEVER kill Chrome. Use the safe launcher script instead: `
                + `exec powershell .\\scripts\\ensure-chrome-debug.ps1`,
            };
          }
        }

        // Patterns that LAUNCH Chrome directly — dangerous because it may
        // replace a running session with different flags/user-data-dir
        const launchPatterns: RegExp[] = [
          /start-process\b.*\bchrome/,
          /start\s+chrome/,
          /chrome\.exe\b.*--remote-debugging/,
        ];

        for (const pattern of launchPatterns) {
          if (pattern.test(command)) {
            api.logger.warn(
              `[mcp-bridge] BLOCKED: direct Chrome launch: "${command.slice(0, 120)}"`,
            );
            return {
              block: true,
              blockReason:
                `Command BLOCKED: "${command.slice(0, 80)}" launches Chrome directly, which may `
                + `replace the running session and destroy all open tabs. `
                + `Use the safe launcher script instead: `
                + `exec powershell .\\scripts\\ensure-chrome-debug.ps1`,
            };
          }
        }

        return; // Allow other commands
      });
      api.logger.info("[mcp-bridge] Chrome process protection hook registered");
    }

    // Register lifecycle hooks for cleanup
    api.on("gateway_stop", async () => {
      if (globalManager) {
        await globalManager.dispose();
        globalManager = null;
        managerInitPromise = null;
        lastConfigHash = "";
      }
    });

    // Register a /mcp status command
    api.registerCommand({
      name: "mcp",
      description: "Show MCP Bridge connection status",
      acceptsArgs: false,
      requireAuth: true,
      handler: (_ctx) => {
        if (!globalManager) {
          return { text: "MCP Bridge: No active connections" };
        }
        const status = globalManager.getStatus();
        if (status.length === 0) {
          return { text: "MCP Bridge: No servers configured" };
        }
        const lines = status.map(
          (s) =>
            `- ${s.name} (${s.transport}): ${s.connected ? "connected" : "disconnected"} | ${s.toolCount} tools`,
        );
        return { text: `MCP Bridge Status:\n${lines.join("\n")}` };
      },
    });
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(api: WinClawPluginApi): McpBridgeManager {
  return new McpBridgeManager({
    info: (msg) => api.logger.info(msg),
    warn: (msg) => api.logger.warn(msg),
    error: (msg) => api.logger.error(msg),
    debug: api.logger.debug ? (msg) => api.logger.debug?.(msg) : undefined,
  });
}

/**
 * Merge static (winclaw.json) and dynamic (IDE) server configs.
 * IDE servers take precedence when names conflict.
 */
function mergeServerConfigs(
  staticServers: McpServerConfig[],
  ideServers: McpServerConfig[],
): McpServerConfig[] {
  if (ideServers.length === 0) return staticServers;
  if (staticServers.length === 0) return ideServers;

  const merged = new Map<string, McpServerConfig>();
  for (const s of staticServers) {
    merged.set(s.name, s);
  }
  for (const s of ideServers) {
    merged.set(s.name, s); // IDE servers override static
  }
  return Array.from(merged.values());
}

// ---------------------------------------------------------------------------
// Status / reconnect tool (shown while MCP servers are connecting)
// ---------------------------------------------------------------------------

function createMcpStatusTool(api: WinClawPluginApi): AnyAgentTool {
  return {
    name: "mcp__bridge_status",
    label: "MCP Bridge Status",
    description:
      "Check the connection status of MCP servers. If MCP tools are not available, call this first to trigger connection. Pass reconnect=true to force reconnect.",
    parameters: {
      type: "object",
      properties: {
        reconnect: {
          type: "boolean",
          description: "Force reconnect to all MCP servers",
        },
      },
      additionalProperties: false,
    },
    execute: async (_toolCallId: string, params: unknown) => {
      const args = (params && typeof params === "object" ? params : {}) as {
        reconnect?: boolean;
      };

      // Wait for any pending init
      if (managerInitPromise) {
        await managerInitPromise;
      }

      // Reconnect if requested
      if (args.reconnect && globalManager) {
        const ideServers = getIdeMcpServersSync();
        const staticServers = (api.pluginConfig as McpBridgePluginConfig | undefined)?.servers ?? [];
        const allServers = mergeServerConfigs(staticServers, ideServers);

        await globalManager.dispose();
        globalManager = createManager(api);
        const config: McpBridgeConfig = { servers: allServers };
        managerInitPromise = globalManager.connect(config).catch((err) => {
          api.logger.error(`[mcp-bridge] Reconnection failed: ${String(err)}`);
        });
        await managerInitPromise;
        lastConfigHash = computeConfigHash(allServers);
      }

      const status = globalManager?.getStatus() ?? [];
      const allTools = globalManager?.getAllTools() ?? [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "ok",
                servers: status,
                totalTools: allTools.length,
                toolNames: allTools.map((t) => t.name),
              },
              null,
              2,
            ),
          },
        ],
        details: { servers: status, toolCount: allTools.length },
      };
    },
  };
}

export default mcpBridgePlugin;
