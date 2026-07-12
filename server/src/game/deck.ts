// The deck of dilemmas. Loaded once from server/data/dilemmas.json and drawn
// without repeats within a single game. Randomness is injectable so draw order
// is deterministically testable (mirrors RoomStore's genCode pattern).

import { readFileSync } from 'fs';
import { join } from 'path';

/** Content register: 'misto' is a filter meaning "any". */
export type ContentRegister = 'vita' | 'business' | 'carriera' | 'misto';

/**
 * A 1-based "tappa" (life chapter / depth level) for the "Percorso" mode. Higher
 * = a later, deeper chapter of life. Absent on a dilemma means it is NOT part of
 * a percorso (classic 3/5/7 mode ignores this field entirely).
 */
export type Tappa = 1 | 2 | 3 | 4;

/**
 * Cross-cutting debate-complexity tier (a universal difficulty ladder, present on
 * every dilemma — classic and percorso). Ascending: 'sorbetto' (light/absurd,
 * low-stakes, high-friction fun — the "permesso di ridere" warm-up tier) <
 * 'alto' (real, accessible stakes) < 'max' (heavy personal/relational stakes) <
 * 'power' (existential / moral / taboo).
 */
export type Complessita = 'sorbetto' | 'alto' | 'max' | 'power';

/** Ascending rank of a complexity tier (for ordering an escalation). */
export const COMPLESSITA_RANK: Record<Complessita, number> = { sorbetto: -1, alto: 0, max: 1, power: 2 };

export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business' | 'carriera';
  /** Percorso chapter/level (1..4); absent ⇒ classic-only dilemma. */
  tappa?: Tappa;
  /** Debate-complexity tier (alto < max < power). Present on every curated dilemma. */
  complessita?: Complessita;
  /**
   * Flags an especially heavy theme (euthanasia, grief, ...) among the 'power'
   * dilemmas. Excluded from the classic draw by default; the leader must
   * opt in (2.2's "tema delicato" toggle) to make it eligible.
   */
  delicato?: boolean;
  /**
   * "Contenuto combinatorio sul roster" (5.3): a template whose text/options
   * embed a `{nome}` placeholder, filled in with a random player's nickname
   * on each DILEMMA_REVEAL (rosterDilemmas.ts) — the same template reads
   * differently every game, so it's exempt from the "già visto" exclusion
   * (deviceSeenIds/excludeDilemmaIds) and never truly gets "consumed".
   */
  roster?: boolean;
  /**
   * "Igiene del pool" (5.4): groups near-duplicate dilemmas (same premise,
   * different wording) so at most one member plays in a single game —
   * dilemmaPlan.ts's buildClassicPlan enforces it. Absent ⇒ not part of any
   * family (the common case).
   */
  famiglia?: string;
  /**
   * "Igiene del pool" (5.4): the content author's expectation of how the vote
   * splits — 'equilibrato' invites real debate; 'sbilanciato' tends toward a
   * near-unanimous vote (still worth keeping around, just not back to back —
   * dilemmaPlan.ts's pacing spaces them out so they don't "uccidere il
   * round" two in a row). Absent ⇒ no signal either way.
   */
  bilanciamento?: 'equilibrato' | 'sbilanciato';
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
 * The evening's mood (2.2's setup selector): 'leggera' keeps things sorbetto +
 * alto (no existential 'power' stakes); 'mista' (default) is the full mix;
 * 'profonda' skips the sorbetto warm-up tier and leans into max/power.
 */
export type Mood = 'leggera' | 'mista' | 'profonda';

/**
 * Filter a dilemma pool by mood, then by the delicate-theme opt-in (excluding
 * `delicato` dilemmas unless the leader explicitly opted in). Applied before
 * drawing, so the pacing pass (dilemmaPlan.ts) only ever sees eligible cards.
 */
export function filterByMood(pool: Dilemma[], mood: Mood, delicatoOptIn: boolean): Dilemma[] {
  const withoutDelicate = delicatoOptIn ? pool : pool.filter((d) => !d.delicato);
  if (mood === 'leggera') return withoutDelicate.filter((d) => (d.complessita ?? 'alto') !== 'power');
  if (mood === 'profonda') return withoutDelicate.filter((d) => (d.complessita ?? 'alto') !== 'sorbetto');
  return withoutDelicate;
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

  /** Return drawn-but-unused cards to the deck (e.g. set-asides from a
   * mid-game replacement draw) so they stay available for later draws. */
  putBack(dilemmas: Dilemma[]): void {
    this.remaining.push(...dilemmas);
  }
}
