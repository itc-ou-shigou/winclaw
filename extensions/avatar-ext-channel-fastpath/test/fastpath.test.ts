import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { register } from "../src/register.js";
import {
  ChannelFastPath,
  getDefaultFastPath,
  isChannelFastPathEnabled,
} from "../src/fastpath.js";

describe("avatar-ext-channel-fastpath", () => {
  beforeEach(() => {
    delete process.env.AVATAR_EXT_CHANNEL_FASTPATH;
    getDefaultFastPath().clear();
  });
  afterEach(() => {
    delete process.env.AVATAR_EXT_CHANNEL_FASTPATH;
    getDefaultFastPath().clear();
  });

  it("flag OFF: tryFastPath always returns null", () => {
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m-direct" });
    expect(fp.tryFastPath({ channelId: "ch1" })).toBeNull();
  });

  it("flag ON: tryFastPath returns the registered model id", () => {
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m-direct" });
    expect(fp.tryFastPath({ channelId: "ch1" })).toBe("m-direct");
  });

  it("flag ON: miss returns null so caller falls through to existing resolver", () => {
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m-direct" });
    expect(fp.tryFastPath({ channelId: "ch-unknown" })).toBeNull();
  });

  it("stats track hits and misses", () => {
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m" });
    fp.tryFastPath({ channelId: "ch1" });
    fp.tryFastPath({ channelId: "ch1" });
    fp.tryFastPath({ channelId: "miss" });
    const s = fp.getStats();
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.totalLookupNs >= 0n).toBe(true);
  });

  it("unregister removes the entry", () => {
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m" });
    fp.unregisterDirect("ch1");
    expect(fp.tryFastPath({ channelId: "ch1" })).toBeNull();
    expect(fp.size()).toBe(0);
  });

  it("isChannelFastPathEnabled reflects env var", () => {
    expect(isChannelFastPathEnabled()).toBe(false);
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    expect(isChannelFastPathEnabled()).toBe(true);
  });

  it("getDefaultFastPath returns a stable singleton", () => {
    expect(getDefaultFastPath()).toBe(getDefaultFastPath());
  });

  it("register() never throws and is idempotent", async () => {
    await expect(register({})).resolves.toBeUndefined();
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    await expect(register({})).resolves.toBeUndefined();
    await expect(register({})).resolves.toBeUndefined();
  });

  it("clear() resets entries and stats", () => {
    process.env.AVATAR_EXT_CHANNEL_FASTPATH = "1";
    const fp = new ChannelFastPath();
    fp.registerDirect({ channelId: "ch1", modelId: "m" });
    fp.tryFastPath({ channelId: "ch1" });
    fp.clear();
    expect(fp.size()).toBe(0);
    expect(fp.getStats().hits).toBe(0);
  });
});
