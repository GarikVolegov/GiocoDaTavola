import { describe, it, expect } from 'vitest';
import { sfxForTransition, type CueGame } from './cues';

const game = (over: Partial<CueGame> = {}): CueGame => ({
  swing: null,
  duelResult: null,
  ...over,
});

describe('sfxForTransition', () => {
  it('plays a reveal chime when votes are revealed', () => {
    expect(sfxForTransition('VOTE_1', 'SPLIT_REVEAL', game())).toBe('reveal');
    expect(sfxForTransition('DILEMMA_REVEAL', 'DUEL_REVEAL', game())).toBe('reveal');
  });

  it('plays a dramatic swing sting when the majority actually flipped', () => {
    expect(
      sfxForTransition('INTERVENTI', 'PHASE_RESULTS', game({ swing: { switched: 2 } })),
    ).toBe('swing');
  });

  it('plays only a reveal when results land with no swing', () => {
    expect(
      sfxForTransition('INTERVENTI', 'PHASE_RESULTS', game({ swing: { switched: 0 } })),
    ).toBe('reveal');
    expect(sfxForTransition('INTERVENTI', 'PHASE_RESULTS', game({ swing: null }))).toBe('reveal');
  });

  it('plays a win fanfare when a duel round convinced someone', () => {
    expect(
      sfxForTransition('DUEL_ARGUE', 'DUEL_RESULT', game({ duelResult: { convinced: [{}] } })),
    ).toBe('win');
  });

  it('plays only a reveal for a duel that ended in agreement', () => {
    expect(
      sfxForTransition('DUEL_ARGUE', 'DUEL_RESULT', game({ duelResult: { convinced: [] } })),
    ).toBe('reveal');
  });

  it('plays a celebratory arpeggio at the finale', () => {
    expect(sfxForTransition('PHASE_RESULTS', 'FINAL_AWARDS', game())).toBe('awards');
    expect(sfxForTransition('DUEL_RESULT', 'FINAL_DUEL', game())).toBe('awards');
  });

  it('is silent for ordinary, non-event transitions', () => {
    expect(sfxForTransition('LOBBY', 'PHASE_INTRO', game())).toBeNull();
    expect(sfxForTransition('SPLIT_REVEAL', 'PREDICT', game())).toBeNull();
    expect(sfxForTransition('DEFENSE', 'INTERVENTI', game())).toBeNull();
  });

  it('is silent when the phase did not change', () => {
    expect(sfxForTransition('PHASE_RESULTS', 'PHASE_RESULTS', game({ swing: { switched: 3 } }))).toBeNull();
  });

  it('is silent on first render (no previous phase)', () => {
    expect(sfxForTransition(null, 'LOBBY', game())).toBeNull();
  });
});
