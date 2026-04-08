/**
 * register() — entry point invoked by the Digital Human plugin
 * when AVATAR_EXT_MEMORY_WIKI=1.
 *
 * Hard rules:
 *   - This function is fire-and-forget. It MUST NOT throw.
 *   - It MUST NOT mutate the api object beyond optional registrations
 *     (and in this initial scaffold, performs zero registrations).
 *   - It MUST NOT touch any ClawMem / memory-core / DH internal state.
 *   - It MUST NOT block DH startup. All work is best-effort and async.
 */

import { ensureExtStorageDir } from "./storage.js";
import { createClawMemReadOnlyAdapter } from "./clawmem-adapter.js";
import { BeliefLayer } from "./belief-layer.js";

export type RegisterApi = unknown;

// Idempotency is provided by BeliefLayer.initialize() (which short-circuits
// after the first call within an instance) and by mkdir({recursive:true})
// being safe to call repeatedly. We deliberately do NOT keep a module-level
// "already registered" flag so that integration tests with isolated storage
// dirs can re-invoke register() per test without bleed-over.
export async function register(_api: RegisterApi): Promise<void> {
  try {
    const storageDir = await ensureExtStorageDir();
    const adapter = createClawMemReadOnlyAdapter({ mode: "noop" });
    const belief = new BeliefLayer({ storageDir, adapter });
    await belief.initialize();

    if (process.env.AVATAR_EXT_MEMORY_WIKI_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log(
        `[avatar-ext-memory-wiki] registered (noop adapter, storage=${storageDir})`
      );
    }
  } catch (err) {
    // Never escalate. The DH plugin must continue startup unaffected.
    if (process.env.AVATAR_EXT_MEMORY_WIKI_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[avatar-ext-memory-wiki] register() suppressed error:", err);
    }
  }
}
