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
  it('plays player-submitted dilemmas BEFORE the official deck', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.submitDilemma(code, 'sock-0', 'Mio dilemma?', 'Sì', 'No');
    store.startGame(code, 3);
    store.advancePhase(code); // DILEMMA_REVEAL (round 1)
    expect(store.get(code)?.currentDilemma?.id).toBe('usr-sock-0-1');
    expect(store.get(code)?.currentDilemma?.text).toBe('Mio dilemma?');
  });

  it('credits authoredSwing to the author when the round changes minds', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.submitDilemma(code, 'sock-0', 'D?', 'A!', 'B!');
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.phase !== 'VOTE_1' && g++ < 10) store.advancePhase(code);
    expect(store.get(code)?.currentDilemma?.id).toBe('usr-sock-0-1'); // round 1 is the submitted one
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
});
