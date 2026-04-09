import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const BACKUP_SUBDIR = ".backups";

export type DreamSnapshotInfo = {
  id: string;
  createdAt: number;
  fileCount: number;
};

async function listMemoryMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = (await fs.readdir(d, { withFileTypes: true }));
    } catch {
      return;
    }
    for (const e of entries) {
      const name: string = e.name;
      if (name === BACKUP_SUBDIR) {continue;}
      if (name.startsWith(".")) {continue;}
      const p = path.join(d, name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.isFile() && (name.endsWith(".md") || name === "MEMORY.md")) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out;
}

async function listAllFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = (await fs.readdir(d, { withFileTypes: true }));
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out;
}

export async function snapshotMemoryDir(
  memoryDir: string,
  keep: number,
): Promise<string> {
  const backupRoot = path.join(memoryDir, BACKUP_SUBDIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotId = `dream-${timestamp}`;
  const target = path.join(backupRoot, snapshotId);

  await fs.mkdir(target, { recursive: true });

  const files = await listMemoryMarkdownFiles(memoryDir);
  for (const f of files) {
    const rel = path.relative(memoryDir, f);
    const dest = path.join(target, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(f, dest);
  }

  await rotateBackups(backupRoot, keep);

  return snapshotId;
}

export async function restoreSnapshot(
  memoryDir: string,
  snapshotId: string,
): Promise<void> {
  const src = path.join(memoryDir, BACKUP_SUBDIR, snapshotId);
  const files = await listAllFiles(src);
  for (const f of files) {
    const rel = path.relative(src, f);
    const dest = path.join(memoryDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(f, dest);
  }
}

export async function listSnapshots(
  memoryDir: string,
): Promise<DreamSnapshotInfo[]> {
  const backupRoot = path.join(memoryDir, BACKUP_SUBDIR);
  let entries: string[];
  try {
    entries = await fs.readdir(backupRoot);
  } catch {
    return [];
  }
  const snapshots: DreamSnapshotInfo[] = [];
  for (const name of entries) {
    if (!name.startsWith("dream-")) {continue;}
    const full = path.join(backupRoot, name);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {continue;}
    const files = await listAllFiles(full);
    snapshots.push({
      id: name,
      createdAt: stat.mtimeMs,
      fileCount: files.length,
    });
  }
  snapshots.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return snapshots;
}

async function rotateBackups(root: string, keep: number): Promise<void> {
  try {
    const entries = await fs.readdir(root);
    const sorted = entries.filter((e) => e.startsWith("dream-")).toSorted();
    const toDelete = sorted.slice(0, Math.max(0, sorted.length - keep));
    for (const d of toDelete) {
      await fs.rm(path.join(root, d), { recursive: true, force: true });
    }
  } catch {
    // best-effort
  }
}
