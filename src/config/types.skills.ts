export type SkillConfig = {
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
  config?: Record<string, unknown>;
};

export type SkillsLoadConfig = {
  /**
   * Additional skill folders to scan (lowest precedence).
   * Each directory should contain skill subfolders with `SKILL.md`.
   */
  extraDirs?: string[];
  /** Watch skill folders for changes and refresh the skills snapshot. */
  watch?: boolean;
  /** Debounce for the skills watcher (ms). */
  watchDebounceMs?: number;
};

export type SkillsInstallConfig = {
  preferBrew?: boolean;
  nodeManager?: "npm" | "pnpm" | "yarn" | "bun";
  /** Preferred Windows package manager for skill dependency installation. */
  windowsPackageManager?: "winget" | "scoop" | "choco";
};

export type DynamicFilterConfig = {
  /** "off" (default): disabled. "auto": activates when >100 skills. "on": always active. */
  mode?: "auto" | "on" | "off";
  /** Max total characters for the skills prompt block. Default 50000. */
  maxSkillsPromptChars?: number;
  /** Max number of skills to inject. Default 50. */
  maxSkills?: number;
  /** Minimum keyword-match score to include a skill. Default 0.1. */
  minScore?: number;
  /** Skill names to always include regardless of score. */
  alwaysInclude?: string[];
};

export type SkillsConfig = {
  /** Optional bundled-skill allowlist (only affects bundled skills). */
  allowBundled?: string[];
  load?: SkillsLoadConfig;
  install?: SkillsInstallConfig;
  entries?: Record<string, SkillConfig>;
  /** Dynamic skill filter to prevent context overflow with many skills. */
  dynamicFilter?: DynamicFilterConfig;
};
