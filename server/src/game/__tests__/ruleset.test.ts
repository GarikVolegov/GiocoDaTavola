import { describe, it, expect } from 'vitest';
import {
  MAX_GIOCATORI,
  DEFENSE_COPPIE_THRESHOLD,
  countGiocatori,
  rulesForGiocatoriCount,
  rulesForRoster,
} from '../ruleset';

describe('rulesForGiocatoriCount — the N-dependent rules, at the extremes (3.6)', () => {
  it.each([
    // [giocatoriCount, isPubblicoCapped, defendersPerSide]
    [1, false, 1], // solo + bots
    [2, false, 1], // duello-sized
    [3, false, 1], // MIN_PLAYERS_TO_START
    [5, false, 1],
    [6, false, 1], // just below the coppie threshold
    [7, false, 2], // DEFENSE_COPPIE_THRESHOLD: pairs kick in
    [8, true, 2], // MAX_GIOCATORI: the pubblico cap kicks in
    [12, true, 2],
    [20, true, 2],
  ])('N=%i -> isPubblicoCapped=%s, defendersPerSide=%i', (n, isPubblicoCapped, defendersPerSide) => {
    expect(rulesForGiocatoriCount(n)).toEqual({
      giocatoriCount: n,
      isPubblicoCapped,
      defendersPerSide,
    });
  });

  it('the thresholds it exposes match the module constants', () => {
    expect(rulesForGiocatoriCount(MAX_GIOCATORI - 1).isPubblicoCapped).toBe(false);
    expect(rulesForGiocatoriCount(MAX_GIOCATORI).isPubblicoCapped).toBe(true);
    expect(rulesForGiocatoriCount(DEFENSE_COPPIE_THRESHOLD - 1).defendersPerSide).toBe(1);
    expect(rulesForGiocatoriCount(DEFENSE_COPPIE_THRESHOLD).defendersPerSide).toBe(2);
  });
});

describe('countGiocatori', () => {
  it('counts everyone when no one is pubblico', () => {
    expect(countGiocatori([{}, {}, { role: 'giocatore' }])).toBe(3);
  });

  it('excludes pubblico members', () => {
    expect(countGiocatori([{}, { role: 'pubblico' }, { role: 'pubblico' }, {}])).toBe(2);
  });

  it('returns 0 for an empty roster', () => {
    expect(countGiocatori([])).toBe(0);
  });
});

describe('rulesForRoster', () => {
  it('derives N from the roster directly', () => {
    const roster = Array.from({ length: 9 }, (_, i) => (i < 8 ? {} : { role: 'pubblico' as const }));
    expect(rulesForRoster(roster)).toEqual({
      giocatoriCount: 8,
      isPubblicoCapped: true,
      defendersPerSide: 2,
    });
  });
});
