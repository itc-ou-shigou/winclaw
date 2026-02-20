/**
 * MCP Config Bridge
 *
 * Converts ACP McpServer definitions (from IDE) into dynamic MCP Bridge plugin
 * server configurations. This enables IDE-passed MCP servers to be available
 * to WinClaw agents through the MCP Bridge plugin.
 */
import type { McpServer } from "@agentclientprotocol/sdk";

type McpServerConfig = {
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

/**
 * Registry of dynamically added MCP server configs from IDE.
 * These are merged with plugin config at tool resolution time.
 */
const ideMcpServers: McpServerConfig[] = [];

/**
 * Get all IDE-provided MCP server configs.
 */
export function getIdeMcpServerConfigs(): McpServerConfig[] {
  return [...ideMcpServers];
}

/**
 * Clear all IDE-provided MCP server configs.
 */
export function clearIdeMcpServerConfigs(): void {
  ideMcpServers.length = 0;
}

/**
 * Convert ACP McpServer definitions to MCP Bridge server configs
 * and register them for use by the MCP Bridge plugin.
 */
export function applyIdeMcpServersToConfig(servers: McpServer[], log: (msg: string) => void): void {
  if (!servers || servers.length === 0) {
    return;
  }

  // Clear previous IDE servers to avoid duplicates on session reconnect
  ideMcpServers.length = 0;

  for (const server of servers) {
    const config = convertAcpMcpServer(server);
    if (config) {
      ideMcpServers.push(config);
      log(`registered IDE MCP server: ${config.name} (${config.transport})`);
    } else {
      log(`skipped unsupported MCP server: ${JSON.stringify(server)}`);
    }
  }

  log(`total IDE MCP servers registered: ${ideMcpServers.length}`);
}

/**
 * Convert a single ACP McpServer to MCP Bridge server config.
 */
function convertAcpMcpServer(server: McpServer): McpServerConfig | null {
  // McpServer is a discriminated union: { type: "http" } | { type: "sse" } | McpServerStdio
  // McpServerStdio has no "type" field but has "command" and "args"

  const typed = server as Record<string, unknown>;

  // Check for stdio (McpServerStdio — no type field, has command)
  if (typed.command && typeof typed.command === "string") {
    const name = (typed.name as string) || `ide-stdio-${Date.now()}`;
    const args = Array.isArray(typed.args) ? typed.args.map(String) : [];
    const env: Record<string, string> = {};
    if (Array.isArray(typed.env)) {
      for (const entry of typed.env) {
        const e = entry as { name?: string; value?: string };
        if (e.name && e.value !== undefined) {
          env[e.name] = String(e.value);
        }
      }
    }
    return {
      name: sanitizeName(name),
      transport: "stdio",
      command: typed.command as string,
      args,
      env: Object.keys(env).length > 0 ? env : undefined,
    };
  }

  // Check for SSE or HTTP
  if (typed.type === "sse" || typed.type === "http") {
    const name = (typed.name as string) || `ide-${typed.type}-${Date.now()}`;
    const url = typed.url as string | undefined;
    if (!url) {
      return null;
    }
    return {
      name: sanitizeName(name),
      transport: "sse", // Both HTTP and SSE are handled as SSE transport in MCP SDK
      url,
    };
  }

  return null;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}
