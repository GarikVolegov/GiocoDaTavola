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
});
