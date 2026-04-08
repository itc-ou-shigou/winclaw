/**
 * register() — sidecar entry point invoked when AVATAR_EXT_AGENT_CONTROLS=1.
 * Never throws. Heartbeat starts in observation-only mode.
 */

import { PromptOverrideStore } from "./prompt-override.js";
import { HeartbeatMonitor } from "./heartbeat.js";

export type RegisterApi = unknown;

export interface SidecarState {
  promptOverrides: PromptOverrideStore;
  heartbeat: HeartbeatMonitor;
}

let sidecar: SidecarState | null = null;

export async function register(_api: RegisterApi): Promise<SidecarState | null> {
  try {
    if (sidecar !== null) return sidecar;
    const state: SidecarState = {
      promptOverrides: new PromptOverrideStore(),
      heartbeat: new HeartbeatMonitor(),
    };
    state.heartbeat.start();
    sidecar = state;
    if (process.env.AVATAR_EXT_AGENT_CONTROLS_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("[avatar-agent-controls] sidecar started");
    }
    return sidecar;
  } catch (err) {
    if (process.env.AVATAR_EXT_AGENT_CONTROLS_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.warn("[avatar-agent-controls] register() suppressed error:", err);
    }
    return null;
  }
}

// Test-only helper. Not exported via package "exports".
export function __resetForTests(): void {
  if (sidecar !== null) {
    sidecar.heartbeat.stop();
    sidecar = null;
  }
}
