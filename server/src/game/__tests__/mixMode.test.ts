import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, buildMixPlan } from '../rooms';
import { Deck, type Dilemma } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));

describe('Serata Mix (variable mini-game mode)', () => {
  it('never places two identical mini-game kinds back to back', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const plan = buildMixPlan(12, 5, rng);
    expect(plan).toHaveLength(12);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]).not.toBe(plan[i - 1]);
    }
  });

  it('excludes infiltrato when fewer than 4 players', () => {
    const plan = buildMixPlan(10, 3, () => 0.99);
    expect(plan).not.toContain('infiltrato');
  });

  it('plays a full Serata Mix game from PHASE_INTRO through FINAL_AWARDS', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const store = new RoomStore(
      generateRoomCode,
      () => 10_000,
      () => new Deck(DILEMMA_FIXTURE, rng),
      rng,
    );
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.join(code, 'p4', 'Dana');

    const startRes = store.startGame(
      code,
      5,
      'misto',
      'gruppo',
      false,
      false,
      undefined,
      undefined,
      undefined,
      false,
      false,
      'assente',
      undefined,
      'mix',
    );
    expect(startRes.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.partyMode).toBe('mix');
    expect(room.mixPlan).toHaveLength(5);

    let steps = 0;
    while (room.phase !== 'FINAL_AWARDS' && steps < 40) {
      store.advancePhase(code);
      steps++;
    }
    expect(room.phase).toBe('FINAL_AWARDS');
  });
});
