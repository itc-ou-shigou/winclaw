import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandHomePrefix, resolveEffectiveHomeDir, resolveRequiredHomeDir } from "./home-dir.js";

describe("resolveEffectiveHomeDir", () => {
  it("prefers WINCLAW_HOME over HOME and USERPROFILE", () => {
    const env = {
      WINCLAW_HOME: "/srv/winclaw-home",
      HOME: "/home/other",
      USERPROFILE: "C:/Users/other",
    } as NodeJS.ProcessEnv;

    expect(resolveEffectiveHomeDir(env, () => "/fallback")).toBe(path.resolve("/srv/winclaw-home"));
  });

  it("falls back to HOME then USERPROFILE then homedir", () => {
    expect(resolveEffectiveHomeDir({ HOME: "/home/alice" } as NodeJS.ProcessEnv)).toBe(
      path.resolve("/home/alice"),
    );
    expect(resolveEffectiveHomeDir({ USERPROFILE: "C:/Users/alice" } as NodeJS.ProcessEnv)).toBe(
      path.resolve("C:/Users/alice"),
    );
    expect(resolveEffectiveHomeDir({} as NodeJS.ProcessEnv, () => "/fallback")).toBe(
      path.resolve("/fallback"),
    );
  });

  it("expands WINCLAW_HOME when set to ~", () => {
    const env = {
      WINCLAW_HOME: "~/svc",
      HOME: "/home/alice",
    } as NodeJS.ProcessEnv;

    expect(resolveEffectiveHomeDir(env)).toBe(path.resolve("/home/alice/svc"));
  });
});

describe("resolveRequiredHomeDir", () => {
  it("falls back to LOCALAPPDATA on Windows when no home source is available", () => {
    if (process.platform !== "win32") return; // Windows-only test
    const env = { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" } as NodeJS.ProcessEnv;
    expect(
      resolveRequiredHomeDir(env, () => {
        throw new Error("no home");
      }),
    ).toBe(path.resolve("C:\\Users\\test\\AppData\\Local"));
  });

  it("falls back to APPDATA on Windows when LOCALAPPDATA missing", () => {
    if (process.platform !== "win32") return; // Windows-only test
    const env = { APPDATA: "C:\\Users\\test\\AppData\\Roaming" } as NodeJS.ProcessEnv;
    expect(
      resolveRequiredHomeDir(env, () => {
        throw new Error("no home");
      }),
    ).toBe(path.resolve("C:\\Users\\test\\AppData\\Roaming"));
  });

  it("uses cwd when it is not a read-only system path", () => {
    const cwd = process.cwd();
    const isReadOnly = [
      "C:\\Program Files",
      "C:\\Program Files (x86)",
      "C:\\Windows",
      "/usr",
      "/opt",
      "/System",
    ].some((p) => cwd.toLowerCase().startsWith(p.toLowerCase()));

    if (isReadOnly) return; // skip when running from a read-only location

    // On Windows without LOCALAPPDATA/APPDATA, non-read-only cwd should work
    // On non-Windows, cwd is the next fallback
    if (process.platform === "win32") {
      // With neither LOCALAPPDATA nor APPDATA, falls through to cwd check
      const env = {} as NodeJS.ProcessEnv;
      expect(
        resolveRequiredHomeDir(env, () => {
          throw new Error("no home");
        }),
      ).toBe(cwd);
    } else {
      expect(
        resolveRequiredHomeDir({} as NodeJS.ProcessEnv, () => {
          throw new Error("no home");
        }),
      ).toBe(cwd);
    }
  });

  it("returns a fully resolved path for WINCLAW_HOME", () => {
    const result = resolveRequiredHomeDir(
      { WINCLAW_HOME: "/custom/home" } as NodeJS.ProcessEnv,
      () => "/fallback",
    );
    expect(result).toBe(path.resolve("/custom/home"));
  });

  it("ignores WINCLAW_HOME pointing to a read-only system path", () => {
    // Simulate a stale WINCLAW_HOME pointing to the install directory
    const env = {
      WINCLAW_HOME: "C:\\Program Files\\WinClaw",
      HOME: "/home/alice",
    } as NodeJS.ProcessEnv;
    // Should fall through to HOME instead of using Program Files
    expect(resolveEffectiveHomeDir(env, () => "/fallback")).toBe(path.resolve("/home/alice"));
  });

  it("ignores WINCLAW_HOME under Program Files (x86)", () => {
    const env = {
      WINCLAW_HOME: "C:\\Program Files (x86)\\SomeApp",
      USERPROFILE: "C:\\Users\\test",
    } as NodeJS.ProcessEnv;
    expect(resolveEffectiveHomeDir(env, () => "/fallback")).toBe(path.resolve("C:\\Users\\test"));
  });

  it("falls back to safe dir when WINCLAW_HOME is tilde-only and no home exists", () => {
    // When no home exists at all, the function should return a writable fallback
    // (LOCALAPPDATA/APPDATA on Windows, cwd or tmpdir otherwise)
    const result = resolveRequiredHomeDir({ WINCLAW_HOME: "~" } as NodeJS.ProcessEnv, () => {
      throw new Error("no home");
    });
    // Result should be a resolved path (not empty/undefined)
    expect(result).toBeTruthy();
    expect(path.isAbsolute(result)).toBe(true);
  });
});

describe("expandHomePrefix", () => {
  it("expands tilde using effective home", () => {
    const value = expandHomePrefix("~/x", {
      env: { WINCLAW_HOME: "/srv/winclaw-home" } as NodeJS.ProcessEnv,
    });
    expect(value).toBe(`${path.resolve("/srv/winclaw-home")}/x`);
  });

  it("keeps non-tilde values unchanged", () => {
    expect(expandHomePrefix("/tmp/x")).toBe("/tmp/x");
  });
});
