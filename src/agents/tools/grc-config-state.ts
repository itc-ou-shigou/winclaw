/**
 * Shared utility for reading GRC config state.
 *
 * Extracted from individual tool files to eliminate duplication (H3).
 * All GRC task tools import this instead of having their own copy.
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Read the role ID from the GRC config state file (~/.winclaw/grc-config-state.json).
 */
export function readRoleIdFromConfigState(): string | undefined {
  try {
    const statePath = path.join(os.homedir(), ".winclaw", "grc-config-state.json");
    const raw = fs.readFileSync(statePath, "utf-8");
    const data = JSON.parse(raw) as { roleId?: string };
    return data.roleId ?? undefined;
  } catch {
    return undefined;
  }
}
