import path from "node:path";
import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { loadConfig } from "../config/config.js";
import type { WinClawConfig } from "../config/types.winclaw.js";
import {
  executeDream,
  getDreamTask,
  killDreamTask,
  listDreamTasks,
  listSnapshots,
  readLastDreamedAt,
  resolveDreamConfig,
  restoreSnapshot,
} from "../memory/dream/index.js";
import { logDreamEvent } from "../memory/dream/dream-telemetry.js";
import { defaultRuntime } from "../runtime.js";
import { formatErrorMessage } from "./cli-utils.js";

function resolveMemoryDirForCli(cfg: WinClawConfig): string {
  const dreamCfg = resolveDreamConfig(cfg);
  const agentId = dreamCfg.agent === "auto" ? resolveDefaultAgentId(cfg) : dreamCfg.agent;
  const workspace = resolveAgentWorkspaceDir(cfg, agentId);
  return path.join(workspace, "memory");
}

export function registerDreamCli(program: Command): void {
  const dream = program
    .command("dream")
    .description("Consolidate memory files — merge, dedupe, prune");

  // --- run (default) ---
  dream
    .command("run", { isDefault: true })
    .description("Run a dream consolidation pass (respects gates unless --force)")
    .option("--force", "bypass time + session gates (still requires lock)")
    .option("--dry-run", "describe changes without writing")
    .option("--agent <id>", "agent to use (overrides memory.dream.agent)")
    .action(
      async (cmdOpts: { force?: boolean; dryRun?: boolean; agent?: string }) => {
        const cfg = loadConfig();
        if (cmdOpts.agent) {
          cfg.memory = {
            ...cfg.memory,
            dream: { ...cfg.memory?.dream, agent: cmdOpts.agent },
          };
        }
        try {
          const result = await executeDream({
            cfg,
            force: Boolean(cmdOpts.force),
            dryRun: Boolean(cmdOpts.dryRun),
          });
          if (result.status === "skipped") {
            defaultRuntime.log(`Skipped: ${result.reason}`);
            return;
          }
          if (result.status === "failed") {
            defaultRuntime.error(`Failed: ${result.error}`);
            process.exitCode = 1;
            return;
          }
          if (result.status === "aborted") {
            defaultRuntime.log("Aborted");
            process.exitCode = 130;
            return;
          }
          defaultRuntime.log(
            `Dream complete. ${result.filesTouched.length} files touched:`,
          );
          for (const f of result.filesTouched) {
            defaultRuntime.log(`  ${f}`);
          }
          if (result.report) {
            defaultRuntime.log("");
            defaultRuntime.log(result.report);
          }
        } catch (err) {
          defaultRuntime.error(`Dream failed: ${formatErrorMessage(err)}`);
          process.exitCode = 1;
        }
      },
    );

  // --- status ---
  dream
    .command("status")
    .description("Show last dream timestamp and running tasks")
    .action(async () => {
      const cfg = loadConfig();
      const resolved = resolveDreamConfig(cfg);
      defaultRuntime.log(`dream.enabled: ${resolved.enabled}`);
      defaultRuntime.log(`auto trigger: ${resolved.autoTrigger.enabled ? "on" : "off"}`);
      try {
        const memoryDir = resolveMemoryDirForCli(cfg);
        const lastDreamedAt = await readLastDreamedAt(memoryDir);
        if (lastDreamedAt > 0) {
          defaultRuntime.log(`last dreamed at: ${new Date(lastDreamedAt).toISOString()}`);
        } else {
          defaultRuntime.log("last dreamed at: never");
        }
      } catch (err) {
        defaultRuntime.log(`last dreamed at: unknown (${formatErrorMessage(err)})`);
      }
      const tasks = listDreamTasks();
      if (tasks.length === 0) {
        defaultRuntime.log("No dream tasks tracked in this process.");
        return;
      }
      defaultRuntime.log("");
      defaultRuntime.log("Tasks:");
      for (const t of tasks) {
        const phasePart = "phase" in t && t.phase ? ` phase=${t.phase}` : "";
        defaultRuntime.log(`  ${t.taskId} [${t.status}]${phasePart}`);
        if ("filesTouched" in t && Array.isArray(t.filesTouched) && t.filesTouched.length > 0) {
          defaultRuntime.log(`    files: ${t.filesTouched.length}`);
        }
        if (t.status === "failed" && "error" in t && t.error) {
          defaultRuntime.log(`    error: ${t.error}`);
        }
      }
    });

  // --- list-snapshots ---
  dream
    .command("list-snapshots")
    .description("List memory snapshot backups")
    .action(async () => {
      const cfg = loadConfig();
      try {
        const memoryDir = resolveMemoryDirForCli(cfg);
        const snapshots = await listSnapshots(memoryDir);
        if (snapshots.length === 0) {
          defaultRuntime.log("No snapshots found.");
          return;
        }
        for (const s of snapshots) {
          const when = new Date(s.createdAt).toISOString();
          defaultRuntime.log(`  ${s.id}  (${s.fileCount} files, ${when})`);
        }
      } catch (err) {
        defaultRuntime.error(`list-snapshots failed: ${formatErrorMessage(err)}`);
        process.exitCode = 1;
      }
    });

  // --- restore ---
  dream
    .command("restore <snapshotId>")
    .description("Restore memory files from a snapshot")
    .action(async (snapshotId: string) => {
      const cfg = loadConfig();
      try {
        const memoryDir = resolveMemoryDirForCli(cfg);
        await restoreSnapshot(memoryDir, snapshotId);
        logDreamEvent("restored", { snapshotId });
        defaultRuntime.log(`Restored from snapshot ${snapshotId}`);
      } catch (err) {
        defaultRuntime.error(`restore failed: ${formatErrorMessage(err)}`);
        process.exitCode = 1;
      }
    });

  // --- kill ---
  dream
    .command("kill <taskId>")
    .description("Abort a running dream task (in-process only)")
    .action((taskId: string) => {
      const task = getDreamTask(taskId);
      if (!task) {
        defaultRuntime.error(`No such task: ${taskId}`);
        process.exitCode = 1;
        return;
      }
      killDreamTask(taskId);
      defaultRuntime.log(`Killed ${taskId}`);
    });
}
