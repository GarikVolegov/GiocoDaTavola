import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../rateLimit';

describe('createRateLimiter', () => {
  it('allows up to max within the window then blocks', () => {
    const rl = createRateLimiter(3, 1000);
    expect(rl.allow('k', 0)).toBe(true);
    expect(rl.allow('k', 100)).toBe(true);
    expect(rl.allow('k', 200)).toBe(true);
    expect(rl.allow('k', 300)).toBe(false);
  });

  it('allows again after the window slides past old hits', () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow('k', 0)).toBe(true);
    expect(rl.allow('k', 500)).toBe(false);
    expect(rl.allow('k', 1001)).toBe(true);
  });

  it('keeps keys independent', () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 0)).toBe(false);
  });

  it('prunes expired keys and bounds memory when maxTrackedKeys is exceeded', () => {
    const rl = createRateLimiter(2, 1000, 3);
    rl.allow('k1', 0);
    rl.allow('k2', 0);
    rl.allow('k3', 0);
    expect(rl.size()).toBe(3);
    // Past window: k1..k3 expire and get pruned when k4 arrives
    rl.allow('k4', 2000);
    expect(rl.size()).toBe(1);
    // Active flood: still bounded to maxTrackedKeys
    rl.allow('k5', 2000);
    rl.allow('k6', 2000);
    rl.allow('k7', 2000);
    expect(rl.size()).toBeLessThanOrEqual(3);
  });
});
