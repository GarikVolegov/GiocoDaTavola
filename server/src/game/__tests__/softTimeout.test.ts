import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, SOFT_TIMEOUT_MS, type VoteChoice } from '../rooms';
import { applyPredictDefaults } from '../predictions';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

function reachPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3);
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  return code;
}

describe('applyPredictDefaults', () => {
  it('fills the leading side + "regge" for anyone still missing, leaves actors alone', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // A leads 2-1
    store.predict(code, 'sock-0', 'B'); // sock-0 already acted — must be untouched
    store.swingBet(code, 'sock-0', 'ribalta');
    const room = store.get(code)!;
    applyPredictDefaults(room);
    expect(room.predictions.get('sock-0')).toBe('B'); // unchanged
    expect(room.swingBets.get('sock-0')).toBe('ribalta'); // unchanged
    expect(room.predictions.get('sock-1')).toBe('A'); // defaulted to the leader
    expect(room.swingBets.get('sock-1')).toBe('regge');
    expect(room.predictions.get('sock-2')).toBe('A');
    expect(room.swingBets.get('sock-2')).toBe('regge');
  });

  it('is a no-op outside PREDICT', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    const room = store.get(code)!;
    applyPredictDefaults(room);
    expect(room.predictions.size).toBe(0);
  });

  it('in the know round, also defaults a still-missing know-guess — a forced exit must not silently drop that sub-part (asymmetric with prediction/swingBet)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // A leads 2-1
    const room = store.get(code)!;
    room.knowRoundIndex = room.dilemmaIndex; // force this round to be the know round
    room.knowTargets.set('sock-0', 'sock-1'); // sock-0 guesses sock-1's first vote
    applyPredictDefaults(room);
    expect(room.knowGuesses.has('sock-0')).toBe(true);
    expect(room.knowGuesses.get('sock-0')).toBe('A'); // defaults to the same leading-side heuristic
  });

  it("never fabricates a know-guess for someone who wasn't assigned a target", () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    const room = store.get(code)!;
    room.knowRoundIndex = room.dilemmaIndex;
    // sock-2 has no knowTarget this round (the ring doesn't have to include everyone).
    applyPredictDefaults(room);
    expect(room.knowGuesses.has('sock-2')).toBe(false);
  });
});

describe('maybeArmSoftTimeout', () => {
  it('arms a deadline once >=70% of present voters have voted in VOTE_1', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    expect(store.get(code)!.phaseExpiresAt).toBeNull();
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // 0/3 acted
    store.vote(code, 'sock-0', 'A');
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // 1/3 < 70%
    store.vote(code, 'sock-1', 'A'); // 2/3 = 67%... still short
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
    store.vote(code, 'sock-2', 'B'); // 3/3 -> but now everyone acted, nothing to wait on
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
  });

  it('arms once 2 of 3 have voted when the 3rd never will (a real 70%+ case)', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.join(code, 'sock-3', 'P3');
    store.startGame(code, 3);
    store.advancePhase(code);
    store.advancePhase(code); // VOTE_1, 4 present
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, 'sock-2', 'B'); // 3/4 = 75% >= 70%, sock-3 never votes
    expect(store.maybeArmSoftTimeout(code)).toBe(true);
    expect(store.get(code)!.phaseExpiresAt).toBe(5_000 + SOFT_TIMEOUT_MS);
    expect(store.maybeArmSoftTimeout(code)).toBe(false); // already armed, no re-arm
  });

  it('does nothing for phases with a real timer (DEFENSE)', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    store.get(code)!.phase = 'DEFENSE';
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
  });

  it('ignores a THIS-round late-joiner in PREDICT (mirrors predictProgress/allPredicted) instead of counting them as still-missing', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B', 'B']); // 4 present
    const room = store.get(code)!;
    room.lateJoiners.add('sock-3'); // joined mid-round — excluded everywhere else
    for (const id of ['sock-0', 'sock-1', 'sock-2']) {
      store.predict(code, id, 'A');
      store.swingBet(code, id, 'regge');
    }
    // 3 of the 3 REAL participants acted: 100% (excluding the late-joiner) —
    // must arm. Counting the late-joiner in the total would read 3/4 = 75%,
    // which also happens to clear 70%, so use the deadline itself to prove
    // it: everyone real is done, so there's nothing left to wait ON — no
    // deadline should arm (mirrors the VOTE_1 "3/3, nothing to wait on" case).
    expect(store.maybeArmSoftTimeout(code)).toBe(false);
    expect(room.phaseExpiresAt).toBeNull();
  });

  it('a late-joiner never counts toward the 70% threshold, even sitting at less than 70% including them', () => {
    const store = new RoomStore(generateRoomCode, () => 5_000, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL
    store.advancePhase(code); // VOTE_1
    // A split vote (not unanimous): an all-A first vote would skip the
    // debate entirely (UNANIMOUS_REVEAL) and never reach PREDICT at all.
    (['A', 'A', 'A', 'B', 'B'] as const).forEach((side, i) => store.vote(code, `sock-${i}`, side));
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    const room = store.get(code)!;
    room.lateJoiners.add('sock-4'); // 4 REAL participants remain
    for (const id of ['sock-0', 'sock-1', 'sock-2']) {
      store.predict(code, id, 'A');
      store.swingBet(code, id, 'regge');
    }
    // 3 of 4 real participants: 75% >= 70% -> arms. Counting the late-joiner
    // in the total (3/5 = 60%) would wrongly say "not yet".
    expect(store.maybeArmSoftTimeout(code)).toBe(true);
    expect(room.phaseExpiresAt).toBe(5_000 + SOFT_TIMEOUT_MS);
  });
});
