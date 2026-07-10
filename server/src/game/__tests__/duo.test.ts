import { describe, it, expect } from 'vitest';
import {
  buildDuoActPlan,
  expandActs,
  actForIndex,
  duoPlayers,
  submitDuoSync,
  duoSyncComplete,
  assignInvertedSides,
  assignAdvocate,
  duoWaver,
  duoWaverComplete,
  duoRepickComplete,
} from '../duo';
import {
  recordSyncRound,
  recordDuoReveal,
  computeRepickFlipped,
  recordRoundOutcome,
  duoSyncReveal,
  duoRoundResult,
  duoPortrait,
  duoTurn,
  duoActState,
} from '../duo';
import { nextDuoPhase, PHASE_DURATIONS_MS, DUO_TURN_MIN_MS } from '../phases';
import { RoomStore, type Room } from '../rooms';

/** A 2-human duello lobby whose phase tests set by hand (the stateful
 * advanceDuoPhase driver arrives in a later task). */
function duoRoom(): { room: Room; ann: string; bob: string } {
  const store = new RoomStore();
  const { code } = store.create();
  store.join(code, 'sock-ann', 'Ann');
  store.join(code, 'sock-bob', 'Bob');
  const room = store.get(code)!;
  const [ann, bob] = [...room.players.keys()];
  return { room, ann, bob };
}

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

// ---------------------------------------------------------------------------
// Domain: Atto I combined submit, Atto II/III side assignments with fairness
// alternation, waver ratings, and the repick-completion predicate.
// ---------------------------------------------------------------------------

describe('duoPlayers', () => {
  it('returns the two humans in insertion order', () => {
    const { room, ann, bob } = duoRoom();
    expect(duoPlayers(room).map((p) => p.id)).toEqual([ann, bob]);
  });
});

describe('submitDuoSync', () => {
  it('is rejected outside DUO_PICK_PREDICT and for non-players', () => {
    const { room, ann } = duoRoom();
    expect(submitDuoSync(room, ann, 'A', 'B')).toBe(false);
    room.phase = 'DUO_PICK_PREDICT';
    expect(submitDuoSync(room, 'ghost', 'A', 'B')).toBe(false);
    expect(room.votes.size).toBe(0);
    expect(room.duoPredictions.size).toBe(0);
  });

  it('stores the own pick and the partner prediction, overwritably', () => {
    const { room, ann } = duoRoom();
    room.phase = 'DUO_PICK_PREDICT';
    expect(submitDuoSync(room, ann, 'A', 'B')).toBe(true);
    expect(room.votes.get(ann)).toBe('A');
    expect(room.duoPredictions.get(ann)).toBe('B');
    expect(submitDuoSync(room, ann, 'B', 'A')).toBe(true);
    expect(room.votes.get(ann)).toBe('B');
    expect(room.duoPredictions.get(ann)).toBe('A');
  });

  it('duoSyncComplete only once BOTH players submitted pick+prediction', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_PICK_PREDICT';
    expect(duoSyncComplete(room)).toBe(false);
    submitDuoSync(room, ann, 'A', 'A');
    expect(duoSyncComplete(room)).toBe(false);
    submitDuoSync(room, bob, 'B', 'A');
    expect(duoSyncComplete(room)).toBe(true);
  });
});

describe('assignInvertedSides (Atto II)', () => {
  it('with different picks each player argues the side they did NOT pick', () => {
    const { room, ann, bob } = duoRoom();
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'B');
    assignInvertedSides(room);
    expect(room.duoAssignedSides.get(ann)).toBe('B');
    expect(room.duoAssignedSides.get(bob)).toBe('A');
    expect(room.duoSpeakers).toEqual([ann, bob]);
    expect(room.duoTurnIndex).toBe(0);
    expect(room.duoAdvocacy).toBe(false);
    expect(room.duoFairness).toBe(0);
  });

  it('with equal picks the fairness alternation designates who flips side', () => {
    const { room, ann, bob } = duoRoom();
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'A');
    assignInvertedSides(room);
    expect(room.duoAssignedSides.get(ann)).toBe('B'); // designated: opposite side
    expect(room.duoAssignedSides.get(bob)).toBe('A');
    expect(room.duoFairness).toBe(1);
    // Next same-pick round: the OTHER player takes the opposite side.
    room.votes.set(ann, 'B');
    room.votes.set(bob, 'B');
    assignInvertedSides(room);
    expect(room.duoAssignedSides.get(ann)).toBe('B');
    expect(room.duoAssignedSides.get(bob)).toBe('A');
    expect(room.duoFairness).toBe(2);
  });
});

describe('assignAdvocate (Atto III agreement twist)', () => {
  it('designates one advocate on the opposite side, solo speaker', () => {
    const { room, ann, bob } = duoRoom();
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'A');
    assignAdvocate(room);
    expect(room.duoAdvocacy).toBe(true);
    expect(room.duoAssignedSides.size).toBe(1);
    expect(room.duoAssignedSides.get(ann)).toBe('B');
    expect(room.duoSpeakers).toEqual([ann]);
    expect(room.duoFairness).toBe(1);
    // The fairness counter alternates the advocate on the next agreement.
    room.votes.set(ann, 'B');
    room.votes.set(bob, 'B');
    assignAdvocate(room);
    expect(room.duoAssignedSides.size).toBe(1);
    expect(room.duoAssignedSides.get(bob)).toBe('A');
    expect(room.duoSpeakers).toEqual([bob]);
    expect(room.duoFairness).toBe(2);
  });
});

describe('duoWaver', () => {
  it('accepts 0..2 from both listeners in Atto II, rejects out-of-phase/ghosts', () => {
    const { room, ann, bob } = duoRoom();
    expect(duoWaver(room, ann, 1)).toBe(false); // not DUO_WAVER yet
    room.phase = 'DUO_WAVER';
    room.duoAdvocacy = false;
    expect(duoWaver(room, 'ghost', 1)).toBe(false);
    expect(duoWaver(room, ann, 2)).toBe(true);
    expect(duoWaver(room, bob, 0)).toBe(true);
    expect(room.duoWaverRatings.get(ann)).toBe(2);
    expect(room.duoWaverRatings.get(bob)).toBe(0);
  });

  it('in the advocacy twist only the listener rates, capped at 1', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_WAVER';
    room.duoAdvocacy = true;
    room.duoAssignedSides.set(ann, 'B'); // Ann is the advocate
    expect(duoWaver(room, ann, 1)).toBe(false); // the advocate cannot rate
    expect(duoWaver(room, bob, 2)).toBe(false); // 🤯 not available in the twist
    expect(duoWaver(room, bob, 1)).toBe(true);
    expect(room.duoWaverRatings.get(bob)).toBe(1);
  });

  it('duoWaverComplete requires both raters in Atto II, only the listener in the twist', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_WAVER';
    room.duoAdvocacy = false;
    expect(duoWaverComplete(room)).toBe(false);
    duoWaver(room, ann, 1);
    expect(duoWaverComplete(room)).toBe(false);
    duoWaver(room, bob, 1);
    expect(duoWaverComplete(room)).toBe(true);

    const twist = duoRoom();
    twist.room.phase = 'DUO_WAVER';
    twist.room.duoAdvocacy = true;
    twist.room.duoAssignedSides.set(twist.ann, 'B');
    expect(duoWaverComplete(twist.room)).toBe(false);
    duoWaver(twist.room, twist.bob, 0);
    expect(duoWaverComplete(twist.room)).toBe(true);
  });
});

describe('duoRepickComplete', () => {
  it('normal Atto III: both players must have confirmed their re-pick', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_REPICK';
    room.duoAdvocacy = false;
    expect(duoRepickComplete(room)).toBe(false);
    room.confirmedVote2.add(ann);
    expect(duoRepickComplete(room)).toBe(false);
    room.confirmedVote2.add(bob);
    expect(duoRepickComplete(room)).toBe(true);
  });

  it('advocacy twist: only the listener re-picks (the advocate is excluded)', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_REPICK';
    room.duoAdvocacy = true;
    room.duoAssignedSides.set(ann, 'B'); // Ann argued as advocate
    expect(duoRepickComplete(room)).toBe(false);
    room.confirmedVote2.add(ann); // the advocate confirming is not enough...
    expect(duoRepickComplete(room)).toBe(false);
    room.confirmedVote2.add(bob); // ...the listener is who matters
    expect(duoRepickComplete(room)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scoring, gated readers and the couple portrait.
// ---------------------------------------------------------------------------

describe('recordSyncRound (Atto I)', () => {
  it('counts sintonia and rewards correct predictions', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_PICK_PREDICT';
    submitDuoSync(room, ann, 'A', 'B'); // Ann picks A, predicts Bob=B (right)
    submitDuoSync(room, bob, 'B', 'B'); // Bob picks B, predicts Ann=B (wrong)
    recordSyncRound(room);
    expect(room.duoTruePicks).toBe(1);
    expect(room.duoFirstPickAgreements).toBe(0);
    expect(room.duoScore.get(ann)?.tiConosco).toBe(1);
    expect(room.duoScore.get(bob)?.tiConosco ?? 0).toBe(0);
  });

  it('counts an agreement when both picked the same side', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_PICK_PREDICT';
    submitDuoSync(room, ann, 'A', 'A');
    submitDuoSync(room, bob, 'A', 'A');
    recordSyncRound(room);
    expect(room.duoTruePicks).toBe(1);
    expect(room.duoFirstPickAgreements).toBe(1);
    expect(room.duoScore.get(ann)?.tiConosco).toBe(1);
    expect(room.duoScore.get(bob)?.tiConosco).toBe(1);
  });
});

describe('recordDuoReveal (Atto III sintonia counters)', () => {
  it('tracks true picks and agreements at the reveal', () => {
    const { room, ann, bob } = duoRoom();
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'B');
    recordDuoReveal(room);
    expect(room.duoTruePicks).toBe(1);
    expect(room.duoFirstPickAgreements).toBe(0);
    room.votes.set(bob, 'A');
    recordDuoReveal(room);
    expect(room.duoTruePicks).toBe(2);
    expect(room.duoFirstPickAgreements).toBe(1);
  });
});

describe('computeRepickFlipped', () => {
  it('in the advocacy twist only the listener counts', () => {
    const { room, ann, bob } = duoRoom();
    room.duoAdvocacy = true;
    room.duoAssignedSides.set(ann, 'B'); // Ann is the advocate
    room.votes1.set(bob, 'A');
    room.votes.set(bob, 'A');
    expect(computeRepickFlipped(room)).toBe(false);
    room.votes.set(bob, 'B');
    expect(computeRepickFlipped(room)).toBe(true);
  });

  it('in the normal path any flip counts', () => {
    const { room, ann, bob } = duoRoom();
    room.votes1.set(ann, 'A');
    room.votes1.set(bob, 'B');
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'B');
    expect(computeRepickFlipped(room)).toBe(false);
    room.votes.set(ann, 'B');
    expect(computeRepickFlipped(room)).toBe(true);
  });
});

/** Drive a room to a scored Atto II round result by hand. */
function actTwoOutcome(ratings: { ann: 0 | 1 | 2; bob: 0 | 1 | 2 }) {
  const ctx = duoRoom();
  const { room, ann, bob } = ctx;
  room.duoPlannedActs = [2]; // one act-2 dilemma
  room.dilemmaIndex = 1;
  room.votes.set(ann, 'A');
  room.votes.set(bob, 'A');
  assignInvertedSides(room);
  room.phase = 'DUO_WAVER';
  duoWaver(room, ann, ratings.ann); // Ann rates BOB's arringa
  duoWaver(room, bob, ratings.bob); // Bob rates ANN's arringa
  room.phase = 'DUO_ROUND_RESULT';
  recordRoundOutcome(room);
  return ctx;
}

describe('recordRoundOutcome', () => {
  it('Atto II: each arguer earns the rating the OTHER gave (🤯 becomes a moment)', () => {
    const { room, ann, bob } = actTwoOutcome({ ann: 2, bob: 1 });
    expect(room.duoScore.get(bob)?.vacillare).toBe(2); // Ann rated Bob 🤯
    expect(room.duoScore.get(ann)?.vacillare).toBe(1); // Bob rated Ann 🤔
    expect(room.duoMoments.some((m) => m.emoji === '🤯' && m.playerId === bob)).toBe(true);
  });

  it('Atto III normal: flipping the partner is worth +2 persuasione and a moment', () => {
    const { room, ann, bob } = duoRoom();
    room.duoPlannedActs = [3];
    room.dilemmaIndex = 1;
    room.duoAdvocacy = false;
    room.votes1.set(ann, 'A');
    room.votes1.set(bob, 'B');
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'A'); // Bob flipped to Ann's side
    room.phase = 'DUO_ROUND_RESULT';
    recordRoundOutcome(room);
    expect(room.duoScore.get(ann)?.persuasione).toBe(2);
    expect(room.duoScore.get(bob)?.persuasione ?? 0).toBe(0);
    expect(room.duoMoments.some((m) => m.playerId === ann)).toBe(true);
  });

  it('Atto III twist: a flip pays +2 ribaltone; no flip pays the listener rating', () => {
    const flip = duoRoom();
    flip.room.duoPlannedActs = [3];
    flip.room.dilemmaIndex = 1;
    flip.room.votes.set(flip.ann, 'A');
    flip.room.votes.set(flip.bob, 'A');
    assignAdvocate(flip.room); // Ann advocates B
    flip.room.votes1.set(flip.bob, 'A');
    flip.room.votes.set(flip.bob, 'B'); // the listener flipped
    flip.room.duoRepickFlipped = true;
    flip.room.phase = 'DUO_ROUND_RESULT';
    recordRoundOutcome(flip.room);
    expect(flip.room.duoScore.get(flip.ann)?.ribaltone).toBe(2);
    expect(flip.room.duoMoments.some((m) => m.title.includes('Ribaltone'))).toBe(true);

    const hold = duoRoom();
    hold.room.duoPlannedActs = [3];
    hold.room.dilemmaIndex = 1;
    hold.room.votes.set(hold.ann, 'A');
    hold.room.votes.set(hold.bob, 'A');
    assignAdvocate(hold.room); // Ann advocates B
    hold.room.votes1.set(hold.bob, 'A');
    hold.room.votes.set(hold.bob, 'A'); // no flip
    hold.room.duoRepickFlipped = false;
    hold.room.phase = 'DUO_WAVER';
    duoWaver(hold.room, hold.bob, 1);
    hold.room.phase = 'DUO_ROUND_RESULT';
    recordRoundOutcome(hold.room);
    expect(hold.room.duoScore.get(hold.ann)?.vacillare).toBe(1);
    expect(hold.room.duoScore.get(hold.ann)?.ribaltone ?? 0).toBe(0);
  });
});

describe('gated duo readers', () => {
  it('duoSyncReveal answers only in DUO_SYNC_REVEAL with picks + prediction hits', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_PICK_PREDICT';
    submitDuoSync(room, ann, 'A', 'B');
    submitDuoSync(room, bob, 'B', 'B');
    expect(duoSyncReveal(room)).toBeNull();
    recordSyncRound(room);
    room.phase = 'DUO_SYNC_REVEAL';
    const reveal = duoSyncReveal(room)!;
    expect(reveal.agreed).toBe(false);
    expect(reveal.picks.map((p) => p.choice)).toEqual(['A', 'B']);
    expect(reveal.predictions.find((p) => p.id === ann)?.correct).toBe(true);
    expect(reveal.predictions.find((p) => p.id === bob)?.correct).toBe(false);
    expect(reveal.truePicks).toBe(1);
  });

  it('duoRoundResult answers only in DUO_ROUND_RESULT with the act outcome', () => {
    const ctx = actTwoOutcome({ ann: 0, bob: 2 });
    const result = duoRoundResult(ctx.room)!;
    expect(result.act).toBe(2);
    expect(result.advocacy).toBe(false);
    expect(result.vacillare.find((v) => v.id === ctx.ann)?.received).toBe(2);
    expect(result.vacillare.find((v) => v.id === ctx.bob)?.received).toBe(0);
    expect(result.scores.find((s) => s.id === ctx.ann)?.total).toBe(2);
    ctx.room.phase = 'DUO_PICK';
    expect(duoRoundResult(ctx.room)).toBeNull();
  });

  it('duoTurn exposes the assigned side with inverted/advocate flags', () => {
    const { room, ann, bob } = duoRoom();
    room.duoPlannedActs = [2];
    room.dilemmaIndex = 1;
    room.votes.set(ann, 'A');
    room.votes.set(bob, 'B');
    assignInvertedSides(room);
    expect(duoTurn(room, 0)).toBeNull(); // not in DUO_ARGUE
    room.phase = 'DUO_ARGUE';
    room.turnStartedAt = 1_000;
    room.turnMinEndsAt = 16_000;
    const turn = duoTurn(room, 5_000)!;
    expect(turn.speaker?.id).toBe(ann);
    expect(turn.speaker?.side).toBe('B'); // Ann argues the side she did NOT pick
    expect(turn.speaker?.inverted).toBe(true);
    expect(turn.speaker?.advocate).toBe(false);
    expect(turn.listenerId).toBe(bob);
    expect(turn.turn).toBe(1);
    expect(turn.totalTurns).toBe(2);
    expect(turn.canFinish).toBe(false);
    expect(duoTurn(room, 16_500)!.canFinish).toBe(true);
  });

  it('duoActState reports the act and the position within it', () => {
    const { room } = duoRoom();
    room.duoPlannedActs = [1, 1, 2, 3];
    room.phase = 'DUO_PICK_PREDICT';
    room.dilemmaIndex = 2;
    expect(duoActState(room)).toEqual({ act: 1, roundInAct: 2, roundsInAct: 2, totalActs: 3 });
    room.phase = 'DUO_ACT_INTRO'; // the card announces the COMING act
    expect(duoActState(room)).toEqual({ act: 2, roundInAct: 0, roundsInAct: 1, totalActs: 3 });
    room.phase = 'DUO_PICK';
    room.dilemmaIndex = 4;
    expect(duoActState(room)).toEqual({ act: 3, roundInAct: 1, roundsInAct: 1, totalActs: 3 });
  });
});

describe('duoPortrait', () => {
  function scoredRoom() {
    const ctx = duoRoom();
    const { room, ann, bob } = ctx;
    room.duoTruePicks = 4;
    room.duoFirstPickAgreements = 2;
    room.duoScore.set(ann, { tiConosco: 3, vacillare: 1, persuasione: 2, ribaltone: 0 });
    room.duoScore.set(bob, { tiConosco: 1, vacillare: 2, persuasione: 0, ribaltone: 2 });
    room.duoMoments.push(
      { emoji: '🤯', title: 'Ha fatto vacillare', description: 'x', playerId: ann },
      { emoji: '🎭', title: 'Ribaltone!', description: 'y', playerId: bob },
    );
    room.phase = 'DUO_PORTRAIT';
    return ctx;
  }

  it('answers only in DUO_PORTRAIT', () => {
    const { room } = duoRoom();
    expect(duoPortrait(room)).toBeNull();
  });

  it('computes sintonia %, verdict totals and the winner', () => {
    const { room, ann, bob } = scoredRoom();
    const portrait = duoPortrait(room)!;
    expect(portrait.sintoniaPct).toBe(50);
    expect(portrait.scores.find((s) => s.id === ann)?.total).toBe(6);
    expect(portrait.scores.find((s) => s.id === bob)?.total).toBe(5);
    expect(portrait.winnerId).toBe(ann);
    expect(portrait.tiConosco.find((t) => t.id === ann)?.hits).toBe(3);
  });

  it('a tie crowns nobody and zero true picks give 0% without crashing', () => {
    const { room, bob } = scoredRoom();
    room.duoScore.get(bob)!.vacillare = 3; // 6 vs 6
    expect(duoPortrait(room)!.winnerId).toBeNull();
    room.duoTruePicks = 0;
    room.duoFirstPickAgreements = 0;
    expect(duoPortrait(room)!.sintoniaPct).toBe(0);
  });

  it('picks the momento della serata by priority: ribaltone over 🤯', () => {
    const { room } = scoredRoom();
    expect(duoPortrait(room)!.momento?.title).toContain('Ribaltone');
  });

  it('hands exactly 2 titles per player, matching the counters', () => {
    const { room, ann, bob } = scoredRoom();
    const titoli = duoPortrait(room)!.titoli;
    expect(titoli.filter((t) => t.playerId === ann)).toHaveLength(2);
    expect(titoli.filter((t) => t.playerId === bob)).toHaveLength(2);
    expect(titoli.find((t) => t.title === 'Il Persuasore')?.playerId).toBe(ann);
    expect(titoli.find((t) => t.title === "L'Avvocato del Diavolo")?.playerId).toBe(bob);
    expect(titoli.find((t) => t.title === 'Il Telepate')?.playerId).toBe(ann);
  });

  it('falls back to jolly titles when nobody scored anything', () => {
    const { room, ann, bob } = duoRoom();
    room.phase = 'DUO_PORTRAIT';
    const titoli = duoPortrait(room)!.titoli;
    expect(titoli.filter((t) => t.playerId === ann)).toHaveLength(2);
    expect(titoli.filter((t) => t.playerId === bob)).toHaveLength(2);
    expect(duoPortrait(room)!.momento).toBeNull();
    expect(duoPortrait(room)!.winnerId).toBeNull();
  });
});

describe('duo room state lifecycle', () => {
  it('create() initialises the duo fields empty', () => {
    const { room } = duoRoom();
    expect(room.duoPlannedActs).toEqual([]);
    expect(room.duoPredictions.size).toBe(0);
    expect(room.duoAssignedSides.size).toBe(0);
    expect(room.duoSpeakers).toEqual([]);
    expect(room.duoTurnIndex).toBe(0);
    expect(room.duoWaverRatings.size).toBe(0);
    expect(room.duoFairness).toBe(0);
    expect(room.duoAdvocacy).toBe(false);
    expect(room.duoRepickFlipped).toBe(false);
    expect(room.duoScore.size).toBe(0);
    expect(room.duoTruePicks).toBe(0);
    expect(room.duoFirstPickAgreements).toBe(0);
    expect(room.duoMoments).toEqual([]);
  });

  it('rematch() resets every duo field so game 2 starts clean', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'sock-ann', 'Ann');
    store.join(code, 'sock-bob', 'Bob');
    const room = store.get(code)!;
    const [ann] = [...room.players.keys()];
    room.phase = 'DUO_PORTRAIT';
    room.duoPlannedActs = [1, 2, 3];
    room.duoPredictions.set(ann, 'A');
    room.duoAssignedSides.set(ann, 'B');
    room.duoSpeakers = [ann];
    room.duoTurnIndex = 1;
    room.duoWaverRatings.set(ann, 2);
    room.duoFairness = 3;
    room.duoAdvocacy = true;
    room.duoRepickFlipped = true;
    room.duoScore.set(ann, { tiConosco: 1, vacillare: 2, persuasione: 2, ribaltone: 2 });
    room.duoTruePicks = 4;
    room.duoFirstPickAgreements = 2;
    room.duoMoments.push({ emoji: '🤯', title: 't', description: 'd' });
    const res = store.rematch(code);
    expect(res.ok).toBe(true);
    expect(room.duoPlannedActs).toEqual([]);
    expect(room.duoPredictions.size).toBe(0);
    expect(room.duoAssignedSides.size).toBe(0);
    expect(room.duoSpeakers).toEqual([]);
    expect(room.duoTurnIndex).toBe(0);
    expect(room.duoWaverRatings.size).toBe(0);
    expect(room.duoFairness).toBe(0);
    expect(room.duoAdvocacy).toBe(false);
    expect(room.duoRepickFlipped).toBe(false);
    expect(room.duoScore.size).toBe(0);
    expect(room.duoTruePicks).toBe(0);
    expect(room.duoFirstPickAgreements).toBe(0);
    expect(room.duoMoments).toEqual([]);
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
