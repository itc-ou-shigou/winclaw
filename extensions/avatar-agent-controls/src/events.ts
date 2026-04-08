/**
 * Event name constants. The avatar.ext.* prefix is reserved for this
 * additive migration namespace and does not collide with any existing
 * winclaw-avatar event names.
 */

export const EVENTS = {
  PROMPT_OVERRIDE: "avatar.ext.prompt.override",
  HEARTBEAT: "avatar.ext.heartbeat",
  HEARTBEAT_STATUS: "avatar.ext.heartbeat.status",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
