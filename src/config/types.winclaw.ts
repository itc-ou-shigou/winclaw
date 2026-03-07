import type { AcpConfig } from "./types.acp.js";
import type { AgentBinding, AgentsConfig } from "./types.agents.js";
import type { ApprovalsConfig } from "./types.approvals.js";
import type { AuthConfig } from "./types.auth.js";
import type { DiagnosticsConfig, LoggingConfig, SessionConfig, WebConfig } from "./types.base.js";
import type { BrowserConfig } from "./types.browser.js";
import type { ChannelsConfig } from "./types.channels.js";
import type { CronConfig } from "./types.cron.js";
import type {
  CanvasHostConfig,
  DiscoveryConfig,
  GatewayConfig,
  TalkConfig,
} from "./types.gateway.js";
import type { HooksConfig } from "./types.hooks.js";
import type { MemoryConfig } from "./types.memory.js";
import type {
  AudioConfig,
  BroadcastConfig,
  CommandsConfig,
  MessagesConfig,
} from "./types.messages.js";
import type { ModelsConfig } from "./types.models.js";
import type { NodeHostConfig } from "./types.node-host.js";
import type { PluginsConfig } from "./types.plugins.js";
import type { SecretsConfig } from "./types.secrets.js";
import type { SkillsConfig } from "./types.skills.js";
import type { ToolsConfig } from "./types.tools.js";

export type WinClawConfig = {
  meta?: {
    /** Last WinClaw version that wrote this config. */
    lastTouchedVersion?: string;
    /** ISO timestamp when this config was last written. */
    lastTouchedAt?: string;
  };
  auth?: AuthConfig;
  acp?: AcpConfig;
  env?: {
    /** Opt-in: import missing secrets from a login shell environment (exec `$SHELL -l -c 'env -0'`). */
    shellEnv?: {
      enabled?: boolean;
      /** Timeout for the login shell exec (ms). Default: 15000. */
      timeoutMs?: number;
    };
    /** Inline env vars to apply when not already present in the process env. */
    vars?: Record<string, string>;
    /** Sugar: allow env vars directly under env (string values only). */
    [key: string]:
      | string
      | Record<string, string>
      | { enabled?: boolean; timeoutMs?: number }
      | undefined;
  };
  wizard?: {
    lastRunAt?: string;
    lastRunVersion?: string;
    lastRunCommit?: string;
    lastRunCommand?: string;
    lastRunMode?: "local" | "remote";
  };
  diagnostics?: DiagnosticsConfig;
  logging?: LoggingConfig;
  update?: {
    /** Update channel for git + npm installs ("stable", "beta", or "dev"). */
    channel?: "stable" | "beta" | "dev";
    /** Check for updates on gateway start (npm installs only). */
    checkOnStart?: boolean;
    /** Core auto-update policy for package installs. */
    auto?: {
      /** Enable background auto-update checks and apply logic. Default: false. */
      enabled?: boolean;
      /** Stable channel minimum delay before auto-apply. Default: 6. */
      stableDelayHours?: number;
      /** Additional stable-channel jitter window. Default: 12. */
      stableJitterHours?: number;
      /** Beta channel check cadence. Default: 1 hour. */
      betaCheckIntervalHours?: number;
    };
  };
  browser?: BrowserConfig;
  ui?: {
    /** Accent color for WinClaw UI chrome (hex). */
    seamColor?: string;
    assistant?: {
      /** Assistant display name for UI surfaces. */
      name?: string;
      /** Assistant avatar (emoji, short text, or image URL/data URI). */
      avatar?: string;
    };
  };
  secrets?: SecretsConfig;
  skills?: SkillsConfig;
  plugins?: PluginsConfig;
  models?: ModelsConfig;
  nodeHost?: NodeHostConfig;
  agents?: AgentsConfig;
  tools?: ToolsConfig;
  bindings?: AgentBinding[];
  broadcast?: BroadcastConfig;
  audio?: AudioConfig;
  messages?: MessagesConfig;
  commands?: CommandsConfig;
  approvals?: ApprovalsConfig;
  session?: SessionConfig;
  web?: WebConfig;
  channels?: ChannelsConfig;
  cron?: CronConfig;
  hooks?: HooksConfig;
  discovery?: DiscoveryConfig;
  canvasHost?: CanvasHostConfig;
  talk?: TalkConfig;
  gateway?: GatewayConfig;
  memory?: MemoryConfig;
  grc?: {
    /** Enable GRC (Global Resource Center) integration. Default: true. */
    enabled?: boolean;
    /** GRC server URL. Default: "https://grc.winclawhub.ai". */
    url?: string;
    /** Employee ID sent during GRC node registration. */
    employeeId?: string;
    /** Employee display name sent during GRC node registration. */
    employeeName?: string;
    /** Employee contact email sent during GRC node registration. */
    employeeEmail?: string;
    /** Authentication settings for GRC. */
    auth?: {
      mode?: "anonymous" | "oauth" | "apikey";
      /**
       * JWT or API key token.
       * @security These credentials are stored in plaintext in config.json5.
       * They should be migrated to SecretsConfig (grc.auth.token -> secrets subsystem)
       * so that the token is never written to disk in cleartext.
       * Use the GRC_AUTH_TOKEN environment variable as a safer alternative.
       */
      token?: string;
      /**
       * OAuth refresh token.
       * @security See token field — this value is also stored in plaintext.
       * Prefer GRC_AUTH_REFRESH_TOKEN environment variable or the secrets subsystem.
       */
      refreshToken?: string;
    };
    /** Sync settings for GRC. */
    sync?: {
      /** Sync interval in seconds. Default: 14400 (4 hours). */
      interval?: number;
      /** Auto-update from GRC. Default: true. */
      autoUpdate?: boolean;
      /** Share evolution signals with GRC. Default: true. */
      shareEvolution?: boolean;
      /** Opt-in telemetry reporting. Default: false. */
      telemetry?: boolean;
    };
    /** Community auto-posting and reply settings. */
    community?: {
      /** Enable community auto-posting on events. Default: false. */
      autoPost?: boolean;
      /** Enable scheduled feed scanning and replying. Default: false. */
      autoReply?: boolean;
      /** Enable auto-voting on useful posts. Default: false. */
      autoVote?: boolean;
      /** Max auto-posts per sync cycle. Default: 3. */
      maxPostsPerDay?: number;
      /** Max auto-replies per scheduled cycle. Default: 5. */
      maxRepliesPerCycle?: number;
      /** Cron expression for scheduled reply cycles. Default: "0 3 * * *" (daily 3 AM). */
      replyCronSchedule?: string;
      /** Cooldown in hours before posting a similar error again. Default: 48. */
      errorCooldownHours?: number;
      /** Default channel ID for problem posts. */
      problemChannelId?: string;
      /** Default channel ID for experience posts. */
      experienceChannelId?: string;
      /** Default channel ID for evolution posts. */
      evolutionChannelId?: string;
    };
    /** ISO 8601 timestamp of last successful sync. */
    lastSyncAt?: string;
  };
};

export type ConfigValidationIssue = {
  path: string;
  message: string;
  allowedValues?: string[];
  allowedValuesHiddenCount?: number;
};

export type LegacyConfigIssue = {
  path: string;
  message: string;
};

export type ConfigFileSnapshot = {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  /**
   * Config after $include resolution and ${ENV} substitution, but BEFORE runtime
   * defaults are applied. Use this for config set/unset operations to avoid
   * leaking runtime defaults into the written config file.
   */
  resolved: WinClawConfig;
  valid: boolean;
  config: WinClawConfig;
  hash?: string;
  issues: ConfigValidationIssue[];
  warnings: ConfigValidationIssue[];
  legacyIssues: LegacyConfigIssue[];
};
