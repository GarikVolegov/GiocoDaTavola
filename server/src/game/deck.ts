// The deck of dilemmas. Loaded once from server/data/dilemmas.json and drawn
// without repeats within a single game. Randomness is injectable so draw order
// is deterministically testable (mirrors RoomStore's genCode pattern).

import { readFileSync } from 'fs';
import { join } from 'path';

/** Content register: 'misto' is a filter meaning "any". */
export type ContentRegister = 'vita' | 'business' | 'misto';

/**
 * A 1-based "tappa" (life chapter / depth level) for the "Percorso" mode. Higher
 * = a later, deeper chapter of life. Absent on a dilemma means it is NOT part of
 * a percorso (classic 3/5/7 mode ignores this field entirely).
 */
export type Tappa = 1 | 2 | 3 | 4;

export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business';
  /** Percorso chapter/level (1..4); absent ⇒ classic-only dilemma. */
  tappa?: Tappa;
  /** 2–3 talking points for someone defending side A (optionA). */
  spuntiA: string[];
  /** 2–3 talking points for someone defending side B (optionB). */
  spuntiB: string[];
}

/** Dilemmas matching a register; 'misto' returns the whole pool. */
export function dilemmasForRegister(all: Dilemma[], register: ContentRegister): Dilemma[] {
  if (register === 'misto') return all;
  return all.filter((d) => d.register === register);
}

/**
 * Dilemmas belonging to a given percorso tappa. Dilemmas without a `tappa` are
 * never returned — they belong to the classic (untagged) pool only.
 */
export function dilemmasForTappa(all: Dilemma[], tappa: Tappa): Dilemma[] {
  return all.filter((d) => d.tappa === tappa);
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

  /** A copy of the cards still available to draw (for snapshotting the deck). */
  get cards(): Dilemma[] {
    return [...this.remaining];
  }

  /** Draw one random dilemma (without repeats), or null if the deck is empty. */
  draw(): Dilemma | null {
    if (this.remaining.length === 0) return null;
    const index = Math.floor(this.rng() * this.remaining.length);
    const [picked] = this.remaining.splice(index, 1);
    return picked;
  }
}
