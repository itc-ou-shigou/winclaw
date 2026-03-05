/**
 * GrcSkillInstaller — download, verify, and extract GRC skill tarballs.
 *
 * Handles the full lifecycle of GRC-managed skills:
 *  - Download tarball from GRC (via presigned MinIO URL)
 *  - Verify SHA-256 checksum
 *  - Extract into the managed skills directory (~/.winclaw/skills/<slug>/)
 *  - Update the local manifest
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";

import { CONFIG_DIR, ensureDir } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { GrcClient } from "./grc-client.js";
import type { GrcSkillManifestStore } from "./grc-skill-manifest.js";

const log = createSubsystemLogger("infra/grc-skill-installer");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrcSkillInstallParams = {
  client: GrcClient;
  manifest: GrcSkillManifestStore;
  slug: string;
  version: string;
  name: string;
  expectedChecksum?: string;
  managedSkillsDir?: string;
  abortSignal?: AbortSignal;
};

export type GrcSkillInstallResult = {
  ok: boolean;
  slug: string;
  version: string;
  message: string;
  installedDir?: string;
};

// ---------------------------------------------------------------------------
// Default managed skills directory
// ---------------------------------------------------------------------------

export function getDefaultManagedSkillsDir(): string {
  return path.join(CONFIG_DIR, "skills");
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Download a skill tarball from GRC, verify its checksum, and extract it
 * into the managed skills directory.
 */
export async function installGrcSkill(
  params: GrcSkillInstallParams,
): Promise<GrcSkillInstallResult> {
  const {
    client,
    manifest,
    slug,
    version,
    name,
    expectedChecksum,
    abortSignal,
  } = params;
  const managedDir = params.managedSkillsDir ?? getDefaultManagedSkillsDir();
  const destDir = path.join(managedDir, slug);

  log.info("Installing GRC skill", { slug, version, destDir });

  // 1. Download tarball
  let buffer: Buffer;
  try {
    buffer = await client.downloadSkillTarball(slug, version, abortSignal);
  } catch (err) {
    const msg = `Failed to download skill tarball: ${(err as Error).message}`;
    log.error(msg, { slug, version });
    return { ok: false, slug, version, message: msg };
  }

  log.debug("Tarball downloaded", { slug, version, size: buffer.length });

  // 2. Verify SHA-256 checksum
  const actualChecksum = createHash("sha256").update(buffer).digest("hex");
  if (expectedChecksum && actualChecksum !== expectedChecksum) {
    const msg = `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`;
    log.error(msg, { slug, version });
    return { ok: false, slug, version, message: msg };
  }

  // 3. Prepare destination directory
  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    ensureDir(destDir);
  } catch (err) {
    const msg = `Failed to prepare directory: ${(err as Error).message}`;
    log.error(msg, { slug, destDir });
    return { ok: false, slug, version, message: msg };
  }

  // 4. Extract tarball
  try {
    const readable = Readable.from(buffer);
    await pipeline(
      readable,
      tar.x({
        cwd: destDir,
        strip: 1,
        preservePaths: false,
        strict: true,
      }),
    );
  } catch (err) {
    // Clean up on extraction failure
    try {
      fs.rmSync(destDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
    const msg = `Failed to extract tarball: ${(err as Error).message}`;
    log.error(msg, { slug, version });
    return { ok: false, slug, version, message: msg };
  }

  // 5. Verify SKILL.md exists
  const skillMdPath = path.join(destDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    log.warn("SKILL.md not found in extracted tarball — skill may not load correctly", {
      slug,
      version,
    });
  }

  // 6. Update manifest
  manifest.markInstalled(slug, {
    name,
    version,
    checksumSha256: actualChecksum,
    autoUpdate: true,
  });

  log.info("GRC skill installed successfully", { slug, version, destDir });

  return {
    ok: true,
    slug,
    version,
    message: `Skill ${slug}@${version} installed successfully`,
    installedDir: destDir,
  };
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

/**
 * Remove an installed GRC skill: delete its directory and manifest entry.
 */
export function uninstallGrcSkill(
  manifest: GrcSkillManifestStore,
  slug: string,
  managedSkillsDir?: string,
): GrcSkillInstallResult {
  const managedDir = managedSkillsDir ?? getDefaultManagedSkillsDir();
  const destDir = path.join(managedDir, slug);

  if (!manifest.isInstalled(slug)) {
    return {
      ok: false,
      slug,
      version: "",
      message: `Skill ${slug} is not installed`,
    };
  }

  const installed = manifest.getInstalled(slug);
  const version = installed?.installedVersion ?? "";

  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  } catch (err) {
    const msg = `Failed to remove skill directory: ${(err as Error).message}`;
    log.error(msg, { slug, destDir });
    return { ok: false, slug, version, message: msg };
  }

  manifest.markRemoved(slug);
  log.info("GRC skill uninstalled", { slug, version });

  return {
    ok: true,
    slug,
    version,
    message: `Skill ${slug}@${version} uninstalled successfully`,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an installed GRC skill to a new version.
 * Effectively uninstalls the old version, then installs the new one.
 */
export async function updateGrcSkill(
  params: GrcSkillInstallParams,
): Promise<GrcSkillInstallResult> {
  const managedDir = params.managedSkillsDir ?? getDefaultManagedSkillsDir();

  // Uninstall the old version (best effort — if it fails, install might still work)
  const destDir = path.join(managedDir, params.slug);
  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  } catch (err) {
    log.warn(`Failed to remove old version of ${params.slug}: ${(err as Error).message}`);
  }

  // Install the new version
  return installGrcSkill(params);
}
