import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "winclaw", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "winclaw", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "winclaw", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "winclaw", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "winclaw", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "winclaw", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "winclaw", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "winclaw", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "winclaw", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "winclaw", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "winclaw", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "winclaw", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "winclaw", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "winclaw"],
      expected: null,
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "winclaw", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "winclaw", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "winclaw", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "winclaw", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "winclaw", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "winclaw", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "winclaw", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "winclaw", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "winclaw", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "winclaw", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "winclaw", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "winclaw", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "winclaw", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "winclaw", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("builds parse argv from raw args", () => {
    const cases = [
      {
        rawArgs: ["node", "winclaw", "status"],
        expected: ["node", "winclaw", "status"],
      },
      {
        rawArgs: ["node-22", "winclaw", "status"],
        expected: ["node-22", "winclaw", "status"],
      },
      {
        rawArgs: ["node-22.2.0.exe", "winclaw", "status"],
        expected: ["node-22.2.0.exe", "winclaw", "status"],
      },
      {
        rawArgs: ["node-22.2", "winclaw", "status"],
        expected: ["node-22.2", "winclaw", "status"],
      },
      {
        rawArgs: ["node-22.2.exe", "winclaw", "status"],
        expected: ["node-22.2.exe", "winclaw", "status"],
      },
      {
        rawArgs: ["/usr/bin/node-22.2.0", "winclaw", "status"],
        expected: ["/usr/bin/node-22.2.0", "winclaw", "status"],
      },
      {
        rawArgs: ["node24", "winclaw", "status"],
        expected: ["node24", "winclaw", "status"],
      },
      {
        rawArgs: ["/usr/bin/node24", "winclaw", "status"],
        expected: ["/usr/bin/node24", "winclaw", "status"],
      },
      {
        rawArgs: ["node24.exe", "winclaw", "status"],
        expected: ["node24.exe", "winclaw", "status"],
      },
      {
        rawArgs: ["nodejs", "winclaw", "status"],
        expected: ["nodejs", "winclaw", "status"],
      },
      {
        rawArgs: ["node-dev", "winclaw", "status"],
        expected: ["node", "winclaw", "node-dev", "winclaw", "status"],
      },
      {
        rawArgs: ["winclaw", "status"],
        expected: ["node", "winclaw", "status"],
      },
      {
        rawArgs: ["bun", "src/entry.ts", "status"],
        expected: ["bun", "src/entry.ts", "status"],
      },
    ] as const;

    for (const testCase of cases) {
      const parsed = buildParseArgv({
        programName: "winclaw",
        rawArgs: [...testCase.rawArgs],
      });
      expect(parsed).toEqual([...testCase.expected]);
    }
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "winclaw",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "winclaw", "status"]);
  });

  it("decides when to migrate state", () => {
    const nonMutatingArgv = [
      ["node", "winclaw", "status"],
      ["node", "winclaw", "health"],
      ["node", "winclaw", "sessions"],
      ["node", "winclaw", "config", "get", "update"],
      ["node", "winclaw", "config", "unset", "update"],
      ["node", "winclaw", "models", "list"],
      ["node", "winclaw", "models", "status"],
      ["node", "winclaw", "memory", "status"],
      ["node", "winclaw", "agent", "--message", "hi"],
    ] as const;
    const mutatingArgv = [
      ["node", "winclaw", "agents", "list"],
      ["node", "winclaw", "message", "send"],
    ] as const;

    for (const argv of nonMutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(false);
    }
    for (const argv of mutatingArgv) {
      expect(shouldMigrateState([...argv])).toBe(true);
    }
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
