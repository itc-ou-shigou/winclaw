import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const executeDream = vi.fn();
const listDreamTasks = vi.fn(() => [] as Array<Record<string, unknown>>);
const getDreamTask = vi.fn(() => ({ taskId: "t1", status: "running" }));
const killDreamTask = vi.fn();
const listSnapshots = vi.fn(async () => [] as Array<Record<string, unknown>>);
const restoreSnapshot = vi.fn(async () => undefined);
const readLastDreamedAt = vi.fn(async () => 0);
const resolveDreamConfig = vi.fn(() => ({
  enabled: false,
  autoTrigger: { enabled: false },
  agent: "auto",
}));

const loadConfig = vi.fn(() => ({ memory: { dream: { enabled: false } } }));
const resolveDefaultAgentId = vi.fn(() => "main");
const resolveAgentWorkspaceDir = vi.fn(() => "/tmp/winclaw-ws");

vi.mock("../memory/dream/index.js", () => ({
  executeDream,
  listDreamTasks,
  getDreamTask,
  killDreamTask,
  listSnapshots,
  restoreSnapshot,
  readLastDreamedAt,
  resolveDreamConfig,
}));

vi.mock("../config/config.js", () => ({
  loadConfig,
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
}));

let registerDreamCli: typeof import("./dream-cli.js").registerDreamCli;
let defaultRuntime: typeof import("../runtime.js").defaultRuntime;

beforeAll(async () => {
  ({ registerDreamCli } = await import("./dream-cli.js"));
  ({ defaultRuntime } = await import("../runtime.js"));
});

describe("dream CLI", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.name("winclaw");
    program.exitOverride();
    registerDreamCli(program);
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  function spyLog() {
    return vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});
  }
  function spyErr() {
    return vi.spyOn(defaultRuntime, "error").mockImplementation(() => {});
  }

  it("registers dream command with subcommands", () => {
    const dream = program.commands.find((c) => c.name() === "dream");
    expect(dream).toBeDefined();
    const names = dream!.commands.map((c) => c.name()).toSorted();
    expect(names).toContain("run");
    expect(names).toContain("status");
    expect(names).toContain("list-snapshots");
    expect(names).toContain("restore");
    expect(names).toContain("kill");
  });

  it("dream run --dry-run forwards dryRun=true", async () => {
    executeDream.mockResolvedValueOnce({
      status: "completed",
      taskId: "t1",
      filesTouched: [],
      report: "",
    });
    spyLog();
    await program.parseAsync(["dream", "run", "--dry-run"], { from: "user" });
    expect(executeDream).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, force: false }),
    );
  });

  it("dream run --force forwards force=true", async () => {
    executeDream.mockResolvedValueOnce({
      status: "completed",
      taskId: "t1",
      filesTouched: [],
      report: "",
    });
    spyLog();
    await program.parseAsync(["dream", "run", "--force"], { from: "user" });
    expect(executeDream).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, dryRun: false }),
    );
  });

  it("dream run skipped prints reason", async () => {
    executeDream.mockResolvedValueOnce({ status: "skipped", reason: "too soon" });
    const log = spyLog();
    await program.parseAsync(["dream", "run"], { from: "user" });
    expect(log.mock.calls.some((c) => String(c[0]).includes("too soon"))).toBe(true);
  });

  it("dream run failed sets exitCode=1", async () => {
    executeDream.mockResolvedValueOnce({ status: "failed", error: "boom" });
    spyErr();
    await program.parseAsync(["dream", "run"], { from: "user" });
    expect(process.exitCode).toBe(1);
  });

  it("dream status prints enabled flag", async () => {
    const log = spyLog();
    await program.parseAsync(["dream", "status"], { from: "user" });
    const joined = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(joined).toContain("dream.enabled");
    expect(joined).toContain("auto trigger");
  });

  it("dream list-snapshots with no snapshots prints empty message", async () => {
    listSnapshots.mockResolvedValueOnce([]);
    const log = spyLog();
    await program.parseAsync(["dream", "list-snapshots"], { from: "user" });
    expect(log.mock.calls.some((c) => String(c[0]).includes("No snapshots"))).toBe(true);
  });

  it("dream restore calls restoreSnapshot", async () => {
    spyLog();
    await program.parseAsync(["dream", "restore", "snap-123"], { from: "user" });
    expect(restoreSnapshot).toHaveBeenCalledWith(expect.any(String), "snap-123");
  });

  it("dream kill calls killDreamTask for existing task", async () => {
    spyLog();
    await program.parseAsync(["dream", "kill", "t1"], { from: "user" });
    expect(killDreamTask).toHaveBeenCalledWith("t1");
  });
});
