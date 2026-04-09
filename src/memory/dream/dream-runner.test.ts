import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { WinClawConfig } from "../../config/types.winclaw.js";
import {
  executeDream,
  __resetDreamRunnerState,
  type DreamAgentRunner,
} from "./dream-runner.js";
import { readLastDreamedAt, dreamLockPath } from "./dream-lock.js";
import { resetDreamTasks } from "./dream-task.js";

async function mkScratch() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dream-runner-"));
  const workspaceDir = path.join(root, "workspace");
  const memoryDir = path.join(workspaceDir, "memory");
  await fs.mkdir(memoryDir, { recursive: true });
  return { root, workspaceDir, memoryDir };
}

function cfgWith(dream: Record<string, unknown>): WinClawConfig {
  return {
    memory: { dream },
  } as unknown as WinClawConfig;
}

function okRunner(overrides: Partial<Awaited<ReturnType<DreamAgentRunner>>> = {}): DreamAgentRunner {
  return async (input) => {
    input.onPhase("orient");
    input.onPhase("consolidate");
    input.onFileTouched(path.join(input.memoryDir, "topic.md"));
    return {
      filesTouched: [path.join(input.memoryDir, "topic.md")],
      finalText: "<dream-report>merged: 1</dream-report>",
      tokensIn: 10,
      tokensOut: 20,
      ...overrides,
    };
  };
}

describe("executeDream", () => {
  beforeEach(() => {
    __resetDreamRunnerState();
    resetDreamTasks();
  });

  it("skips when dream is disabled", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const res = await executeDream({
      cfg: cfgWith({ enabled: false }),
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
    });
    expect(res.status).toBe("skipped");
    expect(res.status === "skipped" && res.reason).toMatch(/enabled=false/);
  });

  it("force=true bypasses enabled and gates and runs the agent", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const res = await executeDream({
      cfg: cfgWith({ enabled: false, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: okRunner(),
    });
    expect(res.status).toBe("completed");
    if (res.status === "completed") {
      expect(res.filesTouched.length).toBeGreaterThan(0);
      expect(res.report).toContain("dream-report");
    }
  });

  it("success records completion via lock mtime", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const before = Date.now();
    const res = await executeDream({
      cfg: cfgWith({ enabled: true, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: okRunner(),
    });
    expect(res.status).toBe("completed");
    const last = await readLastDreamedAt(memoryDir);
    expect(last).toBeGreaterThanOrEqual(before);
  });

  it("runner throw rewinds the lock", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    // Pre-seed a lock with a stale prior mtime (beyond HOLDER_STALE_MS = 1h)
    // so tryAcquireDreamLock treats it as free and returns priorMtime.
    await fs.writeFile(dreamLockPath(memoryDir), "pid=0\n", "utf8");
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    await fs.utimes(dreamLockPath(memoryDir), oldDate, oldDate);
    const prior = await readLastDreamedAt(memoryDir);

    const throwingRunner: DreamAgentRunner = async () => {
      throw new Error("boom");
    };

    const res = await executeDream({
      cfg: cfgWith({ enabled: true, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: throwingRunner,
    });
    expect(res.status).toBe("failed");
    if (res.status === "failed") {
      expect(res.error).toContain("boom");
    }
    const after = await readLastDreamedAt(memoryDir);
    // Rewound to prior (within 10ms tolerance for fs timestamp rounding)
    expect(Math.abs(after - prior)).toBeLessThan(10);
  });

  it("pre-aborted signal returns aborted and rewinds lock", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const ctrl = new AbortController();
    ctrl.abort();

    const runner: DreamAgentRunner = async () => {
      throw new Error("should not be reached");
    };

    const res = await executeDream({
      cfg: cfgWith({ enabled: true, backup: { enabled: false, keep: 1 } }),
      force: true,
      signal: ctrl.signal,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: runner,
    });
    expect(res.status).toBe("aborted");
  });

  it("holds the lock against a concurrent second run", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const slowRunner: DreamAgentRunner = async (_input) => {
      await gate;
      return {
        filesTouched: [],
        finalText: "ok",
        tokensIn: 0,
        tokensOut: 0,
      };
    };

    const p1 = executeDream({
      cfg: cfgWith({ enabled: true, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: slowRunner,
    });
    // Give p1 time to acquire the lock
    await new Promise((r) => setTimeout(r, 50));
    const p2 = executeDream({
      cfg: cfgWith({ enabled: true, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: okRunner(),
    });
    const res2 = await p2;
    expect(res2.status).toBe("skipped");
    if (res2.status === "skipped") {
      expect(res2.reason).toMatch(/lock_held/);
    }
    release();
    const res1 = await p1;
    expect(res1.status).toBe("completed");
  });

  it("session gate blocks when no touched sessions and !force", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const res = await executeDream({
      cfg: cfgWith({
        enabled: true,
        minHours: 0,
        minSessions: 5,
        scanThrottleMinutes: 0,
        backup: { enabled: false, keep: 1 },
      }),
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      agentRunner: okRunner(),
    });
    expect(res.status).toBe("skipped");
    if (res.status === "skipped") {
      expect(res.reason).toMatch(/session_gate/);
    }
  });

  it("default agent runner (not wired) returns skipped agent_runner_not_wired", async () => {
    const { memoryDir, workspaceDir } = await mkScratch();
    const res = await executeDream({
      cfg: cfgWith({ enabled: false, backup: { enabled: false, keep: 1 } }),
      force: true,
      _memoryDirOverride: memoryDir,
      _workspaceDirOverride: workspaceDir,
      // no agentRunner injected — falls back to defaultDreamAgentRunner
    });
    expect(res.status).toBe("skipped");
    if (res.status === "skipped") {
      expect(res.reason).toBe("agent_runner_not_wired");
    }
  });
});
