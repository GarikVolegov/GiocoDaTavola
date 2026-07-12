import { describe, it, expect } from 'vitest';
import { recordRoundStats } from '../roundStats';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const FIXTURE: Dilemma[] = Array.from({ length: 3 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_r: ContentRegister) => new Deck(FIXTURE, () => 0);
const makeStore = (rng: () => number = () => 0) => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

describe('recordRoundStats — co-defenders on the same side', () => {
  it('credits the side swing to only ONE defender when two share a side (coppie / doppio-difensore), not both', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 7; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.votes1 = new Map([['s0', 'B'], ['s1', 'B']]);
    room.votes = new Map([['s0', 'A'], ['s1', 'A']]); // side A gained 2 net
    room.defenders = [
      { id: 's0', nickname: 'P0', side: 'A' },
      { id: 's1', nickname: 'P1', side: 'A' },
    ];
    recordRoundStats(room);
    const total = (room.stats.get('s0')?.persuasion ?? 0) + (room.stats.get('s1')?.persuasion ?? 0);
    expect(total).toBe(2); // the side's real gain, not double-counted to 4
    expect(room.stats.get('s0')?.defendedCount).toBe(1); // still credited for defending
    expect(room.stats.get('s1')?.defendedCount).toBe(1);
  });

  it('still credits each defender independently when they are on DIFFERENT sides', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.votes1 = new Map([['s0', 'A'], ['s1', 'B'], ['s2', 'B'], ['s3', 'B']]);
    room.votes = new Map([['s0', 'A'], ['s1', 'A'], ['s2', 'B'], ['s3', 'B']]); // A +1, B -1
    room.defenders = [
      { id: 's0', nickname: 'P0', side: 'A' },
      { id: 's2', nickname: 'P2', side: 'B' },
    ];
    recordRoundStats(room);
    expect(room.stats.get('s0')?.persuasion).toBe(1);
    expect(room.stats.get('s2')?.persuasion).toBe(0); // B lost votes, no negative credit
  });

  it('the devil-round bonus also goes only to the credited representative', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 7; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.votes1 = new Map([['s0', 'B'], ['s1', 'B']]);
    room.votes = new Map([['s0', 'A'], ['s1', 'A']]);
    room.defenders = [
      { id: 's0', nickname: 'P0', side: 'A', devil: true },
      { id: 's1', nickname: 'P1', side: 'A', devil: true },
    ];
    recordRoundStats(room);
    const devilTotal = (room.stats.get('s0')?.devilPersuasion ?? 0) + (room.stats.get('s1')?.devilPersuasion ?? 0);
    expect(devilTotal).toBe(2);
  });
});

describe('recordRoundStats — "Il Fulmine" (firstToVoteCount) ignores bots', () => {
  it('credits the first HUMAN voter, never a bot that auto-voted first', () => {
    const store = makeStore();
    const { code } = store.create();
    store.join(code, 'human', 'Ann');
    store.addBot(code); // bots vote first (castBotFirstVotes on VOTE_1 entry)
    const room = store.get(code)!;
    // Mirror what actually happens: bots are inserted into votes1 before any
    // human, so the Map's insertion order puts a bot key first.
    room.votes1 = new Map();
    for (const p of room.players.values()) if (p.isBot) room.votes1.set(p.id, 'A');
    room.votes1.set('human', 'A');
    room.votes = new Map(room.votes1);
    recordRoundStats(room);
    for (const p of room.players.values()) {
      if (p.isBot) expect(room.stats.get(p.id)?.firstToVoteCount ?? 0).toBe(0);
    }
    expect(room.stats.get('human')?.firstToVoteCount).toBe(1);
  });

  it('an all-human round behaves exactly as before (first key wins)', () => {
    const store = makeStore();
    const { code } = store.create();
    store.join(code, 's0', 'P0');
    store.join(code, 's1', 'P1');
    const room = store.get(code)!;
    room.votes1 = new Map([['s1', 'A'], ['s0', 'B']]); // s1 voted first
    room.votes = new Map(room.votes1);
    recordRoundStats(room);
    expect(room.stats.get('s1')?.firstToVoteCount).toBe(1);
    expect(room.stats.get('s0')?.firstToVoteCount ?? 0).toBe(0);
  });
});
