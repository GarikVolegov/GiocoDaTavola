import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type GamePhase, type Story } from '../rooms';
import { Deck, type ContentRegister } from '../deck';

function sceneFix(id: string) {
  return {
    id,
    narration: `Narrazione ${id}.`,
    bivio: {
      text: `Bivio ${id}?`,
      optionA: `A-${id}`,
      optionB: `B-${id}`,
      spuntiA: ['a1', 'a2'],
      spuntiB: ['b1', 'b2'],
    },
    consequenceA: `CA-${id}`,
    consequenceB: `CB-${id}`,
  };
}

const TEST_STORY: Story = {
  id: 'prova',
  title: 'Prova',
  genre: 'scifi',
  emoji: '🛰️',
  hook: 'Un gancio.',
  protagonist: 'Eroe',
  premessa: 'La premessa.',
  acts: [
    { id: 'a0', title: 'Atto I', scenes: [sceneFix('s1')] },
    { id: 'a1', title: 'Atto II', scenes: [sceneFix('s2')] },
  ],
  epiloghi: [
    { minA: 0, maxA: 1, text: 'Finale-basso' },
    { minA: 2, maxA: 2, text: 'Finale-alto' },
  ],
  durataStimaMin: 20,
};

const stubDeck = (_r: ContentRegister) => new Deck([], () => 0);
const makeStore = () =>
  new RoomStore(generateRoomCode, () => 0, stubDeck, () => 0, () => [TEST_STORY]);

function startStoria(
  store: RoomStore,
  players: number,
  storyId = 'prova',
  infiltrato = false,
  squadre = false,
) {
  const { code } = store.create();
  for (let i = 0; i < players; i++) store.join(code, `sock-${i}`, `P${i}`);
  const res = store.startGame(code, 0, 'misto', 'gruppo', infiltrato, squadre, undefined, { storyId });
  return { code, res };
}

/** Force-advance, optionally pinning each closed crossroads' second vote to `side`. */
function walk(store: RoomStore, code: string, side?: 'A' | 'B', maxSteps = 400): GamePhase[] {
  const seq: GamePhase[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const room = store.get(code)!;
    // The decision is read when leaving PHASE_RESULTS — pin the votes first.
    if (side && room.phase === 'PHASE_RESULTS') {
      room.votes = new Map([...room.players.keys()].map((id) => [id, side] as const));
    }
    const r = store.advancePhase(code);
    if (!r.ok) break;
    const phase = store.get(code)!.phase;
    seq.push(phase);
    if (phase === 'FINAL_AWARDS') break;
  }
  return seq;
}

describe('startGame — modalità Storia', () => {
  it('costruisce il piano: format/story/scene parallele e dilemmaCount derivato', () => {
    const store = makeStore();
    const { code, res } = startStoria(store, 3);
    expect(res.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.format).toBe('storia');
    expect(room.storyId).toBe('prova');
    expect(room.story?.title).toBe('Prova');
    expect(room.dilemmaCount).toBe(2);
    expect(room.plannedDilemmas).toHaveLength(2);
    expect(room.plannedScenes.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(room.plannedActs).toEqual([0, 1]);
    expect(room.storyDecisions).toEqual([]);
    expect(room.register).toBeNull();
    expect(room.deck).toBeNull();
    expect(room.phase).toBe('PHASE_INTRO');
  });

  it('rifiuta uno storyId sconosciuto', () => {
    const store = makeStore();
    expect(startStoria(store, 3, 'inesistente').res).toEqual({ ok: false, error: 'INVALID_STORIA' });
  });

  it('richiede comunque abbastanza giocatori (gruppo)', () => {
    const store = makeStore();
    expect(startStoria(store, 2).res).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
  });

  it('disabilita i meta-giochi a sorpresa (devil/know/infiltrato/squadre)', () => {
    const store = makeStore();
    const { code, res } = startStoria(store, 5, 'prova', true, true);
    expect(res.ok).toBe(true);
    const room = store.get(code)!;
    expect(room.devilRoundIndex).toBeNull();
    expect(room.knowRoundIndex).toBeNull();
    expect(room.infiltratorId).toBeNull();
    expect(room.teams.size).toBe(0);
  });
});

describe('advancePhase — cammino di una Storia', () => {
  it('cammina da PHASE_INTRO a FINAL_AWARDS con cornici narrative', () => {
    const store = makeStore();
    const { code } = startStoria(store, 3);
    const seq = walk(store, code);
    expect(seq.at(-1)).toBe('FINAL_AWARDS');
    expect(seq.filter((p) => p === 'STORY_INTRO')).toHaveLength(1);
    expect(seq.filter((p) => p === 'SCENE_INTRO')).toHaveLength(2);
    expect(seq.filter((p) => p === 'SCENE_CONSEQUENCE')).toHaveLength(2);
    expect(seq.filter((p) => p === 'STORY_EPILOGUE')).toHaveLength(1);
    expect(seq.filter((p) => p === 'DILEMMA_REVEAL')).toHaveLength(2);
  });

  it('SCENE_INTRO imposta narrazione, atto corrente e pesca il bivio dal piano', () => {
    const store = makeStore();
    const { code } = startStoria(store, 3);
    const room = store.get(code)!;
    store.advancePhase(code); // PHASE_INTRO -> STORY_INTRO
    expect(room.phase).toBe('STORY_INTRO');
    store.advancePhase(code); // STORY_INTRO -> SCENE_INTRO (scena 1)
    expect(room.phase).toBe('SCENE_INTRO');
    expect(room.currentSceneNarration).toBe('Narrazione s1.');
    expect(room.currentAct).toBe(0);
    store.advancePhase(code); // SCENE_INTRO -> DILEMMA_REVEAL (bivio 1)
    expect(room.phase).toBe('DILEMMA_REVEAL');
    expect(room.currentDilemma?.id).toBe(room.plannedDilemmas[0].id);
  });

  it('SCENE_CONSEQUENCE riflette la maggioranza del 2° voto (B) e accumula la decisione', () => {
    const store = makeStore();
    const { code } = startStoria(store, 3);
    const room = store.get(code)!;
    // Advance to the first PHASE_RESULTS.
    for (let i = 0; i < 50 && room.phase !== 'PHASE_RESULTS'; i++) store.advancePhase(code);
    expect(room.phase).toBe('PHASE_RESULTS');
    room.votes = new Map([...room.players.keys()].map((id) => [id, 'B'] as const));
    store.advancePhase(code); // -> SCENE_CONSEQUENCE
    expect(room.phase).toBe('SCENE_CONSEQUENCE');
    expect(room.currentDecision).toBe('B');
    expect(room.currentSceneConsequence).toBe('CB-s1');
    expect(room.storyDecisions).toEqual(['B']);
  });

  it('sceglie l\'epilogo in base al conteggio delle decisioni-A', () => {
    const storeA = makeStore();
    const a = startStoria(storeA, 3).code;
    walk(storeA, a, 'A');
    expect(storeA.get(a)!.storyDecisions).toEqual(['A', 'A']);
    expect(storeA.get(a)!.currentEpilogo).toBe('Finale-alto');

    const storeB = makeStore();
    const b = startStoria(storeB, 3).code;
    walk(storeB, b, 'B');
    expect(storeB.get(b)!.storyDecisions).toEqual(['B', 'B']);
    expect(storeB.get(b)!.currentEpilogo).toBe('Finale-basso');
  });
});

describe('publicStoria — vista secret-safe', () => {
  it('espone prosa + progresso, mai un voto individuale; null in classica', () => {
    const store = makeStore();
    const { code } = startStoria(store, 3);
    store.advancePhase(code); // STORY_INTRO
    store.advancePhase(code); // SCENE_INTRO
    const view = store.publicStoria(code)!;
    expect(view.storyId).toBe('prova');
    expect(view.protagonist).toBe('Eroe');
    expect(view.premessa).toBe('La premessa.');
    expect(view.actTitle).toBe('Atto I');
    expect(view.sceneNarration).toBe('Narrazione s1.');
    expect(view.totalScenes).toBe(2);
    // Secret-safe: no per-player vote field exists on the view.
    expect(Object.keys(view)).not.toContain('votes');

    const { code: classicCode } = store.create();
    for (let i = 0; i < 3; i++) store.join(classicCode, `c${i}`, `C${i}`);
    store.startGame(classicCode, 3);
    expect(store.publicStoria(classicCode)).toBeNull();
  });
});
