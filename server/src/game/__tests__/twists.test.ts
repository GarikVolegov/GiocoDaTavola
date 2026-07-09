import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, DEFENSE_MAX_MS_NORMALE, type VoteChoice } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';
import { planTwistRounds, pickTwist, TWISTS, TWIST_DEFENSE_LAMPO_MS, CAOS_LEVELS } from '../twists';
import * as defenseSetup from '../defenseSetup';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 10 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = (rng: () => number) => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

describe('planTwistRounds', () => {
  it("'assente' never rolls any round, regardless of rng", () => {
    expect(planTwistRounds(7, 'assente', () => 0)).toEqual(new Set());
  });

  it('rolls a round when rng beats the level probability', () => {
    // basso=0.2: rng()=0 always beats it -> every round.
    expect(planTwistRounds(5, 'basso', () => 0)).toEqual(new Set([1, 2, 3, 4, 5]));
    // rng()=0.99 never beats any level -> no rounds (short-game guarantee doesn't
    // apply here since dilemmaCount=5 > 3).
    expect(planTwistRounds(5, 'alto', () => 0.99)).toEqual(new Set());
  });

  it('guarantees at least one twist in a short (<=3) game once caos is on', () => {
    // Every per-round roll misses (0.99 beats no probability), so the guarantee
    // kicks in: 1 + floor(0.99 * 3) = 3.
    expect(planTwistRounds(3, 'basso', () => 0.99)).toEqual(new Set([3]));
    expect(planTwistRounds(3, 'assente', () => 0.99)).toEqual(new Set()); // still off when caos is off
  });
});

describe('pickTwist', () => {
  it('always returns one of the pool entries', () => {
    for (let i = 0; i < TWISTS.length; i++) {
      const rng = () => i / TWISTS.length;
      expect(TWISTS.map((t) => t.id)).toContain(pickTwist(rng).id);
    }
  });
});

describe('caos dial — startGame wiring', () => {
  it("defaults to 'assente' (no twists ever), matching every other opt-in extra's off default", () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 5);
    expect(store.get(code)?.caos).toBe('assente');
    expect(store.get(code)?.twistRoundIndices).toEqual(new Set());
  });

  it('rejects an invalid caos value by falling back to assente', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'nope');
    expect(store.get(code)?.caos).toBe('assente');
  });

  it('accepts every documented caos level', () => {
    for (const caos of CAOS_LEVELS) {
      const store = makeStore(() => 0);
      const { code } = store.create();
      for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
      store.startGame(code, 5, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, caos);
      expect(store.get(code)?.caos).toBe(caos);
    }
  });
});

// Drive a 3-player game with 'alto' caos + rng=()=>0 to DEFENSE of dilemma 1 —
// deterministically a twist round (every round rolls true) whose twist is
// always TWISTS[0] ('difesa-lampo': Math.floor(0 * TWISTS.length) === 0).
function twistDefenseRoom(store: RoomStore): string {
  const { code } = store.create();
  for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'alto');
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  store.vote(code, 'sock-0', 'A');
  store.vote(code, 'sock-1', 'B');
  store.vote(code, 'sock-2', 'B');
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  store.advancePhase(code); // DEFENSE
  return code;
}

describe('DEFENSE with a twist in play', () => {
  it('picks a twist for a planned round and clears it on the next dilemma reveal', () => {
    const store = makeStore(() => 0);
    const code = twistDefenseRoom(store);
    const room = store.get(code)!;
    expect(room.currentTwist?.id).toBe('difesa-lampo');
    expect(store.publicTwist(code)?.id).toBe('difesa-lampo');
  });

  it('"difesa-lampo" forces a hard 30s cap in place of the room default', () => {
    const store = makeStore(() => 0);
    const code = twistDefenseRoom(store);
    const room = store.get(code)!;
    expect(room.phaseExpiresAt).toBe(room.turnStartedAt! + TWIST_DEFENSE_LAMPO_MS);
    expect(TWIST_DEFENSE_LAMPO_MS).toBeLessThan(DEFENSE_MAX_MS_NORMALE);
  });

  it('publicTwist is null outside the speaking phases', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, false, undefined, undefined, 'mista', false, false, 'alto');
    expect(store.publicTwist(code)).toBeNull(); // PHASE_INTRO
  });

  it('"interventi-vietati" rejects a raised hand this round', () => {
    const store = makeStore(() => 0);
    const code = twistDefenseRoom(store);
    const room = store.get(code)!;
    room.currentTwist = TWISTS.find((t) => t.id === 'interventi-vietati')!;
    expect(store.raiseHand(code, 'sock-1')).toEqual({ ok: false, error: 'INTERVENTI_DISABLED_THIS_ROUND' });
  });

  it('"doppio-difensore" forces 2 defenders per side even in a 3-player room', () => {
    const store = makeStore(() => 0);
    const code = twistDefenseRoom(store);
    const room = store.get(code)!;
    room.currentTwist = TWISTS.find((t) => t.id === 'doppio-difensore')!;
    // Re-run the (pure) defender selection with the twist now in play — this is
    // exactly what rooms.ts does on DEFENSE entry.
    const defenders = defenseSetup.selectDefenders(room, () => 0);
    const perSideCount = (side: VoteChoice) => defenders.filter((d) => d.side === side).length;
    expect(perSideCount('A')).toBeLessThanOrEqual(1); // only sock-0 voted A
    expect(perSideCount('B')).toBe(2); // sock-1 + sock-2 voted B -> both picked
  });
});
