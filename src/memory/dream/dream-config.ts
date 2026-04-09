import type { WinClawConfig } from "../../config/types.winclaw.js";

export type ResolvedDreamConfig = {
  enabled: boolean;
  minHours: number;
  minSessions: number;
  scanThrottleMs: number;
  lockStaleMs: number;
  agent: string;
  tools: {
    bashReadOnly: boolean;
    fileWriteScope: "memory" | "workspace";
  };
  backup: { enabled: boolean; keep: number };
  autoTrigger: {
    enabled: boolean;
    onPostTurn: boolean;
    onMemoryFlush: boolean;
    onShutdown: boolean;
    idleMs: number | null;
    cron: string | null;
  };
};

// Installation default: ON.
// Users get memory consolidation out-of-the-box after installing winclaw.
// Safety net: the default agent runner throws DreamAgentNotWiredError, so
// even when enabled, real consolidation only runs after an agent runner is
// injected (M3+). Fire-and-forget auto-trigger in agent-runner.ts swallows
// the "not wired" skip silently — harmless until a runner lands.
export const DREAM_DEFAULTS: ResolvedDreamConfig = {
  enabled: true,
  minHours: 24,
  minSessions: 5,
  scanThrottleMs: 10 * 60 * 1000,
  lockStaleMs: 60 * 60 * 1000,
  agent: "auto",
  tools: { bashReadOnly: true, fileWriteScope: "memory" },
  backup: { enabled: true, keep: 10 },
  autoTrigger: {
    enabled: true,
    onPostTurn: true,
    onMemoryFlush: true,
    onShutdown: true,
    idleMs: null,
    cron: null,
  },
};

export function resolveDreamConfig(cfg?: WinClawConfig): ResolvedDreamConfig {
  const raw = cfg?.memory?.dream;
  if (!raw) {
    return {
      ...DREAM_DEFAULTS,
      tools: { ...DREAM_DEFAULTS.tools },
      backup: { ...DREAM_DEFAULTS.backup },
      autoTrigger: { ...DREAM_DEFAULTS.autoTrigger },
    };
  }
  return {
    enabled: raw.enabled ?? DREAM_DEFAULTS.enabled,
    minHours: raw.minHours ?? DREAM_DEFAULTS.minHours,
    minSessions: raw.minSessions ?? DREAM_DEFAULTS.minSessions,
    scanThrottleMs: (raw.scanThrottleMinutes ?? 10) * 60 * 1000,
    lockStaleMs: (raw.lockStaleHours ?? 1) * 60 * 60 * 1000,
    agent: raw.agent ?? DREAM_DEFAULTS.agent,
    tools: {
      bashReadOnly: raw.tools?.bashReadOnly ?? DREAM_DEFAULTS.tools.bashReadOnly,
      fileWriteScope: raw.tools?.fileWriteScope ?? DREAM_DEFAULTS.tools.fileWriteScope,
    },
    backup: {
      enabled: raw.backup?.enabled ?? DREAM_DEFAULTS.backup.enabled,
      keep: raw.backup?.keep ?? DREAM_DEFAULTS.backup.keep,
    },
    autoTrigger: {
      enabled: raw.autoTrigger?.enabled ?? DREAM_DEFAULTS.autoTrigger.enabled,
      onPostTurn: raw.autoTrigger?.onPostTurn ?? DREAM_DEFAULTS.autoTrigger.onPostTurn,
      onMemoryFlush: raw.autoTrigger?.onMemoryFlush ?? DREAM_DEFAULTS.autoTrigger.onMemoryFlush,
      onShutdown: raw.autoTrigger?.onShutdown ?? DREAM_DEFAULTS.autoTrigger.onShutdown,
      idleMs:
        raw.autoTrigger?.idleMinutes == null
          ? null
          : raw.autoTrigger.idleMinutes * 60 * 1000,
      cron: raw.autoTrigger?.cron ?? null,
    },
  };
}

export type ResolvedEntrypointLimits = {
  maxLines: number;
  maxBytes: number;
  warnOnTruncate: boolean;
};

export const ENTRYPOINT_DEFAULTS: ResolvedEntrypointLimits = {
  maxLines: 200,
  maxBytes: 25_000,
  warnOnTruncate: true,
};

export function resolveEntrypointLimits(cfg?: WinClawConfig): ResolvedEntrypointLimits {
  const raw = cfg?.memory?.entrypoint;
  if (!raw) {return { ...ENTRYPOINT_DEFAULTS };}
  return {
    maxLines: raw.maxLines ?? ENTRYPOINT_DEFAULTS.maxLines,
    maxBytes: raw.maxBytes ?? ENTRYPOINT_DEFAULTS.maxBytes,
    warnOnTruncate: raw.warnOnTruncate ?? ENTRYPOINT_DEFAULTS.warnOnTruncate,
  };
}
