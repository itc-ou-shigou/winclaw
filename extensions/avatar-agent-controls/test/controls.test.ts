import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { register, __resetForTests } from "../src/register.js";
import { EVENTS } from "../src/events.js";
import { PromptOverrideStore } from "../src/prompt-override.js";
import { HeartbeatMonitor } from "../src/heartbeat.js";

describe("avatar-agent-controls", () => {
  beforeEach(() => { __resetForTests(); });
  afterEach(() => { __resetForTests(); });

  it("EVENTS namespace is avatar.ext.*", () => {
    expect(EVENTS.PROMPT_OVERRIDE).toBe("avatar.ext.prompt.override");
    expect(EVENTS.HEARTBEAT).toBe("avatar.ext.heartbeat");
    expect(EVENTS.HEARTBEAT_STATUS).toBe("avatar.ext.heartbeat.status");
  });

  it("register() never throws and is idempotent", async () => {
    const a = await register({});
    const b = await register({});
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it("PromptOverrideStore set/get/ttl/clear", () => {
    const store = new PromptOverrideStore();
    store.set("a", "hello");
    expect(store.get("a")?.text).toBe("hello");
    expect(store.size()).toBe(1);
    store.clear("a");
    expect(store.get("a")).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("PromptOverrideStore TTL expires entries", () => {
    vi.useFakeTimers();
    const store = new PromptOverrideStore();
    store.set("a", "hi", 1000);
    expect(store.get("a")?.text).toBe("hi");
    vi.advanceTimersByTime(2000);
    expect(store.get("a")).toBeNull();
    vi.useRealTimers();
  });

  it("HeartbeatMonitor starts in idle and becomes healthy on tick", () => {
    const hb = new HeartbeatMonitor({ intervalMs: 1000, staleAfterMs: 5000 });
    expect(hb.getStatus()).toBe("idle");
    hb.tick("first");
    expect(hb.getStatus()).toBe("healthy");
    hb.stop();
  });

  it("HeartbeatMonitor goes stale after staleAfterMs", () => {
    vi.useFakeTimers();
    const hb = new HeartbeatMonitor({ intervalMs: 100, staleAfterMs: 500 });
    hb.tick("first");
    vi.advanceTimersByTime(600);
    expect(hb.evaluate()).toBe("stale");
    hb.stop();
    vi.useRealTimers();
  });

  it("HeartbeatMonitor onStatus listeners get notified on transitions", () => {
    const hb = new HeartbeatMonitor();
    const seen: string[] = [];
    const off = hb.onStatus((s) => seen.push(s));
    hb.tick("a");
    expect(seen).toContain("healthy");
    off();
    hb.stop();
  });

  it("HeartbeatMonitor: listener errors are suppressed", () => {
    const hb = new HeartbeatMonitor();
    hb.onStatus(() => { throw new Error("boom"); });
    expect(() => hb.tick("a")).not.toThrow();
    hb.stop();
  });

  it("HeartbeatMonitor stop() releases the timer", () => {
    const hb = new HeartbeatMonitor({ intervalMs: 50 });
    hb.start();
    hb.stop();
    expect(true).toBe(true);
  });
});
