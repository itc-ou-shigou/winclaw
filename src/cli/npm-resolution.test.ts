import { describe, expect, it } from "vitest";
import {
  buildNpmInstallRecordFields,
  logPinnedNpmSpecMessages,
  mapNpmResolutionMetadata,
  resolvePinnedNpmInstallRecord,
  resolvePinnedNpmInstallRecordForCli,
  resolvePinnedNpmSpec,
} from "./npm-resolution.js";

describe("npm-resolution helpers", () => {
  it("keeps original spec when pin is disabled", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@winclaw/plugin-alpha@latest",
      pin: false,
      resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
    });
    expect(result).toEqual({
      recordSpec: "@winclaw/plugin-alpha@latest",
    });
  });

  it("warns when pin is enabled but resolved spec is missing", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@winclaw/plugin-alpha@latest",
      pin: true,
    });
    expect(result).toEqual({
      recordSpec: "@winclaw/plugin-alpha@latest",
      pinWarning: "Could not resolve exact npm version for --pin; storing original npm spec.",
    });
  });

  it("returns pinned spec notice when resolved spec is available", () => {
    const result = resolvePinnedNpmSpec({
      rawSpec: "@winclaw/plugin-alpha@latest",
      pin: true,
      resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
    });
    expect(result).toEqual({
      recordSpec: "@winclaw/plugin-alpha@1.2.3",
      pinNotice: "Pinned npm install record to @winclaw/plugin-alpha@1.2.3.",
    });
  });

  it("maps npm resolution metadata to install fields", () => {
    expect(
      mapNpmResolutionMetadata({
        name: "@winclaw/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
        integrity: "sha512-abc",
        shasum: "deadbeef",
        resolvedAt: "2026-02-21T00:00:00.000Z",
      }),
    ).toEqual({
      resolvedName: "@winclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
      integrity: "sha512-abc",
      shasum: "deadbeef",
      resolvedAt: "2026-02-21T00:00:00.000Z",
    });
  });

  it("builds common npm install record fields", () => {
    expect(
      buildNpmInstallRecordFields({
        spec: "@winclaw/plugin-alpha@1.2.3",
        installPath: "/tmp/winclaw/extensions/alpha",
        version: "1.2.3",
        resolution: {
          name: "@winclaw/plugin-alpha",
          version: "1.2.3",
          resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
          integrity: "sha512-abc",
        },
      }),
    ).toEqual({
      source: "npm",
      spec: "@winclaw/plugin-alpha@1.2.3",
      installPath: "/tmp/winclaw/extensions/alpha",
      version: "1.2.3",
      resolvedName: "@winclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
      integrity: "sha512-abc",
      shasum: undefined,
      resolvedAt: undefined,
    });
  });

  it("logs pin warning/notice messages through provided writers", () => {
    const logs: string[] = [];
    const warns: string[] = [];
    logPinnedNpmSpecMessages(
      {
        pinWarning: "warn-1",
        pinNotice: "notice-1",
      },
      (message) => logs.push(message),
      (message) => warns.push(message),
    );

    expect(logs).toEqual(["notice-1"]);
    expect(warns).toEqual(["warn-1"]);
  });

  it("resolves pinned install record and emits pin notice", () => {
    const logs: string[] = [];
    const warns: string[] = [];
    const record = resolvePinnedNpmInstallRecord({
      rawSpec: "@winclaw/plugin-alpha@latest",
      pin: true,
      installPath: "/tmp/winclaw/extensions/alpha",
      version: "1.2.3",
      resolution: {
        name: "@winclaw/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
      },
      log: (message) => logs.push(message),
      warn: (message) => warns.push(message),
    });

    expect(record).toEqual({
      source: "npm",
      spec: "@winclaw/plugin-alpha@1.2.3",
      installPath: "/tmp/winclaw/extensions/alpha",
      version: "1.2.3",
      resolvedName: "@winclaw/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@winclaw/plugin-alpha@1.2.3",
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual(["Pinned npm install record to @winclaw/plugin-alpha@1.2.3."]);
    expect(warns).toEqual([]);
  });

  it("resolves pinned install record for CLI and formats warning output", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@winclaw/plugin-alpha@latest",
      true,
      "/tmp/winclaw/extensions/alpha",
      "1.2.3",
      undefined,
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record).toEqual({
      source: "npm",
      spec: "@winclaw/plugin-alpha@latest",
      installPath: "/tmp/winclaw/extensions/alpha",
      version: "1.2.3",
      resolvedName: undefined,
      resolvedVersion: undefined,
      resolvedSpec: undefined,
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual([
      "[warn] Could not resolve exact npm version for --pin; storing original npm spec.",
    ]);
  });
});
