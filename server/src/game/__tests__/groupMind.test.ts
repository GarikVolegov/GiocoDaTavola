import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma, type ContentRegister, type Tappa } from '../deck';
import { isGroupMindCheckpoint, pickGroupMindQuestion, GROUP_MIND_QUESTIONS } from '../groupMind';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 10 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = (rng: () => number) => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

// Percorso needs tappa-tagged dilemmas (mirrors percorsoRoom.test.ts's fixture).
const TAGGED: Dilemma[] = ([1, 2, 3, 4] as Tappa[]).flatMap((t) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `t${t}-${i}`,
    text: `Dilemma ${t}-${i}?`,
    optionA: 'A',
    optionB: 'B',
    register: 'vita' as const,
    tappa: t,
    spuntiA: ['x', 'y'],
    spuntiB: ['x', 'y'],
  })),
);
const makeTaggedDeck = (_register: ContentRegister) => new Deck(TAGGED, () => 0);
const makePercorsoStore = (rng: () => number) => new RoomStore(generateRoomCode, () => 0, makeTaggedDeck, rng);

describe('isGroupMindCheckpoint', () => {
  it('fires every 2nd dilemma, never the last, never at 0', () => {
    expect(isGroupMindCheckpoint(0, 5)).toBe(false);
    expect(isGroupMindCheckpoint(1, 5)).toBe(false);
    expect(isGroupMindCheckpoint(2, 5)).toBe(true);
    expect(isGroupMindCheckpoint(3, 5)).toBe(false);
    expect(isGroupMindCheckpoint(4, 5)).toBe(true);
    expect(isGroupMindCheckpoint(5, 5)).toBe(false); // last dilemma: straight to FINAL_AWARDS
  });

  it('a 3-dilemma game only checkpoints after dilemma 2', () => {
    expect(isGroupMindCheckpoint(2, 3)).toBe(true);
    expect(isGroupMindCheckpoint(1, 3)).toBe(false);
    expect(isGroupMindCheckpoint(3, 3)).toBe(false);
  });
});

describe('pickGroupMindQuestion', () => {
  it('never repeats an already-used id', () => {
    const used = new Set(GROUP_MIND_QUESTIONS.slice(0, -1).map((q) => q.id));
    const picked = pickGroupMindQuestion(used, () => 0);
    expect(picked?.id).toBe(GROUP_MIND_QUESTIONS.at(-1)!.id);
  });

  it('returns null once the whole bank is exhausted', () => {
    const used = new Set(GROUP_MIND_QUESTIONS.map((q) => q.id));
    expect(pickGroupMindQuestion(used, () => 0)).toBeNull();
  });
});

// Drive a 3-player, 3-dilemma classic game to the GROUP_MIND checkpoint after
// dilemma 2 (isGroupMindCheckpoint(2,3) === true, the only one for count=3).
function reachGroupMind(store: RoomStore): string {
  const { code } = store.create();
  for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3);
  let g = 0;
  while (store.get(code)!.phase !== 'GROUP_MIND' && g++ < 60) {
    store.advancePhase(code);
    if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
      for (let i = 0; i < 3; i++) store.vote(code, `sock-${i}`, 'A');
    }
  }
  return code;
}

describe('GROUP_MIND round — the checkpoint detour', () => {
  it('detours through GROUP_MIND -> GROUP_MIND_REVEAL after dilemma 2, then continues to dilemma 3', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    expect(store.get(code)!.dilemmaIndex).toBe(2);
    expect(store.get(code)!.groupMindQuestion).not.toBeNull();
    store.advancePhase(code); // -> GROUP_MIND_REVEAL
    expect(store.get(code)!.phase).toBe('GROUP_MIND_REVEAL');
    store.advancePhase(code); // -> DILEMMA_REVEAL (dilemma 3)
    expect(store.get(code)!.phase).toBe('DILEMMA_REVEAL');
    expect(store.get(code)!.dilemmaIndex).toBe(3);
    // Leaving GROUP_MIND clears the question again (only set during it/its reveal).
    expect(store.get(code)!.groupMindQuestion).toBeNull();
  });

  it('never checkpoints for non-classic formats (percorso)', () => {
    const store = makePercorsoStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 0, 'misto', 'gruppo', false, false, { startTappa: 1, durata: 'corto' });
    let g = 0;
    let sawGroupMind = false;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && g++ < 200) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'GROUP_MIND') sawGroupMind = true;
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        for (let i = 0; i < 3; i++) store.vote(code, `sock-${i}`, 'A');
      }
    }
    expect(sawGroupMind).toBe(false);
  });
});

describe('GROUP_MIND submission', () => {
  it('accepts an answer + guess only during GROUP_MIND, rejects elsewhere', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    expect(store.groupMindSubmit(code, 'sock-0', 'A', 'B')).toEqual({ ok: true, room: expect.anything() });
    expect(store.groupMindSubmit(code, 'sock-0', 'nope', 'A')).toEqual({ ok: false, error: 'INVALID_CHOICE' });
    expect(store.groupMindSubmit(code, 'ghost', 'A', 'A')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(store.groupMindSubmit('NOPE', 'sock-0', 'A', 'A')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('ends GROUP_MIND early once every present human has submitted', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    expect(store.groupMindPhaseComplete(code)).toBe(false);
    store.groupMindSubmit(code, 'sock-0', 'A', 'A');
    store.groupMindSubmit(code, 'sock-1', 'B', 'A');
    expect(store.groupMindPhaseComplete(code)).toBe(false);
    store.groupMindSubmit(code, 'sock-2', 'A', 'B');
    expect(store.groupMindPhaseComplete(code)).toBe(true);
  });

  it('reports missing nicknames while some are still undecided', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    store.groupMindSubmit(code, 'sock-0', 'A', 'A');
    const progress = store.groupMindProgress(code)!;
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.missingNicknames.sort()).toEqual(['P1', 'P2']);
  });
});

describe('GROUP_MIND reveal', () => {
  it('backfills stragglers with a default answer+guess when forced through', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    store.groupMindSubmit(code, 'sock-0', 'B', 'B');
    // sock-1 / sock-2 never submit — force the advance (mirrors a leader skip).
    store.advancePhase(code);
    expect(store.get(code)!.phase).toBe('GROUP_MIND_REVEAL');
    expect(store.get(code)!.groupMindAnswers.get('sock-1')).toBe('A');
    expect(store.get(code)!.groupMindAnswers.get('sock-2')).toBe('A');
  });

  it('tallies the real answers and counts correct majority-guessers, gated to the reveal phase', () => {
    const store = makeStore(() => 0);
    const code = reachGroupMind(store);
    expect(store.publicGroupMindTally(code)).toBeNull(); // still GROUP_MIND, not the reveal
    store.groupMindSubmit(code, 'sock-0', 'A', 'A'); // answers A, guesses A (majority) -> correct
    store.groupMindSubmit(code, 'sock-1', 'A', 'B'); // answers A, guesses B -> wrong
    store.groupMindSubmit(code, 'sock-2', 'B', 'A'); // answers B, guesses A -> correct
    store.advancePhase(code); // -> GROUP_MIND_REVEAL
    expect(store.publicGroupMindTally(code)).toEqual({ A: 2, B: 1, correctGuessers: 2 });
    const results = store.groupMindResults(code);
    expect(results.find((r) => r.playerId === 'sock-0')).toEqual({ playerId: 'sock-0', guess: 'A', actual: 'A', correct: true });
    expect(results.find((r) => r.playerId === 'sock-1')).toEqual({ playerId: 'sock-1', guess: 'B', actual: 'A', correct: false });
  });

  it('bots answer + guess immediately on entry, never blocking the round', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.addBot(code);
    store.addBot(code);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'GROUP_MIND' && g++ < 60) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        store.vote(code, 'sock-0', 'A');
      }
    }
    const room = store.get(code)!;
    const botIds = [...room.players.values()].filter((p) => p.isBot).map((p) => p.id);
    for (const id of botIds) {
      expect(room.groupMindAnswers.has(id)).toBe(true);
      expect(room.groupMindGuesses.has(id)).toBe(true);
    }
    // Only the human is left to submit for the round to complete.
    expect(store.groupMindProgress(code)!.total).toBe(1);
  });
});
