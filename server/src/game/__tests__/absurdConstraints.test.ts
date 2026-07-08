import { describe, it, expect } from 'vitest';
import { pickAbsurdConstraint, ABSURD_CONSTRAINTS } from '../absurdConstraints';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 3 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: 'A',
  optionB: 'B',
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

describe('pickAbsurdConstraint', () => {
  it('is null about 2/3 of the time (rng consumed once for the roll)', () => {
    expect(pickAbsurdConstraint(() => 0.999)).toBeNull(); // >= 1/3 -> no constraint
    expect(pickAbsurdConstraint(() => 1 / 3)).toBeNull(); // boundary: not < 1/3
  });

  it('picks a constraint from the pool when the roll succeeds', () => {
    // First call (0.1) succeeds the 1/3 roll; the SAME rng is called again to
    // pick the index, so pass a stateful sequence to control both draws.
    const rolls = [0.1, 0];
    let i = 0;
    const rng = () => rolls[i++];
    expect(pickAbsurdConstraint(rng)).toBe(ABSURD_CONSTRAINTS[0]);
  });

  it('can pick the last constraint in the pool', () => {
    const rolls = [0, 0.999];
    let i = 0;
    const rng = () => rolls[i++];
    expect(pickAbsurdConstraint(rng)).toBe(ABSURD_CONSTRAINTS[ABSURD_CONSTRAINTS.length - 1]);
  });

  it('the pool has no duplicate or empty entries', () => {
    expect(new Set(ABSURD_CONSTRAINTS).size).toBe(ABSURD_CONSTRAINTS.length);
    expect(ABSURD_CONSTRAINTS.every((c) => c.trim().length > 0)).toBe(true);
  });
});

describe('RoomStore — absurd constraint at DEFENSE entry', () => {
  it('draws a constraint on entry to DEFENSE and reveals it only during DEFENSE/INTERVENTI', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    expect(store.publicAbsurdConstraint(code)).toBeNull(); // not DEFENSE yet
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    store.advancePhase(code); // SPLIT_REVEAL
    store.advancePhase(code); // PREDICT
    store.advancePhase(code); // DEFENSE
    expect(store.get(code)!.phase).toBe('DEFENSE');
    // rng=()=>0 always succeeds the 1/3 roll and picks index 0.
    expect(store.get(code)!.absurdConstraint).toBe(ABSURD_CONSTRAINTS[0]);
    expect(store.publicAbsurdConstraint(code)).toBe(ABSURD_CONSTRAINTS[0]);
    expect(store.publicAbsurdConstraint('ZZZZ')).toBeNull();
  });

  it('is null for the round when the roll misses', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.9);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'DEFENSE' && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1') {
        store.vote(code, 'sock-0', 'A');
        store.vote(code, 'sock-1', 'B');
        store.vote(code, 'sock-2', 'B');
      }
    }
    expect(store.get(code)!.phase).toBe('DEFENSE');
    expect(store.get(code)!.absurdConstraint).toBeNull();
    expect(store.publicAbsurdConstraint(code)).toBeNull();
  });

  it('is hidden again once VOTE_2 begins', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'B');
    g = 0;
    while (store.get(code)!.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('VOTE_2');
    expect(store.publicAbsurdConstraint(code)).toBeNull(); // room.absurdConstraint is still set, just not revealed
    expect(store.get(code)!.absurdConstraint).toBe(ABSURD_CONSTRAINTS[0]);
  });
});
