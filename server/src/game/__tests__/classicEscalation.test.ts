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
  // 2.1's pacing pass (round 1 leggero, mai due max/power consecutivi, power
  // mai primo né ultimo) deliberately relocates 'power' away from the edges,
  // which can break STRICT ascending order — so these checks assert the
  // pacing invariants instead of `rank(i) >= rank(i-1)` for every step.
  it('non apre né chiude la partita con un dilemma "power"', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `s${i}`, `P${i}`);
    store.startGame(code, 7); // classica "maratona"
    const plan = store.get(code)!.plannedDilemmas;
    expect(plan.length).toBe(7);
    expect(plan[0].complessita).not.toBe('power');
    expect(plan.at(-1)!.complessita).not.toBe('power');
  });

  it('non apre né chiude la partita con "power" durante il gioco reale', () => {
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
    expect(seen[0]).not.toBe(COMPLESSITA_RANK.power);
    expect(seen.at(-1)).not.toBe(COMPLESSITA_RANK.power);
  });

  it('i dilemmi scritti dai giocatori entrano in gioco ma non aprono la partita quando il mazzo offre un\'alternativa (5.2, "non bruciati in testa")', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `s${i}`, `P${i}`);
    store.submitDilemma(code, 's0', 'Una mia domanda?', 'Sì', 'No');
    store.startGame(code, 5);
    const plan = store.get(code)!.plannedDilemmas;
    expect(plan.some((d) => d.id.startsWith('usr-'))).toBe(true); // still played…
    expect(plan[0].id.startsWith('usr-')).toBe(false); // …but not as the opener
  });
});
