/**
 * Compaction checkpoints. Ports openclaw f4fcaa09a3.
 * Doubly opt-in: only active when AVATAR_EXT_COMPACTION_CHECKPOINTS=1.
 */

export interface CheckpointEntry {
  readonly id: string;
  readonly createdAt: number;
  readonly providerId: string;
  readonly bytesBefore: number;
  readonly bytesAfter: number;
}

export class CompactionCheckpoint {
  private readonly entries: CheckpointEntry[] = [];
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.AVATAR_EXT_COMPACTION_CHECKPOINTS === "1";
  }

  record(entry: Omit<CheckpointEntry, "createdAt">): void {
    if (!this.enabled) return;
    this.entries.push({ ...entry, createdAt: Date.now() });
  }

  list(): readonly CheckpointEntry[] {
    return this.entries.slice();
  }

  clear(): void {
    this.entries.length = 0;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
