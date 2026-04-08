/**
 * Pluggable compaction provider registry.
 * Ports openclaw 12331f0463. NEVER mutates winclaw-avatar's existing LCM code.
 */

export interface CompactionInput {
  readonly text: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CompactionResult {
  readonly compacted: string;
  readonly droppedTokens?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CompactionProvider {
  readonly id: string;
  readonly description?: string;
  compact(input: CompactionInput): Promise<CompactionResult>;
}

export class CompactionRegistry {
  private readonly providers = new Map<string, CompactionProvider>();
  private defaultId: string | null = null;

  register(provider: CompactionProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`compaction provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    if (this.defaultId === null) this.defaultId = provider.id;
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) throw new Error(`unknown compaction provider: ${id}`);
    this.defaultId = id;
  }

  get(id: string): CompactionProvider | null {
    return this.providers.get(id) ?? null;
  }

  getDefault(): CompactionProvider | null {
    if (this.defaultId === null) return null;
    return this.providers.get(this.defaultId) ?? null;
  }

  list(): readonly string[] {
    return Array.from(this.providers.keys());
  }

  clear(): void {
    this.providers.clear();
    this.defaultId = null;
  }
}

let singleton: CompactionRegistry | null = null;

export function getDefaultRegistry(): CompactionRegistry {
  if (singleton === null) singleton = new CompactionRegistry();
  return singleton;
}
