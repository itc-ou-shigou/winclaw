import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { register } from "../src/register.js";
import { tagIntent, readIntent, clearIntent, isMediaIntentEnabled } from "../src/intent.js";

describe("avatar-ext-media-intent", () => {
  beforeEach(() => {
    delete process.env.AVATAR_EXT_MEDIA_INTENT;
  });
  afterEach(() => {
    delete process.env.AVATAR_EXT_MEDIA_INTENT;
  });

  it("flag OFF: tagIntent is a passthrough", () => {
    const env = { id: "x", meta: {} };
    const out = tagIntent(env, { kind: "voice", origin: "user" });
    expect(out).toBe(env);
    expect(readIntent(out)).toBeNull();
  });

  it("flag ON: tagIntent stores intent under meta.ext.mediaIntent", () => {
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    const env = { id: "x", meta: {} };
    const out = tagIntent(env, { kind: "voice", origin: "user", hint: "respond by voice" });
    expect(out).not.toBe(env);
    const intent = readIntent(out);
    expect(intent).not.toBeNull();
    expect(intent?.kind).toBe("voice");
    expect(intent?.origin).toBe("user");
    expect(intent?.hint).toBe("respond by voice");
  });

  it("flag ON: tagIntent does not touch unrelated meta keys", () => {
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    const env = { id: "x", meta: { traceId: "abc", ext: { other: 1 } } };
    const out = tagIntent(env, { kind: "image", origin: "tool" });
    expect((out.meta as any).traceId).toBe("abc");
    expect((out.meta as any).ext.other).toBe(1);
    expect((out.meta as any).ext.mediaIntent.kind).toBe("image");
  });

  it("readIntent returns null on missing/malformed metadata", () => {
    expect(readIntent(null)).toBeNull();
    expect(readIntent(undefined)).toBeNull();
    expect(readIntent({})).toBeNull();
    expect(readIntent({ meta: {} })).toBeNull();
    expect(readIntent({ meta: { ext: {} } })).toBeNull();
    expect(readIntent({ meta: { ext: { mediaIntent: { kind: "voice" } } } })).toBeNull();
  });

  it("clearIntent removes the namespace key", () => {
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    const env = tagIntent({ id: "x", meta: {} }, { kind: "voice", origin: "user" });
    expect(readIntent(env)).not.toBeNull();
    const cleared = clearIntent(env);
    expect(readIntent(cleared)).toBeNull();
  });

  it("isMediaIntentEnabled reflects env var", () => {
    expect(isMediaIntentEnabled()).toBe(false);
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    expect(isMediaIntentEnabled()).toBe(true);
  });

  it("register() never throws", async () => {
    await expect(register({})).resolves.toBeUndefined();
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    await expect(register({})).resolves.toBeUndefined();
  });

  it("simulated provider fallback preserves intent across envelope handoff", () => {
    process.env.AVATAR_EXT_MEDIA_INTENT = "1";
    const original = tagIntent(
      { id: "msg-1", meta: { traceId: "t1" } },
      { kind: "voice", origin: "user" }
    );
    // Simulate fallback: a new provider receives the envelope and forwards it.
    const fallback = { ...original, meta: { ...(original.meta as object) } };
    const intent = readIntent(fallback);
    expect(intent?.kind).toBe("voice");
  });
});
