/**
 * register() — entry point invoked when AVATAR_EXT_MEDIA_INTENT=1.
 * The helper is stateless; register() exists only for symmetric API with
 * other avatar-ext packages and to confirm the flag is on. Never throws.
 */

import { isMediaIntentEnabled } from "./intent.js";

export type RegisterApi = unknown;

export async function register(_api: RegisterApi): Promise<void> {
  try {
    if (!isMediaIntentEnabled()) return;
    if (process.env.AVATAR_EXT_MEDIA_INTENT_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[avatar-ext-media-intent] enabled (helper-only, no provider mutation)");
    }
  } catch (err) {
    if (process.env.AVATAR_EXT_MEDIA_INTENT_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[avatar-ext-media-intent] register() suppressed error:", err);
    }
  }
}
