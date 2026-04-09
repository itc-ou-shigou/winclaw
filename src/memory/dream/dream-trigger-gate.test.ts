import { describe, it, expect } from "vitest";
import { resolveDreamConfig } from "./dream-config.js";

function shouldFireOnMemoryFlush(cfg: Parameters<typeof resolveDreamConfig>[0]) {
  const r = resolveDreamConfig(cfg);
  return r.enabled && r.autoTrigger.enabled && r.autoTrigger.onMemoryFlush;
}

describe("dream auto-trigger gating", () => {
  it("is ON by default (installation default)", () => {
    expect(shouldFireOnMemoryFlush(undefined)).toBe(true);
    expect(shouldFireOnMemoryFlush({} as never)).toBe(true);
  });

  it("explicit enabled=false disables the trigger", () => {
    expect(
      shouldFireOnMemoryFlush({
        memory: {
          dream: {
            enabled: false,
            autoTrigger: { enabled: true, onMemoryFlush: true },
          },
        },
      } as never),
    ).toBe(false);
  });

  it("explicit autoTrigger.enabled=false disables the trigger", () => {
    expect(
      shouldFireOnMemoryFlush({
        memory: {
          dream: { enabled: true, autoTrigger: { enabled: false, onMemoryFlush: true } },
        },
      } as never),
    ).toBe(false);
  });

  it("explicit autoTrigger.onMemoryFlush=false disables the trigger", () => {
    expect(
      shouldFireOnMemoryFlush({
        memory: {
          dream: {
            enabled: true,
            autoTrigger: { enabled: true, onMemoryFlush: false },
          },
        },
      } as never),
    ).toBe(false);
  });

  it("fires when all three flags are true (also the default state)", () => {
    expect(
      shouldFireOnMemoryFlush({
        memory: {
          dream: {
            enabled: true,
            autoTrigger: { enabled: true, onMemoryFlush: true },
          },
        },
      } as never),
    ).toBe(true);
  });
});
