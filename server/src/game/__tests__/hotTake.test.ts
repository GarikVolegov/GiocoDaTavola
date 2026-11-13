import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma } from '../deck';
import { HOT_TAKE_PROMPTS, buildHotTakeReveal, pickHotTakePrompt } from '../hotTake';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));

const makeStore = (rng: () => number = () => 0.25) =>
  new RoomStore(generateRoomCode, () => 1_000, () => new Deck(DILEMMA_FIXTURE, rng), rng);

describe('HotTake (Termometro 1-10)', () => {
  it('has at least 30 curated prompts', () => {
    expect(HOT_TAKE_PROMPTS.length).toBeGreaterThanOrEqual(30);
  });

  it('prefers vecchi_amici prompts when familiarita is vecchi_amici', () => {
    const picked = pickHotTakePrompt(new Set(), () => 0, 'vecchi_amici');
    expect(picked?.familiarita).toBe('vecchi_amici');
  });

  it('rejects scores outside 1..10 and non-integers', () => {
    const store = makeStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.startGame(code, 3, 'vita', 'gruppo', false, false, undefined, undefined, undefined, false, false, 'assente', undefined, 'mix');
    const room = store.get(code)!;
    room.phase = 'HOT_TAKE_VOTE';
    room.currentHotTakePrompt = HOT_TAKE_PROMPTS[0];

    expect(store.submitHotTake(code, 'p1', 0).ok).toBe(false);
    expect(store.submitHotTake(code, 'p1', 11).ok).toBe(false);
    expect(store.submitHotTake(code, 'p1', 5.5).ok).toBe(false);
    expect(store.submitHotTake(code, 'p1', 8).ok).toBe(true);
  });

  it('computes average, spread, lowest and highest extremes at HOT_TAKE_REVEAL', () => {
    const store = makeStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.phase = 'HOT_TAKE_VOTE';
    room.currentHotTakePrompt = HOT_TAKE_PROMPTS[0];

    store.submitHotTake(code, 'p1', 2);
    store.submitHotTake(code, 'p2', 9);
    store.submitHotTake(code, 'p3', 4);
    expect(store.hotTakePhaseComplete(code)).toBe(true);

    room.phase = 'HOT_TAKE_REVEAL';
    const reveal = buildHotTakeReveal(room)!;
    expect(reveal).not.toBeNull();
    expect(reveal.average).toBe(5);
    expect(reveal.lowest?.nickname).toBe('Alice');
    expect(reveal.lowest?.score).toBe(2);
    expect(reveal.highest?.nickname).toBe('Bob');
    expect(reveal.highest?.score).toBe(9);
    expect(reveal.spread).toBe(7);
  });
});
