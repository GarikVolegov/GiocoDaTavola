import { describe, it, expect } from 'vitest';
import { elapsedSeconds, formatMSS, isWaitingPhase } from './time';

describe('elapsedSeconds', () => {
  it('is null when there is no start', () => {
    expect(elapsedSeconds(null, 1000)).toBeNull();
  });
  it('is 0 at the start and grows over time', () => {
    expect(elapsedSeconds(1000, 1000)).toBe(0);
    expect(elapsedSeconds(1000, 1999)).toBe(0);
    expect(elapsedSeconds(1000, 2000)).toBe(1);
    expect(elapsedSeconds(1000, 31_500)).toBe(30);
  });
  it('never goes negative if now precedes the start', () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
  });
});

describe('formatMSS', () => {
  it('formats seconds as M:SS with zero-padded seconds', () => {
    expect(formatMSS(0)).toBe('0:00');
    expect(formatMSS(5)).toBe('0:05');
    expect(formatMSS(42)).toBe('0:42');
    expect(formatMSS(65)).toBe('1:05');
    expect(formatMSS(180)).toBe('3:00');
  });
});

describe('isWaitingPhase', () => {
  it('is true for idle/listening phases', () => {
    expect(isWaitingPhase('DEFENSE')).toBe(true);
    expect(isWaitingPhase('INTERVENTI')).toBe(true);
    expect(isWaitingPhase('VOTE_1')).toBe(true);
    expect(isWaitingPhase('LOBBY')).toBe(true);
  });
  it('is false for short auto-advancing reveals and the finale', () => {
    expect(isWaitingPhase('DILEMMA_REVEAL')).toBe(false);
    expect(isWaitingPhase('PHASE_RESULTS')).toBe(false);
    expect(isWaitingPhase('FINAL_AWARDS')).toBe(false);
  });
});
