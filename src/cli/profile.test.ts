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

  it.each([
    ["--dev first", ["node", "winclaw", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "winclaw", "--profile", "work", "--dev", "status"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
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
    expect(env.WINCLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".winclaw-work", "winclaw.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "winclaw doctor --fix",
      env: {},
      expected: "winclaw doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "winclaw doctor --fix",
      env: { WINCLAW_PROFILE: "default" },
      expected: "winclaw doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "winclaw doctor --fix",
      env: { WINCLAW_PROFILE: "Default" },
      expected: "winclaw doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "winclaw doctor --fix",
      env: { WINCLAW_PROFILE: "bad profile" },
      expected: "winclaw doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "winclaw --profile work doctor --fix",
      env: { WINCLAW_PROFILE: "work" },
      expected: "winclaw --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "winclaw --dev doctor",
      env: { WINCLAW_PROFILE: "dev" },
      expected: "winclaw --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
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
    expect(formatCliCommand("winclaw", { WINCLAW_PROFILE: "test" })).toBe(
      "winclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm winclaw doctor", { WINCLAW_PROFILE: "work" })).toBe(
      "pnpm winclaw --profile work doctor",
    );
  });
});
