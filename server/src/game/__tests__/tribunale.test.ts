import { describe, it, expect } from 'vitest';
import {
  TRIBUNALE_CASES,
  pickTribunaleContenders,
  initTribunaleRound,
  getTribunaleSpeakerId,
  castTribunaleVote,
  resolveTribunaleVerdict,
} from '../tribunale';

describe('Tribunale degli Amici engine', () => {
  it('provides at least 18 unique comedic court cases', () => {
    expect(TRIBUNALE_CASES.length).toBeGreaterThanOrEqual(18);
    const ids = new Set(TRIBUNALE_CASES.map((c) => c.id));
    expect(ids.size).toBe(TRIBUNALE_CASES.length);
  });

  it('fairly rotates contenders, enforces juror-only voting, and resolves verdict & points', () => {
    const counts = new Map<string, number>([
      ['p1', 2],
      ['p2', 2],
      ['p3', 0],
      ['p4', 0],
    ]);
    const pair = pickTribunaleContenders(['p1', 'p2', 'p3', 'p4'], counts, () => 0.1)!;
    expect(pair).toHaveLength(2);
    expect(new Set(pair)).toEqual(new Set(['p3', 'p4']));

    const state = initTribunaleRound(TRIBUNALE_CASES[0], 'p3', 'p4');
    expect(getTribunaleSpeakerId(state)).toBe('p3');
    state.speakerIndex = 1;
    expect(getTribunaleSpeakerId(state)).toBe('p4');

    // Contenders cannot vote for themselves
    expect(castTribunaleVote(state, 'p3', 'ACCUSA').ok).toBe(false);
    expect(castTribunaleVote(state, 'p4', 'DIFESA').ok).toBe(false);

    // Jurors vote
    expect(castTribunaleVote(state, 'p1', 'ACCUSA').ok).toBe(true);
    expect(castTribunaleVote(state, 'p2', 'ACCUSA').ok).toBe(true);

    const verdict = resolveTribunaleVerdict(state);
    expect(verdict.winner).toBe('ACCUSA');
    expect(verdict.winnerIds).toEqual(['p3']);
    expect(verdict.loserId).toBe('p4');
    expect(verdict.accusaVotes).toBe(2);
    expect(verdict.difesaVotes).toBe(0);
    expect(verdict.pointsWinner).toBe(160);
  });

  it('handles ties cleanly with shared points and no loser penalty', () => {
    const state = initTribunaleRound(TRIBUNALE_CASES[1], 'p1', 'p2');
    castTribunaleVote(state, 'p3', 'ACCUSA');
    castTribunaleVote(state, 'p4', 'DIFESA');

    const verdict = resolveTribunaleVerdict(state);
    expect(verdict.winner).toBe('TIE');
    expect(verdict.winnerIds).toEqual(['p1', 'p2']);
    expect(verdict.loserId).toBeNull();
    expect(verdict.pointsTie).toBe(60);
  });
});
