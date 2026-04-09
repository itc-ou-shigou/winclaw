import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  snapshotMemoryDir,
  restoreSnapshot,
  listSnapshots,
} from "./dream-backup.js";

let dir: string;

async function seed(dir: string): Promise<void> {
  await fs.writeFile(path.join(dir, "MEMORY.md"), "# index\n", "utf8");
  await fs.writeFile(path.join(dir, "memory_a.md"), "A\n", "utf8");
  await fs.writeFile(path.join(dir, "memory_b.md"), "B\n", "utf8");
  await fs.writeFile(path.join(dir, ".dream-lock"), "pid=1\n", "utf8");
  await fs.mkdir(path.join(dir, ".backups"), { recursive: true });
  await fs.writeFile(path.join(dir, ".backups", "old-file"), "x\n", "utf8");
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "dream-backup-"));
  await seed(dir);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("dream-backup", () => {
  it("snapshotMemoryDir copies .md files but skips .dream-lock and dotfiles", async () => {
    const id = await snapshotMemoryDir(dir, 10);
    expect(id.startsWith("dream-")).toBe(true);
    const snapDir = path.join(dir, ".backups", id);
    const entries = await fs.readdir(snapDir);
    expect(entries.toSorted()).toEqual(["MEMORY.md", "memory_a.md", "memory_b.md"]);
    await expect(fs.stat(path.join(snapDir, ".dream-lock"))).rejects.toThrow();
  });

  it("snapshotMemoryDir with keep=2 rotates oldest snapshots", async () => {
    const backupRoot = path.join(dir, ".backups");
    await fs.mkdir(path.join(backupRoot, "dream-0000"), { recursive: true });
    await fs.mkdir(path.join(backupRoot, "dream-0001"), { recursive: true });

    await snapshotMemoryDir(dir, 2);

    const entries = (await fs.readdir(backupRoot))
      .filter((e) => e.startsWith("dream-"))
      .toSorted();
    expect(entries.length).toBe(2);
    expect(entries).not.toContain("dream-0000");
    expect(entries).toContain("dream-0001");
  });

  it("restoreSnapshot overwrites files back into memoryDir", async () => {
    const id = await snapshotMemoryDir(dir, 10);
    // Mutate original
    await fs.writeFile(path.join(dir, "memory_a.md"), "MUTATED\n", "utf8");
    await fs.unlink(path.join(dir, "memory_b.md"));

    await restoreSnapshot(dir, id);

    expect(await fs.readFile(path.join(dir, "memory_a.md"), "utf8")).toBe("A\n");
    expect(await fs.readFile(path.join(dir, "memory_b.md"), "utf8")).toBe("B\n");
  });

  it("listSnapshots returns newest-first", async () => {
    const a = await snapshotMemoryDir(dir, 10);
    // Ensure timestamp strings differ
    await new Promise((r) => setTimeout(r, 10));
    const b = await snapshotMemoryDir(dir, 10);

    const list = await listSnapshots(dir);
    const ids = list.map((s) => s.id);
    expect(ids[0]).toBe(b);
    expect(ids[1]).toBe(a);
    expect(list[0].fileCount).toBeGreaterThan(0);
  });
});
