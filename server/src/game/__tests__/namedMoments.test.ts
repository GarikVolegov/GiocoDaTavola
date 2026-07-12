import { describe, it, expect } from 'vitest';
import { detectNamedMoments } from '../namedMoments';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const FIXTURE: Dilemma[] = Array.from({ length: 5 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_r: ContentRegister) => new Deck(FIXTURE, () => 0);
const makeStore = (rng: () => number) => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

describe('detectNamedMoments (5.5, "momenti nominati")', () => {
  it('detects plebiscito when the final vote is unanimous', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.dilemmaIndex = 1;
    const moments = detectNamedMoments(room, { A: 3, B: 0 }, { A: 1, B: -1 });
    expect(moments.map((m) => m.kind)).toContain('plebiscito');
  });

  it('does not fire plebiscito for a genuinely lopsided-but-not-unanimous split', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    const moments = detectNamedMoments(room, { A: 3, B: 1 }, { A: 0, B: 0 });
    expect(moments.map((m) => m.kind)).not.toContain('plebiscito');
  });

  it('detects paritario on a dead-even split', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    const moments = detectNamedMoments(room, { A: 2, B: 2 }, { A: 0, B: 0 });
    expect(moments.map((m) => m.kind)).toContain('paritario');
  });

  it('does not fire paritario or plebiscito on an empty round (nobody voted)', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 's0', 'P0');
    store.startGame(code, 3);
    const room = store.get(code)!;
    const moments = detectNamedMoments(room, { A: 0, B: 0 }, { A: 0, B: 0 });
    expect(moments).toEqual([]);
  });

  it('detects ribaltone when the lead flips between votes1 and votes', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.votes1 = new Map([['s0', 'A'], ['s1', 'A'], ['s2', 'B'], ['s3', 'B']]); // tie -> A leads (>=)... use a real flip
    room.votes1 = new Map([['s0', 'A'], ['s1', 'A'], ['s2', 'A'], ['s3', 'B']]); // A leads 3-1
    room.votes = new Map([['s0', 'B'], ['s1', 'B'], ['s2', 'A'], ['s3', 'B']]); // B leads 3-1
    const moments = detectNamedMoments(room, { A: 1, B: 3 }, { A: -2, B: 2 });
    expect(moments.map((m) => m.kind)).toContain('ribaltone');
  });

  it('detects tripla persuasione for a defender who swung 3+ votes', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.defenders = [{ id: 's0', nickname: 'Ann', side: 'A' }];
    const moments = detectNamedMoments(room, { A: 4, B: 1 }, { A: 3, B: -3 });
    const tripla = moments.find((m) => m.kind === 'triplaPersuasione');
    expect(tripla).toBeDefined();
    expect(tripla?.playerId).toBe('s0');
    expect(tripla?.playerNickname).toBe('Ann');
  });

  it('does not fire tripla persuasione for a swing under the threshold', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 5; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.defenders = [{ id: 's0', nickname: 'Ann', side: 'A' }];
    const moments = detectNamedMoments(room, { A: 3, B: 2 }, { A: 2, B: -2 });
    expect(moments.map((m) => m.kind)).not.toContain('triplaPersuasione');
  });

  it('fires at most ONE tripla persuasione per side, even with 2 co-defenders on it (coppie / doppio-difensore)', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 7; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    // Both defenders share side A — the side's swing is a single shared fact,
    // not something each of them independently "pulled off".
    room.defenders = [
      { id: 's0', nickname: 'Ann', side: 'A' },
      { id: 's1', nickname: 'Bob', side: 'A' },
    ];
    const moments = detectNamedMoments(room, { A: 4, B: 1 }, { A: 3, B: -3 });
    const triple = moments.filter((m) => m.kind === 'triplaPersuasione');
    expect(triple.length).toBe(1);
    expect(triple[0].playerId).toBe('s0'); // the side's first-selected defender
  });

  it('a single round can produce multiple moments at once', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.votes1 = new Map([['s0', 'B'], ['s1', 'B'], ['s2', 'B'], ['s3', 'A']]); // B leads 3-1
    room.votes = new Map([['s0', 'A'], ['s1', 'A'], ['s2', 'B'], ['s3', 'B']]); // tie 2-2, lead flips (B -> null)
    room.defenders = [];
    const moments = detectNamedMoments(room, { A: 2, B: 2 }, { A: 1, B: -1 });
    expect(moments.map((m) => m.kind).sort()).toEqual(['paritario', 'ribaltone']);
  });
});
