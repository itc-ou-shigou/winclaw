/**
 * Prompt override store. Does NOT modify the Digital Human persona prompt
 * assembly. Stores overrides in-memory only. Inert unless callers explicitly
 * read from it.
 */

export interface PromptOverride {
  readonly id: string;
  readonly text: string;
  readonly setAt: number;
  readonly ttlMs?: number;
}

export class PromptOverrideStore {
  private overrides = new Map<string, PromptOverride>();

  set(id: string, text: string, ttlMs?: number): PromptOverride {
    const entry: PromptOverride = { id, text, setAt: Date.now(), ttlMs };
    this.overrides.set(id, entry);
    return entry;
  }

  get(id: string): PromptOverride | null {
    const entry = this.overrides.get(id);
    if (!entry) return null;
    if (entry.ttlMs !== undefined && Date.now() - entry.setAt > entry.ttlMs) {
      this.overrides.delete(id);
      return null;
    }
    return entry;
  }

  clear(id?: string): void {
    if (id === undefined) this.overrides.clear();
    else this.overrides.delete(id);
  }

  size(): number {
    return this.overrides.size;
  }
}
