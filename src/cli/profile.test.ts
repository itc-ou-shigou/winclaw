import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "winclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "winclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "winclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "winclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "winclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "winclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "winclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "winclaw", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "winclaw", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".winclaw-dev");
    expect(env.WINCLAW_PROFILE).toBe("dev");
    expect(env.WINCLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.WINCLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "winclaw.json"));
    expect(env.WINCLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      WINCLAW_STATE_DIR: "/custom",
      WINCLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.WINCLAW_STATE_DIR).toBe("/custom");
    expect(env.WINCLAW_GATEWAY_PORT).toBe("19099");
    expect(env.WINCLAW_CONFIG_PATH).toBe(path.join("/custom", "winclaw.json"));
  });

  it("uses WINCLAW_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      WINCLAW_HOME: "/srv/winclaw-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/winclaw-home");
    expect(env.WINCLAW_STATE_DIR).toBe(path.join(resolvedHome, ".winclaw-work"));
    expect(env.WINCLAW_CONFIG_PATH).toBe(path.join(resolvedHome, ".winclaw-work", "winclaw.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("winclaw doctor --fix", {})).toBe("winclaw doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("winclaw doctor --fix", { WINCLAW_PROFILE: "default" })).toBe(
      "winclaw doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("winclaw doctor --fix", { WINCLAW_PROFILE: "Default" })).toBe(
      "winclaw doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("winclaw doctor --fix", { WINCLAW_PROFILE: "bad profile" })).toBe(
      "winclaw doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("winclaw --profile work doctor --fix", { WINCLAW_PROFILE: "work" }),
    ).toBe("winclaw --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("winclaw --dev doctor", { WINCLAW_PROFILE: "dev" })).toBe(
      "winclaw --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("winclaw doctor --fix", { WINCLAW_PROFILE: "work" })).toBe(
      "winclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("winclaw doctor --fix", { WINCLAW_PROFILE: "  jbwinclaw  " })).toBe(
      "winclaw --profile jbwinclaw doctor --fix",
    );
  });

  it("handles command with no args after winclaw", () => {
    expect(formatCliCommand("winclaw", { WINCLAW_PROFILE: "test" })).toBe("winclaw --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm winclaw doctor", { WINCLAW_PROFILE: "work" })).toBe(
      "pnpm winclaw --profile work doctor",
    );
  });
});
