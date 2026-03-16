import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createSubsystemLogger, type SubsystemLogger } from "../logging/subsystem.js";
import { type BackoffPolicy, computeBackoff, sleepWithAbort } from "./backoff.js";

const log: SubsystemLogger = createSubsystemLogger("infra/grc-client");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrcClientConfig = {
  baseUrl: string;
  authToken?: string;
  /** Request timeout in ms. Default: 15 000. */
  timeout?: number;
  /** Max retry attempts on transient failures. Default: 5. */
  maxRetries?: number;
};

export type UpdateCheckResult = {
  available: boolean;
  version?: string;
  latest?: string;
  channel?: string;
  downloadUrl?: string;
  checksumSha256?: string;
  sizeBytes?: number;
  changelog?: string;
  isCritical?: boolean;
  minUpgradeVersion?: string;
};

export type GrcSkill = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  authorId: string;
  category: string | null;
  tags: string[] | null;
  latestVersion: string | null;
  downloadCount: number;
  ratingAvg: number;
  ratingCount: number;
  isOfficial: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type GrcSkillVersion = {
  id: string;
  skillId: string;
  version: string;
  changelog: string | null;
  tarballUrl: string;
  checksumSha256: string;
  tarballSize: number;
  minWinclawVersion: string | null;
  createdAt: string;
};

export type GrcSkillDetail = GrcSkill & {
  latestVersionInfo: GrcSkillVersion | null;
};

export type GrcSkillSearchOptions = {
  q?: string;
  tags?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export type GrcPaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type GrcEvolutionAsset = {
  assetId: string;
  type: "gene" | "capsule";
  signalsMatch: string[];
  strategy?: Record<string, unknown>;
  status: string;
  useCount: number;
  successRate: number;
};

export type GrcSkillPublishParams = {
  name: string;
  slug: string;
  description: string;
  version: string;
  tags: string[];
  changelog?: string;
  tarball: Buffer;
};

export type GrcSkillPublishResult = {
  skill: GrcSkill;
  version: GrcSkillVersion;
};

export type GrcSkillRateParams = {
  slug: string;
  rating: number; // 1-5
  review?: string;
};

export type GrcPlatformValues = {
  content: string;
  contentHash: string;
  updatedAt: string;
};

/** Parameters for creating an agent task via POST /a2a/tasks/create */
export type AgentTaskCreateParams = {
  creator_role_id: string;
  creator_node_id: string;
  title: string;
  description?: string;
  category?: 'strategic' | 'operational' | 'administrative' | 'expense';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  target_role_id?: string;
  target_node_id?: string;
  trigger_type: 'heartbeat' | 'task_chain' | 'strategy' | 'meeting' | 'escalation';
  trigger_source?: string;
  deadline?: string;
  deliverables?: string[];
  notes?: string;
  expense_amount?: string;
  expense_currency?: string;
};

/** Response from POST /a2a/tasks/create */
export type AgentTaskCreateResult = {
  ok: boolean;
  task?: {
    id: string;
    taskCode: string;
    title: string;
    status: string;
    assignedBy: string;
    createdAt: string;
  };
  approval_required?: boolean;
  error?: string;
  message?: string;
  retry_after?: string;
};

/** Response from GET /a2a/config/check */
export type GrcConfigCheckResult = {
  ok: boolean;
  has_update: boolean;
  latest_revision: number;
  role_id: string | null;
};

/** Key configuration for a single model key slot (primary or auxiliary). */
export type GrcKeyConfigEntry = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

/** Response from GET /a2a/config/pull */
export type GrcConfigPullResult = {
  ok: boolean;
  revision: number;
  role_id: string | null;
  role_mode: string | null;
  files: Record<string, string>;
  /** Model key configuration assigned to this node via the dashboard. */
  key_config?: {
    primary: GrcKeyConfigEntry | null;
    auxiliary: GrcKeyConfigEntry | null;
  } | null;
};

export type GrcApiError = {
  status: number;
  statusText: string;
  body: string;
};

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

const DEFAULT_BACKOFF: BackoffPolicy = {
  initialMs: 1_000,
  maxMs: 60_000,
  factor: 2,
  jitter: 0.25,
};

/** Status codes that are considered transient and worth retrying. */
function isTransientHttpError(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    // Abort/timeout or network-level failures
    if (err.name === "AbortError" || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(err.message)) {
      return true;
    }
    // Our own GrcApiError wrapper or any error with a numeric status
    const errAny = err as Error & { status?: unknown };
    if (typeof errAny.status === "number") {
      return isTransientHttpError(errAny.status);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// GrcClient
// ---------------------------------------------------------------------------

export class GrcClient {
  private baseUrl: string;
  private authToken: string | undefined;
  private timeout: number;
  private maxRetries: number;

  constructor(config: GrcClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authToken = config.authToken;
    this.timeout = config.timeout ?? 15_000;
    this.maxRetries = config.maxRetries ?? 5;
  }

  // -- Auth helpers --------------------------------------------------------

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }

  // -- Core request --------------------------------------------------------

  private async request<T>(
    path: string,
    opts: RequestInit = {},
    abortSignal?: AbortSignal,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "User-Agent": "WinClaw-GRC-Client/1.0",
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    };

    let lastErr: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error("GRC request aborted");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Chain external abort signal to internal controller
      const onExternalAbort = () => controller.abort();
      abortSignal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetch(url, {
          ...opts,
          headers: {
            ...headers,
            ...((opts.headers as Record<string, string>) ?? {}),
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const apiErr = Object.assign(
            new Error(`GRC API error: ${res.status} ${res.statusText} - ${body}`),
            { status: res.status, statusText: res.statusText, body } satisfies GrcApiError,
          );

          if (isTransientHttpError(res.status) && attempt < this.maxRetries) {
            lastErr = apiErr;
            const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
            log.debug(
              `GRC transient error ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
              { url, status: res.status, attempt },
            );
            await sleepWithAbort(delayMs, abortSignal);
            continue;
          }

          throw apiErr;
        }

        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;

        if (attempt < this.maxRetries && isRetryableError(err)) {
          const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
          log.debug(
            `GRC request failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
            { url, error: (err as Error).message, attempt },
          );
          await sleepWithAbort(delayMs, abortSignal).catch(() => {
            // If abort happened during sleep, we throw below
          });
          if (abortSignal?.aborted) {
            throw new Error("GRC request aborted during retry backoff");
          }
          continue;
        }

        throw err;
      } finally {
        clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw lastErr ?? new Error("GRC request failed after retries");
  }

  // -- Binary request (for tarball downloads) --------------------------------

  /**
   * Perform an HTTP GET that returns raw binary data instead of JSON.
   * Used for downloading skill tarballs which redirect (302) to a presigned URL.
   * Follows the same retry / backoff logic as `request<T>()`.
   */
  private async requestBinary(
    path: string,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<Buffer> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "User-Agent": "WinClaw-GRC-Client/1.0",
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };
    const effectiveTimeout = timeoutMs ?? 60_000;

    let lastErr: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error("GRC binary request aborted");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      const onExternalAbort = () => controller.abort();
      abortSignal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const res = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: "follow",
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const apiErr = Object.assign(
            new Error(`GRC API error: ${res.status} ${res.statusText} - ${body}`),
            { status: res.status, statusText: res.statusText, body } satisfies GrcApiError,
          );

          if (isTransientHttpError(res.status) && attempt < this.maxRetries) {
            lastErr = apiErr;
            const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
            log.debug(
              `GRC binary transient error ${res.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
              { url, status: res.status, attempt },
            );
            await sleepWithAbort(delayMs, abortSignal);
            continue;
          }

          throw apiErr;
        }

        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      } catch (err) {
        lastErr = err;

        if (attempt < this.maxRetries && isRetryableError(err)) {
          const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
          log.debug(
            `GRC binary request failed, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`,
            { url, error: (err as Error).message, attempt },
          );
          await sleepWithAbort(delayMs, abortSignal).catch(() => {});
          if (abortSignal?.aborted) {
            throw new Error("GRC binary request aborted during retry backoff");
          }
          continue;
        }

        throw err;
      } finally {
        clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw lastErr ?? new Error("GRC binary request failed after retries");
  }

  // -- Multipart request (for skill publishing) ------------------------------

  /**
   * Perform an HTTP POST with multipart/form-data for uploading skill tarballs.
   * Uses the native `FormData` API (Node 18+).
   * Follows the same retry / backoff logic as `request<T>()`.
   */
  private async requestMultipart<T>(
    path: string,
    params: GrcSkillPublishParams,
    abortSignal?: AbortSignal,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const effectiveTimeout = 120_000; // 2 minutes for upload

    let lastErr: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error("GRC multipart request aborted");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

      const onExternalAbort = () => controller.abort();
      abortSignal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        // Build FormData — must be recreated each attempt because
        // the stream may have been consumed on a previous retry.
        const formData = new FormData();
        formData.set("name", params.name);
        formData.set("slug", params.slug);
        formData.set("description", params.description);
        formData.set("version", params.version);
        formData.set("tags", JSON.stringify(params.tags));
        if (params.changelog) formData.set("changelog", params.changelog);

        // Attach tarball as a file blob (convert Buffer to Uint8Array for Blob compat)
        const blob = new Blob([new Uint8Array(params.tarball)], { type: "application/gzip" });
        formData.set("tarball", blob, `${params.slug}-${params.version}.tar.gz`);

        const headers: Record<string, string> = {
          "User-Agent": "WinClaw-GRC-Client/1.0",
          ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
          // Do NOT set Content-Type — fetch sets the multipart boundary automatically
        };

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const apiErr = Object.assign(
            new Error(`GRC API error: ${res.status} ${res.statusText} - ${body}`),
            { status: res.status, statusText: res.statusText, body } satisfies GrcApiError,
          );

          if (isTransientHttpError(res.status) && attempt < this.maxRetries) {
            lastErr = apiErr;
            const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
            log.debug(
              `GRC multipart transient error ${res.status}, retrying in ${delayMs}ms`,
              { url, status: res.status, attempt },
            );
            await sleepWithAbort(delayMs, abortSignal);
            continue;
          }

          throw apiErr;
        }

        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;

        if (attempt < this.maxRetries && isRetryableError(err)) {
          const delayMs = computeBackoff(DEFAULT_BACKOFF, attempt);
          log.debug(
            `GRC multipart request failed, retrying in ${delayMs}ms`,
            { url, error: (err as Error).message, attempt },
          );
          await sleepWithAbort(delayMs, abortSignal).catch(() => {});
          if (abortSignal?.aborted) {
            throw new Error("GRC multipart request aborted during retry backoff");
          }
          continue;
        }

        throw err;
      } finally {
        clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw lastErr ?? new Error("GRC multipart request failed after retries");
  }

  // -- API methods ---------------------------------------------------------

  /** Check whether a newer WinClaw version is available. */
  async checkUpdate(
    version: string,
    platform: string,
    channel = "stable",
    abortSignal?: AbortSignal,
  ): Promise<UpdateCheckResult> {
    const qs = new URLSearchParams({ version, platform, channel }).toString();
    const raw = await this.request<UpdateCheckResult>(
      `/api/v1/update/check?${qs}`,
      {},
      abortSignal,
    );
    // GRC API returns `latest` field — normalize to `version` for consumer convenience
    if (!raw.version && raw.latest) {
      raw.version = raw.latest;
    }
    return raw;
  }

  /** Fetch trending skills from ClawHub+. */
  async getTrendingSkills(
    limit = 20,
    abortSignal?: AbortSignal,
  ): Promise<{ data: GrcSkill[] }> {
    return this.request<{ data: GrcSkill[] }>(
      `/api/v1/skills/trending?limit=${limit}`,
      {},
      abortSignal,
    );
  }

  /** Search skills on ClawHub+ with optional filtering and pagination. */
  async searchSkills(
    opts: GrcSkillSearchOptions = {},
    abortSignal?: AbortSignal,
  ): Promise<GrcPaginatedResult<GrcSkill>> {
    const qs = new URLSearchParams();
    if (opts.q) qs.set("q", opts.q);
    if (opts.tags) qs.set("tags", opts.tags);
    if (opts.sort) qs.set("sort", opts.sort);
    if (opts.page !== undefined) qs.set("page", String(opts.page));
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    return this.request<GrcPaginatedResult<GrcSkill>>(
      `/api/v1/skills?${qs.toString()}`,
      {},
      abortSignal,
    );
  }

  /** Get a single skill by slug from ClawHub+. */
  async getSkillBySlug(
    slug: string,
    abortSignal?: AbortSignal,
  ): Promise<GrcSkillDetail> {
    return this.request<GrcSkillDetail>(
      `/api/v1/skills/${encodeURIComponent(slug)}`,
      {},
      abortSignal,
    );
  }

  /** List all versions of a skill by slug. */
  async getSkillVersions(
    slug: string,
    abortSignal?: AbortSignal,
  ): Promise<{ data: GrcSkillVersion[] }> {
    return this.request<{ data: GrcSkillVersion[] }>(
      `/api/v1/skills/${encodeURIComponent(slug)}/versions`,
      {},
      abortSignal,
    );
  }

  /**
   * Download a skill tarball from ClawHub+.
   * The GRC endpoint returns a 302 redirect to a presigned MinIO URL.
   * This method follows the redirect and returns the raw binary buffer.
   */
  async downloadSkillTarball(
    slug: string,
    version: string,
    abortSignal?: AbortSignal,
  ): Promise<Buffer> {
    return this.requestBinary(
      `/api/v1/skills/${encodeURIComponent(slug)}/download/${encodeURIComponent(version)}`,
      abortSignal,
    );
  }

  /** Fetch recommended skills from ClawHub+ (personalised). */
  async getRecommendedSkills(
    opts: { limit?: number; strategy?: string; platform?: string } = {},
    abortSignal?: AbortSignal,
  ): Promise<{ data: GrcSkill[] }> {
    const qs = new URLSearchParams();
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    if (opts.strategy) qs.set("strategy", opts.strategy);
    if (opts.platform) qs.set("platform", opts.platform);
    return this.request<{ data: GrcSkill[] }>(
      `/api/v1/skills/recommended?${qs.toString()}`,
      {},
      abortSignal,
    );
  }

  /**
   * Publish a skill (new or new version) to ClawHub+.
   * Uses multipart/form-data to upload the tarball alongside metadata.
   * Requires auth token with `write` + `publish` scopes.
   */
  async publishSkill(
    params: GrcSkillPublishParams,
    abortSignal?: AbortSignal,
  ): Promise<GrcSkillPublishResult> {
    return this.requestMultipart<GrcSkillPublishResult>(
      "/api/v1/skills",
      params,
      abortSignal,
    );
  }

  /**
   * Rate a skill on ClawHub+ (1-5 stars, optional review).
   * One rating per user — subsequent calls update the existing rating.
   */
  async rateSkill(
    params: GrcSkillRateParams,
    abortSignal?: AbortSignal,
  ): Promise<{ rating: number; ratingAvg: number; ratingCount: number }> {
    const body = {
      rating: params.rating,
      ...(params.review ? { review: params.review } : {}),
    };
    return this.request<{ rating: number; ratingAvg: number; ratingCount: number }>(
      `/api/v1/skills/${encodeURIComponent(params.slug)}/rate`,
      { method: "POST", body: JSON.stringify(body) },
      abortSignal,
    );
  }

  /** Fetch promoted evolution assets. */
  async getPromotedAssets(
    limit = 50,
    abortSignal?: AbortSignal,
  ): Promise<{ assets: GrcEvolutionAsset[]; total: number }> {
    return this.request<{ assets: GrcEvolutionAsset[]; total: number }>(
      `/a2a/assets/search?status=promoted&limit=${limit}`,
      {},
      abortSignal,
    );
  }

  /** Publish a local evolution asset to the GRC server (requires auth). */
  async publishAsset(
    asset: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ): Promise<{ asset_id: string }> {
    return this.request<{ asset_id: string }>(
      "/a2a/publish",
      { method: "POST", body: JSON.stringify(asset) },
      abortSignal,
    );
  }

  /** Send an anonymized telemetry report (requires auth). */
  async sendTelemetry(
    report: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      "/api/v1/telemetry/report",
      { method: "POST", body: JSON.stringify(report) },
      abortSignal,
    );
  }

  /**
   * Search evolution assets on GRC by signals and/or status.
   * Compatible with GET /a2a/assets/search?signals=error,timeout&status=promoted&limit=20
   */
  async searchAssets(
    opts: { signals?: string[]; status?: string; limit?: number; offset?: number } = {},
    abortSignal?: AbortSignal,
  ): Promise<{ assets: GrcEvolutionAsset[]; total: number; limit: number; offset: number }> {
    const qs = new URLSearchParams();
    if (opts.signals && opts.signals.length > 0) {
      qs.set("signals", opts.signals.join(","));
    }
    if (opts.status) qs.set("status", opts.status);
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    if (opts.offset !== undefined) qs.set("offset", String(opts.offset));

    return this.request<{ assets: GrcEvolutionAsset[]; total: number; limit: number; offset: number }>(
      `/a2a/assets/search?${qs.toString()}`,
      {},
      abortSignal,
    );
  }

  /**
   * Fetch a single evolution asset by ID or content hash.
   * Uses POST /a2a/fetch. Returns null if not found (404).
   */
  async fetchAsset(
    assetId?: string,
    contentHash?: string,
    abortSignal?: AbortSignal,
  ): Promise<GrcEvolutionAsset | null> {
    if (!assetId && !contentHash) {
      throw new Error("fetchAsset: at least one of assetId or contentHash must be provided");
    }

    try {
      const body: Record<string, string> = {};
      if (assetId) body.asset_id = assetId;
      if (contentHash) body.content_hash = contentHash;

      const result = await this.request<{ asset: GrcEvolutionAsset }>(
        "/a2a/fetch",
        { method: "POST", body: JSON.stringify(body) },
        abortSignal,
      );
      return result.asset ?? null;
    } catch (err) {
      // 404 = not found or quarantined → return null instead of throwing
      const errAny = err as Error & { status?: number };
      if (errAny.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Report usage of an evolution asset to GRC.
   * Uses POST /a2a/report.
   */
  async reportUsage(
    assetId: string,
    reporterNodeId: string,
    success: boolean,
    reportData?: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ): Promise<{
    ok: boolean;
    asset_id: string;
    use_count: number;
    success_rate: number;
    status: string;
    promotion_check?: unknown;
  }> {
    return this.request<{
      ok: boolean;
      asset_id: string;
      use_count: number;
      success_rate: number;
      status: string;
      promotion_check?: unknown;
    }>(
      "/a2a/report",
      {
        method: "POST",
        body: JSON.stringify({
          asset_id: assetId,
          reporter_node_id: reporterNodeId,
          success,
          report_data: reportData,
        }),
      },
      abortSignal,
    );
  }

  /** Health check / connectivity test. Returns true if GRC is reachable. */
  async ping(abortSignal?: AbortSignal): Promise<boolean> {
    try {
      await this.request<unknown>("/health", {}, abortSignal);
      return true;
    } catch {
      return false;
    }
  }

  // -- Authentication methods ----------------------------------------------

  /**
   * Register anonymously with GRC using a device node_id.
   * Returns a JWT token for read-only access.
   */
  async getAnonymousToken(
    nodeId: string,
    abortSignal?: AbortSignal,
  ): Promise<{ token: string; user: { id: string; tier: string; scopes: string[] } }> {
    return this.request<{ token: string; user: { id: string; tier: string; scopes: string[] } }>(
      "/auth/anonymous",
      { method: "POST", body: JSON.stringify({ node_id: nodeId }) },
      abortSignal,
    );
  }

  /**
   * Register this node with GRC's Evolution Pool (A2A hello).
   */
  async hello(
    nodeId: string,
    platform: string,
    winclawVersion: string,
    employee?: { id?: string; name?: string; email?: string },
    abortSignal?: AbortSignal,
  ): Promise<{ ok: boolean; node?: { id: string } }> {
    return this.request<{ ok: boolean; node?: { id: string } }>(
      "/a2a/hello",
      {
        method: "POST",
        body: JSON.stringify({
          node_id: nodeId,
          platform,
          winclaw_version: winclawVersion,
          ...(employee?.id && { employee_id: employee.id }),
          ...(employee?.name && { employee_name: employee.name }),
          ...(employee?.email && { employee_email: employee.email }),
        }),
      },
      abortSignal,
    );
  }

  /**
   * Send a pairing code to the given email address.
   * The user will receive a 6-digit OTP.
   */
  async sendPairingCode(
    email: string,
    abortSignal?: AbortSignal,
  ): Promise<{ ok: boolean; message: string }> {
    return this.request<{ ok: boolean; message: string }>(
      "/auth/pair",
      { method: "POST", body: JSON.stringify({ email }) },
      abortSignal,
    );
  }

  /**
   * Verify a pairing code and associate the node with an email account.
   * Returns JWT + refresh token with full access scopes.
   */
  async verifyPairingCode(
    email: string,
    code: string,
    nodeId: string,
    abortSignal?: AbortSignal,
  ): Promise<{
    ok: boolean;
    token: string;
    refreshToken: string;
    user: { id: string; provider: string; displayName: string; email: string; tier: string; role: string };
  }> {
    return this.request<{
      ok: boolean;
      token: string;
      refreshToken: string;
      user: { id: string; provider: string; displayName: string; email: string; tier: string; role: string };
    }>(
      "/auth/pair/verify",
      { method: "POST", body: JSON.stringify({ email, code, node_id: nodeId }) },
      abortSignal,
    );
  }

  /**
   * Refresh an expired access token using a refresh token.
   * Implements token rotation (old refresh token is invalidated).
   */
  async refreshAccessToken(
    refreshToken: string,
    abortSignal?: AbortSignal,
  ): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
    return this.request<{ access_token: string; refresh_token: string; token_type: string }>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
      abortSignal,
    );
  }

  // -- Community methods ----------------------------------------------------

  /** Fetch community channels with optional pagination. */
  async getCommunityChannels(
    page = 1,
    limit = 20,
    abortSignal?: AbortSignal,
  ): Promise<{ channels: unknown[]; total: number; page: number; totalPages: number }> {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
    const raw = await this.request<{ data?: unknown[]; pagination?: Record<string, number> }>(
      `/api/v1/community/channels?${qs}`, {}, abortSignal,
    );
    const pg = raw.pagination ?? {};
    return {
      channels: raw.data ?? [],
      total: pg.total ?? 0,
      page: pg.page ?? page,
      totalPages: pg.totalPages ?? 0,
    };
  }

  /** Fetch community feed with sorting, channel filter, and pagination. */
  async getCommunityFeed(
    opts: { sort?: string; channelId?: string; page?: number; limit?: number } = {},
    abortSignal?: AbortSignal,
  ): Promise<{ posts: unknown[]; total: number; page: number; totalPages: number }> {
    const qs = new URLSearchParams();
    if (opts.sort) qs.set("sort", opts.sort);
    if (opts.channelId) qs.set("channelId", opts.channelId);
    qs.set("page", String(opts.page ?? 1));
    qs.set("limit", String(opts.limit ?? 20));
    const raw = await this.request<{ data?: unknown[]; pagination?: Record<string, number> }>(
      `/api/v1/community/feed?${qs.toString()}`, {}, abortSignal,
    );
    const pg = raw.pagination ?? {};
    return {
      posts: raw.data ?? [],
      total: pg.total ?? 0,
      page: pg.page ?? (opts.page ?? 1),
      totalPages: pg.totalPages ?? 0,
    };
  }

  /** Fetch a single community post by ID (records a view). */
  async getCommunityPost(
    postId: string,
    abortSignal?: AbortSignal,
  ): Promise<{ post: unknown }> {
    const raw = await this.request<{ data?: unknown }>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}`, {}, abortSignal,
    );
    return { post: raw.data ?? raw };
  }

  /** Fetch replies for a community post. */
  async getCommunityReplies(
    postId: string,
    page = 1,
    limit = 20,
    abortSignal?: AbortSignal,
  ): Promise<{ replies: unknown[]; total: number; page: number; totalPages: number }> {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
    const raw = await this.request<{ data?: unknown[]; pagination?: Record<string, number> }>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/replies?${qs}`,
      {},
      abortSignal,
    );
    const pg = raw.pagination ?? {};
    return {
      replies: raw.data ?? [],
      total: pg.total ?? 0,
      page: pg.page ?? page,
      totalPages: pg.totalPages ?? 0,
    };
  }

  /** Create a new community post (requires auth). */
  async createCommunityPost(
    data: {
      channelId: string;
      postType: string;
      title: string;
      body: string;
      tags?: string[];
      contextData?: unknown;
      codeSnippets?: unknown[];
      relatedAssets?: string[];
    },
    abortSignal?: AbortSignal,
  ): Promise<{ post: unknown }> {
    const raw = await this.request<{ data?: unknown }>(
      "/api/v1/community/posts",
      { method: "POST", body: JSON.stringify(data) },
      abortSignal,
    );
    return { post: raw.data ?? raw };
  }

  /** Reply to a community post (requires auth). */
  async createCommunityReply(
    postId: string,
    data: { content: string; parentReplyId?: string },
    abortSignal?: AbortSignal,
  ): Promise<{ reply: unknown }> {
    const raw = await this.request<{ data?: unknown }>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/replies`,
      { method: "POST", body: JSON.stringify(data) },
      abortSignal,
    );
    return { reply: raw.data ?? raw };
  }

  /** Vote on a community post (requires auth). */
  async voteCommunityPost(
    postId: string,
    direction: "up" | "down",
    abortSignal?: AbortSignal,
  ): Promise<{ ok: boolean; score?: number; upvotes?: number; downvotes?: number }> {
    const endpoint = direction === "up" ? "upvote" : "downvote";
    const raw = await this.request<{ data?: { score?: number; upvotes?: number; downvotes?: number } }>(
      `/api/v1/community/posts/${encodeURIComponent(postId)}/${endpoint}`,
      { method: "POST" },
      abortSignal,
    );
    const d = raw.data ?? {};
    return { ok: true, score: d.score, upvotes: d.upvotes, downvotes: d.downvotes };
  }

  /** Fetch community statistics. */
  async getCommunityStats(
    abortSignal?: AbortSignal,
  ): Promise<{ stats: unknown }> {
    const raw = await this.request<{ data?: unknown }>(
      "/api/v1/community/stats", {}, abortSignal,
    );
    return { stats: raw.data ?? raw };
  }

  // -- Update: external binary download & report --------------------------------

  /**
   * Download a binary from an external URL (e.g. SourceForge, GitHub Releases)
   * and stream it to disk. Unlike `requestBinary()`, this does NOT prefix the
   * GRC base URL and does NOT retry (large file re-downloads are expensive).
   *
   * @param externalUrl  Full URL (https://…)
   * @param destPath     Local file path to write the downloaded binary
   * @param timeoutMs    Download timeout in ms (default: 10 minutes)
   * @param abortSignal  Optional cancellation signal
   */
  async downloadExternalBinary(
    externalUrl: string,
    destPath: string,
    timeoutMs = 600_000,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    abortSignal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      log.info(`Downloading external binary: ${externalUrl}`, { dest: destPath });

      const res = await fetch(externalUrl, {
        headers: { "User-Agent": "WinClaw-Updater/1.0" },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `External download failed: ${res.status} ${res.statusText} - ${body.slice(0, 200)}`,
        );
      }

      if (!res.body) {
        throw new Error("External download returned empty body");
      }

      // Stream response body to disk via pipeline (back-pressure aware)
      const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
      await pipeline(nodeStream, createWriteStream(destPath));

      log.info("External binary download complete", { dest: destPath });
    } finally {
      clearTimeout(timeoutId);
      abortSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  /**
   * Report the outcome of an update attempt to the GRC server.
   * Maps to `POST /api/v1/update/report`.
   *
   * Errors are intentionally non-fatal: callers should catch & log.
   */
  async reportUpdate(
    params: {
      nodeId: string;
      fromVersion: string;
      toVersion: string;
      platform: string;
      success: boolean;
      errorMessage?: string;
      durationMs?: number;
    },
    abortSignal?: AbortSignal,
  ): Promise<{ id: string; recorded: boolean }> {
    return this.request<{ id: string; recorded: boolean }>(
      "/api/v1/update/report",
      {
        method: "POST",
        body: JSON.stringify({
          node_id: params.nodeId,
          from_version: params.fromVersion,
          to_version: params.toVersion,
          platform: params.platform,
          status: params.success ? "success" : "error",
          error_message: params.errorMessage,
          duration_ms: params.durationMs,
        }),
      },
      abortSignal,
    );
  }

  // -- Platform Values -------------------------------------------------------

  /**
   * Fetch platform values from GRC.
   * Supports ETag caching: pass `cachedHash` to receive 304 when unchanged.
   * Returns null if no content or not modified (304) or not found (404).
   */
  async getPlatformValues(
    cachedHash?: string,
    abortSignal?: AbortSignal,
  ): Promise<GrcPlatformValues | null> {
    const url = `${this.baseUrl}/api/v1/platform/values`;
    const headers: Record<string, string> = {
      "User-Agent": "WinClaw-GRC-Client/1.0",
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
    };
    if (cachedHash) {
      headers["If-None-Match"] = cachedHash;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const onExternalAbort = () => controller.abort();
    abortSignal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const res = await fetch(url, { headers, signal: controller.signal });

      if (res.status === 304) {
        // Not modified — cached value is still current
        return null;
      }

      if (res.status === 404) {
        // Module not enabled or no values yet
        return null;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GRC platform values error: ${res.status} ${res.statusText} - ${body}`);
      }

      const raw = (await res.json()) as { data?: { content?: string; contentHash?: string; updatedAt?: string } };
      const d = raw.data;
      if (!d || !d.content) return null;

      return {
        content: d.content,
        contentHash: d.contentHash ?? "",
        updatedAt: d.updatedAt ?? "",
      };
    } catch (err) {
      // Network errors, aborts: return null instead of crashing
      if ((err as Error).name === "AbortError") return null;
      throw err;
    } finally {
      clearTimeout(timeoutId);
      abortSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  // -- Role Config Distribution (A2A) ----------------------------------------

  /**
   * Check if a config update is available for a node.
   * GET /a2a/config/check?node_id=xxx&current_revision=N
   */
  async checkConfig(
    nodeId: string,
    currentRevision: number,
    abortSignal?: AbortSignal,
  ): Promise<GrcConfigCheckResult> {
    const params = new URLSearchParams({
      node_id: nodeId,
      current_revision: String(currentRevision),
    });
    return this.request<GrcConfigCheckResult>(
      `/a2a/config/check?${params.toString()}`,
      { method: "GET" },
      abortSignal,
    );
  }

  /**
   * Pull the full resolved config files for a node.
   * GET /a2a/config/pull?node_id=xxx
   */
  async pullConfig(
    nodeId: string,
    abortSignal?: AbortSignal,
  ): Promise<GrcConfigPullResult> {
    const params = new URLSearchParams({ node_id: nodeId });
    return this.request<GrcConfigPullResult>(
      `/a2a/config/pull?${params.toString()}`,
      { method: "GET" },
      abortSignal,
    );
  }

  /**
   * Report that a config revision has been applied by this node.
   * POST /a2a/config/status
   */
  async reportConfigStatus(
    nodeId: string,
    revision: number,
    applied: boolean,
    abortSignal?: AbortSignal,
  ): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(
      "/a2a/config/status",
      {
        method: "POST",
        body: JSON.stringify({ node_id: nodeId, revision, applied }),
      },
      abortSignal,
    );
  }

  /**
   * Create an agent task via the A2A task distribution endpoint.
   * POST /a2a/tasks/create
   * Returns the created task or an approval_required signal when the task
   * exceeds the node's auto-approve threshold.
   */
  async createAgentTask(
    params: AgentTaskCreateParams,
    abortSignal?: AbortSignal,
  ): Promise<AgentTaskCreateResult> {
    return this.request<AgentTaskCreateResult>(
      '/a2a/tasks/create',
      { method: 'POST', body: JSON.stringify(params) },
      abortSignal,
    );
  }

  // ---------------------------------------------------------------------------
  // Task Lifecycle Methods
  // ---------------------------------------------------------------------------

  /** Fetch pending tasks assigned to this node */
  async fetchPendingTasks(
    nodeId: string,
    roleId?: string,
    abortSignal?: AbortSignal,
  ): Promise<any> {
    let path = `/a2a/tasks/pending?node_id=${encodeURIComponent(nodeId)}`;
    if (roleId) path += `&role_id=${encodeURIComponent(roleId)}`;
    return this.request(path, {}, abortSignal);
  }

  /** Update task status and/or results */
  async updateTaskStatus(
    params: {
      task_id: string;
      node_id: string;
      status?: string;
      result_summary?: string;
      result_data?: Record<string, unknown>;
    },
    abortSignal?: AbortSignal,
  ): Promise<any> {
    return this.request(
      "/a2a/tasks/update",
      { method: "POST", body: JSON.stringify(params) },
      abortSignal,
    );
  }

  /** Add a comment to a task */
  async addTaskComment(
    params: {
      task_id: string;
      node_id: string;
      content: string;
    },
    abortSignal?: AbortSignal,
  ): Promise<any> {
    return this.request(
      "/a2a/tasks/comment",
      { method: "POST", body: JSON.stringify(params) },
      abortSignal,
    );
  }

  // -- A2A Relay Methods -----------------------------------------------------

  /**
   * Send a relay message to another node via GRC's unified delivery system.
   * POST /a2a/relay/send
   */
  async relaySend(
    params: {
      from_node_id: string;
      to_node_id: string;
      message_type: 'text' | 'directive' | 'report' | 'query' | 'task_assignment';
      subject?: string;
      payload: Record<string, unknown>;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      expires_at?: string;
    },
    abortSignal?: AbortSignal,
  ): Promise<{ ok: boolean; message_id: string; status: string; delivered_via_sse: boolean }> {
    return this.request<{ ok: boolean; message_id: string; status: string; delivered_via_sse: boolean }>(
      '/a2a/relay/send',
      { method: 'POST', body: JSON.stringify(params) },
      abortSignal,
    );
  }

  /**
   * Broadcast a message to all nodes or filtered by role.
   * POST /a2a/relay/broadcast
   */
  async relayBroadcast(
    params: {
      from_node_id: string;
      message_type?: 'text' | 'directive' | 'report' | 'broadcast';
      subject: string;
      payload: Record<string, unknown>;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      target_roles?: string[];
      exclude_self?: boolean;
    },
    abortSignal?: AbortSignal,
  ): Promise<{
    ok: boolean;
    broadcast_summary: { total_recipients: number; delivered_immediately: number; queued_for_later: number };
    results: Array<{ node_id: string; message_id: string; delivered_via_sse: boolean }>;
  }> {
    return this.request<{
      ok: boolean;
      broadcast_summary: { total_recipients: number; delivered_immediately: number; queued_for_later: number };
      results: Array<{ node_id: string; message_id: string; delivered_via_sse: boolean }>;
    }>(
      '/a2a/relay/broadcast',
      { method: 'POST', body: JSON.stringify(params) },
      abortSignal,
    );
  }

  /**
   * Get the agent roster with online status.
   * GET /a2a/agents/roster
   */
  async agentRoster(
    abortSignal?: AbortSignal,
  ): Promise<{
    ok: boolean;
    roster: Array<{
      node_id: string;
      status: string;
      sse_connected: boolean;
      last_seen_at: string | null;
      role_id: string | null;
      display_name: string;
    }>;
    summary: { total: number; online: number; sse_connected: number; offline: number; busy: number };
  }> {
    return this.request<{
      ok: boolean;
      roster: Array<{
        node_id: string;
        status: string;
        sse_connected: boolean;
        last_seen_at: string | null;
        role_id: string | null;
        display_name: string;
      }>;
      summary: { total: number; online: number; sse_connected: number; offline: number; busy: number };
    }>(
      '/a2a/agents/roster',
      { method: 'GET' },
      abortSignal,
    );
  }

  /**
   * Check if a JWT token is expired or about to expire (within 5 minutes).
   * Uses simple base64 decode of the payload, no signature verification.
   */
  static isTokenExpired(token: string, bufferSeconds = 300): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: number };
      if (!payload.exp) return true;
      return (payload.exp - bufferSeconds) < (Date.now() / 1000);
    } catch {
      return true;
    }
  }
}
