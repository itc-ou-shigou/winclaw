import os from "node:os";
import path from "node:path";

/** Prefixes of known read-only / system-owned directories. */
const READ_ONLY_PREFIXES = [
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\Windows",
  "/usr",
  "/opt",
  "/System",
];

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Returns `true` when the given *resolved* path sits under a known
 * read-only / system-owned prefix (e.g. `C:\Program Files\…`).
 */
function isReadOnlyPath(resolved: string): boolean {
  return READ_ONLY_PREFIXES.some((prefix) =>
    resolved.toLowerCase().startsWith(prefix.toLowerCase()),
  );
}

export function resolveEffectiveHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string | undefined {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : undefined;
}

function resolveRawHomeDir(env: NodeJS.ProcessEnv, homedir: () => string): string | undefined {
  const explicitHome = normalize(env.WINCLAW_HOME);
  if (explicitHome) {
    if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
      const fallbackHome =
        normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? normalizeSafe(homedir);
      if (fallbackHome) {
        return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      }
      return undefined;
    }
    // Guard: reject WINCLAW_HOME when it points to a read-only system path
    // (e.g. "C:\Program Files\WinClaw" left over from a stale env).
    const resolved = path.resolve(explicitHome);
    if (!isReadOnlyPath(resolved)) {
      return explicitHome;
    }
    // Fall through to HOME / USERPROFILE / os.homedir()
  }

  const envHome = normalize(env.HOME);
  if (envHome) {
    return envHome;
  }

  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) {
    return userProfile;
  }

  return normalizeSafe(homedir);
}

function normalizeSafe(homedir: () => string): string | undefined {
  try {
    return normalize(homedir());
  } catch {
    return undefined;
  }
}

export function resolveRequiredHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return resolveEffectiveHomeDir(env, homedir) ?? resolveSafeFallbackDir(env);
}

/**
 * Last-resort fallback when no home directory can be resolved from
 * WINCLAW_HOME / HOME / USERPROFILE / os.homedir().
 *
 * On Windows the working directory may be `C:\Program Files\WinClaw`
 * (or another read-only location) when running from an installed binary,
 * so we prefer writable per-user directories before falling back to cwd().
 */
function resolveSafeFallbackDir(env: NodeJS.ProcessEnv): string {
  // Windows-specific writable directories
  if (process.platform === "win32") {
    const localAppData = normalize(env.LOCALAPPDATA);
    if (localAppData) return path.resolve(localAppData);

    const appData = normalize(env.APPDATA);
    if (appData) return path.resolve(appData);
  }

  // Cross-platform: reject cwd if it is under a known read-only system path
  const cwd = path.resolve(process.cwd());
  if (!isReadOnlyPath(cwd)) {
    return cwd;
  }

  // Final fallback: OS temp directory
  return os.tmpdir();
}

export function expandHomePrefix(
  input: string,
  opts?: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    homedir?: () => string;
  },
): string {
  if (!input.startsWith("~")) {
    return input;
  }
  const home =
    normalize(opts?.home) ??
    resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}
