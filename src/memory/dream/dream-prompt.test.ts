import { describe, it, expect } from "vitest";
import { buildDreamPrompt, extractDreamReport } from "./dream-prompt.js";

function baseCtx(overrides: Partial<Parameters<typeof buildDreamPrompt>[0]> = {}) {
  return {
    memoryDir: "/home/u/.winclaw/memory",
    entrypointFile: "/home/u/.winclaw/MEMORY.md",
    sessionIds: [],
    transcriptDir: "/home/u/.winclaw/transcripts",
    maxIndexLines: 200,
    maxIndexBytes: 25_000,
    dryRun: false,
    ...overrides,
  };
}

describe("buildDreamPrompt", () => {
  it("includes all 4 phase headers", () => {
    const out = buildDreamPrompt(baseCtx());
    expect(out).toContain("## Phase 1 — Orient");
    expect(out).toContain("## Phase 2 — Gather recent signal");
    expect(out).toContain("## Phase 3 — Consolidate");
    expect(out).toContain("## Phase 4 — Prune and re-index");
  });

  it("omits the dry-run banner when dryRun=false", () => {
    const out = buildDreamPrompt(baseCtx({ dryRun: false }));
    expect(out).not.toContain("DRY RUN MODE");
  });

  it("includes the dry-run banner when dryRun=true", () => {
    const out = buildDreamPrompt(baseCtx({ dryRun: true }));
    expect(out).toContain("DRY RUN MODE");
  });

  it("lists session ids when non-empty", () => {
    const out = buildDreamPrompt(
      baseCtx({ sessionIds: ["sess-a", "sess-b"] }),
    );
    expect(out).toContain("Sessions touched since last dream (2)");
    expect(out).toContain("- sess-a");
    expect(out).toContain("- sess-b");
  });

  it("omits the session listing header when sessionIds is empty", () => {
    const out = buildDreamPrompt(baseCtx({ sessionIds: [] }));
    expect(out).not.toContain("Sessions touched since last dream");
  });
});

describe("extractDreamReport", () => {
  it("extracts content inside <dream-report>", () => {
    const final = "blah\n<dream-report>\nmerged: 3\npruned: 1\n</dream-report>\ntail";
    const r = extractDreamReport(final);
    expect(r).toContain("merged: 3");
    expect(r).toContain("pruned: 1");
    expect(r).not.toContain("<dream-report>");
  });

  it("falls back to first 500 chars when tag is absent", () => {
    const final = "a".repeat(800);
    const r = extractDreamReport(final);
    expect(r.length).toBe(500);
  });
});
