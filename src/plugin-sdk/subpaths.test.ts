import * as compatSdk from "winclaw/plugin-sdk/compat";
import * as discordSdk from "winclaw/plugin-sdk/discord";
import * as imessageSdk from "winclaw/plugin-sdk/imessage";
import * as lineSdk from "winclaw/plugin-sdk/line";
import * as msteamsSdk from "winclaw/plugin-sdk/msteams";
import * as signalSdk from "winclaw/plugin-sdk/signal";
import * as slackSdk from "winclaw/plugin-sdk/slack";
import * as whatsappSdk from "winclaw/plugin-sdk/whatsapp";
import { describe, expect, it } from "vitest";

const bundledExtensionSubpathLoaders = [
  { id: "acpx", load: () => import("winclaw/plugin-sdk/acpx") },
  { id: "bluebubbles", load: () => import("winclaw/plugin-sdk/bluebubbles") },
  { id: "copilot-proxy", load: () => import("winclaw/plugin-sdk/copilot-proxy") },
  { id: "device-pair", load: () => import("winclaw/plugin-sdk/device-pair") },
  { id: "diagnostics-otel", load: () => import("winclaw/plugin-sdk/diagnostics-otel") },
  { id: "diffs", load: () => import("winclaw/plugin-sdk/diffs") },
  { id: "feishu", load: () => import("winclaw/plugin-sdk/feishu") },
  {
    id: "google-gemini-cli-auth",
    load: () => import("winclaw/plugin-sdk/google-gemini-cli-auth"),
  },
  { id: "googlechat", load: () => import("winclaw/plugin-sdk/googlechat") },
  { id: "irc", load: () => import("winclaw/plugin-sdk/irc") },
  { id: "llm-task", load: () => import("winclaw/plugin-sdk/llm-task") },
  { id: "lobster", load: () => import("winclaw/plugin-sdk/lobster") },
  { id: "matrix", load: () => import("winclaw/plugin-sdk/matrix") },
  { id: "mattermost", load: () => import("winclaw/plugin-sdk/mattermost") },
  { id: "memory-core", load: () => import("winclaw/plugin-sdk/memory-core") },
  { id: "memory-lancedb", load: () => import("winclaw/plugin-sdk/memory-lancedb") },
  {
    id: "minimax-portal-auth",
    load: () => import("winclaw/plugin-sdk/minimax-portal-auth"),
  },
  { id: "nextcloud-talk", load: () => import("winclaw/plugin-sdk/nextcloud-talk") },
  { id: "nostr", load: () => import("winclaw/plugin-sdk/nostr") },
  { id: "open-prose", load: () => import("winclaw/plugin-sdk/open-prose") },
  { id: "phone-control", load: () => import("winclaw/plugin-sdk/phone-control") },
  { id: "qwen-portal-auth", load: () => import("winclaw/plugin-sdk/qwen-portal-auth") },
  { id: "synology-chat", load: () => import("winclaw/plugin-sdk/synology-chat") },
  { id: "talk-voice", load: () => import("winclaw/plugin-sdk/talk-voice") },
  { id: "test-utils", load: () => import("winclaw/plugin-sdk/test-utils") },
  { id: "thread-ownership", load: () => import("winclaw/plugin-sdk/thread-ownership") },
  { id: "tlon", load: () => import("winclaw/plugin-sdk/tlon") },
  { id: "twitch", load: () => import("winclaw/plugin-sdk/twitch") },
  { id: "voice-call", load: () => import("winclaw/plugin-sdk/voice-call") },
  { id: "zalo", load: () => import("winclaw/plugin-sdk/zalo") },
  { id: "zalouser", load: () => import("winclaw/plugin-sdk/zalouser") },
] as const;

describe("plugin-sdk subpath exports", () => {
  it("exports compat helpers", () => {
    expect(typeof compatSdk.emptyPluginConfigSchema).toBe("function");
    expect(typeof compatSdk.resolveControlCommandGate).toBe("function");
  });

  it("exports Discord helpers", () => {
    expect(typeof discordSdk.resolveDiscordAccount).toBe("function");
    expect(typeof discordSdk.discordOnboardingAdapter).toBe("object");
  });

  it("exports Slack helpers", () => {
    expect(typeof slackSdk.resolveSlackAccount).toBe("function");
    expect(typeof slackSdk.handleSlackMessageAction).toBe("function");
  });

  it("exports Signal helpers", () => {
    expect(typeof signalSdk.resolveSignalAccount).toBe("function");
    expect(typeof signalSdk.signalOnboardingAdapter).toBe("object");
  });

  it("exports iMessage helpers", () => {
    expect(typeof imessageSdk.resolveIMessageAccount).toBe("function");
    expect(typeof imessageSdk.imessageOnboardingAdapter).toBe("object");
  });

  it("exports WhatsApp helpers", () => {
    expect(typeof whatsappSdk.resolveWhatsAppAccount).toBe("function");
    expect(typeof whatsappSdk.whatsappOnboardingAdapter).toBe("object");
  });

  it("exports LINE helpers", () => {
    expect(typeof lineSdk.processLineMessage).toBe("function");
    expect(typeof lineSdk.createInfoCard).toBe("function");
  });

  it("exports Microsoft Teams helpers", () => {
    expect(typeof msteamsSdk.resolveControlCommandGate).toBe("function");
    expect(typeof msteamsSdk.loadOutboundMediaFromUrl).toBe("function");
  });

  it("resolves bundled extension subpaths", async () => {
    for (const { id, load } of bundledExtensionSubpathLoaders) {
      const mod = await load();
      expect(typeof mod).toBe("object");
      expect(mod, `subpath ${id} should resolve`).toBeTruthy();
    }
  });
});
