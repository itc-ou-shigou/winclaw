/**
 * Gateway middleware for compaction checkpoints.
 * NOT auto-mounted. Callers must explicitly invoke mountCompactionMiddleware().
 * Even then requires both AVATAR_EXT_COMPACTION_REGISTRY=1 and
 * AVATAR_EXT_COMPACTION_CHECKPOINTS=1.
 */

import { CompactionCheckpoint } from "./checkpoint.js";

export interface MinimalGatewayLike {
  use?: (handler: (req: unknown, res: unknown, next: () => void) => void) => void;
}

export function mountCompactionMiddleware(
  gateway: MinimalGatewayLike,
  checkpoint: CompactionCheckpoint = new CompactionCheckpoint()
): { mounted: boolean; reason?: string } {
  if (process.env.AVATAR_EXT_COMPACTION_REGISTRY !== "1") {
    return { mounted: false, reason: "registry flag off" };
  }
  if (!checkpoint.isEnabled) {
    return { mounted: false, reason: "checkpoint flag off" };
  }
  if (typeof gateway.use !== "function") {
    return { mounted: false, reason: "gateway.use unavailable" };
  }
  gateway.use((_req, _res, next) => { next(); });
  return { mounted: true };
}
