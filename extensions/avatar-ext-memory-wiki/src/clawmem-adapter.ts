/**
 * ClawMem / memory-core read-only adapter.
 *
 * Default mode is "noop": every read returns an empty result. The adapter
 * does NOT import any winclaw-avatar memory module, does NOT touch the
 * filesystem, and does NOT issue network requests.
 *
 * Why noop:
 *   extensions/memory-core/index.ts only exposes WinClaw plugin registration
 *   objects (registerTool / registerCli). There is no documented stable read
 *   surface. Importing memory-bridge.ts directly is forbidden by the
 *   additive-migration plan because that file is DH-internal.
 */

export type AdapterMode = "noop";

export interface ClaimRecord {
  id: string;
  text: string;
  source: string;
  timestamp: number;
}

export interface ClawMemReadOnlyAdapter {
  readonly mode: AdapterMode;
  searchClaims(query: string, limit?: number): Promise<readonly ClaimRecord[]>;
  getClaim(id: string): Promise<ClaimRecord | null>;
}

export interface CreateAdapterOptions {
  mode?: AdapterMode;
}

export function createClawMemReadOnlyAdapter(
  options: CreateAdapterOptions = {}
): ClawMemReadOnlyAdapter {
  const mode: AdapterMode = options.mode ?? "noop";
  return {
    mode,
    async searchClaims(_query, _limit) {
      return [];
    },
    async getClaim(_id) {
      return null;
    },
  };
}
