// The deck of dilemmas. Loaded once from server/data/dilemmas.json and drawn
// without repeats within a single game. Randomness is injectable so draw order
// is deterministically testable (mirrors RoomStore's genCode pattern).

import { readFileSync } from 'fs';
import { join } from 'path';

/** Content register: 'misto' is a filter meaning "any". */
export type ContentRegister = 'vita' | 'business' | 'misto';

export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business';
}

/** Dilemmas matching a register; 'misto' returns the whole pool. */
export function dilemmasForRegister(all: Dilemma[], register: ContentRegister): Dilemma[] {
  if (register === 'misto') return all;
  return all.filter((d) => d.register === register);
}

/**
 * Load the dilemma deck from server/data/dilemmas.json. The path is resolved
 * from __dirname so it works both in dev (tsx: server/src/game) and in the
 * compiled build (server/dist/game) — the data dir lives at server/data in both.
 */
export function loadDilemmas(): Dilemma[] {
  const file = join(__dirname, '..', '..', 'data', 'dilemmas.json');
  return JSON.parse(readFileSync(file, 'utf-8')) as Dilemma[];
}

/**
 * A shuffled-on-demand deck: each draw removes one dilemma at random so there
 * are no repeats within a single game. Returns null once exhausted. The source
 * array is never mutated.
 */
export class Deck {
  private readonly remaining: Dilemma[];

  constructor(
    dilemmas: Dilemma[],
    private readonly rng: () => number = Math.random,
  ) {
    this.remaining = [...dilemmas];
  }

  /** How many dilemmas are still available to draw. */
  get remainingCount(): number {
    return this.remaining.length;
  }

  /** Draw one random dilemma (without repeats), or null if the deck is empty. */
  draw(): Dilemma | null {
    if (this.remaining.length === 0) return null;
    const index = Math.floor(this.rng() * this.remaining.length);
    const [picked] = this.remaining.splice(index, 1);
    return picked;
  }
}
