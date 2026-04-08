/**
 * BeliefLayer — claim digest skeleton.
 * Ports openclaw commit 947a43dae3.
 */

import { join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import type { ClawMemReadOnlyAdapter } from "./clawmem-adapter.js";

export interface BeliefLayerOptions {
  storageDir: string;
  adapter: ClawMemReadOnlyAdapter;
}

interface BeliefLayerManifest {
  version: 1;
  createdAt: number;
  adapterMode: string;
}

export class BeliefLayer {
  private readonly storageDir: string;
  private readonly adapter: ClawMemReadOnlyAdapter;
  private initialized = false;

  constructor(options: BeliefLayerOptions) {
    this.storageDir = options.storageDir;
    this.adapter = options.adapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const beliefDir = join(this.storageDir, "belief");
    await mkdir(beliefDir, { recursive: true });
    const manifestPath = join(beliefDir, "manifest.json");
    try {
      await readFile(manifestPath, "utf8");
    } catch {
      const manifest: BeliefLayerManifest = {
        version: 1,
        createdAt: Date.now(),
        adapterMode: this.adapter.mode,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
    this.initialized = true;
  }

  async computeDigests(): Promise<readonly string[]> {
    if (!this.initialized) await this.initialize();
    return [];
  }
}
