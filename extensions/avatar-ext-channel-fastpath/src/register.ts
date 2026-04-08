/**
 * register() — entry point invoked when AVATAR_EXT_CHANNEL_FASTPATH=1.
 * Never throws. Initializes the singleton fast-path table empty so callers
 * can populate it on demand.
 */

import { getDefaultFastPath, isChannelFastPathEnabled } from "./fastpath.js";

export type RegisterApi = unknown;

export async function register(_api: RegisterApi): Promise<void> {
  try {
    if (!isChannelFastPathEnabled()) return;
    const fp = getDefaultFastPath();
    if (process.env.AVATAR_EXT_CHANNEL_FASTPATH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log(`[avatar-ext-channel-fastpath] enabled (entries=${fp.size()})`);
    }
  } catch (err) {
    if (process.env.AVATAR_EXT_CHANNEL_FASTPATH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[avatar-ext-channel-fastpath] register() suppressed error:", err);
    }
  }
}
