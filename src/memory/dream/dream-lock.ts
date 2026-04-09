import fs from "node:fs/promises";
import path from "node:path";

const LOCK_FILE = ".dream-lock";
const HOLDER_STALE_MS = 60 * 60 * 1000; // 1 hour

export function dreamLockPath(memoryDir: string): string {
  return path.join(memoryDir, LOCK_FILE);
}

/**
 * mtime of the lock file IS lastDreamedAt. 0 if absent.
 */
export async function readLastDreamedAt(memoryDir: string): Promise<number> {
  try {
    const s = await fs.stat(dreamLockPath(memoryDir));
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to acquire the dream lock. Returns priorMtime (0 if no prior lock) on
 * success, or null if another live holder is active within HOLDER_STALE_MS.
 */
export async function tryAcquireDreamLock(
  memoryDir: string,
): Promise<number | null> {
  const lockPath = dreamLockPath(memoryDir);
  let priorMtime: number | undefined;
  let holderPid: number | undefined;

  try {
    const [s, raw] = await Promise.all([
      fs.stat(lockPath),
      fs.readFile(lockPath, "utf8"),
    ]);
    priorMtime = s.mtimeMs;
    const match = /^pid=(\d+)/m.exec(raw);
    if (match && match[1]) {holderPid = parseInt(match[1], 10);}
  } catch {
    // ENOENT — first dream
  }

  if (
    priorMtime !== undefined &&
    Date.now() - priorMtime < HOLDER_STALE_MS &&
    holderPid !== undefined &&
    isPidAlive(holderPid)
  ) {
    return null;
  }

  const body = `pid=${process.pid}\nstarted=${new Date().toISOString()}\n`;
  await fs.mkdir(memoryDir, { recursive: true });
  await fs.writeFile(lockPath, body, "utf8");

  return priorMtime ?? 0;
}

/**
 * Rewind mtime to priorMtime so the time-gate reopens. Best-effort.
 */
export async function rollbackDreamLock(
  memoryDir: string,
  priorMtime: number,
): Promise<void> {
  try {
    if (priorMtime === 0) {
      await fs.unlink(dreamLockPath(memoryDir));
    } else {
      const t = new Date(priorMtime);
      await fs.utimes(dreamLockPath(memoryDir), t, t);
    }
  } catch {
    // swallow
  }
}

/**
 * Touch the lock to "now" to record successful completion.
 */
export async function recordDreamCompletion(memoryDir: string): Promise<void> {
  const lockPath = dreamLockPath(memoryDir);
  const now = new Date();
  try {
    await fs.utimes(lockPath, now, now);
  } catch {
    await fs.writeFile(
      lockPath,
      `pid=${process.pid}\nfinished=${now.toISOString()}\n`,
      "utf8",
    );
  }
}
