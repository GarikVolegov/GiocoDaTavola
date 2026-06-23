import { describe, it, expect } from 'vitest';
import { sfxForTransition, shouldWarnAt, handRaised, type CueGame } from './cues';

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

describe('shouldWarnAt', () => {
  it('ticks on each of the final seconds as the countdown drops', () => {
    expect(shouldWarnAt(6, 5)).toBe(true);
    expect(shouldWarnAt(5, 4)).toBe(true);
    expect(shouldWarnAt(2, 1)).toBe(true);
  });

  it('does not tick above the warning window or at zero', () => {
    expect(shouldWarnAt(10, 9)).toBe(false);
    expect(shouldWarnAt(1, 0)).toBe(false);
  });

  it('does not tick when the timer is unchanged or counting up (reset)', () => {
    expect(shouldWarnAt(4, 4)).toBe(false);
    expect(shouldWarnAt(3, 4)).toBe(false);
  });

  it('does not tick without both readings', () => {
    expect(shouldWarnAt(null, 5)).toBe(false);
    expect(shouldWarnAt(5, null)).toBe(false);
  });
});

describe('handRaised', () => {
  it('is true only when the queue grew', () => {
    expect(handRaised(1, 2)).toBe(true);
    expect(handRaised(0, 1)).toBe(true);
  });

  it('is false when the queue shrank or held', () => {
    expect(handRaised(2, 1)).toBe(false);
    expect(handRaised(2, 2)).toBe(false);
  });

  it('is false without both readings', () => {
    expect(handRaised(null, 3)).toBe(false);
    expect(handRaised(3, null)).toBe(false);
  });
});
