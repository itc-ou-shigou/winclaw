/**
 * @winclaw-avatar/avatar-agent-controls — public re-exports.
 * Loaded only when AVATAR_EXT_AGENT_CONTROLS=1.
 */

export { register } from "./register.js";
export { EVENTS } from "./events.js";
export type { EventName } from "./events.js";
export { PromptOverrideStore } from "./prompt-override.js";
export type { PromptOverride } from "./prompt-override.js";
export { HeartbeatMonitor } from "./heartbeat.js";
export type { HeartbeatTick, HeartbeatStatus } from "./heartbeat.js";
