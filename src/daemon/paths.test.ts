import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".winclaw"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", WINCLAW_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".winclaw-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", WINCLAW_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".winclaw"));
  });

  it("uses WINCLAW_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", WINCLAW_STATE_DIR: "/var/lib/winclaw" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/winclaw"));
  });

  it("expands ~ in WINCLAW_STATE_DIR", () => {
    const env = { HOME: "/Users/test", WINCLAW_STATE_DIR: "~/winclaw-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/winclaw-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { WINCLAW_STATE_DIR: "C:\\State\\winclaw" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\winclaw");
  });
});
