// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getSeenDilemmaIds, addSeenDilemmaIds } from './seenDilemmas';

describe('seenDilemmas (5.1, "memoria del già-visto")', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getSeenDilemmaIds()).toEqual([]);
  });

  it('records and returns seen ids', () => {
    addSeenDilemmaIds(['d1', 'd2']);
    expect(getSeenDilemmaIds()).toEqual(['d1', 'd2']);
  });

  it('accumulates across calls without duplicates', () => {
    addSeenDilemmaIds(['d1', 'd2']);
    addSeenDilemmaIds(['d2', 'd3']);
    expect(getSeenDilemmaIds()).toEqual(['d1', 'd2', 'd3']);
  });

  it('is a no-op for an empty list', () => {
    addSeenDilemmaIds(['d1']);
    addSeenDilemmaIds([]);
    expect(getSeenDilemmaIds()).toEqual(['d1']);
  });

  it('caps the stored list to the most recent 500 entries', () => {
    addSeenDilemmaIds(Array.from({ length: 501 }, (_, i) => `d${i}`));
    const seen = getSeenDilemmaIds();
    expect(seen.length).toBe(500);
    expect(seen[0]).toBe('d1'); // d0 was pushed out
    expect(seen.at(-1)).toBe('d500');
  });

  it('tolerates malformed storage content', () => {
    localStorage.setItem('schierati:seenDilemmas', 'not json');
    expect(getSeenDilemmaIds()).toEqual([]);
  });
});
