import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { computeAwards, type PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = (rng: () => number) =>
  new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, ...over };
}

// Drive a fresh group room to PREDICT of round 1 (normal round; devil round is 2
// with rng=()=>0), applying the given VOTE_1 choices for sock-0..n.
function reachPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3);
  store.advancePhase(code); // DILEMMA_REVEAL
  store.advancePhase(code); // VOTE_1
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  return code;
}

// From PREDICT, walk to VOTE_2, apply the given re-votes, then land on PHASE_RESULTS.
function resolveRound(store: RoomStore, code: string, revotes: Record<string, VoteChoice>): void {
  let g = 0;
  while (store.get(code)!.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
  for (const [id, side] of Object.entries(revotes)) store.vote(code, id, side);
  g = 0;
  while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) store.advancePhase(code);
}

describe('Scommetti sul ribaltone — bet recording', () => {
  it('accepts a swing bet only during PREDICT, with a valid value', () => {
    const store = makeStore(() => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    expect(store.get(code)?.phase).toBe('PREDICT');
    expect(store.swingBet(code, 'sock-0', 'ribalta').ok).toBe(true);
    expect(store.get(code)?.swingBets.get('sock-0')).toBe('ribalta');
    expect(store.swingBet(code, 'sock-0', 'nope').ok).toBe(false); // invalid value
    expect(store.swingBet(code, 'ghost', 'regge').ok).toBe(false); // not in room
    expect(store.swingBet('ZZZZ', 'sock-0', 'regge').ok).toBe(false); // no room
  });

  it('rejects a swing bet outside PREDICT', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // PHASE_INTRO
    expect(store.swingBet(code, 'sock-0', 'ribalta')).toEqual({
      ok: false,
      error: 'NOT_PREDICT_PHASE',
    });
  });

  it('reports allSwingBet + count once every human has bet', () => {
    const store = makeStore(() => 0);
    const code = reachPredict(store, ['A', 'A', 'B']);
    expect(store.allSwingBet(code)).toBe(false);
    store.swingBet(code, 'sock-0', 'ribalta');
    store.swingBet(code, 'sock-1', 'regge');
    expect(store.allSwingBet(code)).toBe(false);
    store.swingBet(code, 'sock-2', 'regge');
    expect(store.allSwingBet(code)).toBe(true);
    expect(store.swingBetCount(code)).toBe(3);
  });
});

describe('Scommetti sul ribaltone — resolution & award', () => {
  it("credits 'ribalta' bettors when the lead flips", () => {
    const store = makeStore(() => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // lead A (2-1)
    store.swingBet(code, 'sock-0', 'ribalta');
    store.swingBet(code, 'sock-1', 'regge');
    store.swingBet(code, 'sock-2', 'ribalta');
    resolveRound(store, code, { 'sock-0': 'B' }); // now A=1 B=2 -> lead flips to B
    const results = store.swingBetResults(code);
    expect(results.every((r) => r.flipped)).toBe(true);
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')?.correctSwingBets).toBe(1);
    expect(stats.get('sock-2')?.correctSwingBets).toBe(1);
    expect(stats.get('sock-1')?.correctSwingBets ?? 0).toBe(0); // bet regge, but it flipped
  });

  it("credits 'regge' bettors when the lead holds", () => {
    const store = makeStore(() => 0);
    const code = reachPredict(store, ['A', 'A', 'B']); // lead A
    store.swingBet(code, 'sock-0', 'regge');
    store.swingBet(code, 'sock-1', 'ribalta');
    resolveRound(store, code, {}); // nobody changes -> lead holds A
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')?.correctSwingBets).toBe(1);
    expect(stats.get('sock-1')?.correctSwingBets ?? 0).toBe(0);
  });

  it('awards Il Sensitivo to the top correctSwingBets player', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.join(code, 'sock-1', 'Bob');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ correctSwingBets: 3 }));
    room.stats.set('sock-1', baseStats({ correctSwingBets: 1 }));
    expect(computeAwards(room).find((a) => a.id === 'sensitivo')?.winner.id).toBe('sock-0');
  });

  it('omits Il Sensitivo when nobody bet right', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({}));
    expect(computeAwards(room).find((a) => a.id === 'sensitivo')).toBeUndefined();
  });
});
