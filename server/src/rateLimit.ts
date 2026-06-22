// Fixed-window per-key rate limiter (sliding by pruning hits older than the
// window). Pure + clock-injectable for deterministic tests. Used to throttle
// room create/join so one socket can't spam the room space.
export interface RateLimiter {
  allow(key: string, now?: number): boolean;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (kept.length >= max) {
        hits.set(key, kept);
        return false;
      }
      kept.push(now);
      hits.set(key, kept);
      return true;
    },
  };
}
