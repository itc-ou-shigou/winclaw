import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("memory/dream");

export type DreamEventName =
  | "fired"
  | "skipped"
  | "completed"
  | "failed"
  | "restored"
  | "phase_start"
  | "phase_end";

export function logDreamEvent(
  name: DreamEventName,
  data: Record<string, unknown>,
): void {
  const payload = { event: `winclaw_dream_${name}`, ...data };
  if (name === "failed") {log.error(JSON.stringify(payload));}
  else {log.info(JSON.stringify(payload));}
}

export { log as dreamLog };
