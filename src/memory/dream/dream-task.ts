import crypto from "node:crypto";

export type DreamPhase =
  | "pre-flight"
  | "orient"
  | "gather"
  | "consolidate"
  | "prune"
  | "reporting";

export type DreamTaskState =
  | {
      status: "running";
      taskId: string;
      startedAt: number;
      phase: DreamPhase;
      filesTouched: string[];
      priorMtime: number;
      snapshotId: string | null;
      abort: AbortController;
    }
  | {
      status: "completed";
      taskId: string;
      filesTouched: string[];
      startedAt: number;
      finishedAt: number;
    }
  | {
      status: "failed";
      taskId: string;
      error: string;
      phase: DreamPhase;
      startedAt: number;
      finishedAt: number;
    }
  | {
      status: "killed";
      taskId: string;
      startedAt: number;
      finishedAt: number;
    };

const tasks: Map<string, DreamTaskState> = new Map();

function generateTaskId(): string {
  const rand = crypto.randomBytes(3).toString("hex"); // 6 hex chars
  return `dream-${Date.now()}-${rand}`;
}

export function registerDreamTask(init: {
  sessionsReviewing: number;
  priorMtime: number;
  snapshotId: string | null;
}): string {
  const taskId = generateTaskId();
  tasks.set(taskId, {
    status: "running",
    taskId,
    startedAt: Date.now(),
    phase: "pre-flight",
    filesTouched: [],
    priorMtime: init.priorMtime,
    snapshotId: init.snapshotId,
    abort: new AbortController(),
  });
  // sessionsReviewing reserved for future progress reporting
  void init.sessionsReviewing;
  return taskId;
}

export function setDreamPhase(taskId: string, phase: DreamPhase): void {
  const t = tasks.get(taskId);
  if (t && t.status === "running") {
    t.phase = phase;
  }
}

export function addDreamTouched(taskId: string, filePath: string): void {
  const t = tasks.get(taskId);
  if (t && t.status === "running" && !t.filesTouched.includes(filePath)) {
    t.filesTouched.push(filePath);
  }
}

export function completeDreamTask(
  taskId: string,
  init: { filesTouched: string[] },
): void {
  const prev = tasks.get(taskId);
  const startedAt = prev && prev.status === "running" ? prev.startedAt : Date.now();
  tasks.set(taskId, {
    status: "completed",
    taskId,
    filesTouched: init.filesTouched,
    startedAt,
    finishedAt: Date.now(),
  });
}

export function failDreamTask(
  taskId: string,
  error: string,
  phase?: DreamPhase,
): void {
  const prev = tasks.get(taskId);
  const startedAt = prev && prev.status === "running" ? prev.startedAt : Date.now();
  const resolvedPhase: DreamPhase =
    phase ?? (prev && prev.status === "running" ? prev.phase : "pre-flight");
  tasks.set(taskId, {
    status: "failed",
    taskId,
    error,
    phase: resolvedPhase,
    startedAt,
    finishedAt: Date.now(),
  });
}

export function killDreamTask(taskId: string): void {
  const prev = tasks.get(taskId);
  if (!prev || prev.status !== "running") {return;}
  try {
    prev.abort.abort();
  } catch {
    // ignore
  }
  tasks.set(taskId, {
    status: "killed",
    taskId,
    startedAt: prev.startedAt,
    finishedAt: Date.now(),
  });
}

export function getDreamTask(taskId: string): DreamTaskState | undefined {
  return tasks.get(taskId);
}

export function listDreamTasks(): DreamTaskState[] {
  return Array.from(tasks.values());
}

export function getAbortSignal(taskId: string): AbortSignal | undefined {
  const t = tasks.get(taskId);
  if (t && t.status === "running") {return t.abort.signal;}
  return undefined;
}

export function resetDreamTasks(): void {
  tasks.clear();
}
