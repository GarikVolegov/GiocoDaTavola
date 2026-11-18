import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type Room } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';
import { computeAwards } from '../awards';
import {
  TELEPATHY_PROMPTS,
  normalizeTelepathyWord,
  pickTelepathyPrompt,
} from '../telepathy';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 10 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeDeck = (_r: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

describe('telepathy (1-word silent mind-sync mode)', () => {
  it('normalizes casing, accents, punctuation, and leading articles safely', () => {
    expect(normalizeTelepathyWord('  Caffè!! ')).toBe('caffe');
    expect(normalizeTelepathyWord("  L'Estate! ")).toBe('estate');
    expect(normalizeTelepathyWord('universo')).toBe('universo');
  });

  it('picks unused prompts respecting familiarita until exhausted', () => {
    const used = new Set(TELEPATHY_PROMPTS.slice(0, -1).map((p) => p.id));
    const roomLike = { usedTelepathyIds: used, familiarita: 'misto' } as unknown as Room;
    expect(pickTelepathyPrompt(roomLike, () => 0).id).toBe(TELEPATHY_PROMPTS.at(-1)!.id);

    const exhausted = {
      usedTelepathyIds: new Set(TELEPATHY_PROMPTS.map((p) => p.id)),
      familiarita: 'misto',
    } as unknown as Room;
    expect(pickTelepathyPrompt(exhausted, () => 0)).toBeTruthy();
  });

  it('clusters matching answers, awards sync points and Onda Telepatica', () => {
    // Sweep 0.0..0.95 so buildMixPlan selects every mini-game including telepatia
    let step = 0;
    const steps = [0.05, 0.15, 0.28, 0.4, 0.52, 0.65, 0.78, 0.9, 0.96, 0.72];
    const rng = () => {
      const val = steps[step % steps.length];
      step++;
      return val;
    };
    const store = new RoomStore(generateRoomCode, () => 1_000, makeDeck, rng);
    const { code } = store.create();
    store.join(code, 'p1', 'Alice');
    store.join(code, 'p2', 'Bob');
    store.join(code, 'p3', 'Carl');
    store.join(code, 'p4', 'Dana');

    const startRes = store.startGame(
      code,
      10,
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

    let guard = 0;
    while (room.phase !== 'TELEPATHY' && room.phase !== 'FINAL_AWARDS' && guard < 60) {
      store.advancePhase(code);
      guard++;
    }
    expect(room.phase).toBe('TELEPATHY');

    expect(store.submitTelepathy(code, 'p1', ' ').ok).toBe(false);
    expect(store.submitTelepathy(code, 'p1', 'Mare').ok).toBe(true);
    expect(store.submitTelepathy(code, 'p2', 'mare!').ok).toBe(true);
    expect(store.submitTelepathy(code, 'p3', 'MARE').ok).toBe(true);
    expect(store.submitTelepathy(code, 'p4', 'Montagna').ok).toBe(true);

    expect(store.telepathyPhaseComplete(code)).toBe(true);
    expect(store.telepathyProgress(code)).toMatchObject({ total: 4, done: 4 });

    store.advancePhase(code);
    expect(room.phase).toBe('TELEPATHY_REVEAL');

    const reveal = store.publicTelepathyReveal(code)!;
    expect(reveal.totalPlayers).toBe(4);
    expect(reveal.syncedCount).toBe(3);
    expect(reveal.clusters).toHaveLength(2);
    expect(reveal.clusters[0].playerIds).toHaveLength(3);

    expect(room.stats.get('p1')?.telepathyMatches).toBe(1);
    expect(room.stats.get('p4')?.telepathyMatches ?? 0).toBe(0);
    expect(room.partyScores.get('p1') ?? 0).toBeGreaterThan(room.partyScores.get('p4') ?? 0);
    expect(computeAwards(room).some((a) => a.id === 'sincronia')).toBe(true);
  });
});
