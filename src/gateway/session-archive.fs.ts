import fs from "node:fs";
import path from "node:path";
import {
  formatSessionArchiveTimestamp,
  parseSessionArchiveTimestamp,
  type SessionArchiveReason,
} from "../config/sessions.js";
import { resolveSessionTranscriptCandidates } from "./session-utils.fs.js";

export type ArchiveFileReason = SessionArchiveReason;

function canonicalizePathForComparison(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

export function archiveFileOnDisk(filePath: string, reason: ArchiveFileReason): string {
  const ts = formatSessionArchiveTimestamp();
  const archived = `${filePath}.${reason}.${ts}`;
  fs.renameSync(filePath, archived);
  return archived;
}

/**
 * Archives all transcript files for a given session.
 * Best-effort: silently skips files that don't exist or fail to rename.
 */
export function archiveSessionTranscripts(opts: {
  sessionId: string;
  storePath: string | undefined;
  sessionFile?: string;
  agentId?: string;
  reason: "reset" | "deleted";
  /**
   * When true, only archive files resolved under the session store directory.
   * This prevents maintenance operations from mutating paths outside the agent sessions dir.
   */
  restrictToStoreDir?: boolean;
}): string[] {
  const archived: string[] = [];
  const storeDir =
    opts.restrictToStoreDir && opts.storePath
      ? canonicalizePathForComparison(path.dirname(opts.storePath))
      : null;
  for (const candidate of resolveSessionTranscriptCandidates(
    opts.sessionId,
    opts.storePath,
    opts.sessionFile,
    opts.agentId,
  )) {
    const candidatePath = canonicalizePathForComparison(candidate);
    if (storeDir) {
      const relative = path.relative(storeDir, candidatePath);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        continue;
      }
    }
    if (!fs.existsSync(candidatePath)) {
      continue;
    }
    try {
      archived.push(archiveFileOnDisk(candidatePath, opts.reason));
    } catch {
      // Best-effort.
    }
  }
  return archived;
}

export async function cleanupArchivedSessionTranscripts(opts: {
  directories: string[];
  olderThanMs: number;
  reason?: ArchiveFileReason;
  nowMs?: number;
}): Promise<{ removed: number; scanned: number }> {
  if (!Number.isFinite(opts.olderThanMs) || opts.olderThanMs < 0) {
    return { removed: 0, scanned: 0 };
  }
  const now = opts.nowMs ?? Date.now();
  const reason: ArchiveFileReason = opts.reason ?? "deleted";
  const directories = Array.from(new Set(opts.directories.map((dir) => path.resolve(dir))));
  let removed = 0;
  let scanned = 0;

  for (const dir of directories) {
    const entries = await fs.promises.readdir(dir).catch(() => []);
    for (const entry of entries) {
      const timestamp = parseSessionArchiveTimestamp(entry, reason);
      if (timestamp == null) {
        continue;
      }
      scanned += 1;
      if (now - timestamp <= opts.olderThanMs) {
        continue;
      }
      const fullPath = path.join(dir, entry);
      const stat = await fs.promises.stat(fullPath).catch(() => null);
      if (!stat?.isFile()) {
        continue;
      }
      await fs.promises.rm(fullPath).catch(() => undefined);
      removed += 1;
    }
  }

  return { removed, scanned };
}
