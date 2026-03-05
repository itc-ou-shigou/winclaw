/**
 * EvolutionStore — local persistence layer for evolution genes and capsules.
 *
 * Stores all data in a single JSON file (default: ~/.winclaw/evolution-store.json).
 * Tracks which assets have been shared to the GRC server and buffers usage events
 * for batch reporting.
 *
 * Design constraints:
 *  - Synchronous file I/O keeps the API simple and avoids async footguns in the
 *    callers (evolution engine runs on the hot path).
 *  - Data is loaded lazily on first access and flushed after every mutation.
 *  - The store file is created with mode 0o600 (user-readable only).
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSubsystemLogger } from "../logging/subsystem.js";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = createSubsystemLogger("infra/evolution-store");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A locally-originated or GRC-cached evolution gene. */
export interface LocalGene {
  /** Local UUID — stable primary key within this store. */
  id: string;
  /** Globally unique identifier used across the evolution system, e.g. "gene_xxx". */
  assetId: string;
  /** Broad capability category, e.g. "reasoning" | "coding" | "planning". */
  category: string;
  /** Signals that trigger this gene, used for lookup. */
  signalsMatch: string[];
  /** Core strategy payload (opaque to the store). */
  strategy: Record<string, unknown>;
  /** Optional constraints applied alongside the strategy. */
  constraintsData?: Record<string, unknown>;
  /** Optional validation rules for outputs produced by this gene. */
  validation?: string[];
  /** SHA-256 hex digest of the canonical serialised payload. */
  contentHash: string;
  /** Whether this record originated locally or was downloaded from GRC. */
  source: "local" | "grc";
  /** Status string assigned by the GRC server after review, e.g. "approved" | "promoted". */
  grcStatus?: string;
  /** True once this gene has been successfully published to the GRC server. */
  sharedToGrc: boolean;
  /** Internal ID assigned by the GRC server after a successful publish. */
  grcAssetId?: string;
  /** Total number of times this gene has been selected and applied. */
  useCount: number;
  /** Number of uses that produced a successful outcome. */
  successCount: number;
  /** Number of uses that produced a failed outcome. */
  failCount: number;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}

/** A locally-originated or GRC-cached evolution capsule (a concrete outcome record). */
export interface LocalCapsule {
  /** Local UUID — stable primary key within this store. */
  id: string;
  /** Globally unique identifier used across the evolution system. */
  assetId: string;
  /** The assetId of the parent gene this capsule was generated from, if any. */
  geneAssetId?: string;
  /** Broad capability category inherited from the parent gene, if applicable. */
  category?: string;
  /** Signals associated with this capsule. */
  signalsMatch?: string[];
  /** Data that describes the conditions under which this capsule was triggered. */
  triggerData?: Record<string, unknown>;
  /** Human-readable description of what this capsule captures. */
  summary?: string;
  /** SHA-256 hex digest of the canonical serialised payload. */
  contentHash: string;
  /** Whether this record originated locally or was downloaded from GRC. */
  source: "local" | "grc";
  /** Status string assigned by GRC after review. */
  grcStatus?: string;
  /** True once this capsule has been successfully published to the GRC server. */
  sharedToGrc: boolean;
  /** Internal ID assigned by the GRC server after a successful publish. */
  grcAssetId?: string;
  /** Total number of times this capsule has been applied. */
  useCount: number;
  /** Number of uses that produced a successful outcome. */
  successCount: number;
  /** Number of uses that produced a failed outcome. */
  failCount: number;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}

/** A single usage observation buffered for eventual GRC reporting. */
export interface UsageEvent {
  /** Unique identifier for this event (used for deduplication). */
  id: string;
  /** The assetId of the gene or capsule that was used. */
  assetId: string;
  /** Whether the used asset is a gene or a capsule. */
  assetType: "gene" | "capsule";
  /** Whether the use was considered successful. */
  success: boolean;
  /** Optional additional context captured at the time of use. */
  details?: Record<string, unknown>;
  /** ISO-8601 timestamp of the usage event. */
  timestamp: string;
  /** True once this event has been acknowledged by the GRC server. */
  reported: boolean;
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/** Optional filter criteria for {@link EvolutionStore.listGenes}. */
export interface GeneFilter {
  source?: "local" | "grc";
  sharedToGrc?: boolean;
}

/** Optional filter criteria for {@link EvolutionStore.listCapsules}. */
export interface CapsuleFilter {
  source?: "local" | "grc";
  sharedToGrc?: boolean;
}

// ---------------------------------------------------------------------------
// Omit helper aliases — types accepted by the add* methods
// ---------------------------------------------------------------------------

/** Fields that are auto-populated by {@link EvolutionStore.addGene}. */
type GeneAutoFields = "id" | "useCount" | "successCount" | "failCount" | "createdAt" | "updatedAt";

/** Fields that are auto-populated by {@link EvolutionStore.addCapsule}. */
type CapsuleAutoFields =
  | "id"
  | "useCount"
  | "successCount"
  | "failCount"
  | "createdAt"
  | "updatedAt";

// ---------------------------------------------------------------------------
// Internal store schema
// ---------------------------------------------------------------------------

interface StoreData {
  version: 1;
  genes: Record<string, LocalGene>;
  capsules: Record<string, LocalCapsule>;
  usageEvents: UsageEvent[];
}

function emptyStore(): StoreData {
  return { version: 1, genes: {}, capsules: {}, usageEvents: [] };
}

// ---------------------------------------------------------------------------
// Default store path
// ---------------------------------------------------------------------------

const DEFAULT_STORE_FILENAME = "evolution-store.json";

function resolveDefaultStorePath(): string {
  return path.join(os.homedir(), ".winclaw", DEFAULT_STORE_FILENAME);
}

// ---------------------------------------------------------------------------
// Hashing helper
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hex digest of an arbitrary serialisable value.
 * The value is deterministically stringified via JSON.stringify with sorted
 * keys so that logically equivalent objects produce the same hash.
 */
export function hashPayload(value: unknown): string {
  const serialised = JSON.stringify(value, sortedReplacer);
  return createHash("sha256").update(serialised, "utf8").digest("hex");
}

function sortedReplacer(_key: string, val: unknown): unknown {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = (val as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return val;
}

// ---------------------------------------------------------------------------
// EvolutionStore
// ---------------------------------------------------------------------------

/**
 * Local persistence layer for evolution assets (genes and capsules).
 *
 * All mutations are immediately flushed to disk.  The in-memory state is
 * loaded lazily on first access.
 *
 * @example
 * ```ts
 * const store = new EvolutionStore();
 *
 * const gene = store.addGene({
 *   assetId: "gene_abc123",
 *   category: "reasoning",
 *   signalsMatch: ["high-complexity"],
 *   strategy: { approach: "chain-of-thought" },
 *   contentHash: hashPayload({ approach: "chain-of-thought" }),
 *   source: "local",
 *   sharedToGrc: false,
 * });
 *
 * store.recordUsage(gene.assetId, "gene", true);
 * ```
 */
export class EvolutionStore {
  private readonly storePath: string;
  private data: StoreData | null = null;

  constructor(storePath?: string) {
    this.storePath = storePath ?? resolveDefaultStorePath();
  }

  // -------------------------------------------------------------------------
  // Gene CRUD
  // -------------------------------------------------------------------------

  /**
   * Persist a new gene and return the fully-populated record.
   * Throws if a gene with the same `assetId` already exists.
   */
  addGene(gene: Omit<LocalGene, GeneAutoFields>): LocalGene {
    const store = this.ensureLoaded();
    if (store.genes[gene.assetId] !== undefined) {
      throw new Error(
        `EvolutionStore.addGene: gene with assetId "${gene.assetId}" already exists`,
      );
    }
    const now = new Date().toISOString();
    const record: LocalGene = {
      ...gene,
      id: randomUUID(),
      useCount: 0,
      successCount: 0,
      failCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.genes[gene.assetId] = record;
    this.save(store);
    log.debug("gene added", { assetId: gene.assetId, source: gene.source });
    return record;
  }

  /**
   * Retrieve a gene by its `assetId`.
   * Returns `null` when no matching gene is found.
   */
  getGene(assetId: string): LocalGene | null {
    return this.ensureLoaded().genes[assetId] ?? null;
  }

  /**
   * Return all genes, optionally filtered by `source` and/or `sharedToGrc`.
   */
  listGenes(filter?: GeneFilter): LocalGene[] {
    const genes = Object.values(this.ensureLoaded().genes);
    return applyAssetFilter(genes, filter);
  }

  /**
   * Shorthand for `listGenes({ source: "local", sharedToGrc: false })`.
   * Returns all locally-created genes that have not yet been published to GRC.
   */
  getUnsharedGenes(): LocalGene[] {
    return this.listGenes({ source: "local", sharedToGrc: false });
  }

  /**
   * Mark a gene as successfully shared to GRC and record the server-assigned ID.
   * No-op (with a warning) when the gene is not found.
   */
  markGeneShared(assetId: string, grcAssetId: string): void {
    const store = this.ensureLoaded();
    const gene = store.genes[assetId];
    if (gene === undefined) {
      log.warn("markGeneShared: gene not found", { assetId });
      return;
    }
    store.genes[assetId] = {
      ...gene,
      sharedToGrc: true,
      grcAssetId,
      updatedAt: new Date().toISOString(),
    };
    this.save(store);
    log.debug("gene marked as shared", { assetId, grcAssetId });
  }

  /**
   * Update mutable metadata on an existing gene (e.g. `grcStatus`).
   * The fields `id`, `assetId`, `createdAt`, `useCount`, `successCount`,
   * and `failCount` are ignored in `patch` — use {@link recordUsage} for
   * usage counters.  Returns the updated record, or `null` if not found.
   */
  updateGene(
    assetId: string,
    patch: Partial<
      Omit<LocalGene, "id" | "assetId" | "createdAt" | "useCount" | "successCount" | "failCount">
    >,
  ): LocalGene | null {
    const store = this.ensureLoaded();
    const gene = store.genes[assetId];
    if (gene === undefined) {
      log.warn("updateGene: gene not found", { assetId });
      return null;
    }
    const updated: LocalGene = {
      ...gene,
      ...patch,
      id: gene.id,
      assetId: gene.assetId,
      createdAt: gene.createdAt,
      useCount: gene.useCount,
      successCount: gene.successCount,
      failCount: gene.failCount,
      updatedAt: new Date().toISOString(),
    };
    store.genes[assetId] = updated;
    this.save(store);
    return updated;
  }

  // -------------------------------------------------------------------------
  // Capsule CRUD
  // -------------------------------------------------------------------------

  /**
   * Persist a new capsule and return the fully-populated record.
   * Throws if a capsule with the same `assetId` already exists.
   */
  addCapsule(capsule: Omit<LocalCapsule, CapsuleAutoFields>): LocalCapsule {
    const store = this.ensureLoaded();
    if (store.capsules[capsule.assetId] !== undefined) {
      throw new Error(
        `EvolutionStore.addCapsule: capsule with assetId "${capsule.assetId}" already exists`,
      );
    }
    const now = new Date().toISOString();
    const record: LocalCapsule = {
      ...capsule,
      id: randomUUID(),
      useCount: 0,
      successCount: 0,
      failCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.capsules[capsule.assetId] = record;
    this.save(store);
    log.debug("capsule added", { assetId: capsule.assetId, source: capsule.source });
    return record;
  }

  /**
   * Retrieve a capsule by its `assetId`.
   * Returns `null` when no matching capsule is found.
   */
  getCapsule(assetId: string): LocalCapsule | null {
    return this.ensureLoaded().capsules[assetId] ?? null;
  }

  /**
   * Return all capsules, optionally filtered by `source` and/or `sharedToGrc`.
   */
  listCapsules(filter?: CapsuleFilter): LocalCapsule[] {
    const capsules = Object.values(this.ensureLoaded().capsules);
    return applyAssetFilter(capsules, filter);
  }

  /**
   * Shorthand for `listCapsules({ source: "local", sharedToGrc: false })`.
   * Returns all locally-created capsules that have not yet been published to GRC.
   */
  getUnsharedCapsules(): LocalCapsule[] {
    return this.listCapsules({ source: "local", sharedToGrc: false });
  }

  /**
   * Mark a capsule as successfully shared to GRC and record the server-assigned ID.
   * No-op (with a warning) when the capsule is not found.
   */
  markCapsuleShared(assetId: string, grcAssetId: string): void {
    const store = this.ensureLoaded();
    const capsule = store.capsules[assetId];
    if (capsule === undefined) {
      log.warn("markCapsuleShared: capsule not found", { assetId });
      return;
    }
    store.capsules[assetId] = {
      ...capsule,
      sharedToGrc: true,
      grcAssetId,
      updatedAt: new Date().toISOString(),
    };
    this.save(store);
    log.debug("capsule marked as shared", { assetId, grcAssetId });
  }

  /**
   * Update mutable metadata on an existing capsule (e.g. `grcStatus`, `summary`).
   * Returns the updated record, or `null` if not found.
   */
  updateCapsule(
    assetId: string,
    patch: Partial<
      Omit<
        LocalCapsule,
        "id" | "assetId" | "createdAt" | "useCount" | "successCount" | "failCount"
      >
    >,
  ): LocalCapsule | null {
    const store = this.ensureLoaded();
    const capsule = store.capsules[assetId];
    if (capsule === undefined) {
      log.warn("updateCapsule: capsule not found", { assetId });
      return null;
    }
    const updated: LocalCapsule = {
      ...capsule,
      ...patch,
      id: capsule.id,
      assetId: capsule.assetId,
      createdAt: capsule.createdAt,
      useCount: capsule.useCount,
      successCount: capsule.successCount,
      failCount: capsule.failCount,
      updatedAt: new Date().toISOString(),
    };
    store.capsules[assetId] = updated;
    this.save(store);
    return updated;
  }

  // -------------------------------------------------------------------------
  // GRC cache — upsert helpers for downloaded promoted assets
  // -------------------------------------------------------------------------

  /**
   * Insert or update a gene that was downloaded from GRC.
   *
   * If a gene with the same `assetId` already exists, its strategy and
   * metadata are updated in place (preserving local usage counters).
   * Always sets `source: "grc"` and `sharedToGrc: true`.
   */
  cacheGrcGene(
    gene: Partial<LocalGene> & { assetId: string; contentHash: string },
  ): LocalGene {
    const store = this.ensureLoaded();
    const existing = store.genes[gene.assetId];
    const now = new Date().toISOString();

    if (existing !== undefined) {
      // Short-circuit when the content has not changed.
      if (existing.contentHash === gene.contentHash) {
        return existing;
      }
      const updated: LocalGene = {
        ...existing,
        ...gene,
        id: existing.id,
        assetId: existing.assetId,
        source: "grc" as const,
        sharedToGrc: true,
        useCount: existing.useCount,
        successCount: existing.successCount,
        failCount: existing.failCount,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      store.genes[gene.assetId] = updated;
      this.save(store);
      log.debug("grc gene cache updated", { assetId: gene.assetId });
      return updated;
    }

    const record: LocalGene = {
      category: "",
      signalsMatch: [],
      strategy: {},
      ...gene,
      id: randomUUID(),
      source: "grc" as const,
      sharedToGrc: true,
      useCount: 0,
      successCount: 0,
      failCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.genes[gene.assetId] = record;
    this.save(store);
    log.debug("grc gene cached", { assetId: gene.assetId });
    return record;
  }

  /**
   * Insert or update a capsule that was downloaded from GRC.
   *
   * Preserves local usage counters when updating an existing record.
   * Always sets `source: "grc"` and `sharedToGrc: true`.
   */
  cacheGrcCapsule(
    capsule: Partial<LocalCapsule> & { assetId: string; contentHash: string },
  ): LocalCapsule {
    const store = this.ensureLoaded();
    const existing = store.capsules[capsule.assetId];
    const now = new Date().toISOString();

    if (existing !== undefined) {
      if (existing.contentHash === capsule.contentHash) {
        return existing;
      }
      const updated: LocalCapsule = {
        ...existing,
        ...capsule,
        id: existing.id,
        assetId: existing.assetId,
        source: "grc" as const,
        sharedToGrc: true,
        useCount: existing.useCount,
        successCount: existing.successCount,
        failCount: existing.failCount,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      store.capsules[capsule.assetId] = updated;
      this.save(store);
      log.debug("grc capsule cache updated", { assetId: capsule.assetId });
      return updated;
    }

    const record: LocalCapsule = {
      ...capsule,
      id: randomUUID(),
      source: "grc" as const,
      sharedToGrc: true,
      useCount: 0,
      successCount: 0,
      failCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.capsules[capsule.assetId] = record;
    this.save(store);
    log.debug("grc capsule cached", { assetId: capsule.assetId });
    return record;
  }

  // -------------------------------------------------------------------------
  // Usage tracking
  // -------------------------------------------------------------------------

  /**
   * Record a usage observation for a gene or capsule.
   *
   * Also increments the corresponding counter (`useCount`, `successCount` or
   * `failCount`) on the asset record if it exists in the store.
   */
  recordUsage(
    assetId: string,
    assetType: "gene" | "capsule",
    success: boolean,
    details?: Record<string, unknown>,
  ): void {
    const store = this.ensureLoaded();
    const now = new Date().toISOString();

    // Buffer the event for batch reporting.
    const event: UsageEvent = {
      id: randomUUID(),
      assetId,
      assetType,
      success,
      details,
      timestamp: now,
      reported: false,
    };
    store.usageEvents.push(event);

    // Cap the events buffer to prevent unbounded growth (Issue #9 from review).
    const MAX_USAGE_EVENTS = 10_000;
    if (store.usageEvents.length > MAX_USAGE_EVENTS) {
      // Drop oldest reported events first, then oldest unreported if still over limit.
      const reported = store.usageEvents.filter((e) => e.reported);
      const unreported = store.usageEvents.filter((e) => !e.reported);
      if (reported.length > 0) {
        store.usageEvents = [...unreported, ...reported.slice(-Math.max(MAX_USAGE_EVENTS - unreported.length, 0))];
      } else {
        store.usageEvents = unreported.slice(-MAX_USAGE_EVENTS);
      }
    }

    // Increment counters on the asset record.
    if (assetType === "gene") {
      const gene = store.genes[assetId];
      if (gene !== undefined) {
        store.genes[assetId] = {
          ...gene,
          useCount: gene.useCount + 1,
          successCount: success ? gene.successCount + 1 : gene.successCount,
          failCount: success ? gene.failCount : gene.failCount + 1,
          updatedAt: now,
        };
      }
    } else {
      const capsule = store.capsules[assetId];
      if (capsule !== undefined) {
        store.capsules[assetId] = {
          ...capsule,
          useCount: capsule.useCount + 1,
          successCount: success ? capsule.successCount + 1 : capsule.successCount,
          failCount: success ? capsule.failCount : capsule.failCount + 1,
          updatedAt: now,
        };
      }
    }

    this.save(store);
    log.debug("usage recorded", { assetId, assetType, success });
  }

  /**
   * Return all usage events that have not yet been acknowledged by GRC.
   */
  getUnreportedUsage(): UsageEvent[] {
    return this.ensureLoaded().usageEvents.filter((e) => !e.reported);
  }

  /**
   * Mark a batch of usage events as reported, identified by their unique `id` values.
   *
   * IDs that do not match any buffered event are silently ignored.
   */
  markUsageReported(eventIds: string[]): void {
    const store = this.ensureLoaded();
    const idSet = new Set(eventIds);
    let changed = false;
    for (const event of store.usageEvents) {
      if (!event.reported && idSet.has(event.id)) {
        event.reported = true;
        changed = true;
      }
    }
    if (changed) {
      this.save(store);
      log.debug("usage events marked as reported", { count: eventIds.length });
    }
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Find genes and/or capsules whose `signalsMatch` array contains at least
   * one of the provided signal strings.
   *
   * @param signals   One or more signal strings to match against.
   * @param assetType Restrict results to `"gene"`, `"capsule"`, or both when omitted.
   */
  searchBySignals(
    signals: string[],
    assetType?: "gene" | "capsule",
  ): (LocalGene | LocalCapsule)[] {
    if (signals.length === 0) {
      return [];
    }
    const signalSet = new Set(signals);
    const results: (LocalGene | LocalCapsule)[] = [];

    if (assetType === undefined || assetType === "gene") {
      for (const gene of Object.values(this.ensureLoaded().genes)) {
        if (gene.signalsMatch.some((s) => signalSet.has(s))) {
          results.push(gene);
        }
      }
    }

    if (assetType === undefined || assetType === "capsule") {
      for (const capsule of Object.values(this.ensureLoaded().capsules)) {
        if (capsule.signalsMatch?.some((s) => signalSet.has(s))) {
          results.push(capsule);
        }
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Diagnostics / maintenance
  // -------------------------------------------------------------------------

  /**
   * Return a shallow summary of the store's current state without exposing
   * the full data graph (useful for health-checks and logging).
   */
  summary(): {
    geneCount: number;
    capsuleCount: number;
    unreportedUsageCount: number;
    storePath: string;
  } {
    const store = this.ensureLoaded();
    return {
      geneCount: Object.keys(store.genes).length,
      capsuleCount: Object.keys(store.capsules).length,
      unreportedUsageCount: store.usageEvents.filter((e) => !e.reported).length,
      storePath: this.storePath,
    };
  }

  /**
   * Prune usage events that have already been reported to GRC.
   * Keeps all unreported events.  Returns the number of events removed.
   */
  pruneReportedUsage(): number {
    const store = this.ensureLoaded();
    const before = store.usageEvents.length;
    store.usageEvents = store.usageEvents.filter((e) => !e.reported);
    const removed = before - store.usageEvents.length;
    if (removed > 0) {
      this.save(store);
      log.debug("pruned reported usage events", { removed });
    }
    return removed;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Load store data from disk into memory.  Idempotent — subsequent calls are
   * no-ops until the in-memory state is invalidated.
   */
  private load(): StoreData {
    try {
      if (!fs.existsSync(this.storePath)) {
        log.debug("store file not found, starting empty", { storePath: this.storePath });
        return emptyStore();
      }
      const raw = fs.readFileSync(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isStoreData(parsed)) {
        log.warn("store file has unexpected format, starting empty", {
          storePath: this.storePath,
        });
        return emptyStore();
      }
      return parsed;
    } catch (err) {
      log.error("failed to load store, starting empty", {
        storePath: this.storePath,
        error: String(err),
      });
      return emptyStore();
    }
  }

  /**
   * Flush the current in-memory state to disk atomically by writing to a
   * temporary file then renaming.  Creates the parent directory if needed.
   */
  private save(store: StoreData): void {
    const dir = path.dirname(this.storePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      const tmp = `${this.storePath}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      fs.renameSync(tmp, this.storePath);
      try {
        fs.chmodSync(this.storePath, 0o600);
      } catch {
        // Best-effort on platforms that do not support chmod.
      }
    } catch (err) {
      log.error("failed to save store", {
        storePath: this.storePath,
        error: String(err),
      });
      throw err;
    }
  }

  /**
   * Return the loaded in-memory state, loading from disk on the first call.
   */
  private ensureLoaded(): StoreData {
    if (this.data === null) {
      this.data = this.load();
    }
    return this.data;
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isStoreData(value: unknown): value is StoreData {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    v["version"] === 1 &&
    v["genes"] !== null &&
    typeof v["genes"] === "object" &&
    v["capsules"] !== null &&
    typeof v["capsules"] === "object" &&
    Array.isArray(v["usageEvents"])
  );
}

// ---------------------------------------------------------------------------
// Shared filter helper
// ---------------------------------------------------------------------------

type FilterableAsset = { source: "local" | "grc"; sharedToGrc: boolean };

function applyAssetFilter<T extends FilterableAsset>(
  assets: T[],
  filter: { source?: string; sharedToGrc?: boolean } | undefined,
): T[] {
  if (filter === undefined) {
    return assets;
  }
  return assets.filter((a) => {
    if (filter.source !== undefined && a.source !== filter.source) {
      return false;
    }
    if (filter.sharedToGrc !== undefined && a.sharedToGrc !== filter.sharedToGrc) {
      return false;
    }
    return true;
  });
}
