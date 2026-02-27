/**
 * MCP Bridge Plugin for WinClaw
 *
 * Bridges MCP (Model Context Protocol) servers into WinClaw's agent tool system.
 * Allows any MCP-compatible server to provide tools to WinClaw agents.
 *
 * Servers can be configured from three sources:
 * 1. Static config in winclaw.json (under plugins.entries.mcp-bridge.config.servers)
 * 2. Dynamic config from IDE via ACP protocol (mcpServers in newSession/loadSession)
 * 3. Plugin .mcp.json files (auto-discovered from plugin directories)
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
import fs from "node:fs";
import path from "node:path";
import type { WinClawPluginApi, AnyAgentTool } from "winclaw/plugin-sdk";
import {
  McpBridgeManager,
  type McpBridgeConfig,
  type McpServerConfig,
} from "./mcp-bridge-manager.js";

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

type McpBridgePluginConfig = {
  servers?: McpServerConfig[];
  /** Disable auto-discovery of .mcp.json from plugin directories */
  disablePluginDiscovery?: boolean;
};

// ---------------------------------------------------------------------------
// Plugin .mcp.json discovery
// ---------------------------------------------------------------------------

type PluginMcpConfig = {
  mcpServers?: Record<string, PluginMcpServerConfig>;
};

type PluginMcpServerConfig = {
  type?: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  timeoutMs?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  blockedTools?: string[];
};

/**
 * Expand environment variables in a string.
 * Supports ${VAR} and $VAR syntax.
 */
function expandEnvVars(value: string, env: Record<string, string> = process.env): string {
  return value
    .replace(/\$\{([^}]+)\}/g, (_, key) => env[key] ?? "")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => env[key] ?? "");
}

/**
 * Recursively expand environment variables in an object.
 */
function expandEnvVarsInObject<T>(obj: T, env: Record<string, string> = process.env): T {
  if (typeof obj === "string") {
    return expandEnvVars(obj, env) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, env)) as T;
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value, env);
    }
    return result as T;
  }
  return obj;
}

/**
 * Convert a plugin .mcp.json server config to McpServerConfig format.
 */
function convertPluginMcpServer(
  name: string,
  config: PluginMcpServerConfig,
): McpServerConfig | null {
  // Determine transport type
  let transport: "stdio" | "sse";
  if (config.type === "sse" || config.type === "http") {
    transport = "sse";
  } else if (config.type === "stdio" || config.command) {
    transport = "stdio";
  } else if (config.url) {
    transport = "sse";
  } else {
    return null; // Invalid config - no transport determined
  }

  // Validate required fields
  if (transport === "stdio" && !config.command) {
    return null;
  }
  if (transport === "sse" && !config.url) {
    return null;
  }

  // Expand env vars in all string fields
  const expanded = expandEnvVarsInObject(config);

  return {
    name,
    transport,
    command: expanded.command,
    args: expanded.args,
    env: expanded.env,
    url: expanded.url,
    timeoutMs: expanded.timeoutMs,
    autoReconnect: expanded.autoReconnect,
    maxReconnectAttempts: expanded.maxReconnectAttempts,
    blockedTools: expanded.blockedTools,
  };
}

/**
 * Discover and load .mcp.json files from plugin directories.
 */
function discoverPluginMcpConfigs(params: {
  config: WinClawPluginApi["config"];
  logger: WinClawPluginApi["logger"];
}): McpServerConfig[] {
  const { config, logger } = params;
  const servers: McpServerConfig[] = [];

  // Collect plugin paths from config
  const pluginPaths: string[] = [];

  // From plugins.load.paths
  const loadPaths = config.plugins?.load?.paths;
  if (Array.isArray(loadPaths)) {
    pluginPaths.push(...loadPaths);
  }

  // From plugins.entries (get source dirs for enabled plugins)
  const entries = config.plugins?.entries;
  if (entries && typeof entries === "object") {
    for (const entry of Object.values(entries)) {
      if (entry && typeof entry === "object" && "sourcePath" in entry) {
        const sourcePath = (entry as { sourcePath?: string }).sourcePath;
        if (sourcePath && typeof sourcePath === "string") {
          pluginPaths.push(sourcePath);
        }
      }
    }
  }

  // Deduplicate paths
  const seenPaths = new Set<string>();

  for (const pluginPath of pluginPaths) {
    let resolvedPath: string;
    try {
      // Handle relative paths
      if (path.isAbsolute(pluginPath)) {
        resolvedPath = pluginPath;
      } else {
        // Assume relative to workspace or cwd
        resolvedPath = path.resolve(process.cwd(), pluginPath);
      }

      // If path points to a file, use its directory
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        resolvedPath = path.dirname(resolvedPath);
      }

      // Normalize to avoid duplicates
      const normalized = path.normalize(resolvedPath);
      if (seenPaths.has(normalized)) {
        continue;
      }
      seenPaths.add(normalized);

      // Look for .mcp.json in the plugin directory
      const mcpJsonPath = path.join(normalized, ".mcp.json");
      if (!fs.existsSync(mcpJsonPath)) {
        continue;
      }

      // Read and parse .mcp.json
      const content = fs.readFileSync(mcpJsonPath, "utf-8");
      let mcpConfig: PluginMcpConfig;
      try {
        mcpConfig = JSON.parse(content) as PluginMcpConfig;
      } catch (parseErr) {
        logger.warn(`[mcp-bridge] Failed to parse ${mcpJsonPath}: ${String(parseErr)}`);
        continue;
      }

      // Convert servers
      const mcpServers = mcpConfig.mcpServers;
      if (!mcpServers || typeof mcpServers !== "object") {
        continue;
      }

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const converted = convertPluginMcpServer(name, serverConfig as PluginMcpServerConfig);
        if (converted) {
          servers.push(converted);
          logger.info(`[mcp-bridge] Discovered MCP server "${name}" from ${mcpJsonPath}`);
        } else {
          logger.warn(
            `[mcp-bridge] Invalid MCP server config "${name}" in ${mcpJsonPath}: missing required fields`,
          );
        }
      }
    } catch (err) {
      // Path resolution or access error - skip silently
      logger.debug?.(`[mcp-bridge] Error scanning ${pluginPath}: ${String(err)}`);
    }
  }

  return servers;
}

// ---------------------------------------------------------------------------
// Singleton manager (shared across tool factory invocations)
// ---------------------------------------------------------------------------

let globalManager: McpBridgeManager | null = null;
let managerInitPromise: Promise<void> | null = null;
let lastConfigHash = "";
let cachedDiscoveredServers: McpServerConfig[] = [];

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

    // Discover MCP servers from plugin .mcp.json files
    let discoveredServers: McpServerConfig[] = [];
    if (!pluginConfig.disablePluginDiscovery) {
      discoveredServers = discoverPluginMcpConfigs({
        config: api.config,
        logger: api.logger,
      });
    }
    // Cache for use in status tool reconnection logic
    cachedDiscoveredServers = discoveredServers;

    const totalStatic = staticServers.length;
    const totalDiscovered = discoveredServers.length;
    api.logger.info(
      `[mcp-bridge] Plugin loaded with ${totalStatic} static server(s)` +
        (totalDiscovered > 0 ? `, ${totalDiscovered} discovered from plugins` : ""),
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
        // Merge static config servers with discovered plugin servers and IDE-provided servers
        // Priority (highest to lowest): IDE > static config > discovered
        const ideServers = getIdeMcpServersSync();
        const allServers = mergeServerConfigs(
          mergeServerConfigs(discoveredServers, staticServers),
          ideServers,
        );

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
        names:
          staticServers.length > 0 || discoveredServers.length > 0
            ? [...staticServers, ...discoveredServers].map(
                (s) => `mcp__${s.name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
              )
            : ["mcp__bridge_status"],
      },
    );

    // ── Chrome process protection hook ──────────────────────────────────
    // Block exec/process tool calls that would kill Chrome or launch it in
    // a way that replaces the running session (destroying all user tabs).
    // Allowed: running the safe launcher script "ensure-chrome-debug.ps1"
    // which checks for existing Chrome before acting.
    const allKnownServers = [...staticServers, ...discoveredServers];
    const hasChromeDevtools = allKnownServers.some((s) => s.name === "chrome-devtools");
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
                `Command BLOCKED: "${command.slice(0, 80)}" would kill Chrome and destroy all open tabs. ` +
                `NEVER kill Chrome. Use the safe launcher script instead: ` +
                `exec powershell .\\scripts\\ensure-chrome-debug.ps1`,
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
                `Command BLOCKED: "${command.slice(0, 80)}" launches Chrome directly, which may ` +
                `replace the running session and destroy all open tabs. ` +
                `Use the safe launcher script instead: ` +
                `exec powershell .\\scripts\\ensure-chrome-debug.ps1`,
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
        const staticServers =
          (api.pluginConfig as McpBridgePluginConfig | undefined)?.servers ?? [];
        // Include discovered plugin servers (cached from plugin load)
        const allServers = mergeServerConfigs(
          mergeServerConfigs(cachedDiscoveredServers, staticServers),
          ideServers,
        );

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
