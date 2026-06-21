import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = (rng: () => number) =>
  new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

function startInfiltratoGame(store: RoomStore, humans = 4, count = 3): string {
  const { code } = store.create();
  for (let i = 0; i < humans; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, count, 'misto', 'gruppo', true);
  return code;
}

// Play one full round, casting VOTE_1 / VOTE_2, landing on PHASE_RESULTS.
function playRound(
  store: RoomStore,
  code: string,
  v1: Record<string, VoteChoice>,
  v2: Record<string, VoteChoice> = {},
): void {
  let g = 0;
  while (store.get(code)!.phase !== 'VOTE_1' && g++ < 14) store.advancePhase(code);
  for (const [id, s] of Object.entries(v1)) store.vote(code, id, s);
  g = 0;
  while (store.get(code)!.phase !== 'VOTE_2' && g++ < 14) store.advancePhase(code);
  for (const [id, s] of Object.entries(v2)) store.vote(code, id, s);
  g = 0;
  while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 14) store.advancePhase(code);
}

describe("L'Infiltrato — setup", () => {
  it('assigns a secret infiltrator with >=4 humans', () => {
    const store = makeStore(() => 0);
    const code = startInfiltratoGame(store, 4, 3);
    expect(store.get(code)?.infiltratorId).toBe('sock-0'); // rng=0 picks the first human
  });

  it('rejects the infiltrator with fewer than 4 humans', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    expect(store.startGame(code, 3, 'misto', 'gruppo', true)).toEqual({
      ok: false,
      error: 'INFILTRATO_NEEDS_PLAYERS',
    });
  });

  it('leaves infiltratorId null when not enabled', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)?.infiltratorId).toBeNull();
  });

  it('a normal game skips the ACCUSE phase', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'FINAL_AWARDS' && g++ < 100) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
    expect(store.publicInfiltratoResult(code)).toBeNull();
  });
});

describe("L'Infiltrato — mission, accusation & verdict", () => {
  // Round 1 flips the lead (A 3-1 → B 0-4); rounds 2-3 hold. Devil round (2 with
  // rng=0) doesn't flip. So infiltratorFlips ends at 1.
  function playToAccuse(store: RoomStore, code: string): void {
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'A', 'sock-3': 'B' }, { 'sock-0': 'B', 'sock-1': 'B', 'sock-2': 'B' });
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'A', 'sock-3': 'A' });
    playRound(store, code, { 'sock-0': 'A', 'sock-1': 'A', 'sock-2': 'A', 'sock-3': 'A' });
    store.advancePhase(code); // PHASE_RESULTS (last) -> ACCUSE
  }

  it('routes the end through ACCUSE and counts overturns', () => {
    const store = makeStore(() => 0);
    const code = startInfiltratoGame(store, 4, 3);
    playToAccuse(store, code);
    expect(store.get(code)?.phase).toBe('ACCUSE');
    expect(store.get(code)?.infiltratorFlips).toBe(1);
  });

  it('the infiltrator WINS when they overturned a round and evaded detection', () => {
    const store = makeStore(() => 0);
    const code = startInfiltratoGame(store, 4, 3);
    playToAccuse(store, code);
    // Nobody fingers sock-0 (the infiltrator); sock-1 takes the heat.
    store.accuse(code, 'sock-1', 'sock-2');
    store.accuse(code, 'sock-2', 'sock-1');
    store.accuse(code, 'sock-3', 'sock-1');
    store.accuse(code, 'sock-0', 'sock-3');
    expect(store.allAccused(code)).toBe(true);
    store.advancePhase(code); // ACCUSE -> FINAL_AWARDS
    const r = store.publicInfiltratoResult(code)!;
    expect(r.infiltratorId).toBe('sock-0');
    expect(r.caught).toBe(false);
    expect(r.won).toBe(true);
    expect(r.votesAgainst).toBe(0);
  });

  it('the infiltrator is CAUGHT (and loses) when the group pins them', () => {
    const store = makeStore(() => 0);
    const code = startInfiltratoGame(store, 4, 3);
    playToAccuse(store, code);
    store.accuse(code, 'sock-1', 'sock-0');
    store.accuse(code, 'sock-2', 'sock-0');
    store.accuse(code, 'sock-3', 'sock-0');
    store.accuse(code, 'sock-0', 'sock-1');
    store.advancePhase(code);
    const r = store.publicInfiltratoResult(code)!;
    expect(r.caught).toBe(true);
    expect(r.won).toBe(false);
    expect(r.votesAgainst).toBe(3);
  });

  it('rejects accusations outside ACCUSE, self, or unknown target', () => {
    const store = makeStore(() => 0);
    const code = startInfiltratoGame(store, 4, 3);
    expect(store.accuse(code, 'sock-1', 'sock-0')).toEqual({ ok: false, error: 'NOT_ACCUSE_PHASE' });
    playToAccuse(store, code);
    expect(store.accuse(code, 'sock-1', 'sock-1')).toEqual({ ok: false, error: 'INVALID_TARGET' });
    expect(store.accuse(code, 'ghost', 'sock-0')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });
});
