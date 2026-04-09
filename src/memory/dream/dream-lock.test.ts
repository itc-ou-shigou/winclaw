import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  dreamLockPath,
  readLastDreamedAt,
  tryAcquireDreamLock,
  rollbackDreamLock,
  recordDreamCompletion,
} from "./dream-lock.js";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "dream-lock-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("dream-lock", () => {
  it("readLastDreamedAt returns 0 when lock is absent", async () => {
    expect(await readLastDreamedAt(dir)).toBe(0);
  });

  it("first tryAcquireDreamLock returns 0 (priorMtime) on empty dir", async () => {
    const prior = await tryAcquireDreamLock(dir);
    expect(prior).toBe(0);
    const s = await fs.stat(dreamLockPath(dir));
    expect(s.isFile()).toBe(true);
  });

  it("second tryAcquireDreamLock in same process is blocked (live pid)", async () => {
    const first = await tryAcquireDreamLock(dir);
    expect(first).toBe(0);
    const second = await tryAcquireDreamLock(dir);
    expect(second).toBeNull();
  });

  it("stale lock with dead pid is reclaimed", async () => {
    const lockPath = dreamLockPath(dir);
    await fs.mkdir(dir, { recursive: true });
    // Write a lock owned by (almost certainly) nonexistent pid
    await fs.writeFile(lockPath, "pid=999999\nstarted=2000-01-01T00:00:00.000Z\n", "utf8");
    // Rewind mtime to > HOLDER_STALE_MS ago
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.utimes(lockPath, old, old);

    const prior = await tryAcquireDreamLock(dir);
    expect(prior).not.toBeNull();
    expect(prior).toBeGreaterThan(0);
  });

  it("rollbackDreamLock with priorMtime=0 unlinks the file", async () => {
    await tryAcquireDreamLock(dir);
    await rollbackDreamLock(dir, 0);
    await expect(fs.stat(dreamLockPath(dir))).rejects.toThrow();
  });

  it("rollbackDreamLock with priorMtime>0 rewinds mtime", async () => {
    await tryAcquireDreamLock(dir);
    const target = Date.now() - 10 * 60 * 60 * 1000; // 10h ago
    await rollbackDreamLock(dir, target);
    const s = await fs.stat(dreamLockPath(dir));
    expect(Math.abs(s.mtimeMs - target)).toBeLessThan(2000);
  });

  it("recordDreamCompletion updates mtime to near now", async () => {
    await tryAcquireDreamLock(dir);
    // rewind first
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000);
    await fs.utimes(dreamLockPath(dir), old, old);

    await recordDreamCompletion(dir);
    const s = await fs.stat(dreamLockPath(dir));
    expect(Math.abs(s.mtimeMs - Date.now())).toBeLessThan(5000);
  });
});
