import { describe, it, expect } from 'vitest';
import { Deck, loadDilemmas, type Dilemma } from '../deck';

// A small fixed deck for exercising draw behavior without depending on the
// real data file.
const fixture: Dilemma[] = [
  { id: 'a', text: 'A?', optionA: 'a1', optionB: 'a2' },
  { id: 'b', text: 'B?', optionA: 'b1', optionB: 'b2' },
  { id: 'c', text: 'C?', optionA: 'c1', optionB: 'c2' },
];

describe('loadDilemmas (server/data/dilemmas.json)', () => {
  it('loads at least 20 dilemmas', () => {
    expect(loadDilemmas().length).toBeGreaterThanOrEqual(20);
  });

  it('every dilemma has a non-empty text, optionA and optionB', () => {
    for (const d of loadDilemmas()) {
      expect(d.text.trim()).not.toBe('');
      expect(d.optionA.trim()).not.toBe('');
      expect(d.optionB.trim()).not.toBe('');
    }
  });

  it('dilemma ids are unique', () => {
    const dilemmas = loadDilemmas();
    const ids = new Set(dilemmas.map((d) => d.id));
    expect(ids.size).toBe(dilemmas.length);
  });
});

describe('Deck', () => {
  it('draws without repeats within a single game', () => {
    const deck = new Deck(fixture);
    const drawn = [deck.draw(), deck.draw(), deck.draw()].map((d) => d?.id);
    // Three draws, no id appears twice, and every fixture id is covered.
    expect(new Set(drawn).size).toBe(3);
    expect([...drawn].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns null once the deck is exhausted', () => {
    const deck = new Deck(fixture);
    deck.draw();
    deck.draw();
    deck.draw();
    expect(deck.draw()).toBeNull();
  });

  it('reports how many dilemmas remain', () => {
    const deck = new Deck(fixture);
    expect(deck.remainingCount).toBe(3);
    deck.draw();
    expect(deck.remainingCount).toBe(2);
  });

  it('uses the injectable RNG to pick (deterministic)', () => {
    // rng always returns 0 -> always picks index 0, walking the deck in order.
    const deck = new Deck(fixture, () => 0);
    expect(deck.draw()?.id).toBe('a');
    expect(deck.draw()?.id).toBe('b');
    expect(deck.draw()?.id).toBe('c');
  });

  it('does not mutate the source array', () => {
    const source = [...fixture];
    const deck = new Deck(source);
    deck.draw();
    deck.draw();
    deck.draw();
    expect(source).toHaveLength(3);
  });

  it('draws the real deck with no repeats across a full game', () => {
    const dilemmas = loadDilemmas();
    const deck = new Deck(dilemmas);
    const seen = new Set<string>();
    for (let i = 0; i < dilemmas.length; i++) {
      const d = deck.draw();
      expect(d).not.toBeNull();
      expect(seen.has(d!.id)).toBe(false);
      seen.add(d!.id);
    }
    expect(deck.draw()).toBeNull();
  });
});
