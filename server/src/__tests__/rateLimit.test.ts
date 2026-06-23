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
});
