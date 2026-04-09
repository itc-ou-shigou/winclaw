import { describe, it, expect } from "vitest";
import type { WinClawConfig } from "../../config/types.winclaw.js";
import {
  DREAM_DEFAULTS,
  ENTRYPOINT_DEFAULTS,
  resolveDreamConfig,
  resolveEntrypointLimits,
} from "./dream-config.js";

function cfg(memory: NonNullable<WinClawConfig["memory"]>): WinClawConfig {
  return { memory } as WinClawConfig;
}

describe("resolveDreamConfig", () => {
  it("returns defaults for undefined config", () => {
    const r = resolveDreamConfig(undefined);
    expect(r).toEqual(DREAM_DEFAULTS);
  });

  it("returns defaults for empty memory", () => {
    const r = resolveDreamConfig({} as WinClawConfig);
    // Installation default: dream is ON out-of-the-box.
    expect(r.enabled).toBe(true);
    expect(r.autoTrigger.enabled).toBe(true);
    expect(r.minHours).toBe(24);
    expect(r.scanThrottleMs).toBe(10 * 60 * 1000);
  });

  it("applies enabled=false override while keeping other defaults", () => {
    const r = resolveDreamConfig(cfg({ dream: { enabled: false } }));
    expect(r.enabled).toBe(false);
    expect(r.minHours).toBe(DREAM_DEFAULTS.minHours);
    expect(r.minSessions).toBe(DREAM_DEFAULTS.minSessions);
    expect(r.tools.bashReadOnly).toBe(true);
  });

  it("applies autoTrigger.enabled=false override", () => {
    const r = resolveDreamConfig(
      cfg({ dream: { autoTrigger: { enabled: false } } }),
    );
    expect(r.enabled).toBe(true); // still on by default
    expect(r.autoTrigger.enabled).toBe(false);
  });

  it("converts scanThrottleMinutes to ms", () => {
    const r = resolveDreamConfig(cfg({ dream: { scanThrottleMinutes: 5 } }));
    expect(r.scanThrottleMs).toBe(300_000);
  });

  it("converts lockStaleHours to ms", () => {
    const r = resolveDreamConfig(cfg({ dream: { lockStaleHours: 2 } }));
    expect(r.lockStaleMs).toBe(2 * 60 * 60 * 1000);
  });

  it("converts autoTrigger.idleMinutes to ms", () => {
    const r = resolveDreamConfig(
      cfg({ dream: { autoTrigger: { idleMinutes: 15 } } }),
    );
    expect(r.autoTrigger.idleMs).toBe(900_000);
  });

  it("preserves null idleMinutes", () => {
    const r = resolveDreamConfig(
      cfg({ dream: { autoTrigger: { idleMinutes: null } } }),
    );
    expect(r.autoTrigger.idleMs).toBeNull();
  });

  it("applies nested tools overrides", () => {
    const r = resolveDreamConfig(
      cfg({ dream: { tools: { fileWriteScope: "workspace" } } }),
    );
    expect(r.tools.fileWriteScope).toBe("workspace");
    expect(r.tools.bashReadOnly).toBe(true);
  });

  it("applies backup overrides", () => {
    const r = resolveDreamConfig(cfg({ dream: { backup: { keep: 3 } } }));
    expect(r.backup.keep).toBe(3);
    expect(r.backup.enabled).toBe(true);
  });
});

describe("resolveEntrypointLimits", () => {
  it("returns defaults for undefined config", () => {
    expect(resolveEntrypointLimits(undefined)).toEqual(ENTRYPOINT_DEFAULTS);
  });

  it("applies overrides", () => {
    const r = resolveEntrypointLimits(
      cfg({ entrypoint: { maxLines: 500, maxBytes: 50_000, warnOnTruncate: false } }),
    );
    expect(r.maxLines).toBe(500);
    expect(r.maxBytes).toBe(50_000);
    expect(r.warnOnTruncate).toBe(false);
  });

  it("merges partial overrides with defaults", () => {
    const r = resolveEntrypointLimits(cfg({ entrypoint: { maxLines: 300 } }));
    expect(r.maxLines).toBe(300);
    expect(r.maxBytes).toBe(ENTRYPOINT_DEFAULTS.maxBytes);
    expect(r.warnOnTruncate).toBe(true);
  });
});
