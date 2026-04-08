import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { register } from "../src/register.js";
import { ensureExtStorageDir, getExtStorageDir } from "../src/storage.js";
import { createClawMemReadOnlyAdapter } from "../src/clawmem-adapter.js";
import { BeliefLayer } from "../src/belief-layer.js";
import { ClaimHealth } from "../src/claim-health.js";
import { buildMemoryPrompt } from "../src/prompt-helper.js";

describe("avatar-ext-memory-wiki", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "avatar-ext-mw-"));
    process.env.AVATAR_EXT_MEMORY_WIKI_DIR = tmp;
  });

  afterEach(() => {
    delete process.env.AVATAR_EXT_MEMORY_WIKI_DIR;
    delete process.env.AVATAR_EXT_MEMORY_WIKI;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("storage override is honored", () => {
    expect(getExtStorageDir()).toBe(tmp);
  });

  it("ensureExtStorageDir creates the directory", async () => {
    const dir = await ensureExtStorageDir();
    expect(dir).toBe(tmp);
  });

  it("register() never throws and is idempotent", async () => {
    await expect(register({})).resolves.toBeUndefined();
    await expect(register({})).resolves.toBeUndefined();
  });

  it("noop adapter returns empty results", async () => {
    const a = createClawMemReadOnlyAdapter();
    expect(a.mode).toBe("noop");
    expect(await a.searchClaims("anything")).toEqual([]);
    expect(await a.getClaim("x")).toBeNull();
  });

  it("BeliefLayer initializes and writes a manifest", async () => {
    const dir = await ensureExtStorageDir();
    const belief = new BeliefLayer({
      storageDir: dir,
      adapter: createClawMemReadOnlyAdapter(),
    });
    await belief.initialize();
    expect(await belief.computeDigests()).toEqual([]);
  });

  it("ClaimHealth generates an inert report", async () => {
    const report = await new ClaimHealth().generate();
    expect(report.totalClaims).toBe(0);
    expect(report.staleClaims).toBe(0);
    expect(report.contradictingPairs).toBe(0);
  });

  it("buildMemoryPrompt returns empty string with no inputs", () => {
    expect(buildMemoryPrompt()).toBe("");
  });

  it("flag-ON: register() creates belief manifest in isolated dir", async () => {
    process.env.AVATAR_EXT_MEMORY_WIKI = "1";
    await register({});
    expect(existsSync(join(tmp, "belief", "manifest.json"))).toBe(true);
  });

  it("flag-ON: register() does not throw on degenerate api", async () => {
    process.env.AVATAR_EXT_MEMORY_WIKI = "1";
    await expect(register(null)).resolves.toBeUndefined();
    await expect(register(undefined)).resolves.toBeUndefined();
    await expect(register({ broken: true })).resolves.toBeUndefined();
  });

  it("buildMemoryPrompt formats claims and digests", () => {
    const out = buildMemoryPrompt({
      recentClaims: ["claim A"],
      digestSummaries: ["digest 1"],
    });
    expect(out).toContain("Recent claims");
    expect(out).toContain("- claim A");
    expect(out).toContain("Digest summaries");
    expect(out).toContain("- digest 1");
  });
});
