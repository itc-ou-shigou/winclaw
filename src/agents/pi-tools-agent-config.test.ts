import { describe, expect, it } from "vitest";
import "./test-helpers/fast-coding-tools.js";
import type { WinClawConfig } from "../config/config.js";
import type { SandboxDockerConfig } from "./sandbox.js";
import { createWinClawCodingTools } from "./pi-tools.js";

describe("Agent-specific tool filtering", () => {
  it("should apply global tool policy when no agent-specific policy exists", () => {
    const cfg: WinClawConfig = {
      tools: {
        allow: ["read", "write"],
        deny: ["bash"],
      },
      agents: {
        list: [
          {
            id: "main",
            workspace: "~/winclaw",
          },
        ],
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test",
      agentDir: "/tmp/agent",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read");
    expect(toolNames).toContain("write");
    expect(toolNames).not.toContain("exec");
    expect(toolNames).not.toContain("apply_patch");
  });

  it("should keep global tool policy when agent only sets tools.elevated", () => {
    const cfg: WinClawConfig = {
      tools: {
        deny: ["write"],
      },
      agents: {
        list: [
          {
            id: "main",
            workspace: "~/winclaw",
            tools: {
              elevated: {
                enabled: true,
                allowFrom: { whatsapp: ["+15555550123"] },
              },
            },
          },
        ],
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test",
      agentDir: "/tmp/agent",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("exec");
    expect(toolNames).toContain("read");
    expect(toolNames).not.toContain("write");
    expect(toolNames).not.toContain("apply_patch");
  });

  it("should allow apply_patch when exec is allow-listed and applyPatch is enabled", () => {
    const cfg: WinClawConfig = {
      tools: {
        allow: ["read", "exec"],
        exec: {
          applyPatch: { enabled: true },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test",
      agentDir: "/tmp/agent",
      modelProvider: "openai",
      modelId: "gpt-5.2",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read");
    expect(toolNames).toContain("exec");
    expect(toolNames).toContain("apply_patch");
  });

  it("should apply agent-specific tool policy", () => {
    const cfg: WinClawConfig = {
      tools: {
        allow: ["read", "write", "exec"],
        deny: [],
      },
      agents: {
        list: [
          {
            id: "restricted",
            workspace: "~/winclaw-restricted",
            tools: {
              allow: ["read"], // Agent override: only read
              deny: ["exec", "write", "edit"],
            },
          },
        ],
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:restricted:main",
      workspaceDir: "/tmp/test-restricted",
      agentDir: "/tmp/agent-restricted",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read");
    expect(toolNames).not.toContain("exec");
    expect(toolNames).not.toContain("write");
    expect(toolNames).not.toContain("apply_patch");
    expect(toolNames).not.toContain("edit");
  });

  it("should apply provider-specific tool policy", () => {
    const cfg: WinClawConfig = {
      tools: {
        allow: ["read", "write", "exec"],
        byProvider: {
          "google-antigravity": {
            allow: ["read"],
          },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test-provider",
      agentDir: "/tmp/agent-provider",
      modelProvider: "google-antigravity",
      modelId: "claude-opus-4-6-thinking",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("read");
    expect(toolNames).not.toContain("exec");
    expect(toolNames).not.toContain("write");
    expect(toolNames).not.toContain("apply_patch");
  });

  it("should apply provider-specific tool profile overrides", () => {
    const cfg: WinClawConfig = {
      tools: {
        profile: "coding",
        byProvider: {
          "google-antigravity": {
            profile: "minimal",
          },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test-provider-profile",
      agentDir: "/tmp/agent-provider-profile",
      modelProvider: "google-antigravity",
      modelId: "claude-opus-4-6-thinking",
    });

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toEqual(["session_status"]);
  });

  it("should allow different tool policies for different agents", () => {
    const cfg: WinClawConfig = {
      agents: {
        list: [
          {
            id: "main",
            workspace: "~/winclaw",
            // No tools restriction - all tools available
          },
          {
            id: "family",
            workspace: "~/winclaw-family",
            tools: {
              allow: ["read"],
              deny: ["exec", "write", "edit", "process"],
            },
          },
        ],
      },
    };

    // main agent: all tools
    const mainTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test-main",
      agentDir: "/tmp/agent-main",
    });
    const mainToolNames = mainTools.map((t) => t.name);
    expect(mainToolNames).toContain("exec");
    expect(mainToolNames).toContain("write");
    expect(mainToolNames).toContain("edit");
    expect(mainToolNames).not.toContain("apply_patch");

    // family agent: restricted
    const familyTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:family:whatsapp:group:123",
      workspaceDir: "/tmp/test-family",
      agentDir: "/tmp/agent-family",
    });
    const familyToolNames = familyTools.map((t) => t.name);
    expect(familyToolNames).toContain("read");
    expect(familyToolNames).not.toContain("exec");
    expect(familyToolNames).not.toContain("write");
    expect(familyToolNames).not.toContain("edit");
    expect(familyToolNames).not.toContain("apply_patch");
  });

  it("should apply group tool policy overrides (group-specific beats wildcard)", () => {
    const cfg: WinClawConfig = {
      channels: {
        whatsapp: {
          groups: {
            "*": {
              tools: { allow: ["read"] },
            },
            trusted: {
              tools: { allow: ["read", "exec"] },
            },
          },
        },
      },
    };

    const trustedTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:whatsapp:group:trusted",
      messageProvider: "whatsapp",
      workspaceDir: "/tmp/test-group-trusted",
      agentDir: "/tmp/agent-group",
    });
    const trustedNames = trustedTools.map((t) => t.name);
    expect(trustedNames).toContain("read");
    expect(trustedNames).toContain("exec");

    const defaultTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:whatsapp:group:unknown",
      messageProvider: "whatsapp",
      workspaceDir: "/tmp/test-group-default",
      agentDir: "/tmp/agent-group",
    });
    const defaultNames = defaultTools.map((t) => t.name);
    expect(defaultNames).toContain("read");
    expect(defaultNames).not.toContain("exec");
  });

  it("should apply per-sender tool policies for group tools", () => {
    const cfg: WinClawConfig = {
      channels: {
        whatsapp: {
          groups: {
            "*": {
              tools: { allow: ["read"] },
              toolsBySender: {
                alice: { allow: ["read", "exec"] },
              },
            },
          },
        },
      },
    };

    const aliceTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:whatsapp:group:family",
      senderId: "alice",
      workspaceDir: "/tmp/test-group-sender",
      agentDir: "/tmp/agent-group-sender",
    });
    const aliceNames = aliceTools.map((t) => t.name);
    expect(aliceNames).toContain("read");
    expect(aliceNames).toContain("exec");

    const bobTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:whatsapp:group:family",
      senderId: "bob",
      workspaceDir: "/tmp/test-group-sender-bob",
      agentDir: "/tmp/agent-group-sender",
    });
    const bobNames = bobTools.map((t) => t.name);
    expect(bobNames).toContain("read");
    expect(bobNames).not.toContain("exec");
  });

  it("should not let default sender policy override group tools", () => {
    const cfg: WinClawConfig = {
      channels: {
        whatsapp: {
          groups: {
            "*": {
              toolsBySender: {
                admin: { allow: ["read", "exec"] },
              },
            },
            locked: {
              tools: { allow: ["read"] },
            },
          },
        },
      },
    };

    const adminTools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:whatsapp:group:locked",
      senderId: "admin",
      workspaceDir: "/tmp/test-group-default-override",
      agentDir: "/tmp/agent-group-default-override",
    });
    const adminNames = adminTools.map((t) => t.name);
    expect(adminNames).toContain("read");
    expect(adminNames).not.toContain("exec");
  });

  it("should resolve telegram group tool policy for topic session keys", () => {
    const cfg: WinClawConfig = {
      channels: {
        telegram: {
          groups: {
            "123": {
              tools: { allow: ["read"] },
            },
          },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:telegram:group:123:topic:456",
      messageProvider: "telegram",
      workspaceDir: "/tmp/test-telegram-topic",
      agentDir: "/tmp/agent-telegram",
    });
    const names = tools.map((t) => t.name);
    expect(names).toContain("read");
    expect(names).not.toContain("exec");
  });

  it("should inherit group tool policy for subagents from spawnedBy session keys", () => {
    const cfg: WinClawConfig = {
      channels: {
        whatsapp: {
          groups: {
            trusted: {
              tools: { allow: ["read"] },
            },
          },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:subagent:test",
      spawnedBy: "agent:main:whatsapp:group:trusted",
      workspaceDir: "/tmp/test-subagent-group",
      agentDir: "/tmp/agent-subagent",
    });
    const names = tools.map((t) => t.name);
    expect(names).toContain("read");
    expect(names).not.toContain("exec");
  });

  it("should apply global tool policy before agent-specific policy", () => {
    const cfg: WinClawConfig = {
      tools: {
        deny: ["browser"], // Global deny
      },
      agents: {
        list: [
          {
            id: "work",
            workspace: "~/winclaw-work",
            tools: {
              deny: ["exec", "process"], // Agent deny (override)
            },
          },
        ],
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:work:slack:dm:user123",
      workspaceDir: "/tmp/test-work",
      agentDir: "/tmp/agent-work",
    });

    const toolNames = tools.map((t) => t.name);
    // Global policy still applies; agent policy further restricts
    expect(toolNames).not.toContain("browser");
    expect(toolNames).not.toContain("exec");
    expect(toolNames).not.toContain("process");
    expect(toolNames).not.toContain("apply_patch");
  });

  it("should work with sandbox tools filtering", () => {
    const cfg: WinClawConfig = {
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "agent",
          },
        },
        list: [
          {
            id: "restricted",
            workspace: "~/winclaw-restricted",
            sandbox: {
              mode: "all",
              scope: "agent",
            },
            tools: {
              allow: ["read"], // Agent further restricts to only read
              deny: ["exec", "write"],
            },
          },
        ],
      },
      tools: {
        sandbox: {
          tools: {
            allow: ["read", "write", "exec"], // Sandbox allows these
            deny: [],
          },
        },
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:restricted:main",
      workspaceDir: "/tmp/test-restricted",
      agentDir: "/tmp/agent-restricted",
      sandbox: {
        enabled: true,
        sessionKey: "agent:restricted:main",
        workspaceDir: "/tmp/sandbox",
        agentWorkspaceDir: "/tmp/test-restricted",
        workspaceAccess: "none",
        containerName: "test-container",
        containerWorkdir: "/workspace",
        docker: {
          image: "test-image",
          containerPrefix: "test-",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: [],
          network: "none",
          capDrop: [],
        } satisfies SandboxDockerConfig,
        tools: {
          allow: ["read", "write", "exec"],
          deny: [],
        },
        browserAllowHostControl: false,
      },
    });

    const toolNames = tools.map((t) => t.name);
    // Agent policy should be applied first, then sandbox
    // Agent allows only "read", sandbox allows ["read", "write", "exec"]
    // Result: only "read" (most restrictive wins)
    expect(toolNames).toContain("read");
    expect(toolNames).not.toContain("exec");
    expect(toolNames).not.toContain("write");
  });

  it("should run exec synchronously when process is denied", async () => {
    const cfg: WinClawConfig = {
      tools: {
        deny: ["process"],
      },
    };

    const tools = createWinClawCodingTools({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir: "/tmp/test-main",
      agentDir: "/tmp/agent-main",
    });
    const execTool = tools.find((tool) => tool.name === "exec");
    expect(execTool).toBeDefined();

    const result = await execTool?.execute("call1", {
      command: "echo done",
      yieldMs: 10,
    });

    expect(result?.details.status).toBe("completed");
  });
});
