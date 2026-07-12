import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';
import { pickWritePrompt, WRITE_PROMPTS } from '../writeRound';

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

// writeVote takes the opaque per-round token (an answer's position in
// writeOrder), never the real player id — this helper looks it up for tests
// that need to vote for a specific known author.
const tokenOf = (store: RoomStore, code: string, authorId: string): string =>
  String(store.get(code)!.writeOrder.indexOf(authorId));

describe('pickWritePrompt', () => {
  it('never repeats an already-used id', () => {
    const used = new Set(WRITE_PROMPTS.slice(0, -1).map((p) => p.id));
    const picked = pickWritePrompt(used, () => 0);
    expect(picked?.id).toBe(WRITE_PROMPTS.at(-1)!.id);
  });

  it('returns null once the whole bank is exhausted', () => {
    const used = new Set(WRITE_PROMPTS.map((p) => p.id));
    expect(pickWritePrompt(used, () => 0)).toBeNull();
  });
});

// Drive a 3-player, 5-dilemma classic game to the 2nd breather checkpoint
// (dilemma 4, occurrence 2 -> WRITE per the GROUP_MIND/WRITE alternation).
function reachWrite(store: RoomStore): string {
  const { code } = store.create();
  for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 5);
  let g = 0;
  while (store.get(code)!.phase !== 'WRITE' && g++ < 120) {
    store.advancePhase(code);
    if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
      for (let i = 0; i < 3; i++) store.vote(code, `sock-${i}`, 'A');
    }
    if (store.get(code)!.phase === 'GROUP_MIND') {
      for (let i = 0; i < 3; i++) store.groupMindSubmit(code, `sock-${i}`, 'A', 'A');
    }
  }
  return code;
}

describe('WRITE/WRITE_VOTE/WRITE_REVEAL — the alternating checkpoint detour', () => {
  it('alternates GROUP_MIND (dilemma 2) then WRITE (dilemma 4) in a 5-dilemma game', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 5);
    let g = 0;
    const seen: string[] = [];
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && g++ < 150) {
      store.advancePhase(code);
      const phase = store.get(code)!.phase;
      if (phase === 'GROUP_MIND' || phase === 'WRITE') seen.push(phase);
      if (phase === 'VOTE_1' || phase === 'VOTE_2') {
        for (let i = 0; i < 3; i++) store.vote(code, `sock-${i}`, 'A');
      }
      if (phase === 'GROUP_MIND') {
        for (let i = 0; i < 3; i++) store.groupMindSubmit(code, `sock-${i}`, 'A', 'A');
      }
      if (phase === 'WRITE') {
        for (let i = 0; i < 3; i++) store.submitWrite(code, `sock-${i}`, `answer-${i}`);
      }
      if (phase === 'WRITE_VOTE') {
        const order = store.get(code)!.writeOrder;
        for (let i = 0; i < 3; i++) {
          const target = order.find((id) => id !== `sock-${i}`);
          if (target) store.writeVote(code, `sock-${i}`, tokenOf(store, code, target));
        }
      }
    }
    expect(seen).toEqual(['GROUP_MIND', 'WRITE']);
  });

  it('detours through WRITE -> WRITE_VOTE -> WRITE_REVEAL then continues to the next dilemma', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    expect(store.get(code)!.dilemmaIndex).toBe(4);
    expect(store.get(code)!.writePrompt).not.toBeNull();
    store.advancePhase(code); // -> WRITE_VOTE
    expect(store.get(code)!.phase).toBe('WRITE_VOTE');
    expect(store.get(code)!.writeOrder.length).toBe(3);
    store.advancePhase(code); // -> WRITE_REVEAL
    expect(store.get(code)!.phase).toBe('WRITE_REVEAL');
    store.advancePhase(code); // -> DILEMMA_REVEAL (dilemma 5)
    expect(store.get(code)!.phase).toBe('DILEMMA_REVEAL');
    expect(store.get(code)!.dilemmaIndex).toBe(5);
    expect(store.get(code)!.writePrompt).toBeNull();
  });
});

describe('WRITE submission', () => {
  it('accepts a written answer only during WRITE, rejects elsewhere/empty/too long', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    expect(store.submitWrite(code, 'sock-0', 'Una risposta')).toEqual({ ok: true, room: expect.anything() });
    expect(store.submitWrite(code, 'sock-0', '   ')).toEqual({ ok: false, error: 'EMPTY' });
    expect(store.submitWrite(code, 'sock-0', 'x'.repeat(200))).toEqual({ ok: false, error: 'TOO_LONG' });
    expect(store.submitWrite(code, 'ghost', 'ciao')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(store.submitWrite('NOPE', 'sock-0', 'ciao')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('ends WRITE early once every present human has written, backfills stragglers when forced', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    expect(store.writePhaseComplete(code)).toBe(false);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    expect(store.writePhaseComplete(code)).toBe(false);
    store.submitWrite(code, 'sock-2', 'Gamma');
    expect(store.writePhaseComplete(code)).toBe(true);
  });

  it('reports missing nicknames while some are still undecided', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    const progress = store.writeProgress(code)!;
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.missingNicknames.sort()).toEqual(['P1', 'P2']);
  });
});

describe('WRITE_VOTE — anonymized voting', () => {
  it('publishes the shuffled answer list keyed by an opaque per-round token, never the real player id', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    store.submitWrite(code, 'sock-2', 'Gamma');
    expect(store.publicWrittenAnswers(code)).toBeNull(); // still WRITE, not the vote
    store.advancePhase(code); // -> WRITE_VOTE
    const list = store.publicWrittenAnswers(code)!;
    expect(list.length).toBe(3);
    // Tokens are just "my position in writeOrder" (0..2) — never a real id.
    expect(list.map((a) => a.id).sort()).toEqual(['0', '1', '2']);
    expect(list.map((a) => a.id)).not.toEqual(expect.arrayContaining(['sock-0', 'sock-1', 'sock-2']));
    expect(list.find((a) => a.text === 'Beta')?.id).toBe(tokenOf(store, code, 'sock-1'));
  });

  it("myWrittenAnswerToken lets a player find their OWN entry to filter out, without knowing anyone else's real id", () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    store.submitWrite(code, 'sock-2', 'Gamma');
    expect(store.myWrittenAnswerToken(code, 'sock-0')).toBeNull(); // still WRITE
    store.advancePhase(code); // -> WRITE_VOTE
    expect(store.myWrittenAnswerToken(code, 'sock-0')).toBe(tokenOf(store, code, 'sock-0'));
  });

  it('rejects self-votes and unknown/stale tokens', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    store.submitWrite(code, 'sock-2', 'Gamma');
    store.advancePhase(code); // -> WRITE_VOTE
    expect(store.writeVote(code, 'sock-0', tokenOf(store, code, 'sock-0'))).toEqual({ ok: false, error: 'SELF_VOTE' });
    expect(store.writeVote(code, 'sock-0', 'not-a-number')).toEqual({ ok: false, error: 'INVALID_TARGET' });
    expect(store.writeVote(code, 'sock-0', '99')).toEqual({ ok: false, error: 'INVALID_TARGET' }); // out of range
    expect(store.writeVote(code, 'sock-0', tokenOf(store, code, 'sock-1'))).toEqual({ ok: true, room: expect.anything() });
  });

  it('ends WRITE_VOTE early once every present human has voted', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    store.submitWrite(code, 'sock-2', 'Gamma');
    store.advancePhase(code); // -> WRITE_VOTE
    expect(store.writeVotePhaseComplete(code)).toBe(false);
    store.writeVote(code, 'sock-0', tokenOf(store, code, 'sock-1'));
    store.writeVote(code, 'sock-1', tokenOf(store, code, 'sock-2'));
    expect(store.writeVotePhaseComplete(code)).toBe(false);
    store.writeVote(code, 'sock-2', tokenOf(store, code, 'sock-0'));
    expect(store.writeVotePhaseComplete(code)).toBe(true);
  });
});

describe('WRITE_REVEAL', () => {
  it('reveals each answer with its author + vote count, aggregate only', () => {
    const store = makeStore(() => 0);
    const code = reachWrite(store);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.submitWrite(code, 'sock-1', 'Beta');
    store.submitWrite(code, 'sock-2', 'Gamma');
    store.advancePhase(code); // -> WRITE_VOTE
    store.writeVote(code, 'sock-0', tokenOf(store, code, 'sock-1'));
    store.writeVote(code, 'sock-1', tokenOf(store, code, 'sock-2'));
    store.writeVote(code, 'sock-2', tokenOf(store, code, 'sock-1'));
    expect(store.writeRevealResults(code)).toBeNull(); // still WRITE_VOTE
    store.advancePhase(code); // -> WRITE_REVEAL
    const results = store.writeRevealResults(code)!;
    expect(results.length).toBe(3);
    const beta = results.find((r) => r.text === 'Beta')!;
    expect(beta.authorNickname).toBe('P1');
    expect(beta.votes).toBe(2); // sock-0 and sock-2 both voted for sock-1
  });

  it('bots write + vote immediately on entry, never blocking the round', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.addBot(code);
    store.addBot(code);
    store.startGame(code, 5);
    let g = 0;
    while (store.get(code)!.phase !== 'WRITE' && g++ < 120) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        store.vote(code, 'sock-0', 'A');
      }
      if (store.get(code)!.phase === 'GROUP_MIND') store.groupMindSubmit(code, 'sock-0', 'A', 'A');
    }
    const room = store.get(code)!;
    const botIds = [...room.players.values()].filter((p) => p.isBot).map((p) => p.id);
    for (const id of botIds) expect(room.writeAnswers.has(id)).toBe(true);
    store.submitWrite(code, 'sock-0', 'Alpha');
    store.advancePhase(code); // -> WRITE_VOTE
    for (const id of botIds) expect(store.get(code)!.writeVotes.has(id)).toBe(true);
  });
});
