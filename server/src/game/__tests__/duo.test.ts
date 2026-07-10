import { describe, it, expect } from 'vitest';
import { buildDuoActPlan, expandActs, actForIndex } from '../duo';
import { nextDuoPhase, PHASE_DURATIONS_MS, DUO_TURN_MIN_MS } from '../phases';

// ---------------------------------------------------------------------------
// Act plan (Percorso in 2): the leader's 3/5/7 wire value maps to the three
// acts' sizes (Sintonia / A parti invertite / Schierati).
// ---------------------------------------------------------------------------

describe('buildDuoActPlan', () => {
  it('maps assaggio (3) to [2,1,1]', () => {
    expect(buildDuoActPlan(3)).toEqual([2, 1, 1]);
  });
  it('maps classica (5) to [3,2,2]', () => {
    expect(buildDuoActPlan(5)).toEqual([3, 2, 2]);
  });
  it('maps maratona (7) to [4,3,3]', () => {
    expect(buildDuoActPlan(7)).toEqual([4, 3, 3]);
  });
  it('falls back to the classica split for unexpected counts', () => {
    expect(buildDuoActPlan(4)).toEqual([3, 2, 2]);
    expect(buildDuoActPlan(0)).toEqual([3, 2, 2]);
  });
});

describe('expandActs / actForIndex', () => {
  it('expands act sizes into a per-dilemma act list', () => {
    expect(expandActs([2, 1, 1])).toEqual([1, 1, 2, 3]);
    expect(expandActs([3, 2, 2])).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });
  it('actForIndex reads the act of a 1-based dilemma index', () => {
    const acts = expandActs([2, 1, 1]); // [1,1,2,3]
    expect(actForIndex(acts, 1)).toBe(1);
    expect(actForIndex(acts, 2)).toBe(1);
    expect(actForIndex(acts, 3)).toBe(2);
    expect(actForIndex(acts, 4)).toBe(3);
  });
  it('actForIndex is 0 out of range', () => {
    expect(actForIndex([1, 2, 3], 0)).toBe(0);
    expect(actForIndex([1, 2, 3], 4)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pure duo state machine. plannedActs[i] = act of the 1-based dilemma i+1
// (same convention as percorso's plannedTappe).
// ---------------------------------------------------------------------------

const ACTS = [1, 1, 2, 3]; // assaggio: 2 Sintonia, 1 Invertite, 1 Schierati
const NO_FLAGS = { advocacy: false, flipped: false };

describe('nextDuoPhase', () => {
  it('PHASE_INTRO opens the first act card', () => {
    expect(nextDuoPhase('PHASE_INTRO', 0, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ACT_INTRO',
      dilemmaIndex: 0,
    });
  });

  it('DUO_ACT_INTRO opens the pick phase of the coming act (advancing the index)', () => {
    expect(nextDuoPhase('DUO_ACT_INTRO', 0, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_PICK_PREDICT',
      dilemmaIndex: 1,
    });
    expect(nextDuoPhase('DUO_ACT_INTRO', 2, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_SIDE_PICK',
      dilemmaIndex: 3,
    });
    expect(nextDuoPhase('DUO_ACT_INTRO', 3, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_PICK',
      dilemmaIndex: 4,
    });
  });

  it('Atto I round: PICK_PREDICT → SYNC_REVEAL → next dilemma of the same act', () => {
    expect(nextDuoPhase('DUO_PICK_PREDICT', 1, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_SYNC_REVEAL',
      dilemmaIndex: 1,
    });
    expect(nextDuoPhase('DUO_SYNC_REVEAL', 1, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_PICK_PREDICT',
      dilemmaIndex: 2,
    });
  });

  it('act boundary: end of round detours through DUO_ACT_INTRO without advancing the index', () => {
    // Dilemma 2 is the last of act 1; dilemma 3 opens act 2.
    expect(nextDuoPhase('DUO_SYNC_REVEAL', 2, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ACT_INTRO',
      dilemmaIndex: 2,
    });
  });

  it('Atto II round: SIDE_PICK → ARGUE → WAVER → ROUND_RESULT → act boundary', () => {
    expect(nextDuoPhase('DUO_SIDE_PICK', 3, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ARGUE',
      dilemmaIndex: 3,
    });
    expect(nextDuoPhase('DUO_ARGUE', 3, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_WAVER',
      dilemmaIndex: 3,
    });
    expect(nextDuoPhase('DUO_WAVER', 3, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ROUND_RESULT',
      dilemmaIndex: 3,
    });
    expect(nextDuoPhase('DUO_ROUND_RESULT', 3, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ACT_INTRO',
      dilemmaIndex: 3,
    });
  });

  it('Atto III disagree: PICK → REVEAL → ARGUE → REPICK → ROUND_RESULT', () => {
    expect(nextDuoPhase('DUO_PICK', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_REVEAL',
      dilemmaIndex: 4,
    });
    expect(nextDuoPhase('DUO_REVEAL', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ARGUE',
      dilemmaIndex: 4,
    });
    // Act 3 argue leads to the re-pick, not the waver.
    expect(nextDuoPhase('DUO_ARGUE', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_REPICK',
      dilemmaIndex: 4,
    });
    expect(nextDuoPhase('DUO_REPICK', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_ROUND_RESULT',
      dilemmaIndex: 4,
    });
  });

  it('Atto III advocacy twist without flip detours through DUO_WAVER', () => {
    expect(nextDuoPhase('DUO_REPICK', 4, ACTS, { advocacy: true, flipped: false })).toEqual({
      phase: 'DUO_WAVER',
      dilemmaIndex: 4,
    });
    expect(nextDuoPhase('DUO_WAVER', 4, ACTS, { advocacy: true, flipped: false })).toEqual({
      phase: 'DUO_ROUND_RESULT',
      dilemmaIndex: 4,
    });
  });

  it('Atto III advocacy twist with flip goes straight to the round result', () => {
    expect(nextDuoPhase('DUO_REPICK', 4, ACTS, { advocacy: true, flipped: true })).toEqual({
      phase: 'DUO_ROUND_RESULT',
      dilemmaIndex: 4,
    });
  });

  it('last round ends at DUO_PORTRAIT', () => {
    expect(nextDuoPhase('DUO_ROUND_RESULT', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_PORTRAIT',
      dilemmaIndex: 4,
    });
  });

  it('a full assaggio walk visits every act and ends at the portrait', () => {
    const visited: string[] = [];
    let phase: Parameters<typeof nextDuoPhase>[0] = 'PHASE_INTRO';
    let idx = 0;
    for (let guard = 0; guard < 40 && phase !== 'DUO_PORTRAIT'; guard++) {
      const t = nextDuoPhase(phase, idx, ACTS, NO_FLAGS);
      phase = t.phase;
      idx = t.dilemmaIndex;
      visited.push(t.phase);
    }
    expect(phase).toBe('DUO_PORTRAIT');
    expect(idx).toBe(4);
    expect(visited.filter((p) => p === 'DUO_ACT_INTRO')).toHaveLength(3);
    expect(visited.filter((p) => p === 'DUO_PICK_PREDICT')).toHaveLength(2);
    expect(visited.filter((p) => p === 'DUO_SIDE_PICK')).toHaveLength(1);
    expect(visited.filter((p) => p === 'DUO_PICK')).toHaveLength(1);
  });

  it('LOBBY and DUO_PORTRAIT have no automatic successor', () => {
    expect(nextDuoPhase('LOBBY', 0, ACTS, NO_FLAGS)).toEqual({ phase: 'LOBBY', dilemmaIndex: 0 });
    expect(nextDuoPhase('DUO_PORTRAIT', 4, ACTS, NO_FLAGS)).toEqual({
      phase: 'DUO_PORTRAIT',
      dilemmaIndex: 4,
    });
  });
});

describe('duo phase timing', () => {
  it('every duo input phase has a real timer; the portrait is terminal', () => {
    expect(PHASE_DURATIONS_MS.DUO_ACT_INTRO).toBe(7_000);
    expect(PHASE_DURATIONS_MS.DUO_PICK_PREDICT).toBe(30_000);
    expect(PHASE_DURATIONS_MS.DUO_SYNC_REVEAL).toBe(8_000);
    expect(PHASE_DURATIONS_MS.DUO_SIDE_PICK).toBe(12_000);
    expect(PHASE_DURATIONS_MS.DUO_ARGUE).toBe(45_000);
    expect(PHASE_DURATIONS_MS.DUO_WAVER).toBe(15_000);
    expect(PHASE_DURATIONS_MS.DUO_ROUND_RESULT).toBe(8_000);
    expect(PHASE_DURATIONS_MS.DUO_PICK).toBe(20_000);
    expect(PHASE_DURATIONS_MS.DUO_REVEAL).toBe(6_000);
    expect(PHASE_DURATIONS_MS.DUO_REPICK).toBe(20_000);
    expect(PHASE_DURATIONS_MS.DUO_PORTRAIT).toBeNull();
  });
  it('keeps the 15s human floor for a duo argue turn', () => {
    expect(DUO_TURN_MIN_MS).toBe(15_000);
  });
});
