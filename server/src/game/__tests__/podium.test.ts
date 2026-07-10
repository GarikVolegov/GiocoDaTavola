import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { podiumPoints, computePodium } from '../podium';
import type { PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = () => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);

// Base stats record with the required fields (mirrors devilAdvocate.test.ts).
function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0, ...over };
}

describe('podiumPoints — la formula dei Punti Serata', () => {
  it('dà +1 a round giocato', () => {
    expect(podiumPoints(baseStats({ rounds: 3 }))).toBe(3);
  });
  it('dà +2 a voto netto spostato dalle difese', () => {
    expect(podiumPoints(baseStats({ rounds: 1, persuasion: 2 }))).toBe(5);
  });
  it('non manda mai in negativo: persuasion negativa vale 0', () => {
    expect(podiumPoints(baseStats({ rounds: 2, persuasion: -3 }))).toBe(2);
  });
  it('dà +2 a voto "oratore più convincente"', () => {
    expect(podiumPoints(baseStats({ oratorVotes: 2 }))).toBe(5);
  });
  it('dà +1 a pronostico/scommessa/conoscenza/idea-cambiata', () => {
    expect(
      podiumPoints(baseStats({ correctPredictions: 1, correctSwingBets: 1, knowCorrect: 1, authoredSwing: 1 })),
    ).toBe(5);
  });
});

describe('computePodium — la classifica finale', () => {
  function roomWithStats(statsById: Record<string, PlayerStats>) {
    const store = makeStore();
    const { code } = store.create();
    Object.keys(statsById).forEach((id, i) => store.join(code, id, `P${i}`));
    const room = store.get(code)!;
    for (const [id, s] of Object.entries(statsById)) room.stats.set(id, s);
    return room;
  }

  it('ordina per punti decrescenti', () => {
    const room = roomWithStats({
      a: baseStats({ rounds: 1 }),
      b: baseStats({ rounds: 3, persuasion: 2 }),
      c: baseStats({ rounds: 2 }),
    });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['b', 'c', 'a']);
  });

  it('assegna i rank ex aequo in stile competition (1, 1, 3)', () => {
    const room = roomWithStats({
      a: baseStats({ rounds: 2 }),
      b: baseStats({ rounds: 2 }),
      c: baseStats({ rounds: 1 }),
    });
    expect(computePodium(room).map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it('a pari punti mantiene l’ordine di join (tie stabile)', () => {
    const room = roomWithStats({ a: baseStats(), b: baseStats() });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['a', 'b']);
  });

  it('esclude chi non ha giocato nessun round', () => {
    const room = roomWithStats({ a: baseStats(), b: baseStats({ rounds: 0 }) });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['a']);
  });

  it('riporta punti e nickname', () => {
    const room = roomWithStats({ a: baseStats({ rounds: 2, oratorVotes: 1 }) });
    expect(computePodium(room)[0]).toEqual({ player: { id: 'a', nickname: 'P0' }, points: 4, rank: 1 });
  });
});
