import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { computeAwards, type PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

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
const makeStore = (rng: () => number) =>
  new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return {
    rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0,
    persuasion: 0, defendedCount: 0, ...over,
  };
}

// Drive a 5-round game (devil=2, know=3 with rng=()=>0) to PREDICT of the know
// round, casting `sides` each VOTE_1 (so round 3's first votes are known).
function reachKnowPredict(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 5);
  let g = 0;
  while (!(store.get(code)!.phase === 'PREDICT' && store.get(code)!.dilemmaIndex === 3) && g++ < 80) {
    store.advancePhase(code);
    if (store.get(code)!.phase === 'VOTE_1') sides.forEach((s, i) => store.vote(code, `sock-${i}`, s));
  }
  return code;
}

describe('Quanto mi conosci — round selection', () => {
  it('has no know round in short games, a distinct one in longer games', () => {
    const s3 = makeStore(() => 0);
    const { code: c3 } = s3.create();
    for (let i = 0; i < 3; i++) s3.join(c3, `p${i}`, `P${i}`);
    s3.startGame(c3, 3);
    expect(s3.get(c3)?.knowRoundIndex).toBeNull();

    const s5 = makeStore(() => 0);
    const { code: c5 } = s5.create();
    for (let i = 0; i < 3; i++) s5.join(c5, `p${i}`, `P${i}`);
    s5.startGame(c5, 5);
    expect(s5.get(c5)?.devilRoundIndex).toBe(2);
    expect(s5.get(c5)?.knowRoundIndex).toBe(3);
  });
});

describe('Quanto mi conosci — guessing', () => {
  it('assigns a ring + accepts guesses only in the know round', () => {
    const store = makeStore(() => 0);
    const code = reachKnowPredict(store, ['A', 'B', 'B']);
    expect(store.get(code)?.phase).toBe('PREDICT');
    expect(store.get(code)?.dilemmaIndex).toBe(3);
    const pairs = store.publicKnowPairs(code)!;
    expect(pairs.length).toBe(3);
    expect(pairs.find((p) => p.guesserId === 'sock-0')?.targetId).toBe('sock-1');
    expect(store.knowGuess(code, 'sock-0', 'B').ok).toBe(true);
    expect(store.knowGuess(code, 'sock-0', 'nope').ok).toBe(false);
    expect(store.knowGuess(code, 'ghost', 'A')).toEqual({ ok: false, error: 'NO_TARGET' });
  });

  it('rejects a guess in a normal round and hides the ring', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 5);
    let g = 0;
    while (!(store.get(code)!.phase === 'PREDICT' && store.get(code)!.dilemmaIndex === 1) && g++ < 12) {
      store.advancePhase(code);
    }
    expect(store.publicKnowPairs(code)).toBeNull();
    expect(store.knowGuess(code, 'sock-0', 'A')).toEqual({ ok: false, error: 'NOT_KNOW_PHASE' });
  });

  it('credits knowCorrect for guessers who read their target right', () => {
    const store = makeStore(() => 0);
    const code = reachKnowPredict(store, ['A', 'B', 'B']);
    // ring: sock-0->sock-1 (B), sock-1->sock-2 (B), sock-2->sock-0 (A)
    store.knowGuess(code, 'sock-0', 'B'); // correct
    store.knowGuess(code, 'sock-1', 'A'); // wrong (target voted B)
    store.knowGuess(code, 'sock-2', 'A'); // correct
    expect(store.allKnowGuessed(code)).toBe(true);
    let g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 8) store.advancePhase(code);
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')?.knowCorrect).toBe(1);
    expect(stats.get('sock-1')?.knowCorrect ?? 0).toBe(0);
    expect(stats.get('sock-2')?.knowCorrect).toBe(1);
  });

  it('awards Il Telepate to the top knowCorrect player', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.join(code, 'sock-1', 'Bob');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ knowCorrect: 2 }));
    room.stats.set('sock-1', baseStats({ knowCorrect: 1 }));
    expect(computeAwards(room).find((a) => a.id === 'telepate')?.winner.id).toBe('sock-0');
  });
});
