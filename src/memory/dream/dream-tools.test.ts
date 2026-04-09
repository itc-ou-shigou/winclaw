import path from "node:path";
import { describe, it, expect } from "vitest";
import { decideBashCommand, decideFileWrite } from "./dream-tools.js";

describe("decideBashCommand", () => {
  it("allows ls -la", () => {
    expect(decideBashCommand("ls -la").allowed).toBe(true);
  });

  it("allows grep -rn pattern ./memory", () => {
    expect(decideBashCommand("grep -rn pattern ./memory").allowed).toBe(true);
  });

  it("rejects rm -rf /", () => {
    const r = decideBashCommand("rm -rf /");
    expect(r.allowed).toBe(false);
  });

  it("rejects ls > /tmp/out (redirection)", () => {
    expect(decideBashCommand("ls > /tmp/out").allowed).toBe(false);
  });

  it("rejects ls | tee /tmp/out (tee)", () => {
    expect(decideBashCommand("ls | tee /tmp/out").allowed).toBe(false);
  });

  it("rejects cat $(whoami) (subshell)", () => {
    expect(decideBashCommand("cat $(whoami)").allowed).toBe(false);
  });

  it("rejects cat `whoami` (backtick)", () => {
    expect(decideBashCommand("cat `whoami`").allowed).toBe(false);
  });

  it("rejects eval whatever", () => {
    expect(decideBashCommand("eval whatever").allowed).toBe(false);
  });

  it("rejects empty command", () => {
    expect(decideBashCommand("").allowed).toBe(false);
    expect(decideBashCommand("   ").allowed).toBe(false);
  });

  it("allows FOO=bar ls -la (env prefix)", () => {
    expect(decideBashCommand("FOO=bar ls -la").allowed).toBe(true);
  });

  it("rejects ls|grep foo (pipe chain)", () => {
    expect(decideBashCommand("ls|grep foo").allowed).toBe(false);
  });
});

describe("decideFileWrite", () => {
  const memoryDir = path.resolve(path.join(process.cwd(), "m"));
  const entrypointFile = path.join(memoryDir, "MEMORY.md");
  const policy = { memoryDir, entrypointFile };

  it("rejects path outside memory dir", () => {
    const outside = path.resolve(path.join(process.cwd(), "tmp-outside", "foo.md"));
    expect(decideFileWrite(outside, policy).allowed).toBe(false);
  });

  it("allows a top-level file inside memory dir", () => {
    const inside = path.join(memoryDir, "decisions.md");
    expect(decideFileWrite(inside, policy).allowed).toBe(true);
  });

  it("allows a nested file inside memory dir", () => {
    const nested = path.join(memoryDir, "nested", "x.md");
    expect(decideFileWrite(nested, policy).allowed).toBe(true);
  });

  it("allows MEMORY.md entrypoint", () => {
    expect(decideFileWrite(entrypointFile, policy).allowed).toBe(true);
  });

  it("rejects path that escapes via ..", () => {
    const escaped = path.join(memoryDir, "..", "etc", "passwd");
    expect(decideFileWrite(escaped, policy).allowed).toBe(false);
  });

  it("rejects empty path", () => {
    expect(decideFileWrite("", policy).allowed).toBe(false);
  });

  it("rejects path equal to memory dir root", () => {
    expect(decideFileWrite(memoryDir, policy).allowed).toBe(false);
  });
});
