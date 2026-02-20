/**
 * MCP Bridge Manager
 *
 * Manages MCP server connections and converts MCP tools to WinClaw AgentTool format.
 * Supports stdio and SSE transports with automatic reconnection and lifecycle management.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AnyAgentTool } from "../../src/agents/tools/common.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpTransportType = "stdio" | "sse";

export type McpServerConfig = {
  /** Unique server name used for tool namespacing (e.g. "chrome-devtools") */
  name: string;
  /** Transport type */
  transport: McpTransportType;
  /** For stdio: command to execute */
  command?: string;
  /** For stdio: command arguments */
  args?: string[];
  /** For stdio: environment variables */
  env?: Record<string, string>;
  /** For sse: server URL */
  url?: string;
  /** Connection timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Whether to automatically reconnect on failure */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 3) */
  maxReconnectAttempts?: number;
  /**
   * Tool names to block from being called by the agent.
   * These tools will still appear in the tool list (so the model knows they exist)
   * but calling them will return an error message instead of executing.
   */
  blockedTools?: string[];
};

export type McpBridgeConfig = {
  servers: McpServerConfig[];
};

type McpServerInstance = {
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
  connected: boolean;
  tools: AnyAgentTool[];
  reconnectAttempts: number;
};

export type McpBridgeLogger = {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

// ---------------------------------------------------------------------------
// Tool name helpers
// ---------------------------------------------------------------------------

const MCP_TOOL_PREFIX = "mcp__";

function buildMcpToolName(serverName: string, toolName: string): string {
  // Sanitize: replace non-alphanumeric with underscore, collapse consecutive underscores
  const safeName = serverName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
  const safeToolName = toolName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
  return `${MCP_TOOL_PREFIX}${safeName}__${safeToolName}`;
}

// ---------------------------------------------------------------------------
// JSON Schema → parameters conversion
// ---------------------------------------------------------------------------

function mcpInputSchemaToParameters(
  inputSchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!inputSchema) {
    return {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
  }
  // MCP tools use standard JSON Schema for input_schema
  // Ensure it has the required "type": "object" for LLM compatibility
  const schema = { ...inputSchema };
  if (!schema.type) {
    schema.type = "object";
  }
  return schema;
}

// ---------------------------------------------------------------------------
// Default blocked tools per server
// These tools are blocked by default to prevent destructive actions.
// Users can override by setting blockedTools explicitly in server config.
// ---------------------------------------------------------------------------

const DEFAULT_BLOCKED_TOOLS: Record<string, string[]> = {
  // chrome-devtools: prevent agent from closing user's browser tabs
  "chrome-devtools": ["close_page"],
};

// ---------------------------------------------------------------------------
// MCP Bridge Manager class
// ---------------------------------------------------------------------------

export class McpBridgeManager {
  private servers = new Map<string, McpServerInstance>();
  private logger: McpBridgeLogger;
  private disposed = false;

  constructor(logger: McpBridgeLogger) {
    this.logger = logger;
  }

  /**
   * Connect to all configured MCP servers and discover their tools.
   */
  async connect(config: McpBridgeConfig): Promise<void> {
    if (this.disposed) {
      throw new Error("McpBridgeManager has been disposed");
    }

    const connectionPromises = config.servers.map((serverConfig) =>
      this.connectServer(serverConfig).catch((err) => {
        this.logger.error(
          `[mcp-bridge] Failed to connect to server "${serverConfig.name}": ${String(err)}`,
        );
      }),
    );

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Connect to a single MCP server.
   */
  private async connectServer(config: McpServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      this.logger.warn(`[mcp-bridge] Server "${config.name}" already connected, skipping`);
      return;
    }

    const timeoutMs = config.timeoutMs ?? 30_000;

    this.logger.info(
      `[mcp-bridge] Connecting to MCP server "${config.name}" (${config.transport})...`,
    );

    const client = new Client(
      { name: `winclaw-mcp-bridge/${config.name}`, version: "1.0.0" },
      { capabilities: {} },
    );

    let transport: StdioClientTransport | SSEClientTransport;

    if (config.transport === "stdio") {
      if (!config.command) {
        throw new Error(`Server "${config.name}": stdio transport requires "command"`);
      }
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env ? ({ ...process.env, ...config.env } as Record<string, string>) : undefined,
      });
    } else if (config.transport === "sse") {
      if (!config.url) {
        throw new Error(`Server "${config.name}": sse transport requires "url"`);
      }
      transport = new SSEClientTransport(new URL(config.url));
    } else {
      throw new Error(`Server "${config.name}": unsupported transport "${config.transport}"`);
    }

    // Set up error handler for stdio transport child process
    if (transport instanceof StdioClientTransport) {
      transport.onerror = (err) => {
        this.logger.error(`[mcp-bridge] Transport error for "${config.name}": ${String(err)}`);
        this.handleDisconnect(config.name);
      };
    }

    // Connect with timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timeout (${timeoutMs}ms)`)), timeoutMs),
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // Discover tools (pass config for blocked-tool resolution)
    const tools = await this.discoverTools(config, client);

    const instance: McpServerInstance = {
      config,
      client,
      transport,
      connected: true,
      tools,
      reconnectAttempts: 0,
    };

    this.servers.set(config.name, instance);

    this.logger.info(
      `[mcp-bridge] Connected to "${config.name}" - discovered ${tools.length} tool(s)`,
    );
  }

  /**
   * Discover and convert MCP tools from a connected server.
   */
  private async discoverTools(config: McpServerConfig, client: Client): Promise<AnyAgentTool[]> {
    const response = await client.listTools();
    if (!response?.tools || !Array.isArray(response.tools)) {
      return [];
    }

    const tools: AnyAgentTool[] = [];

    for (const mcpTool of response.tools) {
      const agentTool = this.convertMcpTool(config, client, mcpTool);
      if (agentTool) {
        tools.push(agentTool);
      }
    }

    return tools;
  }

  /**
   * Resolve the blocked tool list for a server.
   * Uses explicit config if provided, otherwise falls back to defaults.
   */
  private getBlockedTools(config: McpServerConfig): Set<string> {
    if (config.blockedTools !== undefined) {
      // Explicit config overrides defaults (empty array = no blocks)
      return new Set(config.blockedTools);
    }
    // Fall back to defaults for known servers
    const defaults = DEFAULT_BLOCKED_TOOLS[config.name];
    return defaults ? new Set(defaults) : new Set();
  }

  /**
   * Convert a single MCP tool definition to WinClaw AgentTool format.
   */
  private convertMcpTool(
    config: McpServerConfig,
    client: Client,
    mcpTool: { name: string; description?: string; inputSchema?: Record<string, unknown> },
  ): AnyAgentTool | null {
    const serverName = config.name;
    const toolName = buildMcpToolName(serverName, mcpTool.name);
    const originalName = mcpTool.name;
    const logger = this.logger;

    // Resolve blocked tool list for this server
    const blockedTools = this.getBlockedTools(config);
    const isBlocked = blockedTools.has(originalName);

    // Append safety notice to description for blocked tools
    const description = isBlocked
      ? `${mcpTool.description ?? `MCP tool from ${serverName}`} [BLOCKED: This tool is disabled for safety. Do NOT attempt to call it.]`
      : (mcpTool.description ?? `MCP tool from ${serverName}`);

    return {
      name: toolName,
      label: `MCP: ${serverName}/${originalName}`,
      description,
      parameters: mcpInputSchemaToParameters(mcpTool.inputSchema),
      execute: async (
        _toolCallId: string,
        params: unknown,
        _signal?: AbortSignal,
        _onUpdate?: unknown,
      ) => {
        // ── Blocked tool guard ──────────────────────────────────────
        if (isBlocked) {
          logger.warn(
            `[mcp-bridge] BLOCKED tool call: "${toolName}" — this tool is restricted for safety`,
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "error",
                  tool: toolName,
                  error:
                    `Tool "${originalName}" is blocked for safety. ` +
                    `You must NOT close browser tabs/pages. ` +
                    `Use "new_page" to create new tabs instead.`,
                  blocked: true,
                }),
              },
            ],
            details: { error: "tool_blocked", blocked: true },
          };
        }

        const server = this.servers.get(serverName);
        if (!server?.connected) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "error",
                  error: `MCP server "${serverName}" is not connected`,
                }),
              },
            ],
            details: { error: "server_disconnected" },
          };
        }

        try {
          const result = await client.callTool({
            name: originalName,
            arguments: (params && typeof params === "object" ? params : {}) as Record<
              string,
              unknown
            >,
          });

          // Convert MCP tool result to AgentToolResult
          return this.convertMcpResult(result);
        } catch (err) {
          logger.error(`[mcp-bridge] Tool "${toolName}" execution failed: ${String(err)}`);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "error",
                  tool: toolName,
                  error: String(err),
                }),
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    };
  }

  /**
   * Convert MCP tool result to AgentToolResult format.
   * Returns content typed as (TextContent | ImageContent)[].
   */
  private convertMcpResult(result: unknown): {
    content: Array<
      { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
    >;
    details: unknown;
  } {
    type TextItem = { type: "text"; text: string };
    type ImageItem = { type: "image"; data: string; mimeType: string };
    type ContentItem = TextItem | ImageItem;

    if (!result || typeof result !== "object") {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        details: result,
      };
    }

    const mcpResult = result as {
      content?: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
        [key: string]: unknown;
      }>;
      isError?: boolean;
      [key: string]: unknown;
    };

    if (!mcpResult.content || !Array.isArray(mcpResult.content)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        details: result,
      };
    }

    const content: ContentItem[] = [];

    for (const item of mcpResult.content) {
      if (item.type === "text" && typeof item.text === "string") {
        content.push({ type: "text" as const, text: item.text });
      } else if (item.type === "image" && typeof item.data === "string") {
        content.push({
          type: "image" as const,
          data: item.data,
          mimeType: item.mimeType ?? "image/png",
        });
      } else if (item.type === "resource") {
        // Flatten resource content to text
        const resourceText = typeof item.text === "string" ? item.text : JSON.stringify(item);
        content.push({ type: "text" as const, text: resourceText });
      } else {
        // Fallback: serialize unknown content types
        content.push({ type: "text" as const, text: JSON.stringify(item) });
      }
    }

    if (content.length === 0) {
      content.push({ type: "text" as const, text: JSON.stringify(result) });
    }

    return {
      content,
      details: {
        mcpResult: result,
        isError: mcpResult.isError === true,
      },
    };
  }

  /**
   * Handle server disconnection.
   */
  private handleDisconnect(serverName: string): void {
    const instance = this.servers.get(serverName);
    if (!instance) return;

    instance.connected = false;
    this.logger.warn(`[mcp-bridge] Server "${serverName}" disconnected`);

    if (instance.config.autoReconnect !== false) {
      const maxAttempts = instance.config.maxReconnectAttempts ?? 3;
      if (instance.reconnectAttempts < maxAttempts) {
        instance.reconnectAttempts += 1;
        const delay = Math.min(1000 * Math.pow(2, instance.reconnectAttempts), 30_000);
        this.logger.info(
          `[mcp-bridge] Reconnecting to "${serverName}" in ${delay}ms (attempt ${instance.reconnectAttempts}/${maxAttempts})`,
        );
        setTimeout(() => {
          this.reconnectServer(serverName).catch((err) => {
            this.logger.error(
              `[mcp-bridge] Reconnection failed for "${serverName}": ${String(err)}`,
            );
          });
        }, delay);
      } else {
        this.logger.error(`[mcp-bridge] Max reconnection attempts reached for "${serverName}"`);
      }
    }
  }

  /**
   * Attempt to reconnect to a server.
   */
  private async reconnectServer(serverName: string): Promise<void> {
    const instance = this.servers.get(serverName);
    if (!instance || this.disposed) return;

    // Clean up old connection
    try {
      await instance.client.close();
    } catch {
      // ignore cleanup errors
    }

    this.servers.delete(serverName);

    // Reconnect
    await this.connectServer(instance.config);
  }

  /**
   * Get all tools from all connected MCP servers.
   */
  getAllTools(): AnyAgentTool[] {
    const tools: AnyAgentTool[] = [];
    for (const instance of this.servers.values()) {
      if (instance.connected) {
        tools.push(...instance.tools);
      }
    }
    return tools;
  }

  /**
   * Get tools from a specific server.
   */
  getServerTools(serverName: string): AnyAgentTool[] {
    const instance = this.servers.get(serverName);
    if (!instance?.connected) return [];
    return [...instance.tools];
  }

  /**
   * Get connection status for all servers.
   */
  getStatus(): Array<{
    name: string;
    transport: McpTransportType;
    connected: boolean;
    toolCount: number;
    reconnectAttempts: number;
  }> {
    const status: Array<{
      name: string;
      transport: McpTransportType;
      connected: boolean;
      toolCount: number;
      reconnectAttempts: number;
    }> = [];
    for (const instance of this.servers.values()) {
      status.push({
        name: instance.config.name,
        transport: instance.config.transport,
        connected: instance.connected,
        toolCount: instance.tools.length,
        reconnectAttempts: instance.reconnectAttempts,
      });
    }
    return status;
  }

  /**
   * Disconnect from all servers and clean up resources.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    const closePromises: Promise<void>[] = [];

    for (const [name, instance] of this.servers) {
      this.logger.info(`[mcp-bridge] Disconnecting from "${name}"...`);
      closePromises.push(
        instance.client.close().catch((err) => {
          this.logger.error(`[mcp-bridge] Error closing "${name}": ${String(err)}`);
        }),
      );
    }

    await Promise.allSettled(closePromises);
    this.servers.clear();
    this.logger.info("[mcp-bridge] All MCP servers disconnected");
  }
}
