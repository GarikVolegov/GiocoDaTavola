import { describe, it, expect } from 'vitest';
import { FALLBACK_DECKS, type PassCoppieCard, type PassMode } from './fallbackDeck';

describe('FALLBACK_DECKS (offline Pass & Play)', () => {
  const modes: PassMode[] = ['flash', 'infiltrato', 'assurdo', 'coppie', 'classico'];

  it('provides at least 8 unique cards for every mode so 8-round offline games never run dry', () => {
    for (const mode of modes) {
      const deck = FALLBACK_DECKS[mode];
      expect(deck.length).toBeGreaterThanOrEqual(8);
      const ids = new Set(deck.map((c) => c.id));
      expect(ids.size).toBe(deck.length);
    }
  });

  it('includes both complicita and piccante cards for coppie offline play', () => {
    const coppie = FALLBACK_DECKS.coppie as PassCoppieCard[];
    expect(coppie.filter((c) => c.intensity === 'complicita').length).toBeGreaterThanOrEqual(5);
    expect(coppie.filter((c) => c.intensity === 'piccante').length).toBeGreaterThanOrEqual(5);
  });
});
