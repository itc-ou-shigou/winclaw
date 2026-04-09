import path from "node:path";
import type { WinClawConfig } from "../../config/types.winclaw.js";
import {
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { resolveSessionTranscriptsDirForAgent } from "../../config/sessions.js";
import { resolveDreamConfig, resolveEntrypointLimits } from "./dream-config.js";
import {
  readLastDreamedAt,
  tryAcquireDreamLock,
  rollbackDreamLock,
  recordDreamCompletion,
} from "./dream-lock.js";
import { snapshotMemoryDir } from "./dream-backup.js";
import {
  registerDreamTask,
  completeDreamTask,
  failDreamTask,
  getDreamTask,
  addDreamTouched,
  setDreamPhase,
  type DreamPhase,
} from "./dream-task.js";
import { logDreamEvent } from "./dream-telemetry.js";
import { buildDreamPrompt } from "./dream-prompt.js";
import { listSessionsTouchedSince } from "./dream-sessions.js";
import { defaultDreamAgentRunner, DreamAgentNotWiredError } from "./dream-agent.js";

export type DreamOptions = {
  cfg: WinClawConfig;
  force?: boolean;
  dryRun?: boolean;
  currentSessionId?: string;
  signal?: AbortSignal;
  /** Optional dependency injection for tests / custom wiring. */
  agentRunner?: DreamAgentRunner;
  /**
   * Test-only escape hatch: override the resolved memory directory. When
   * provided, the runner skips agent-scope lookups entirely. Undocumented
   * outside of this comment — do not use in production call sites.
   * @internal @testonly Do not use in production; test-only path override.
   */
  _memoryDirOverride?: string;
  /** @internal @testonly Do not use in production; test-only path override. */
  _workspaceDirOverride?: string;
};

export type DreamResult =
  | { status: "skipped"; reason: string }
  | {
      status: "completed";
      taskId: string;
      filesTouched: string[];
      report: string;
    }
  | { status: "failed"; taskId?: string; error: string }
  | { status: "aborted"; taskId?: string };

export type DreamAgentRunner = (input: {
  cfg: WinClawConfig;
  prompt: string;
  memoryDir: string;
  entrypointFile: string;
  workspaceDir: string;
  sessionIds: string[];
  signal: AbortSignal;
  onPhase: (phase: DreamPhase) => void;
  onFileTouched: (p: string) => void;
}) => Promise<{
  filesTouched: string[];
  finalText: string;
  tokensIn: number;
  tokensOut: number;
}>;

// Module-level scan throttle state. Use __resetDreamRunnerState() in tests.
let lastSessionScanAt = 0;

export function __resetDreamRunnerState(): void {
  lastSessionScanAt = 0;
}

/**
 * Compose two abort signals into one. Falls back gracefully for Node versions
 * without AbortSignal.any.
 */
function composeSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => !!s);
  if (real.length === 0) {return new AbortController().signal;}
  if (real.length === 1) {return real[0];}
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === "function") {
    try {
      return anyFn(real);
    } catch {
      // fall through
    }
  }
  const ctrl = new AbortController();
  const onAbort = () => {
    try {
      ctrl.abort();
    } catch {
      // ignore
    }
  };
  for (const s of real) {
    if (s.aborted) {
      onAbort();
      break;
    }
    s.addEventListener("abort", onAbort, { once: true });
  }
  return ctrl.signal;
}

export async function executeDream(opts: DreamOptions): Promise<DreamResult> {
  let taskId: string | undefined;
  let priorMtime: number | undefined;
  let memoryDir: string | undefined;
  let currentPhase: DreamPhase = "pre-flight";

  try {
    const resolved = resolveDreamConfig(opts.cfg);
    const force = opts.force === true;

    if (!force && !resolved.enabled) {
      return { status: "skipped", reason: "memory.dream.enabled=false" };
    }

    // Resolve memoryDir / workspaceDir.
    let workspaceDir: string;
    if (opts._memoryDirOverride) {
      memoryDir = opts._memoryDirOverride;
      workspaceDir = opts._workspaceDirOverride ?? path.dirname(opts._memoryDirOverride);
    } else {
      const agentId =
        resolved.agent && resolved.agent !== "auto"
          ? resolved.agent
          : resolveDefaultAgentId(opts.cfg);
      workspaceDir = resolveAgentWorkspaceDir(opts.cfg, agentId);
      memoryDir = path.join(workspaceDir, "memory");
    }
    const entrypointFile = path.join(workspaceDir, "MEMORY.md");

    // Gate 1 — time
    const lastAt = await readLastDreamedAt(memoryDir);
    const hoursSince = (Date.now() - lastAt) / 3_600_000;
    if (!force && hoursSince < resolved.minHours) {
      logDreamEvent("skipped", { reason: "time_gate", hoursSince });
      return { status: "skipped", reason: `time_gate hoursSince=${hoursSince.toFixed(2)}` };
    }

    // Scan throttle (non-force)
    if (!force && Date.now() - lastSessionScanAt < resolved.scanThrottleMs) {
      logDreamEvent("skipped", { reason: "scan_throttle" });
      return { status: "skipped", reason: "scan_throttle" };
    }
    lastSessionScanAt = Date.now();

    // Gate 2 — sessions touched
    const touched = await listSessionsTouchedSince(lastAt, opts.cfg);
    const sessionIds = opts.currentSessionId
      ? touched.filter((s) => s !== opts.currentSessionId)
      : touched;
    if (!force && sessionIds.length < resolved.minSessions) {
      logDreamEvent("skipped", {
        reason: "session_gate",
        sessions: sessionIds.length,
        required: resolved.minSessions,
      });
      return {
        status: "skipped",
        reason: `session_gate sessions=${sessionIds.length}/${resolved.minSessions}`,
      };
    }

    // Gate 3 — lock
    const acquired = await tryAcquireDreamLock(memoryDir);
    if (acquired === null) {
      logDreamEvent("skipped", { reason: "lock_held" });
      return { status: "skipped", reason: "lock_held" };
    }
    priorMtime = acquired;

    // Snapshot (unless dry run)
    let snapshotId: string | null = null;
    if (!opts.dryRun && resolved.backup.enabled) {
      try {
        snapshotId = await snapshotMemoryDir(memoryDir, resolved.backup.keep);
      } catch (err) {
        logDreamEvent("skipped", {
          reason: "snapshot_failed",
          error: String(err),
        });
        await rollbackDreamLock(memoryDir, priorMtime);
        return {
          status: "skipped",
          reason: `snapshot_failed: ${String(err)}`,
        };
      }
    }

    // Register task
    taskId = registerDreamTask({
      sessionsReviewing: sessionIds.length,
      priorMtime,
      snapshotId,
    });

    logDreamEvent("fired", {
      taskId,
      hoursSince,
      sessions: sessionIds.length,
      dryRun: !!opts.dryRun,
    });

    // Build prompt
    const entrypointLimits = resolveEntrypointLimits(opts.cfg);
    const transcriptDir = (() => {
      try {
        const agentId =
          resolved.agent && resolved.agent !== "auto"
            ? resolved.agent
            : resolveDefaultAgentId(opts.cfg);
        return resolveSessionTranscriptsDirForAgent(agentId);
      } catch {
        return path.join(workspaceDir, "sessions");
      }
    })();

    const prompt = buildDreamPrompt({
      memoryDir,
      entrypointFile,
      sessionIds,
      transcriptDir,
      maxIndexLines: entrypointLimits.maxLines,
      maxIndexBytes: entrypointLimits.maxBytes,
      dryRun: !!opts.dryRun,
    });

    // Merge signals
    const taskState = getDreamTask(taskId);
    const taskSignal =
      taskState && taskState.status === "running" ? taskState.abort.signal : undefined;
    const signal = composeSignals([opts.signal, taskSignal]);

    if (signal.aborted) {
      await rollbackDreamLock(memoryDir, priorMtime);
      logDreamEvent("skipped", { reason: "aborted_before_run", taskId });
      failDreamTask(taskId, "aborted", currentPhase);
      return { status: "aborted", taskId };
    }

    // Execute agent
    const runner = opts.agentRunner ?? defaultDreamAgentRunner;
    const collectedFiles: string[] = [];
    try {
      const result = await runner({
        cfg: opts.cfg,
        prompt,
        memoryDir,
        entrypointFile,
        workspaceDir,
        sessionIds,
        signal,
        onPhase: (phase) => {
          currentPhase = phase;
          if (taskId) {setDreamPhase(taskId, phase);}
        },
        onFileTouched: (p) => {
          if (!collectedFiles.includes(p)) {collectedFiles.push(p);}
          if (taskId) {addDreamTouched(taskId, p);}
        },
      });

      const mergedFiles = Array.from(
        new Set([...collectedFiles, ...result.filesTouched]),
      );

      if (!opts.dryRun) {
        await recordDreamCompletion(memoryDir);
      } else {
        // Dry run: rewind lock so the time gate doesn't reset.
        await rollbackDreamLock(memoryDir, priorMtime);
      }

      completeDreamTask(taskId, { filesTouched: mergedFiles });
      logDreamEvent("completed", {
        taskId,
        filesTouched: mergedFiles.length,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      });

      return {
        status: "completed",
        taskId,
        filesTouched: mergedFiles,
        report: result.finalText,
      };
    } catch (err) {
      const aborted = signal.aborted;
      await rollbackDreamLock(memoryDir, priorMtime);
      if (err instanceof DreamAgentNotWiredError) {
        failDreamTask(taskId, err.message, currentPhase);
        logDreamEvent("skipped", { reason: "agent_runner_not_wired", taskId });
        return { status: "skipped", reason: "agent_runner_not_wired" };
      }
      if (aborted) {
        logDreamEvent("skipped", { reason: "aborted", taskId });
        failDreamTask(taskId, "aborted", currentPhase);
        return { status: "aborted", taskId };
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      failDreamTask(taskId, errMsg, currentPhase);
      logDreamEvent("failed", { taskId, error: errMsg, phase: currentPhase });
      return { status: "failed", taskId, error: errMsg };
    }
  } catch (err) {
    // Pre-flight / unexpected error — never throw.
    const errMsg = err instanceof Error ? err.message : String(err);
    if (taskId && memoryDir && typeof priorMtime === "number") {
      try {
        await rollbackDreamLock(memoryDir, priorMtime);
      } catch {
        // ignore
      }
      failDreamTask(taskId, errMsg, currentPhase);
    }
    logDreamEvent("skipped", {
      reason: `error_in_pre_flight: ${errMsg}`,
    });
    return { status: "failed", taskId, error: errMsg };
  }
}
