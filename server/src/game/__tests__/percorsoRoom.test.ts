import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type GamePhase } from '../rooms';
import { Deck, type Dilemma, type ContentRegister, type Tappa } from '../deck';

// A tagged fixture: 6 dilemmas per tappa (1..4). makeDeck('misto').cards returns
// the whole list, which is how RoomStore sources the percorso pool.
const TAGGED: Dilemma[] = ([1, 2, 3, 4] as Tappa[]).flatMap((t) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `t${t}-${i}`,
    text: `Dilemma ${t}-${i}?`,
    optionA: `A`,
    optionB: `B`,
    register: 'vita' as const,
    tappa: t,
    spuntiA: ['x', 'y'],
    spuntiB: ['x', 'y'],
  })),
);
const makeFixtureDeck = (_register: ContentRegister) => new Deck(TAGGED, () => 0);
const makeStore = (rng: () => number = () => 0) =>
  new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

function startPercorso(
  store: RoomStore,
  players: number,
  opts: { startTappa: number; durata: string },
  infiltrato = false,
) {
  const { code } = store.create();
  for (let i = 0; i < players; i++) store.join(code, `sock-${i}`, `P${i}`);
  const res = store.startGame(code, 0, 'misto', 'gruppo', infiltrato, false, opts);
  return { code, res };
}

/** Force-advance the state machine, collecting the phase visited at each step. */
function walk(store: RoomStore, code: string, maxSteps = 600): GamePhase[] {
  const seq: GamePhase[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const r = store.advancePhase(code);
    if (!r.ok) break;
    const phase = store.get(code)!.phase;
    seq.push(phase);
    if (phase === 'FINAL_AWARDS') break;
  }
  return seq;
}

describe('startGame — modalità Percorso', () => {
  it('costruisce il piano: format/durata/tappe e dilemmaCount derivato', () => {
    const store = makeStore();
    const { code, res } = startPercorso(store, 3, { startTappa: 3, durata: 'corto' });
    expect(res.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.format).toBe('percorso');
    expect(room.durata).toBe('corto');
    expect(room.startTappa).toBe(3);
    expect(room.register).toBeNull();
    // corto = 10 su 2 tappe (3,4) -> 5 + 5
    expect(room.dilemmaCount).toBe(10);
    expect(room.plannedDilemmas).toHaveLength(10);
    expect(room.plannedTappe).toEqual([3, 3, 3, 3, 3, 4, 4, 4, 4, 4]);
    expect(room.currentTappa).toBe(3);
    expect(room.phase).toBe('PHASE_INTRO');
  });

  it('rifiuta una tappa di partenza fuori range', () => {
    const store = makeStore();
    expect(startPercorso(store, 3, { startTappa: 0, durata: 'corto' }).res).toEqual({
      ok: false,
      error: 'INVALID_PERCORSO',
    });
    expect(startPercorso(store, 3, { startTappa: 5, durata: 'corto' }).res).toEqual({
      ok: false,
      error: 'INVALID_PERCORSO',
    });
  });

  it('rifiuta una durata non valida', () => {
    const store = makeStore();
    expect(startPercorso(store, 3, { startTappa: 1, durata: 'xl' }).res).toEqual({
      ok: false,
      error: 'INVALID_PERCORSO',
    });
  });

  it('richiede comunque abbastanza giocatori (gruppo)', () => {
    const store = makeStore();
    expect(startPercorso(store, 2, { startTappa: 1, durata: 'corto' }).res).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_PLAYERS',
    });
  });
});

describe('advancePhase — cammino di un Percorso', () => {
  it('cammina da PHASE_INTRO a FINAL_AWARDS passando per carte e recap di tappa', () => {
    const store = makeStore();
    const { code } = startPercorso(store, 3, { startTappa: 3, durata: 'corto' });
    const seq = walk(store, code);
    expect(seq.at(-1)).toBe('FINAL_AWARDS');
    expect(seq.filter((p) => p === 'TAPPA_INTRO')).toHaveLength(2); // tappa 3 e 4
    expect(seq.filter((p) => p === 'TAPPA_RECAP')).toHaveLength(2); // intermedio + finale
    expect(seq.filter((p) => p === 'DILEMMA_REVEAL')).toHaveLength(10);
  });

  it('pesca i dilemmi dal piano, in ordine, aggiornando la tappa corrente', () => {
    const store = makeStore();
    const { code } = startPercorso(store, 3, { startTappa: 3, durata: 'corto' });
    const room = store.get(code)!;
    // PHASE_INTRO -> TAPPA_INTRO
    store.advancePhase(code);
    expect(room.phase).toBe('TAPPA_INTRO');
    expect(room.currentTappa).toBe(3);
    // TAPPA_INTRO -> DILEMMA_REVEAL (primo dilemma del piano)
    store.advancePhase(code);
    expect(room.phase).toBe('DILEMMA_REVEAL');
    expect(room.currentDilemma?.id).toBe(room.plannedDilemmas[0].id);
    expect(room.currentTappa).toBe(3);
  });

  it('inserisce l\'ACCUSA prima dei premi quando l\'Infiltrato è attivo', () => {
    const store = makeStore();
    const { code, res } = startPercorso(store, 4, { startTappa: 4, durata: 'corto' }, true);
    expect(res.ok).toBe(true);
    expect(store.get(code)!.infiltratorId).not.toBeNull();
    const seq = walk(store, code);
    expect(seq).toContain('ACCUSE');
    expect(seq.indexOf('ACCUSE')).toBeLessThan(seq.indexOf('FINAL_AWARDS'));
  });
});

describe('publicPercorso — vista secret-safe', () => {
  it('espone format/tappe/progresso e nessun voto individuale', () => {
    const store = makeStore();
    const { code } = startPercorso(store, 3, { startTappa: 3, durata: 'corto' });
    const view = store.publicPercorso(code)!;
    expect(view.startTappa).toBe(3);
    expect(view.durata).toBe('corto');
    expect(view.totalDilemmas).toBe(10);
    expect(view.tappe.map((t) => t.id)).toEqual([3, 4]);
    expect(view.tappe.every((t) => t.total === 5)).toBe(true);
  });

  it('è null in modalità classica', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.publicPercorso(code)).toBeNull();
  });
});
