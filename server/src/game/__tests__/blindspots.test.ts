import { describe, it, expect } from 'vitest';
import { computeBlindSpot } from '../blindspots';
import type { PlayerStats } from '../awards';

// Build a PlayerStats with sensible zeros, overriding only what each case needs.
function stats(over: Partial<PlayerStats>): PlayerStats {
  return { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0, ...over };
}

describe('computeBlindSpot', () => {
  it('flags a frequent mind-changer as "volubile"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 3, majorityCount: 2, minorityCount: 1 })).id).toBe('volubile');
  });

  it('flags someone who never changed as "rigido"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 0, majorityCount: 2, minorityCount: 1, persuasion: 1, defendedCount: 1 })).id).toBe('rigido');
  });

  it('flags a majority-follower as "conformista"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 3 })).id).toBe('conformista');
  });

  it('flags a frequent minority voter as "contrarian"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, minorityCount: 3 })).id).toBe('contrarian');
  });

  it('flags an ineffective defender as "difese-deboli"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 1, minorityCount: 1, persuasion: 0, defendedCount: 1 })).id).toBe('difese-deboli');
  });

  it('falls back to "equilibrato" when no pattern dominates', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 1, minorityCount: 1, persuasion: 2, defendedCount: 1 })).id).toBe('equilibrato');
  });

  it('flags too-few-rounds players as "esordiente"', () => {
    expect(computeBlindSpot(stats({ rounds: 1, changedCount: 0 })).id).toBe('esordiente');
    expect(computeBlindSpot(stats({ rounds: 0 })).id).toBe('esordiente');
  });

  it('always returns a non-empty title and advice', () => {
    const b = computeBlindSpot(stats({ rounds: 3, changedCount: 0 }));
    expect(b.title.trim()).not.toBe('');
    expect(b.advice.trim()).not.toBe('');
  });
});
