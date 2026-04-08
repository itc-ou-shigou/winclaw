/**
 * @winclaw-avatar/ext-media-intent — public re-exports.
 * Loaded only when AVATAR_EXT_MEDIA_INTENT=1.
 */

export { register } from "./register.js";
export { tagIntent, readIntent, clearIntent, isMediaIntentEnabled } from "./intent.js";
export type { MediaIntent, MediaIntentKind, EnvelopeLike } from "./intent.js";
