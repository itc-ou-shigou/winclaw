/**
 * Storage location helper.
 *
 * All ext-memory-wiki state lives under ~/.winclaw-avatar/ext/memory-wiki/,
 * intentionally outside any path used by memory-core, ClawMem, LCM, DH, or GRC.
 */

import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export function getExtStorageDir(): string {
  const override = process.env.AVATAR_EXT_MEMORY_WIKI_DIR;
  if (override && override.length > 0) return override;
  return join(homedir(), ".winclaw-avatar", "ext", "memory-wiki");
}

export async function ensureExtStorageDir(): Promise<string> {
  const dir = getExtStorageDir();
  await mkdir(dir, { recursive: true });
  return dir;
}
