/**
 * register() — entry point invoked when AVATAR_EXT_COMPACTION_REGISTRY=1.
 * Never throws. Never touches LCM internals. Only registers the LCM
 * passthrough provider in the registry.
 */

import { getDefaultRegistry } from "./registry.js";
import { lcmDefaultProvider } from "./lcm-default-provider.js";

export type RegisterApi = unknown;

export async function register(_api: RegisterApi): Promise<void> {
  try {
    const registry = getDefaultRegistry();
    if (registry.get(lcmDefaultProvider.id) === null) {
      registry.register(lcmDefaultProvider);
    }
    if (process.env.AVATAR_EXT_COMPACTION_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log(
        `[avatar-ext-compaction] registered (providers=${registry.list().join(",")})`
      );
    }
  } catch (err) {
    if (process.env.AVATAR_EXT_COMPACTION_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[avatar-ext-compaction] register() suppressed error:", err);
    }
  }
}
