/**
 * Task Event Cache — stores SSE task event metadata so heartbeat prompts
 * can include task details (title, priority, description, feedback, etc.)
 * instead of only the task ID.
 *
 * The cache is keyed by task_id and auto-expires entries after 30 minutes
 * to prevent unbounded memory growth.
 */

export interface TaskEventMeta {
  event_type: string;
  task_id: string;
  task_code: string;
  title: string;
  priority: string;
  category?: string;
  status?: string;
  description?: string;
  deliverables?: string[];
  feedback?: string;
  result_summary?: string;
  assigned_role_id?: string;
  creator_node_id?: string;
  cached_at: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, TaskEventMeta>();

/** Store task event metadata from an SSE payload. */
export function cacheTaskEvent(meta: Omit<TaskEventMeta, "cached_at">): void {
  cache.set(meta.task_id, { ...meta, cached_at: Date.now() });
  // Lazy cleanup: remove expired entries when cache grows beyond a threshold
  if (cache.size > 100) {
    pruneExpired();
  }
}

/** Retrieve cached task event metadata. Returns undefined if not found or expired. */
export function getCachedTaskEvent(taskId: string): TaskEventMeta | undefined {
  const entry = cache.get(taskId);
  if (!entry) return undefined;
  if (Date.now() - entry.cached_at > CACHE_TTL_MS) {
    cache.delete(taskId);
    return undefined;
  }
  return entry;
}

/** Remove a task event from the cache after it has been consumed. */
export function removeCachedTaskEvent(taskId: string): void {
  cache.delete(taskId);
}

/** Remove all expired entries. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cached_at > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

/** Clear all cached entries (for testing). */
export function clearTaskEventCache(): void {
  cache.clear();
}
