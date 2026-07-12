import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { computeAwards, type PlayerStats } from '../awards';
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

function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return {
    rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0,
    persuasion: 0, defendedCount: 0, ...over,
  };
}

describe('Dilemmi dai giocatori — submission', () => {
  it('accepts a valid lobby submission and trims it', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    const r = store.submitDilemma(code, 'sock-0', '  Domanda?  ', ' Sì ', ' No ');
    expect(r.ok).toBe(true);
    const d = store.get(code)!.submittedDilemmas[0];
    expect(d.text).toBe('Domanda?');
    expect(d.optionA).toBe('Sì');
    expect(d.optionB).toBe('No');
    expect(store.get(code)!.dilemmaAuthors.get(d.id)).toBe('sock-0');
  });

  it('validates empty / duplicate / too-long / not-in-room', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    expect(store.submitDilemma(code, 'sock-0', '', 'A', 'B')).toEqual({ ok: false, error: 'EMPTY' });
    expect(store.submitDilemma(code, 'sock-0', 'D', 'same', 'SAME')).toEqual({ ok: false, error: 'SAME_OPTIONS' });
    expect(store.submitDilemma(code, 'sock-0', 'x'.repeat(201), 'A', 'B')).toEqual({ ok: false, error: 'TOO_LONG' });
    expect(store.submitDilemma(code, 'ghost', 'D', 'A', 'B')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('caps submissions at 2 per player', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'P0');
    expect(store.submitDilemma(code, 'sock-0', 'D1', 'A', 'B')).toMatchObject({ ok: true, count: 1 });
    expect(store.submitDilemma(code, 'sock-0', 'D2', 'A', 'B')).toMatchObject({ ok: true, count: 2 });
    expect(store.submitDilemma(code, 'sock-0', 'D3', 'A', 'B')).toEqual({ ok: false, error: 'LIMIT_REACHED' });
    expect(store.submittedCount(code)).toBe(2);
  });

  it('rejects submissions outside the lobby', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.submitDilemma(code, 'sock-0', 'D', 'A', 'B')).toEqual({ ok: false, error: 'NOT_LOBBY' });
  });
});

describe('Dilemmi dai giocatori — play order & award', () => {
  it('plays player-submitted dilemmas during the game, spread out rather than opening it (5.2)', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.submitDilemma(code, 'sock-0', 'Mio dilemma?', 'Sì', 'No');
    store.startGame(code, 3);
    const plan = store.get(code)!.plannedDilemmas;
    expect(plan.map((d) => d.id)).toContain('usr-sock-0-1'); // still played…
    expect(plan[0].id).not.toBe('usr-sock-0-1'); // …but the deck opens instead
    store.advancePhase(code); // DILEMMA_REVEAL (round 1)
    expect(store.get(code)?.currentDilemma?.text).not.toBe('Mio dilemma?');
  });

  it('credits authoredSwing to the author when the round changes minds', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.submitDilemma(code, 'sock-0', 'D?', 'A!', 'B!');
    store.startGame(code, 3);
    // Walk to whichever round plays the submitted dilemma (5.2: no longer
    // guaranteed to be round 1).
    let g = 0;
    while (store.get(code)!.currentDilemma?.id !== 'usr-sock-0-1' && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        // Split vote: an all-A first vote would skip + REPLACE the dilemma
        // (UNANIMOUS_REVEAL) — and could discard the submitted one this walk hunts.
        ['sock-0', 'sock-1', 'sock-2'].forEach((id, i) => store.vote(code, id, i === 0 ? 'A' : 'B'));
      }
    }
    expect(store.get(code)?.currentDilemma?.id).toBe('usr-sock-0-1');
    g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'A');
    store.vote(code, 'sock-2', 'B');
    g = 0;
    while (store.get(code)!.phase !== 'VOTE_2' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-1', 'B'); // 1 mind changed
    g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 6) store.advancePhase(code);
    expect(store.get(code)?.stats.get('sock-0')?.authoredSwing).toBe(1);
  });

  it("awards L'Autore to the top authoredSwing player", () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.join(code, 'sock-1', 'Bob');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ authoredSwing: 4 }));
    room.stats.set('sock-1', baseStats({ authoredSwing: 1 }));
    expect(computeAwards(room).find((a) => a.id === 'autore')?.winner.id).toBe('sock-0');
  });

  it('credits authoredBestBalance from the round\'s final split, keeping the closest-to-50/50 across rounds (5.2)', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.submitDilemma(code, 'sock-0', 'D?', 'A!', 'B!');
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.currentDilemma?.id !== 'usr-sock-0-1' && g++ < 20) {
      store.advancePhase(code);
      if (store.get(code)!.phase === 'VOTE_1' || store.get(code)!.phase === 'VOTE_2') {
        // Split vote: an all-A first vote would skip + REPLACE the dilemma
        // (UNANIMOUS_REVEAL) — and could discard the submitted one this walk hunts.
        ['sock-0', 'sock-1', 'sock-2'].forEach((id, i) => store.vote(code, id, i === 0 ? 'A' : 'B'));
      }
    }
    g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    store.vote(code, 'sock-1', 'B');
    store.vote(code, 'sock-2', 'A'); // final split 2-1 -> balance = 1/3
    g = 0;
    while (store.get(code)!.phase !== 'PHASE_RESULTS' && g++ < 8) store.advancePhase(code);
    const balance = store.get(code)?.stats.get('sock-0')?.authoredBestBalance;
    expect(balance).toBeCloseTo(1 / 3);
  });

  it("awards Spacca la Stanza to the author whose dilemma split closest to 50/50", () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    store.join(code, 'sock-1', 'Bob');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ authoredBestBalance: 0.5 })); // perfect split
    room.stats.set('sock-1', baseStats({ authoredBestBalance: 0.1 })); // lopsided
    expect(computeAwards(room).find((a) => a.id === 'spaccalastanza')?.winner.id).toBe('sock-0');
  });

  it('omits Spacca la Stanza when no submitted dilemma was ever played', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'Ann');
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats());
    expect(computeAwards(room).find((a) => a.id === 'spaccalastanza')).toBeUndefined();
  });
});
