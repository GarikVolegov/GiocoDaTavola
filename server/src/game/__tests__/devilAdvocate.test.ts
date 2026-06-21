import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type VoteChoice } from '../rooms';
import { computeAwards, type PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

// A small deterministic deck (rng=()=>0 always draws index 0, walking d1,d2,...).
const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);

function makeStore(rng: () => number) {
  return new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);
}

// Base stats record with the five required fields (helps build award fixtures).
function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, ...over };
}

// Drive a group room to DEFENSE of the devil round (round 2, with rng=()=>0).
// Round 1 is walked through with no votes; the given `sides` are this round's
// VOTE_1 choices for sock-0..n.
function reachDevilDefense(store: RoomStore, sides: VoteChoice[]): string {
  const { code } = store.create();
  for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
  store.startGame(code, 3); // devilRoundIndex = 2 with rng=()=>0
  let g = 0;
  while (store.get(code)!.dilemmaIndex !== 2 && g++ < 50) store.advancePhase(code);
  store.advancePhase(code); // VOTE_1 (round 2)
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  store.advancePhase(code); // SPLIT_REVEAL
  store.advancePhase(code); // PREDICT
  store.advancePhase(code); // DEFENSE
  return code;
}

describe('Avvocato del Diavolo — round selection', () => {
  it('picks a devil round in [2..dilemmaCount], never the first', () => {
    const store = makeStore(() => 0); // -> 2 + floor(0 * (n-1)) = 2
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)?.devilRoundIndex).toBe(2);
  });

  it('places the devil round deterministically via rng (last possible round)', () => {
    const store = makeStore(() => 0.999); // 2 + floor(0.999 * 4) = 5
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    store.startGame(code, 5);
    expect(store.get(code)?.devilRoundIndex).toBe(5);
  });

  it('never targets the first round across the rng range', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const store = makeStore(() => r);
      const { code } = store.create();
      for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
      store.startGame(code, 7);
      const idx = store.get(code)!.devilRoundIndex!;
      expect(idx).toBeGreaterThanOrEqual(2);
      expect(idx).toBeLessThanOrEqual(7);
    }
  });

  it('has no devil round in duello mode', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.startGame(code, 3, 'misto', 'duello');
    expect(store.get(code)?.devilRoundIndex).toBeNull();
  });
});

describe('Avvocato del Diavolo — defender selection', () => {
  it('flips each defender to argue the OPPOSITE side in the devil round', () => {
    const store = makeStore(() => 0);
    const code = reachDevilDefense(store, ['A', 'B', 'B']);
    const room = store.get(code);
    expect(room?.phase).toBe('DEFENSE');
    expect(room?.dilemmaIndex).toBe(2);
    expect(room?.devilRoundIndex).toBe(2);
    // A-voter sock-0 argues B; first B-voter sock-1 argues A; both flagged devil.
    expect(room?.defenders).toEqual([
      { id: 'sock-0', nickname: 'P0', side: 'B', devil: true },
      { id: 'sock-1', nickname: 'P1', side: 'A', devil: true },
    ]);
  });

  it('still gives the unpopular side a voice when everyone voted alike', () => {
    const store = makeStore(() => 0);
    const code = reachDevilDefense(store, ['A', 'A', 'A']); // nobody picked B
    // The sole defender is an A-voter forced to argue B.
    expect(store.get(code)?.defenders).toEqual([
      { id: 'sock-0', nickname: 'P0', side: 'B', devil: true },
    ]);
  });

  it('leaves normal rounds untouched (no devil flag, real side defended)', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // devil round = 2, so round 1 is normal
    let g = 0;
    while (!(store.get(code)!.phase === 'DEFENSE' && store.get(code)!.dilemmaIndex === 1) && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1') {
        store.vote(code, 'sock-0', 'A');
        store.vote(code, 'sock-1', 'B');
        store.vote(code, 'sock-2', 'B');
      }
    }
    expect(store.get(code)?.defenders).toEqual([
      { id: 'sock-0', nickname: 'P0', side: 'A' },
      { id: 'sock-1', nickname: 'P1', side: 'B' },
    ]);
  });
});

describe('Avvocato del Diavolo — stats & award', () => {
  it('credits devilPersuasion (a subset of persuasion) in the devil round', () => {
    const store = makeStore(() => 0);
    const code = reachDevilDefense(store, ['A', 'B', 'B']); // sock-0 argues B, sock-1 argues A
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    // sock-0 switches A->B, so the argued side B gains a vote (netSwing B = +1).
    store.vote(code, 'sock-0', 'B');
    g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) store.advancePhase(code);
    const stats = store.get(code)!.stats;
    expect(stats.get('sock-0')?.persuasion).toBe(1);
    expect(stats.get('sock-0')?.devilPersuasion).toBe(1);
    // sock-1 argued A, which lost a vote -> no credit at all.
    expect(stats.get('sock-1')?.devilPersuasion ?? 0).toBe(0);
  });

  it('awards Il Voltagabbana to the top devilPersuasion player', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.join(code, 'sock-1', 'Bob');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ persuasion: 3, devilPersuasion: 2 }));
    room.stats.set('sock-1', baseStats({ persuasion: 5, devilPersuasion: 0 }));
    const awards = computeAwards(room);
    expect(awards.find((a) => a.id === 'voltagabbana')?.winner.id).toBe('sock-0');
    // Persuasore still rewards the overall top persuasion (Bob).
    expect(awards.find((a) => a.id === 'persuasore')?.winner.id).toBe('sock-1');
  });

  it('omits Il Voltagabbana when nobody played devil persuader', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ persuasion: 0 }));
    expect(computeAwards(room).find((a) => a.id === 'voltagabbana')).toBeUndefined();
  });
});

describe('Avvocato del Diavolo — public reveal gating', () => {
  it('exposes the twist from DEFENSE through PHASE_RESULTS', () => {
    const store = makeStore(() => 0);
    const code = reachDevilDefense(store, ['A', 'B', 'B']);
    expect(store.publicDevilRound(code)).toBe(true); // DEFENSE
    let g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) {
      store.advancePhase(code);
      const phase = store.get(code)!.phase;
      if (phase === 'VOTE_2' || phase === 'SPEAKER_VOTE') {
        expect(store.publicDevilRound(code)).toBe(true);
      }
    }
    expect(store.get(code)?.phase).toBe('PHASE_RESULTS');
    expect(store.publicDevilRound(code)).toBe(true);
  });

  it('keeps the twist hidden before DEFENSE and in normal rounds', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3); // devil round = 2
    // Round 1 (normal) reaches DEFENSE -> never devil.
    let g = 0;
    while (!(store.get(code)!.phase === 'DEFENSE' && store.get(code)!.dilemmaIndex === 1) && g++ < 20) {
      store.advancePhase(code);
    }
    expect(store.get(code)?.phase).toBe('DEFENSE');
    expect(store.publicDevilRound(code)).toBe(false);
    // Into round 2 but before DEFENSE (VOTE_1) -> still hidden.
    g = 0;
    while (!(store.get(code)!.phase === 'VOTE_1' && store.get(code)!.dilemmaIndex === 2) && g++ < 20) {
      store.advancePhase(code);
    }
    expect(store.publicDevilRound(code)).toBe(false);
    expect(store.publicDevilRound('ZZZZ')).toBe(false);
  });
});
