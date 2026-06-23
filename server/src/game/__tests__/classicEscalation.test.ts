import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { Deck, COMPLESSITA_RANK, type Dilemma, type ContentRegister, type Complessita } from '../deck';

const mk = (id: string, complessita: Complessita): Dilemma => ({
  id,
  text: `dilemma ${id}?`,
  optionA: 'A',
  optionB: 'B',
  register: 'vita',
  complessita,
  spuntiA: ['x', 'y'],
  spuntiB: ['x', 'y'],
});

// A mixed-complexity pool (deliberately out of order) with enough for a maratona.
const POOL: Dilemma[] = [
  mk('p1', 'power'), mk('a1', 'alto'), mk('m1', 'max'), mk('p2', 'power'),
  mk('a2', 'alto'), mk('m2', 'max'), mk('a3', 'alto'), mk('m3', 'max'),
  mk('p3', 'power'), mk('a4', 'alto'),
];
const makeDeck = (_r: ContentRegister) => new Deck(POOL, () => 0);
const makeStore = () => new RoomStore(generateRoomCode, () => 0, makeDeck, () => 0);

const rank = (d: Dilemma) => COMPLESSITA_RANK[d.complessita ?? 'alto'];

describe('Classic: escalation di complessità (alto → max → power)', () => {
  it('ordina la sequenza per complessità crescente', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 7); // classica "maratona"
    const plan = store.get(code)!.plannedDilemmas;
    expect(plan.length).toBe(7);
    for (let i = 1; i < plan.length; i++) {
      expect(rank(plan[i])).toBeGreaterThanOrEqual(rank(plan[i - 1]));
    }
    expect(plan[0].complessita).toBe('alto');
    expect(plan.at(-1)!.complessita).toBe('power');
  });

  it('i dilemmi escono in ordine di complessità non decrescente durante la partita', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 5);
    const room = store.get(code)!;
    const seen: number[] = [];
    for (let i = 0; i < 600 && room.phase !== 'FINAL_AWARDS'; i++) {
      const r = store.advancePhase(code);
      if (!r.ok) break;
      if (room.phase === 'DILEMMA_REVEAL' && room.currentDilemma) seen.push(rank(room.currentDilemma));
    }
    expect(seen.length).toBe(5);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('i dilemmi scritti dai giocatori aprono la partita (warm-up “alto”)', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `s${i}`, `P${i}`);
    store.submitDilemma(code, 's0', 'Una mia domanda?', 'Sì', 'No');
    store.startGame(code, 5);
    const plan = store.get(code)!.plannedDilemmas;
    expect(plan[0].id.startsWith('usr-')).toBe(true);
  });
});
