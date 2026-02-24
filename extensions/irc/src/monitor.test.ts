import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#winclaw",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#winclaw",
      rawTarget: "#winclaw",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "winclaw-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "winclaw-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "winclaw-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "winclaw-bot",
      rawTarget: "winclaw-bot",
    });
  });
});
