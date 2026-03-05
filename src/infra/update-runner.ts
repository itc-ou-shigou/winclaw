import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type CommandOptions, runCommandWithTimeout } from "../process/exec.js";
import {
  resolveControlUiDistIndexHealth,
  resolveControlUiDistIndexPathForRoot,
} from "./control-ui-assets.js";
import { detectPackageManager as detectPackageManagerImpl } from "./detect-package-manager.js";
import { readPackageName, readPackageVersion } from "./package-json.js";
import { trimLogTail } from "./restart-sentinel.js";
import {
  channelToNpmTag,
  DEFAULT_PACKAGE_CHANNEL,
  DEV_BRANCH,
  isBetaTag,
  isStableTag,
  type UpdateChannel,
} from "./update-channels.js";
import { compareSemverStrings } from "./update-check.js";
import {
  cleanupGlobalRenameDirs,
  detectGlobalInstallManagerByPresence,
  detectGlobalInstallManagerForRoot,
  globalInstallArgs,
} from "./update-global.js";
import { GrcClient, type UpdateCheckResult as GrcUpdateCheckResult } from "./grc-client.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const grcLog = createSubsystemLogger("infra/update-runner/grc");

export type UpdateStepResult = {
  name: string;
  command: string;
  cwd: string;
  durationMs: number;
  exitCode: number | null;
  stdoutTail?: string | null;
  stderrTail?: string | null;
};

export type UpdateRunResult = {
  status: "ok" | "error" | "skipped";
  mode: "git" | "grc" | "pnpm" | "bun" | "npm" | "unknown";
  root?: string;
  reason?: string;
  before?: { sha?: string | null; version?: string | null };
  after?: { sha?: string | null; version?: string | null };
  steps: UpdateStepResult[];
  durationMs: number;
  /** Present only when mode === "grc" and an update was found. */
  grcManifest?: GrcUpdateCheckResult;
};

type CommandRunner = (
  argv: string[],
  options: CommandOptions,
) => Promise<{ stdout: string; stderr: string; code: number | null }>;

export type UpdateStepInfo = {
  name: string;
  command: string;
  index: number;
  total: number;
};

export type UpdateStepCompletion = UpdateStepInfo & {
  durationMs: number;
  exitCode: number | null;
  stderrTail?: string | null;
};

export type UpdateStepProgress = {
  onStepStart?: (step: UpdateStepInfo) => void;
  onStepComplete?: (step: UpdateStepCompletion) => void;
};

type UpdateRunnerOptions = {
  cwd?: string;
  argv1?: string;
  tag?: string;
  channel?: UpdateChannel;
  timeoutMs?: number;
  runCommand?: CommandRunner;
  progress?: UpdateStepProgress;
};

const DEFAULT_TIMEOUT_MS = 20 * 60_000;
const MAX_LOG_CHARS = 8000;
const PREFLIGHT_MAX_COMMITS = 10;
const START_DIRS = ["cwd", "argv1", "process"];
const DEFAULT_PACKAGE_NAME = "winclaw";
const CORE_PACKAGE_NAMES = new Set([DEFAULT_PACKAGE_NAME]);

function normalizeDir(value?: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return path.resolve(trimmed);
}

function resolveNodeModulesBinPackageRoot(argv1: string): string | null {
  const normalized = path.resolve(argv1);
  const parts = normalized.split(path.sep);
  const binIndex = parts.lastIndexOf(".bin");
  if (binIndex <= 0) {
    return null;
  }
  if (parts[binIndex - 1] !== "node_modules") {
    return null;
  }
  const binName = path.basename(normalized);
  const nodeModulesDir = parts.slice(0, binIndex).join(path.sep);
  return path.join(nodeModulesDir, binName);
}

function buildStartDirs(opts: UpdateRunnerOptions): string[] {
  const dirs: string[] = [];
  const cwd = normalizeDir(opts.cwd);
  if (cwd) {
    dirs.push(cwd);
  }
  const argv1 = normalizeDir(opts.argv1);
  if (argv1) {
    dirs.push(path.dirname(argv1));
    const packageRoot = resolveNodeModulesBinPackageRoot(argv1);
    if (packageRoot) {
      dirs.push(packageRoot);
    }
  }
  const proc = normalizeDir(process.cwd());
  if (proc) {
    dirs.push(proc);
  }
  return Array.from(new Set(dirs));
}

async function readBranchName(
  runCommand: CommandRunner,
  root: string,
  timeoutMs: number,
): Promise<string | null> {
  const res = await runCommand(["git", "-C", root, "rev-parse", "--abbrev-ref", "HEAD"], {
    timeoutMs,
  }).catch(() => null);
  if (!res || res.code !== 0) {
    return null;
  }
  const branch = res.stdout.trim();
  return branch || null;
}

async function listGitTags(
  runCommand: CommandRunner,
  root: string,
  timeoutMs: number,
  pattern = "v*",
): Promise<string[]> {
  const res = await runCommand(["git", "-C", root, "tag", "--list", pattern, "--sort=-v:refname"], {
    timeoutMs,
  }).catch(() => null);
  if (!res || res.code !== 0) {
    return [];
  }
  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function resolveChannelTag(
  runCommand: CommandRunner,
  root: string,
  timeoutMs: number,
  channel: Exclude<UpdateChannel, "dev">,
): Promise<string | null> {
  const tags = await listGitTags(runCommand, root, timeoutMs);
  if (channel === "beta") {
    const betaTag = tags.find((tag) => isBetaTag(tag)) ?? null;
    const stableTag = tags.find((tag) => isStableTag(tag)) ?? null;
    if (!betaTag) {
      return stableTag;
    }
    if (!stableTag) {
      return betaTag;
    }
    const cmp = compareSemverStrings(betaTag, stableTag);
    if (cmp != null && cmp < 0) {
      return stableTag;
    }
    return betaTag;
  }
  return tags.find((tag) => isStableTag(tag)) ?? null;
}

async function resolveGitRoot(
  runCommand: CommandRunner,
  candidates: string[],
  timeoutMs: number,
): Promise<string | null> {
  for (const dir of candidates) {
    const res = await runCommand(["git", "-C", dir, "rev-parse", "--show-toplevel"], {
      timeoutMs,
    });
    if (res.code === 0) {
      const root = res.stdout.trim();
      if (root) {
        return root;
      }
    }
  }
  return null;
}

async function findPackageRoot(candidates: string[]) {
  for (const dir of candidates) {
    let current = dir;
    for (let i = 0; i < 12; i += 1) {
      const pkgPath = path.join(current, "package.json");
      try {
        const raw = await fs.readFile(pkgPath, "utf-8");
        const parsed = JSON.parse(raw) as { name?: string };
        const name = parsed?.name?.trim();
        if (name && CORE_PACKAGE_NAMES.has(name)) {
          return current;
        }
      } catch {
        // ignore
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return null;
}

async function detectPackageManager(root: string) {
  return (await detectPackageManagerImpl(root)) ?? "npm";
}

type RunStepOptions = {
  runCommand: CommandRunner;
  name: string;
  argv: string[];
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  progress?: UpdateStepProgress;
  stepIndex: number;
  totalSteps: number;
};

async function runStep(opts: RunStepOptions): Promise<UpdateStepResult> {
  const { runCommand, name, argv, cwd, timeoutMs, env, progress, stepIndex, totalSteps } = opts;
  const command = argv.join(" ");

  const stepInfo: UpdateStepInfo = {
    name,
    command,
    index: stepIndex,
    total: totalSteps,
  };

  progress?.onStepStart?.(stepInfo);

  const started = Date.now();
  const result = await runCommand(argv, { cwd, timeoutMs, env });
  const durationMs = Date.now() - started;

  const stderrTail = trimLogTail(result.stderr, MAX_LOG_CHARS);

  progress?.onStepComplete?.({
    ...stepInfo,
    durationMs,
    exitCode: result.code,
    stderrTail,
  });

  return {
    name,
    command,
    cwd,
    durationMs,
    exitCode: result.code,
    stdoutTail: trimLogTail(result.stdout, MAX_LOG_CHARS),
    stderrTail: trimLogTail(result.stderr, MAX_LOG_CHARS),
  };
}

function managerScriptArgs(manager: "pnpm" | "bun" | "npm", script: string, args: string[] = []) {
  if (manager === "pnpm") {
    return ["pnpm", script, ...args];
  }
  if (manager === "bun") {
    return ["bun", "run", script, ...args];
  }
  if (args.length > 0) {
    return ["npm", "run", script, "--", ...args];
  }
  return ["npm", "run", script];
}

function managerInstallArgs(manager: "pnpm" | "bun" | "npm") {
  if (manager === "pnpm") {
    return ["pnpm", "install"];
  }
  if (manager === "bun") {
    return ["bun", "install"];
  }
  return ["npm", "install"];
}

function normalizeTag(tag?: string) {
  const trimmed = tag?.trim();
  if (!trimmed) {
    return "latest";
  }
  if (trimmed.startsWith("winclaw@")) {
    return trimmed.slice("winclaw@".length);
  }
  if (trimmed.startsWith(`${DEFAULT_PACKAGE_NAME}@`)) {
    return trimmed.slice(`${DEFAULT_PACKAGE_NAME}@`.length);
  }
  return trimmed;
}

export async function runGatewayUpdate(opts: UpdateRunnerOptions = {}): Promise<UpdateRunResult> {
  const startedAt = Date.now();
  const runCommand =
    opts.runCommand ??
    (async (argv, options) => {
      const res = await runCommandWithTimeout(argv, options);
      return { stdout: res.stdout, stderr: res.stderr, code: res.code };
    });
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const progress = opts.progress;
  const steps: UpdateStepResult[] = [];
  const candidates = buildStartDirs(opts);

  let stepIndex = 0;
  let gitTotalSteps = 0;

  const step = (
    name: string,
    argv: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv,
  ): RunStepOptions => {
    const currentIndex = stepIndex;
    stepIndex += 1;
    return {
      runCommand,
      name,
      argv,
      cwd,
      timeoutMs,
      env,
      progress,
      stepIndex: currentIndex,
      totalSteps: gitTotalSteps,
    };
  };

  const pkgRoot = await findPackageRoot(candidates);

  let gitRoot = await resolveGitRoot(runCommand, candidates, timeoutMs);
  if (gitRoot && pkgRoot && path.resolve(gitRoot) !== path.resolve(pkgRoot)) {
    gitRoot = null;
  }

  if (gitRoot && !pkgRoot) {
    return {
      status: "error",
      mode: "unknown",
      root: gitRoot,
      reason: "not-winclaw-root",
      steps: [],
      durationMs: Date.now() - startedAt,
    };
  }

  if (gitRoot && pkgRoot && path.resolve(gitRoot) === path.resolve(pkgRoot)) {
    // Get current SHA (not a visible step, no progress)
    const beforeShaResult = await runCommand(["git", "-C", gitRoot, "rev-parse", "HEAD"], {
      cwd: gitRoot,
      timeoutMs,
    });
    const beforeSha = beforeShaResult.stdout.trim() || null;
    const beforeVersion = await readPackageVersion(gitRoot);
    const channel: UpdateChannel = opts.channel ?? "dev";
    const branch = channel === "dev" ? await readBranchName(runCommand, gitRoot, timeoutMs) : null;
    const needsCheckoutMain = channel === "dev" && branch !== DEV_BRANCH;
    gitTotalSteps = channel === "dev" ? (needsCheckoutMain ? 11 : 10) : 9;
    const buildGitErrorResult = (reason: string): UpdateRunResult => ({
      status: "error",
      mode: "git",
      root: gitRoot,
      reason,
      before: { sha: beforeSha, version: beforeVersion },
      steps,
      durationMs: Date.now() - startedAt,
    });
    const runGitCheckoutOrFail = async (name: string, argv: string[]) => {
      const checkoutStep = await runStep(step(name, argv, gitRoot));
      steps.push(checkoutStep);
      if (checkoutStep.exitCode !== 0) {
        return buildGitErrorResult("checkout-failed");
      }
      return null;
    };

    const statusCheck = await runStep(
      step(
        "clean check",
        ["git", "-C", gitRoot, "status", "--porcelain", "--", ":!dist/control-ui/"],
        gitRoot,
      ),
    );
    steps.push(statusCheck);
    const hasUncommittedChanges =
      statusCheck.stdoutTail && statusCheck.stdoutTail.trim().length > 0;
    if (hasUncommittedChanges) {
      return {
        status: "skipped",
        mode: "git",
        root: gitRoot,
        reason: "dirty",
        before: { sha: beforeSha, version: beforeVersion },
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    if (channel === "dev") {
      if (needsCheckoutMain) {
        const failure = await runGitCheckoutOrFail(`git checkout ${DEV_BRANCH}`, [
          "git",
          "-C",
          gitRoot,
          "checkout",
          DEV_BRANCH,
        ]);
        if (failure) {
          return failure;
        }
      }

      const upstreamStep = await runStep(
        step(
          "upstream check",
          [
            "git",
            "-C",
            gitRoot,
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
          ],
          gitRoot,
        ),
      );
      steps.push(upstreamStep);
      if (upstreamStep.exitCode !== 0) {
        return {
          status: "skipped",
          mode: "git",
          root: gitRoot,
          reason: "no-upstream",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const fetchStep = await runStep(
        step("git fetch", ["git", "-C", gitRoot, "fetch", "--all", "--prune", "--tags"], gitRoot),
      );
      steps.push(fetchStep);

      const upstreamShaStep = await runStep(
        step(
          "git rev-parse @{upstream}",
          ["git", "-C", gitRoot, "rev-parse", "@{upstream}"],
          gitRoot,
        ),
      );
      steps.push(upstreamShaStep);
      const upstreamSha = upstreamShaStep.stdoutTail?.trim();
      if (!upstreamShaStep.stdoutTail || !upstreamSha) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "no-upstream-sha",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const revListStep = await runStep(
        step(
          "git rev-list",
          ["git", "-C", gitRoot, "rev-list", `--max-count=${PREFLIGHT_MAX_COMMITS}`, upstreamSha],
          gitRoot,
        ),
      );
      steps.push(revListStep);
      if (revListStep.exitCode !== 0) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "preflight-revlist-failed",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const candidates = (revListStep.stdoutTail ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (candidates.length === 0) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "preflight-no-candidates",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const manager = await detectPackageManager(gitRoot);
      const preflightRoot = await fs.mkdtemp(path.join(os.tmpdir(), "winclaw-update-preflight-"));
      const worktreeDir = path.join(preflightRoot, "worktree");
      const worktreeStep = await runStep(
        step(
          "preflight worktree",
          ["git", "-C", gitRoot, "worktree", "add", "--detach", worktreeDir, upstreamSha],
          gitRoot,
        ),
      );
      steps.push(worktreeStep);
      if (worktreeStep.exitCode !== 0) {
        await fs.rm(preflightRoot, { recursive: true, force: true }).catch(() => {});
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "preflight-worktree-failed",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      let selectedSha: string | null = null;
      try {
        for (const sha of candidates) {
          const shortSha = sha.slice(0, 8);
          const checkoutStep = await runStep(
            step(
              `preflight checkout (${shortSha})`,
              ["git", "-C", worktreeDir, "checkout", "--detach", sha],
              worktreeDir,
            ),
          );
          steps.push(checkoutStep);
          if (checkoutStep.exitCode !== 0) {
            continue;
          }

          const depsStep = await runStep(
            step(`preflight deps install (${shortSha})`, managerInstallArgs(manager), worktreeDir),
          );
          steps.push(depsStep);
          if (depsStep.exitCode !== 0) {
            continue;
          }

          const buildStep = await runStep(
            step(`preflight build (${shortSha})`, managerScriptArgs(manager, "build"), worktreeDir),
          );
          steps.push(buildStep);
          if (buildStep.exitCode !== 0) {
            continue;
          }

          const lintStep = await runStep(
            step(`preflight lint (${shortSha})`, managerScriptArgs(manager, "lint"), worktreeDir),
          );
          steps.push(lintStep);
          if (lintStep.exitCode !== 0) {
            continue;
          }

          selectedSha = sha;
          break;
        }
      } finally {
        const removeStep = await runStep(
          step(
            "preflight cleanup",
            ["git", "-C", gitRoot, "worktree", "remove", "--force", worktreeDir],
            gitRoot,
          ),
        );
        steps.push(removeStep);
        await runCommand(["git", "-C", gitRoot, "worktree", "prune"], {
          cwd: gitRoot,
          timeoutMs,
        }).catch(() => null);
        await fs.rm(preflightRoot, { recursive: true, force: true }).catch(() => {});
      }

      if (!selectedSha) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "preflight-no-good-commit",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const rebaseStep = await runStep(
        step("git rebase", ["git", "-C", gitRoot, "rebase", selectedSha], gitRoot),
      );
      steps.push(rebaseStep);
      if (rebaseStep.exitCode !== 0) {
        const abortResult = await runCommand(["git", "-C", gitRoot, "rebase", "--abort"], {
          cwd: gitRoot,
          timeoutMs,
        });
        steps.push({
          name: "git rebase --abort",
          command: "git rebase --abort",
          cwd: gitRoot,
          durationMs: 0,
          exitCode: abortResult.code,
          stdoutTail: trimLogTail(abortResult.stdout, MAX_LOG_CHARS),
          stderrTail: trimLogTail(abortResult.stderr, MAX_LOG_CHARS),
        });
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "rebase-failed",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }
    } else {
      const fetchStep = await runStep(
        step("git fetch", ["git", "-C", gitRoot, "fetch", "--all", "--prune", "--tags"], gitRoot),
      );
      steps.push(fetchStep);
      if (fetchStep.exitCode !== 0) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "fetch-failed",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const tag = await resolveChannelTag(runCommand, gitRoot, timeoutMs, channel);
      if (!tag) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "no-release-tag",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const failure = await runGitCheckoutOrFail(`git checkout ${tag}`, [
        "git",
        "-C",
        gitRoot,
        "checkout",
        "--detach",
        tag,
      ]);
      if (failure) {
        return failure;
      }
    }

    const manager = await detectPackageManager(gitRoot);

    const depsStep = await runStep(step("deps install", managerInstallArgs(manager), gitRoot));
    steps.push(depsStep);
    if (depsStep.exitCode !== 0) {
      return {
        status: "error",
        mode: "git",
        root: gitRoot,
        reason: "deps-install-failed",
        before: { sha: beforeSha, version: beforeVersion },
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    const buildStep = await runStep(step("build", managerScriptArgs(manager, "build"), gitRoot));
    steps.push(buildStep);
    if (buildStep.exitCode !== 0) {
      return {
        status: "error",
        mode: "git",
        root: gitRoot,
        reason: "build-failed",
        before: { sha: beforeSha, version: beforeVersion },
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    const uiBuildStep = await runStep(
      step("ui:build", managerScriptArgs(manager, "ui:build"), gitRoot),
    );
    steps.push(uiBuildStep);
    if (uiBuildStep.exitCode !== 0) {
      return {
        status: "error",
        mode: "git",
        root: gitRoot,
        reason: "ui-build-failed",
        before: { sha: beforeSha, version: beforeVersion },
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    const doctorEntry = path.join(gitRoot, "winclaw.mjs");
    const doctorEntryExists = await fs
      .stat(doctorEntry)
      .then(() => true)
      .catch(() => false);
    if (!doctorEntryExists) {
      steps.push({
        name: "winclaw doctor entry",
        command: `verify ${doctorEntry}`,
        cwd: gitRoot,
        durationMs: 0,
        exitCode: 1,
        stderrTail: `missing ${doctorEntry}`,
      });
      return {
        status: "error",
        mode: "git",
        root: gitRoot,
        reason: "doctor-entry-missing",
        before: { sha: beforeSha, version: beforeVersion },
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    // Use --fix so that doctor auto-strips unknown config keys introduced by
    // schema changes between versions, preventing a startup validation crash.
    const doctorArgv = [process.execPath, doctorEntry, "doctor", "--non-interactive", "--fix"];
    const doctorStep = await runStep(
      step("winclaw doctor", doctorArgv, gitRoot, { WINCLAW_UPDATE_IN_PROGRESS: "1" }),
    );
    steps.push(doctorStep);

    const uiIndexHealth = await resolveControlUiDistIndexHealth({ root: gitRoot });
    if (!uiIndexHealth.exists) {
      const repairArgv = managerScriptArgs(manager, "ui:build");
      const started = Date.now();
      const repairResult = await runCommand(repairArgv, { cwd: gitRoot, timeoutMs });
      const repairStep: UpdateStepResult = {
        name: "ui:build (post-doctor repair)",
        command: repairArgv.join(" "),
        cwd: gitRoot,
        durationMs: Date.now() - started,
        exitCode: repairResult.code,
        stdoutTail: trimLogTail(repairResult.stdout, MAX_LOG_CHARS),
        stderrTail: trimLogTail(repairResult.stderr, MAX_LOG_CHARS),
      };
      steps.push(repairStep);

      if (repairResult.code !== 0) {
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: repairStep.name,
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }

      const repairedUiIndexHealth = await resolveControlUiDistIndexHealth({ root: gitRoot });
      if (!repairedUiIndexHealth.exists) {
        const uiIndexPath =
          repairedUiIndexHealth.indexPath ?? resolveControlUiDistIndexPathForRoot(gitRoot);
        steps.push({
          name: "ui assets verify",
          command: `verify ${uiIndexPath}`,
          cwd: gitRoot,
          durationMs: 0,
          exitCode: 1,
          stderrTail: `missing ${uiIndexPath}`,
        });
        return {
          status: "error",
          mode: "git",
          root: gitRoot,
          reason: "ui-assets-missing",
          before: { sha: beforeSha, version: beforeVersion },
          steps,
          durationMs: Date.now() - startedAt,
        };
      }
    }

    const failedStep = steps.find((s) => s.exitCode !== 0);
    const afterShaStep = await runStep(
      step("git rev-parse HEAD (after)", ["git", "-C", gitRoot, "rev-parse", "HEAD"], gitRoot),
    );
    steps.push(afterShaStep);
    const afterVersion = await readPackageVersion(gitRoot);

    return {
      status: failedStep ? "error" : "ok",
      mode: "git",
      root: gitRoot,
      reason: failedStep ? failedStep.name : undefined,
      before: { sha: beforeSha, version: beforeVersion },
      after: {
        sha: afterShaStep.stdoutTail?.trim() ?? null,
        version: afterVersion,
      },
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!pkgRoot) {
    return {
      status: "error",
      mode: "unknown",
      reason: `no root (${START_DIRS.join(",")})`,
      steps: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const beforeVersion = await readPackageVersion(pkgRoot);
  const globalManager = await detectGlobalInstallManagerForRoot(runCommand, pkgRoot, timeoutMs);
  if (globalManager) {
    const packageName = (await readPackageName(pkgRoot)) ?? DEFAULT_PACKAGE_NAME;
    await cleanupGlobalRenameDirs({
      globalRoot: path.dirname(pkgRoot),
      packageName,
    });
    const channel = opts.channel ?? DEFAULT_PACKAGE_CHANNEL;
    const tag = normalizeTag(opts.tag ?? channelToNpmTag(channel));
    const spec = `${packageName}@${tag}`;
    const updateStep = await runStep({
      runCommand,
      name: "global update",
      argv: globalInstallArgs(globalManager, spec),
      cwd: pkgRoot,
      timeoutMs,
      progress,
      stepIndex: 0,
      totalSteps: 1,
    });
    const steps = [updateStep];
    const afterVersion = await readPackageVersion(pkgRoot);
    return {
      status: updateStep.exitCode === 0 ? "ok" : "error",
      mode: globalManager,
      root: pkgRoot,
      reason: updateStep.exitCode === 0 ? undefined : updateStep.name,
      before: { version: beforeVersion },
      after: { version: afterVersion },
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    status: "skipped",
    mode: "unknown",
    root: pkgRoot,
    reason: "not-git-install",
    before: { version: beforeVersion },
    steps: [],
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// GRC-based update flow
// ---------------------------------------------------------------------------

export type GrcUpdateOptions = {
  /** GRC server base URL. */
  grcUrl: string;
  /** Bearer token for authenticated endpoints. */
  authToken?: string;
  /** Current WinClaw version string (e.g. "2026.3.2"). */
  currentVersion: string;
  /** Update channel ("stable" | "beta" | "dev"). */
  channel?: UpdateChannel;
  /** Timeout per HTTP request in ms. Default: 15 000. */
  timeoutMs?: number;
  /** Abort signal for cooperative cancellation. */
  abortSignal?: AbortSignal;
};

/**
 * Check for updates via the GRC server and return the manifest if one is
 * available.  This function intentionally does NOT download or install the
 * update -- that responsibility stays with the existing `runGatewayUpdate`
 * flow.  The caller (e.g. `GrcSyncService`) can inspect `grcManifest` and
 * decide whether to proceed.
 *
 * The returned `UpdateRunResult.mode` is always `"grc"`.  When no update is
 * available the status will be `"skipped"` with reason `"up-to-date"`.
 */
export async function runGrcUpdateCheck(
  opts: GrcUpdateOptions,
): Promise<UpdateRunResult> {
  const startedAt = Date.now();
  const platform = os.platform();
  const channel = opts.channel ?? "stable";
  const steps: UpdateStepResult[] = [];

  const client = new GrcClient({
    baseUrl: opts.grcUrl,
    authToken: opts.authToken,
    timeout: opts.timeoutMs,
  });

  // Step 1: connectivity check
  const pingStarted = Date.now();
  let reachable: boolean;
  try {
    reachable = await client.ping(opts.abortSignal);
  } catch {
    reachable = false;
  }
  steps.push({
    name: "grc ping",
    command: `GET ${opts.grcUrl}/health`,
    cwd: ".",
    durationMs: Date.now() - pingStarted,
    exitCode: reachable ? 0 : 1,
  });

  if (!reachable) {
    grcLog.warn("GRC server unreachable, skipping update check", { url: opts.grcUrl });
    return {
      status: "skipped",
      mode: "grc",
      reason: "grc-unreachable",
      before: { version: opts.currentVersion },
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  // Step 2: query the update endpoint
  const checkStarted = Date.now();
  let manifest: GrcUpdateCheckResult;
  try {
    manifest = await client.checkUpdate(
      opts.currentVersion,
      platform,
      channel,
      opts.abortSignal,
    );
    steps.push({
      name: "grc update check",
      command: `GET ${opts.grcUrl}/api/v1/update/check`,
      cwd: ".",
      durationMs: Date.now() - checkStarted,
      exitCode: 0,
      stdoutTail: JSON.stringify(manifest).slice(0, MAX_LOG_CHARS),
    });
  } catch (err) {
    const msg = (err as Error).message;
    grcLog.error(`GRC update check failed: ${msg}`);
    steps.push({
      name: "grc update check",
      command: `GET ${opts.grcUrl}/api/v1/update/check`,
      cwd: ".",
      durationMs: Date.now() - checkStarted,
      exitCode: 1,
      stderrTail: msg,
    });
    return {
      status: "error",
      mode: "grc",
      reason: "grc-check-failed",
      before: { version: opts.currentVersion },
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!manifest.available) {
    grcLog.info("WinClaw is up to date via GRC", { version: opts.currentVersion });
    return {
      status: "skipped",
      mode: "grc",
      reason: "up-to-date",
      before: { version: opts.currentVersion },
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  // Step 3: verify the checksum field exists if a download URL is provided
  if (manifest.downloadUrl && !manifest.checksumSha256) {
    grcLog.warn("GRC manifest has downloadUrl but missing checksumSha256, refusing to proceed");
    return {
      status: "error",
      mode: "grc",
      reason: "grc-missing-checksum",
      before: { version: opts.currentVersion },
      after: { version: manifest.version },
      grcManifest: manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  grcLog.info("GRC update available", {
    currentVersion: opts.currentVersion,
    newVersion: manifest.version,
    critical: manifest.isCritical,
    channel: manifest.channel,
  });

  return {
    status: "ok",
    mode: "grc",
    reason: manifest.isCritical ? "critical-update" : undefined,
    before: { version: opts.currentVersion },
    after: { version: manifest.version },
    grcManifest: manifest,
    steps,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// GRC-based download + install flow
// ---------------------------------------------------------------------------

export type GrcInstallOptions = {
  /** GRC server base URL. */
  grcUrl: string;
  /** Bearer token for authenticated endpoints. */
  authToken?: string;
  /** The update manifest returned by `runGrcUpdateCheck()` → `grcManifest`. */
  manifest: GrcUpdateCheckResult;
  /** Current WinClaw version string (e.g. "2026.3.2"). */
  currentVersion: string;
  /** Node ID for GRC report. */
  nodeId?: string;
  /** Progress callbacks. */
  progress?: UpdateStepProgress;
  /** Overall timeout in ms. Default: 900 000 (15 min). */
  timeoutMs?: number;
  /** Abort signal for cooperative cancellation. */
  abortSignal?: AbortSignal;
};

/**
 * Download, verify, and install a WinClaw update from the GRC manifest.
 *
 * - **Windows**: Downloads the EXE installer from `manifest.downloadUrl`,
 *   verifies SHA-256 checksum, then launches via PowerShell `Start-Process
 *   -Verb RunAs` for UAC elevation with `/SILENT /NORESTART` flags.
 *
 * - **Linux / macOS**: Uses the existing global install manager (npm / pnpm /
 *   bun) to install the specific version via `winclaw@<version>`.
 *
 * Reports the outcome to GRC via `POST /api/v1/update/report`.
 */
export async function runGrcDownloadAndInstall(
  opts: GrcInstallOptions,
): Promise<UpdateRunResult> {
  const startedAt = Date.now();
  const platform = os.platform();
  const steps: UpdateStepResult[] = [];
  const version = opts.manifest.version ?? opts.manifest.latest ?? "unknown";
  const runCommand: CommandRunner = runCommandWithTimeout;

  const client = new GrcClient({
    baseUrl: opts.grcUrl,
    authToken: opts.authToken,
    timeout: opts.timeoutMs ?? 900_000,
  });

  let result: UpdateRunResult;

  try {
    if (platform === "win32") {
      result = await installWindows({
        client,
        manifest: opts.manifest,
        currentVersion: opts.currentVersion,
        version,
        steps,
        progress: opts.progress,
        timeoutMs: opts.timeoutMs ?? 900_000,
        abortSignal: opts.abortSignal,
        startedAt,
        runCommand,
      });
    } else {
      result = await installUnix({
        manifest: opts.manifest,
        currentVersion: opts.currentVersion,
        version,
        steps,
        progress: opts.progress,
        timeoutMs: opts.timeoutMs ?? 900_000,
        abortSignal: opts.abortSignal,
        startedAt,
        runCommand,
      });
    }
  } catch (err) {
    const msg = (err as Error).message;
    grcLog.error(`GRC install failed: ${msg}`);
    result = {
      status: "error",
      mode: "grc",
      reason: msg,
      before: { version: opts.currentVersion },
      after: { version },
      grcManifest: opts.manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  // Report outcome to GRC (best-effort, never throw)
  if (opts.nodeId) {
    try {
      await client.reportUpdate(
        {
          nodeId: opts.nodeId,
          fromVersion: opts.currentVersion,
          toVersion: version,
          platform,
          success: result.status === "ok",
          errorMessage: result.status !== "ok" ? result.reason : undefined,
          durationMs: result.durationMs,
        },
        opts.abortSignal,
      );
      grcLog.info("Update result reported to GRC", {
        success: result.status === "ok",
        version,
      });
    } catch (reportErr) {
      grcLog.warn(`Failed to report update to GRC: ${(reportErr as Error).message}`);
    }
  }

  return result;
}

// -- Windows installer (EXE download + UAC) ----------------------------------

async function installWindows(ctx: {
  client: GrcClient;
  manifest: GrcUpdateCheckResult;
  currentVersion: string;
  version: string;
  steps: UpdateStepResult[];
  progress?: UpdateStepProgress;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  startedAt: number;
  runCommand: CommandRunner;
}): Promise<UpdateRunResult> {
  const { client, manifest, steps, progress, abortSignal, startedAt, runCommand } = ctx;
  const totalSteps = 3; // download, verify, install

  if (!manifest.downloadUrl) {
    return {
      status: "error",
      mode: "grc",
      reason: "no-download-url",
      before: { version: ctx.currentVersion },
      after: { version: ctx.version },
      grcManifest: manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  // 1. Download EXE to temp directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "winclaw-update-"));
  const exePath = path.join(tmpDir, `winclaw-${ctx.version}-setup.exe`);

  const dlStarted = Date.now();
  const dlStepInfo: UpdateStepInfo = {
    name: "download installer",
    command: `GET ${manifest.downloadUrl}`,
    index: 0,
    total: totalSteps,
  };
  progress?.onStepStart?.(dlStepInfo);

  try {
    await client.downloadExternalBinary(
      manifest.downloadUrl,
      exePath,
      ctx.timeoutMs,
      abortSignal,
    );
  } catch (err) {
    const msg = (err as Error).message;
    const dlDuration = Date.now() - dlStarted;
    progress?.onStepComplete?.({ ...dlStepInfo, durationMs: dlDuration, exitCode: 1, stderrTail: msg });
    steps.push({
      name: "download installer",
      command: `GET ${manifest.downloadUrl}`,
      cwd: tmpDir,
      durationMs: dlDuration,
      exitCode: 1,
      stderrTail: msg,
    });
    await cleanupTmpDir(tmpDir);
    return {
      status: "error",
      mode: "grc",
      reason: `download-failed: ${msg}`,
      before: { version: ctx.currentVersion },
      after: { version: ctx.version },
      grcManifest: manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  const dlDuration = Date.now() - dlStarted;
  progress?.onStepComplete?.({ ...dlStepInfo, durationMs: dlDuration, exitCode: 0 });
  steps.push({
    name: "download installer",
    command: `GET ${manifest.downloadUrl}`,
    cwd: tmpDir,
    durationMs: dlDuration,
    exitCode: 0,
  });

  // 2. SHA-256 verification
  const verifyStarted = Date.now();
  const verifyStepInfo: UpdateStepInfo = {
    name: "verify checksum",
    command: `sha256sum ${exePath}`,
    index: 1,
    total: totalSteps,
  };
  progress?.onStepStart?.(verifyStepInfo);

  if (manifest.checksumSha256) {
    const fileBuffer = await fs.readFile(exePath);
    const actualHash = createHash("sha256").update(fileBuffer).digest("hex");
    const expectedHash = manifest.checksumSha256.toLowerCase();

    if (actualHash !== expectedHash) {
      const verifyDuration = Date.now() - verifyStarted;
      const mismatchMsg = `SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}`;
      progress?.onStepComplete?.({ ...verifyStepInfo, durationMs: verifyDuration, exitCode: 1, stderrTail: mismatchMsg });
      steps.push({
        name: "verify checksum",
        command: `sha256sum ${exePath}`,
        cwd: tmpDir,
        durationMs: verifyDuration,
        exitCode: 1,
        stderrTail: mismatchMsg,
      });
      await cleanupTmpDir(tmpDir);
      return {
        status: "error",
        mode: "grc",
        reason: mismatchMsg,
        before: { version: ctx.currentVersion },
        after: { version: ctx.version },
        grcManifest: manifest,
        steps,
        durationMs: Date.now() - startedAt,
      };
    }

    grcLog.info("Checksum verified", { expected: expectedHash, actual: actualHash });
  } else {
    grcLog.warn("No checksum provided, skipping verification");
  }

  const verifyDuration = Date.now() - verifyStarted;
  progress?.onStepComplete?.({ ...verifyStepInfo, durationMs: verifyDuration, exitCode: 0 });
  steps.push({
    name: "verify checksum",
    command: `sha256sum ${exePath}`,
    cwd: tmpDir,
    durationMs: verifyDuration,
    exitCode: 0,
    stdoutTail: manifest.checksumSha256 ? "checksum OK" : "no checksum, skipped",
  });

  // 3. Launch installer with UAC elevation via PowerShell
  const psCommand = [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `$p = Start-Process -FilePath '${exePath.replace(/'/g, "''")}' -ArgumentList '/SILENT','/NORESTART' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`,
  ];

  const installStep = await runStep({
    runCommand,
    name: "install (UAC elevated)",
    argv: psCommand,
    cwd: tmpDir,
    timeoutMs: ctx.timeoutMs,
    progress,
    stepIndex: 2,
    totalSteps,
  });
  steps.push(installStep);

  // Cleanup temp directory (best-effort)
  await cleanupTmpDir(tmpDir);

  if (installStep.exitCode !== 0) {
    return {
      status: "error",
      mode: "grc",
      reason: `installer-exit-code-${installStep.exitCode}`,
      before: { version: ctx.currentVersion },
      after: { version: ctx.version },
      grcManifest: manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  grcLog.info("Windows installer completed successfully", { version: ctx.version });
  return {
    status: "ok",
    mode: "grc",
    before: { version: ctx.currentVersion },
    after: { version: ctx.version },
    grcManifest: manifest,
    steps,
    durationMs: Date.now() - startedAt,
  };
}

// -- Linux / macOS installer (npm/pnpm/bun global) ---------------------------

async function installUnix(ctx: {
  manifest: GrcUpdateCheckResult;
  currentVersion: string;
  version: string;
  steps: UpdateStepResult[];
  progress?: UpdateStepProgress;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  startedAt: number;
  runCommand: CommandRunner;
}): Promise<UpdateRunResult> {
  const { manifest, steps, progress, startedAt, runCommand } = ctx;
  const totalSteps = 1;
  const spec = `winclaw@${ctx.version}`;

  // Detect global install manager by checking which package manager has winclaw installed
  const manager = await detectGlobalInstallManagerByPresence(
    runCommand,
    30_000,
  ).catch(() => null) ?? "npm";

  const installArgv = globalInstallArgs(manager, spec);

  const installStep = await runStep({
    runCommand,
    name: `global install via ${manager}`,
    argv: installArgv,
    cwd: os.homedir(),
    timeoutMs: ctx.timeoutMs,
    progress,
    stepIndex: 0,
    totalSteps,
  });
  steps.push(installStep);

  if (installStep.exitCode !== 0) {
    return {
      status: "error",
      mode: "grc",
      reason: `${manager}-install-exit-code-${installStep.exitCode}`,
      before: { version: ctx.currentVersion },
      after: { version: ctx.version },
      grcManifest: manifest,
      steps,
      durationMs: Date.now() - startedAt,
    };
  }

  grcLog.info(`Unix install completed successfully via ${manager}`, { version: ctx.version, spec });
  return {
    status: "ok",
    mode: "grc",
    before: { version: ctx.currentVersion },
    after: { version: ctx.version },
    grcManifest: manifest,
    steps,
    durationMs: Date.now() - startedAt,
  };
}

// -- Helpers ------------------------------------------------------------------

async function cleanupTmpDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    grcLog.debug(`Failed to cleanup temp dir: ${dirPath}`);
  }
}
