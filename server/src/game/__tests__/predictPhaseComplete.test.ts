import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

// A deterministic 8-dilemma fixture so a 5-round game (>=5 unlocks the "Quanto
// mi conosci" round) has enough draws. pickDevilRound is now deterministic
// (always dilemmaCount - 1, the penultimate round — 6.2), which pickKnowRound
// then excludes when drawing its own round via rng (see knowRound.pickKnowRound).
const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

// Drive a fresh 3-human room to PREDICT of a round, casting the given VOTE_1
// choices for sock-0..n first.
function reachPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 5); // 5 rounds unlocks the know round
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  return code;
}

describe('predictPhaseComplete — unified PREDICT advance gate', () => {
  it('outside the know round: true once predict + swingBet are both done, ignoring knowGuess', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // rng=()=>0 -> round 1, not the know round
    expect(store.get(code)!.knowRoundIndex).not.toBe(1);
    store.predict(code, 'sock-0', 'A');
    store.predict(code, 'sock-1', 'A');
    store.predict(code, 'sock-2', 'A');
    expect(store.predictPhaseComplete(code)).toBe(false); // swing bets missing
    store.swingBet(code, 'sock-0', 'regge');
    store.swingBet(code, 'sock-1', 'regge');
    store.swingBet(code, 'sock-2', 'regge');
    expect(store.predictPhaseComplete(code)).toBe(true);
  });

  it('in the know round: stays incomplete until predict + swingBet + knowGuess all land', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    const knowRoundIndex = store.get(code)!.knowRoundIndex!;
    expect(knowRoundIndex).toBeGreaterThan(1); // round 1 is never eligible
    // Walk to the know round's PREDICT. PREDICT is followed by DEFENSE/VOTE_2/
    // SPEAKER_VOTE/PHASE_RESULTS before dilemmaIndex bumps (at DILEMMA_REVEAL),
    // so the guard must check phase+index together, not index alone (which
    // reaches the target several sub-phases before that round's PREDICT).
    let g = 0;
    while (
      !(store.get(code)!.phase === 'PREDICT' && store.get(code)!.dilemmaIndex === knowRoundIndex) &&
      g++ < 30
    ) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1') {
        (['A', 'A', 'B'] as VoteChoice[]).forEach((side, i) => store.vote(code, `sock-${i}`, side));
      }
    }
    expect(store.get(code)!.phase).toBe('PREDICT');
    expect(store.get(code)!.knowRoundIndex).toBe(knowRoundIndex);
    for (let i = 0; i < 3; i++) {
      store.predict(code, `sock-${i}`, 'A');
      store.swingBet(code, `sock-${i}`, 'regge');
    }
    expect(store.predictPhaseComplete(code)).toBe(false); // knowGuess still missing
    const targets = [...store.get(code)!.knowTargets.keys()];
    for (const guesserId of targets) store.knowGuess(code, guesserId, 'A');
    expect(store.predictPhaseComplete(code)).toBe(true);
  });

  it('predictProgress lists who is still missing something, without their choice', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    store.predict(code, 'sock-0', 'A');
    store.swingBet(code, 'sock-0', 'regge');
    const progress = store.predictProgress(code)!;
    expect(progress.total).toBe(3);
    expect(progress.done).toBe(1);
    expect(progress.missingNicknames.sort()).toEqual(['P1', 'P2']);
  });

  it('predictProgress is null outside PREDICT', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    expect(store.predictProgress(code)).toBeNull();
  });

  it('predictProgress excludes a THIS-round late-joiner, mirroring allPredicted/allSwingBet — they never block or appear in the waiting list', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    const room = store.get(code)!;
    room.lateJoiners.add('sock-2'); // joined mid-round, hasn't even seen PREDICT
    store.predict(code, 'sock-0', 'A');
    store.swingBet(code, 'sock-0', 'regge');
    store.predict(code, 'sock-1', 'A');
    store.swingBet(code, 'sock-1', 'regge');
    const progress = store.predictProgress(code)!;
    expect(progress.total).toBe(2); // sock-2 doesn't count
    expect(progress.done).toBe(2);
    expect(progress.missingNicknames).toEqual([]); // never "Aspettiamo P2…"
    expect(store.predictPhaseComplete(code)).toBe(true); // can advance early
  });
});
