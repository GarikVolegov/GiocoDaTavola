import { describe, it, expect } from 'vitest';
import { noteAt, LOOP_STEPS, SECONDS_PER_BEAT, type NoteEvent } from './sequence';

const allNotes = (): NoteEvent[] =>
  Array.from({ length: LOOP_STEPS }, (_, step) => noteAt(step)).flat();

describe('musichetta sequence', () => {
  it('has a positive-length loop and beat duration', () => {
    expect(LOOP_STEPS).toBeGreaterThan(0);
    expect(SECONDS_PER_BEAT).toBeGreaterThan(0);
  });

  it('repeats: a step and the same step one loop later are identical', () => {
    for (let step = 0; step < LOOP_STEPS; step++) {
      expect(noteAt(step + LOOP_STEPS)).toEqual(noteAt(step));
    }
  });

  it('plays at least one note on every beat (no silent gaps)', () => {
    for (let step = 0; step < LOOP_STEPS; step++) {
      expect(noteAt(step).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('emits only musically-sane notes (audible range, positive duration, soft gain)', () => {
    for (const n of allNotes()) {
      expect(n.freq).toBeGreaterThan(50);
      expect(n.freq).toBeLessThan(2000);
      expect(n.durationBeats).toBeGreaterThan(0);
      expect(n.gain).toBeGreaterThan(0);
      expect(n.gain).toBeLessThanOrEqual(1);
    }
  });

  it('is a melody, not a monotone (uses several distinct pitches)', () => {
    const distinct = new Set(allNotes().map((n) => Math.round(n.freq)));
    expect(distinct.size).toBeGreaterThanOrEqual(4);
  });
});
