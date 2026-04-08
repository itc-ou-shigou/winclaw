import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { register } from "../src/register.js";
import { CompactionRegistry, getDefaultRegistry } from "../src/registry.js";
import { lcmDefaultProvider } from "../src/lcm-default-provider.js";
import { buildPromptCacheContext } from "../src/prompt-cache-context.js";
import { CompactionCheckpoint } from "../src/checkpoint.js";
import { mountCompactionMiddleware } from "../src/middleware.js";

describe("avatar-ext-compaction", () => {
  beforeEach(() => {
    getDefaultRegistry().clear();
  });

  afterEach(() => {
    delete process.env.AVATAR_EXT_COMPACTION_REGISTRY;
    delete process.env.AVATAR_EXT_COMPACTION_CHECKPOINTS;
    getDefaultRegistry().clear();
  });

  it("registry registers / lookups / list / default", () => {
    const r = new CompactionRegistry();
    r.register(lcmDefaultProvider);
    expect(r.list()).toContain("lcm-default");
    expect(r.get("lcm-default")).toBe(lcmDefaultProvider);
    expect(r.getDefault()).toBe(lcmDefaultProvider);
  });

  it("registry rejects duplicate ids", () => {
    const r = new CompactionRegistry();
    r.register(lcmDefaultProvider);
    expect(() => r.register(lcmDefaultProvider)).toThrow(/already registered/);
  });

  it("lcm default provider is a true passthrough", async () => {
    const out = await lcmDefaultProvider.compact({ text: "hello world" });
    expect(out.compacted).toBe("hello world");
    expect(out.droppedTokens).toBe(0);
  });

  it("register() never throws and is idempotent", async () => {
    await expect(register({})).resolves.toBeUndefined();
    await expect(register({})).resolves.toBeUndefined();
    expect(getDefaultRegistry().list()).toContain("lcm-default");
  });

  it("buildPromptCacheContext defaults cacheBreakObserved to false", () => {
    expect(buildPromptCacheContext()).toEqual({
      resolvedRetention: undefined,
      lastCallUsage: undefined,
      cacheBreakObserved: false,
      cacheTouchTimestamp: undefined,
    });
  });

  it("checkpoint is inert without flag", () => {
    const cp = new CompactionCheckpoint();
    cp.record({ id: "x", providerId: "p", bytesBefore: 100, bytesAfter: 50 });
    expect(cp.list()).toEqual([]);
    expect(cp.isEnabled).toBe(false);
  });

  it("checkpoint records when flag is on", () => {
    process.env.AVATAR_EXT_COMPACTION_CHECKPOINTS = "1";
    const cp = new CompactionCheckpoint();
    cp.record({ id: "x", providerId: "p", bytesBefore: 100, bytesAfter: 50 });
    expect(cp.list()).toHaveLength(1);
    expect(cp.list()[0].id).toBe("x");
  });

  it("middleware refuses to mount without registry flag", () => {
    const out = mountCompactionMiddleware({ use: () => {} });
    expect(out.mounted).toBe(false);
    expect(out.reason).toBe("registry flag off");
  });

  it("middleware refuses to mount without checkpoint flag", () => {
    process.env.AVATAR_EXT_COMPACTION_REGISTRY = "1";
    const out = mountCompactionMiddleware({ use: () => {} });
    expect(out.mounted).toBe(false);
    expect(out.reason).toBe("checkpoint flag off");
  });

  it("middleware mounts when both flags are on", () => {
    process.env.AVATAR_EXT_COMPACTION_REGISTRY = "1";
    process.env.AVATAR_EXT_COMPACTION_CHECKPOINTS = "1";
    let used = false;
    const out = mountCompactionMiddleware({ use: () => { used = true; } });
    expect(out.mounted).toBe(true);
    expect(used).toBe(true);
  });
});
