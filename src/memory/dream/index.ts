export { executeDream, __resetDreamRunnerState } from "./dream-runner.js";
export type { DreamOptions, DreamResult, DreamAgentRunner } from "./dream-runner.js";
export { buildDreamPrompt, extractDreamReport } from "./dream-prompt.js";
export {
  resolveDreamConfig,
  resolveEntrypointLimits,
  DREAM_DEFAULTS,
  ENTRYPOINT_DEFAULTS,
} from "./dream-config.js";
export type { ResolvedDreamConfig, ResolvedEntrypointLimits } from "./dream-config.js";
export {
  listDreamTasks,
  getDreamTask,
  killDreamTask,
} from "./dream-task.js";
export type { DreamTaskState, DreamPhase } from "./dream-task.js";
export { listSnapshots, restoreSnapshot } from "./dream-backup.js";
export { readLastDreamedAt } from "./dream-lock.js";
