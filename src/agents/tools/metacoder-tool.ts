import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const METACODER_WRAPPER = "/usr/local/bin/metacoder-wrapper.sh";
const METACODER_BINARY = "/usr/local/bin/metacoder";

const MODES = ["systest", "newproject", "modernize", "graph"] as const;

const MetaCoderSchema = Type.Object(
  {
    mode: Type.Union(
      MODES.map((m) => Type.Literal(m)),
      {
        description:
          "MetaCoder skill to invoke: 'systest' = test existing system, 'newproject' = create new project from requirements, 'modernize' = migrate legacy code to modern web, 'graph' = knowledge graph operations",
      },
    ),
    workspace: Type.Optional(
      Type.String({
        description:
          "Path to source/workspace directory (required for systest, modernize, graph). Inside container e.g. /home/winclaw/.winclaw/workspace/<sub>",
      }),
    ),
    output: Type.Optional(
      Type.String({
        description: "Output directory (required for newproject, modernize)",
      }),
    ),
    requirements: Type.Optional(
      Type.String({
        description:
          "Requirements text (newproject) — short summary or path to requirements.md file",
      }),
    ),
    backend_url: Type.Optional(
      Type.String({ description: "Backend URL for systest (e.g. http://localhost:8000)" }),
    ),
    frontend_url: Type.Optional(
      Type.String({ description: "Frontend URL for systest (e.g. http://localhost:5173)" }),
    ),
    graph_subcmd: Type.Optional(
      Type.Union([Type.Literal("status"), Type.Literal("rebuild"), Type.Literal("query")], {
        description: "Subcommand when mode=graph: status / rebuild / query",
      }),
    ),
    graph_query: Type.Optional(
      Type.String({ description: "Query string when graph_subcmd=query" }),
    ),
    extra_args: Type.Optional(
      Type.String({
        description:
          "Additional CLI arguments to pass through to metacoder (advanced, optional)",
      }),
    ),
    timeout_ms: Type.Optional(
      Type.Number({
        description: "Timeout in milliseconds. Default: 7200000 (2 hours).",
        minimum: 60_000,
        maximum: 14_400_000,
      }),
    ),
  },
  { additionalProperties: true },
);

function buildArgs(params: Record<string, unknown>): { mode: string; cliArgs: string[] } {
  const mode = readStringParam(params, "mode", { required: true });
  const cliArgs: string[] = [];

  switch (mode) {
    case "systest": {
      const workspace = readStringParam(params, "workspace");
      const backendUrl = readStringParam(params, "backend_url");
      const frontendUrl = readStringParam(params, "frontend_url");
      if (!workspace && !backendUrl && !frontendUrl) {
        throw new ToolInputError(
          "systest requires at least one of: workspace, backend_url, frontend_url",
        );
      }
      if (workspace) cliArgs.push("--workspace", workspace);
      if (backendUrl) cliArgs.push("--backend-url", backendUrl);
      if (frontendUrl) cliArgs.push("--frontend-url", frontendUrl);
      break;
    }
    case "newproject": {
      const output = readStringParam(params, "output", { required: true });
      const requirements = readStringParam(params, "requirements", { required: true });
      cliArgs.push("--output", output, "--requirements", requirements);
      break;
    }
    case "modernize": {
      const workspace = readStringParam(params, "workspace", { required: true });
      const output = readStringParam(params, "output", { required: true });
      cliArgs.push("--workspace", workspace, "--output", output);
      break;
    }
    case "graph": {
      const sub = readStringParam(params, "graph_subcmd") ?? "status";
      cliArgs.push(sub);
      if (sub === "query") {
        const q = readStringParam(params, "graph_query", { required: true });
        cliArgs.push(q);
      }
      break;
    }
  }

  const extra = readStringParam(params, "extra_args");
  if (extra) {
    // Split on whitespace, simple shell-like splitting
    extra.split(/\s+/).forEach((a) => a && cliArgs.push(a));
  }

  return { mode, cliArgs };
}

export function createMetaCoderTool(): AnyAgentTool {
  return {
    label: "MetaCoder",
    name: "metacoder",
    description: `Invoke MetaCoder for large-scale software development. MetaCoder uses semantic knowledge graphs and multi-agent TDD (PM + Coding + Reviewer + Tester).

USE THIS TOOL WHEN:
- Building NEW projects from requirements (game mods, web apps, SaaS, mobile apps)
- MIGRATING legacy code (COBOL, VB, AS-400, mainframe → modern web stack)
- TESTING existing projects with automated bug fixing (95% pass rate target)
- Working with LARGE codebases (>10K LoC) where semantic graph navigation matters

DO NOT USE FOR:
- Simple code edits (use Edit tool directly)
- Small scripts or prototypes (overkill, slow)
- Tasks requiring less than ~30 minutes of work

MODES:
- mode="newproject": requires output + requirements. Generates frontend + backend + tests.
- mode="modernize": requires workspace (legacy code dir) + output (new web app dir).
- mode="systest": requires workspace and/or backend_url/frontend_url. Auto-fixes bugs.
- mode="graph": semantic knowledge graph ops (status/rebuild/query).

API KEY: Automatically extracted from winclaw.json (synced from GRC). No manual setup.

EXECUTION TIME:
- newproject: 30 min - 4 hours depending on scope
- modernize: 1 - 8 hours depending on legacy size
- systest: 30 min - 2 hours per iteration
- graph rebuild: 5 - 30 min per ~10K LoC

REPORT: Heartbeat agent status updates while running. Final summary with file count, pass rate, and key decisions returned on completion.`,
    parameters: MetaCoderSchema,
    execute: async (_toolCallId, args) => {
      // Verify metacoder is available (Linux Docker container only)
      if (!existsSync(METACODER_BINARY)) {
        throw new ToolInputError(
          "MetaCoder binary not found at /usr/local/bin/metacoder. This tool only works inside the WinClaw Docker container with MetaCoder enabled.",
        );
      }
      if (!existsSync(METACODER_WRAPPER)) {
        throw new ToolInputError(
          "MetaCoder wrapper not found at /usr/local/bin/metacoder-wrapper.sh. Update Docker image to include MetaCoder integration.",
        );
      }

      const params = args as Record<string, unknown>;
      const { mode, cliArgs } = buildArgs(params);
      const timeoutMs = (params.timeout_ms as number | undefined) ?? 7_200_000;

      return new Promise((resolve, reject) => {
        execFile(
          METACODER_WRAPPER,
          [mode, ...cliArgs],
          {
            cwd: "/home/winclaw",
            encoding: "utf-8",
            maxBuffer: 32 * 1024 * 1024, // 32 MB
            timeout: timeoutMs,
            env: { ...process.env, FORCE_COLOR: "0" },
          },
          (err, stdout, stderr) => {
            if (err) {
              const code = (err as NodeJS.ErrnoException).code;
              const signal = (err as { signal?: string }).signal;
              const exitCode = (err as { code?: number }).code;
              reject(
                new ToolInputError(
                  `MetaCoder execution failed (signal=${signal} code=${code} exitCode=${exitCode}):\n${stderr.slice(0, 4000)}\n${stdout.slice(-4000)}`,
                ),
              );
              return;
            }
            const result = {
              mode,
              cli_args: cliArgs.join(" "),
              stdout_tail: stdout.slice(-8000),
              stderr_tail: stderr.slice(-2000),
              status: "completed",
            };
            resolve(jsonResult(result));
          },
        );
      });
    },
  };
}
