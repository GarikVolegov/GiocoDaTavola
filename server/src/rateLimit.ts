// Fixed-window per-key rate limiter (sliding by pruning hits older than the
// window). Pure + clock-injectable for deterministic tests. Used to throttle
// room create/join so one socket can't spam the room space.
export interface RateLimiter {
  allow(key: string, now?: number): boolean;
  /** Number of currently tracked keys (for testing/observability). */
  size(): number;
}

export function createRateLimiter(
  max: number,
  windowMs: number,
  maxTrackedKeys = 2000,
): RateLimiter {
  const hits = new Map<string, number[]>();

  function pruneExpired(cutoff: number): void {
    for (const [k, ts] of hits) {
      const valid = ts.filter((t) => t > cutoff);
      if (valid.length === 0) hits.delete(k);
      else hits.set(k, valid);
    }
    // If still at/above cap (e.g. active flood from many distinct keys), evict oldest
    // so inserting the incoming key stays within maxTrackedKeys.
    if (hits.size >= maxTrackedKeys) {
      const excess = hits.size - maxTrackedKeys + 1;
      let removed = 0;
      for (const k of hits.keys()) {
        hits.delete(k);
        if (++removed >= excess) break;
      }
    }
  }

  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      if (!hits.has(key) && hits.size >= maxTrackedKeys) {
        pruneExpired(cutoff);
      }
      const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (kept.length >= max) {
        hits.set(key, kept);
        return false;
      }
      kept.push(now);
      hits.set(key, kept);
      return true;
    },
    size(): number {
      return hits.size;
    },
  };
}
