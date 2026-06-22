// "Percorso" mode: a long, themed session that climbs through life chapters
// ("tappe"), each deeper than the last. Pure planning helpers — no game state —
// so the budget distribution and per-tappa draw are deterministically testable.

import { Deck, dilemmasForTappa, type Dilemma, type Tappa } from './deck';

/** Number of tappe in a full percorso (the summit is the last). */
export const N_TAPPE = 4;

/** Duration presets the host can pick; each maps to a target dilemma budget. */
export const DURATE = ['corto', 'medio', 'lungo'] as const;
export type Durata = (typeof DURATE)[number];

/** Target number of dilemmas per duration preset (~5–6 min/dilemma). Tunable. */
export const DURATA_BUDGET: Record<Durata, number> = {
  corto: 10, // ~1h
  medio: 20, // ~2h
  lungo: 30, // ~3h
};

export function isDurata(v: string): v is Durata {
  return (DURATE as readonly string[]).includes(v);
}

/** Display metadata for a single tappa (mirrored on the client). */
export interface TappaMeta {
  id: Tappa;
  key: 'basi' | 'bivi' | 'legami' | 'bilanci';
  nome: string;
  emoji: string;
  sottotitolo: string;
  descrizione: string;
}

/** The fixed climb: four life chapters, rising in theme and emotional stakes. */
export const TAPPE: readonly TappaMeta[] = [
  {
    id: 1,
    key: 'basi',
    nome: 'Le Basi',
    emoji: '🌱',
    sottotitolo: 'Giovinezza & prime scelte',
    descrizione: 'Indipendenza, studio, soldi vs passione: le scelte di partenza, leggere e quotidiane.',
  },
  {
    id: 2,
    key: 'bivi',
    nome: 'I Bivi',
    emoji: '🔀',
    sottotitolo: 'Carriera, soldi & relazioni',
    descrizione: 'Ambizione vs stabilità, amore vs lavoro: i bivi che indirizzano la vita.',
  },
  {
    id: 3,
    key: 'legami',
    nome: 'I Legami',
    emoji: '🤝',
    sottotitolo: 'Famiglia & responsabilità',
    descrizione: 'Lealtà, sacrifici, io vs gli altri: scelte personali che pesano sugli affetti.',
  },
  {
    id: 4,
    key: 'bilanci',
    nome: 'I Bilanci',
    emoji: '🌅',
    sottotitolo: 'Eredità & senso',
    descrizione: 'Rimpianti, valori, cosa lasci: i dilemmi più profondi ed esistenziali.',
  },
];

/** Clamp an arbitrary number to a valid tappa (1..N_TAPPE). */
export function clampTappa(t: number): Tappa {
  return Math.min(N_TAPPE, Math.max(1, Math.floor(t))) as Tappa;
}

/**
 * Distribute a duration's dilemma budget across the tappe from `startTappa` up to
 * the summit, as evenly as possible. The remainder goes to the DEEPER tappe (so
 * the climax carries a touch more weight). Tappe below the start get 0. This is
 * the pre-cap allocation — the actual plan is capped by available content.
 */
export function allocateBudget(startTappa: number, durata: Durata): Record<Tappa, number> {
  const start = clampTappa(startTappa);
  const budget = DURATA_BUDGET[durata];
  const range: Tappa[] = [];
  for (let t = start; t <= N_TAPPE; t++) range.push(t as Tappa);
  const count = range.length;
  const base = Math.floor(budget / count);
  const rem = budget % count;
  const alloc: Record<Tappa, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  range.forEach((t, i) => {
    // The last `rem` tappe in the range (the deeper ones) get one extra.
    alloc[t] = base + (i >= count - rem ? 1 : 0);
  });
  return alloc;
}

/** How many dilemmas are available per tappa (for capping + host estimates). */
export function tappaCounts(all: Dilemma[]): Record<Tappa, number> {
  return {
    1: dilemmasForTappa(all, 1).length,
    2: dilemmasForTappa(all, 2).length,
    3: dilemmasForTappa(all, 3).length,
    4: dilemmasForTappa(all, 4).length,
  };
}

/** A planned ascent: the ordered dilemmas plus the tappa each belongs to. */
export interface PercorsoPlan {
  dilemmas: Dilemma[];
  /** Parallel to `dilemmas`: tappe[i] is the tappa of dilemmas[i] (ascending). */
  tappe: number[];
}

/**
 * Build the ordered dilemma sequence for a percorso: from `startTappa` to the
 * summit, drawing each tappa's allocation (without repeats) from its own pool.
 * Drawing reuses the (tested) Deck so it's deterministic with an injected rng.
 * If a tappa's pool is smaller than its allocation the plan is naturally shorter.
 */
export function buildPercorsoPlan(
  all: Dilemma[],
  startTappa: number,
  durata: Durata,
  rng: () => number = Math.random,
): PercorsoPlan {
  const alloc = allocateBudget(startTappa, durata);
  const start = clampTappa(startTappa);
  const dilemmas: Dilemma[] = [];
  const tappe: number[] = [];
  for (let t = start; t <= N_TAPPE; t++) {
    const deck = new Deck(dilemmasForTappa(all, t as Tappa), rng);
    const take = Math.min(alloc[t as Tappa], deck.remainingCount);
    for (let i = 0; i < take; i++) {
      const d = deck.draw();
      if (d) {
        dilemmas.push(d);
        tappe.push(t);
      }
    }
  }
  return { dilemmas, tappe };
}

/** Actual planned length given availability (host's live estimate, capped). */
export function planSize(all: Dilemma[], startTappa: number, durata: Durata): number {
  const alloc = allocateBudget(startTappa, durata);
  const counts = tappaCounts(all);
  let total = 0;
  for (let t = 1 as Tappa; t <= N_TAPPE; t = (t + 1) as Tappa) {
    total += Math.min(alloc[t], counts[t]);
  }
  return total;
}
