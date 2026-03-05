/**
 * GrcSkillManifestStore — tracks GRC-installed skills on the local node.
 *
 * Persists to `~/.winclaw/grc-skill-manifest.json` (same directory as
 * evolution-store.json).  Follows the same synchronous-IO pattern used by
 * `EvolutionStore` for simplicity.
 */

import fs from "node:fs";
import path from "node:path";

import { CONFIG_DIR, ensureDir } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("infra/grc-skill-manifest");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrcInstalledSkill = {
  slug: string;
  name: string;
  installedVersion: string;
  checksumSha256: string;
  installedAt: string;
  updatedAt: string;
  remoteLatestVersion?: string;
  autoUpdate: boolean;
};

export type GrcSkillManifest = {
  version: 1;
  skills: Record<string, GrcInstalledSkill>;
};

// ---------------------------------------------------------------------------
// Semver helper (lightweight — no external dependency)
// ---------------------------------------------------------------------------

/**
 * Compare two semver strings (e.g. "1.2.3" vs "1.3.0").
 * Returns  <0 if a < b,  0 if a === b,  >0 if a > b.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const MANIFEST_FILE = "grc-skill-manifest.json";

export class GrcSkillManifestStore {
  private filePath: string;
  private data: GrcSkillManifest;

  constructor(configDir?: string) {
    const dir = configDir ?? CONFIG_DIR;
    ensureDir(dir);
    this.filePath = path.join(dir, MANIFEST_FILE);
    this.data = this.load();
  }

  // -- Queries -------------------------------------------------------------

  /** Check whether a skill is installed. */
  isInstalled(slug: string): boolean {
    return slug in this.data.skills;
  }

  /** Get the locally installed version, or null if not installed. */
  getInstalledVersion(slug: string): string | null {
    return this.data.skills[slug]?.installedVersion ?? null;
  }

  /** Get the full record for an installed skill. */
  getInstalled(slug: string): GrcInstalledSkill | null {
    return this.data.skills[slug] ?? null;
  }

  /** List all installed skills. */
  listInstalled(): GrcInstalledSkill[] {
    return Object.values(this.data.skills);
  }

  /** List skills where the remote version is newer than the installed version. */
  listOutdated(): GrcInstalledSkill[] {
    return Object.values(this.data.skills).filter((s) => {
      if (!s.remoteLatestVersion) return false;
      return compareSemver(s.remoteLatestVersion, s.installedVersion) > 0;
    });
  }

  // -- Mutations -----------------------------------------------------------

  /** Record a skill as installed (or update existing record). */
  markInstalled(
    slug: string,
    info: {
      name: string;
      version: string;
      checksumSha256: string;
      autoUpdate?: boolean;
    },
  ): void {
    const now = new Date().toISOString();
    const existing = this.data.skills[slug];
    this.data.skills[slug] = {
      slug,
      name: info.name,
      installedVersion: info.version,
      checksumSha256: info.checksumSha256,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
      remoteLatestVersion: existing?.remoteLatestVersion,
      autoUpdate: info.autoUpdate ?? existing?.autoUpdate ?? true,
    };
    this.save();
  }

  /** Remove a skill from the manifest. */
  markRemoved(slug: string): void {
    if (slug in this.data.skills) {
      delete this.data.skills[slug];
      this.save();
    }
  }

  /** Update the cached remote latest versions for one or more skills. */
  updateRemoteVersions(updates: { slug: string; version: string }[]): void {
    let changed = false;
    for (const { slug, version } of updates) {
      const skill = this.data.skills[slug];
      if (skill && skill.remoteLatestVersion !== version) {
        skill.remoteLatestVersion = version;
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }

  /** Set autoUpdate flag for a single skill. */
  setAutoUpdate(slug: string, enabled: boolean): void {
    const skill = this.data.skills[slug];
    if (skill) {
      skill.autoUpdate = enabled;
      this.save();
    }
  }

  // -- Persistence ---------------------------------------------------------

  private load(): GrcSkillManifest {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw) as GrcSkillManifest;
        if (parsed.version === 1 && parsed.skills) {
          return parsed;
        }
        log.warn("Manifest file has unexpected format, starting fresh");
      }
    } catch (err) {
      log.warn(`Failed to load skill manifest: ${(err as Error).message}`);
    }
    return { version: 1, skills: {} };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      ensureDir(dir);
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
    } catch (err) {
      log.error(`Failed to save skill manifest: ${(err as Error).message}`);
    }
  }
}
