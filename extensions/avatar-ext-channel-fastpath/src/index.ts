/**
 * @winclaw-avatar/ext-channel-fastpath — public re-exports.
 * Loaded only when AVATAR_EXT_CHANNEL_FASTPATH=1.
 */

export { register } from "./register.js";
export {
  ChannelFastPath,
  getDefaultFastPath,
  isChannelFastPathEnabled,
} from "./fastpath.js";
export type { DirectOverrideEntry, FastPathLookupInput, FastPathStats } from "./fastpath.js";
