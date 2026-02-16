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
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "winclaw", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "winclaw", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "winclaw", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "winclaw", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "winclaw", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "winclaw", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "winclaw", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "winclaw"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "winclaw", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "winclaw", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "winclaw", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "winclaw", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "winclaw", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "winclaw", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "winclaw", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "winclaw", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "winclaw", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "winclaw", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "winclaw", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "winclaw", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "winclaw", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "winclaw", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node", "winclaw", "status"],
    });
    expect(nodeArgv).toEqual(["node", "winclaw", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node-22", "winclaw", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "winclaw", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node-22.2.0.exe", "winclaw", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "winclaw", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node-22.2", "winclaw", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "winclaw", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node-22.2.exe", "winclaw", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "winclaw", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["/usr/bin/node-22.2.0", "winclaw", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "winclaw", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["nodejs", "winclaw", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "winclaw", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["node-dev", "winclaw", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "winclaw", "node-dev", "winclaw", "status"]);

    const directArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["winclaw", "status"],
    });
    expect(directArgv).toEqual(["node", "winclaw", "status"]);

    const bunArgv = buildParseArgv({
      programName: "winclaw",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "winclaw",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "winclaw", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "winclaw", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "winclaw", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "winclaw", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "winclaw", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "winclaw", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "winclaw", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "winclaw", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
