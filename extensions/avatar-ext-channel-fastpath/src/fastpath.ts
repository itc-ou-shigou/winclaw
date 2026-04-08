/**
 * Channel direct-override fast-path.
 *
 * Hard rules:
 *   - Never mutates existing channel resolver code.
 *   - On any miss or any error, returns null so callers fall through to
 *     the existing resolver.
 *   - Stores latency observations in-memory for opt-in inspection. Logs
 *     are written only when AVATAR_EXT_CHANNEL_FASTPATH_DEBUG=1.
 */

export interface DirectOverrideEntry {
  readonly channelId: string;
  readonly modelId: string;
  readonly description?: string;
}

export interface FastPathLookupInput {
  readonly channelId: string;
}

export interface FastPathStats {
  hits: number;
  misses: number;
  totalLookupNs: bigint;
}

export function isChannelFastPathEnabled(): boolean {
  return process.env.AVATAR_EXT_CHANNEL_FASTPATH === "1";
}

export class ChannelFastPath {
  private readonly direct = new Map<string, DirectOverrideEntry>();
  private readonly stats: FastPathStats = { hits: 0, misses: 0, totalLookupNs: 0n };

  registerDirect(entry: DirectOverrideEntry): void {
    this.direct.set(entry.channelId, entry);
  }

  unregisterDirect(channelId: string): void {
    this.direct.delete(channelId);
  }

  size(): number {
    return this.direct.size;
  }

  /**
   * Returns the resolved model id for a direct override match, or null on
   * miss / when the feature flag is off / on any error. Callers MUST treat
   * null as "fall through to the existing resolver".
   */
  tryFastPath(input: FastPathLookupInput): string | null {
    if (!isChannelFastPathEnabled()) return null;
    const start = process.hrtime.bigint();
    try {
      const entry = this.direct.get(input.channelId);
      if (!entry) {
        this.stats.misses += 1;
        return null;
      }
      this.stats.hits += 1;
      return entry.modelId;
    } catch {
      this.stats.misses += 1;
      return null;
    } finally {
      this.stats.totalLookupNs += process.hrtime.bigint() - start;
    }
  }

  getStats(): Readonly<FastPathStats> {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.totalLookupNs = 0n;
  }

  clear(): void {
    this.direct.clear();
    this.resetStats();
  }
}

let singleton: ChannelFastPath | null = null;

export function getDefaultFastPath(): ChannelFastPath {
  if (singleton === null) singleton = new ChannelFastPath();
  return singleton;
}
