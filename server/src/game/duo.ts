// "Percorso in 2" helpers: the pure pieces of the rebuilt 1v1 — the act plan
// (how many dilemmas each act plays), side assignments, waver scoring, and the
// couple-portrait readers. The stateful transition (advanceDuoPhase) stays in
// rooms.ts because it drives timers/clock; these are pure given a Room.

// actForIndex lives in phases.ts (nextDuoPhase needs it and phases.ts must not
// import from here — rooms.ts already imports phases, and a value import in the
// other direction would close a require cycle); re-exported for callers that
// think in duo terms.
export { actForIndex } from './phases';

/** Act sizes (Sintonia / A parti invertite / Schierati) per leader wire value. */
const ACT_SPLITS: Record<number, [number, number, number]> = {
  3: [2, 1, 1], // assaggio → 4 dilemmi
  5: [3, 2, 2], // classica → 7 dilemmi
  7: [4, 3, 3], // maratona → 10 dilemmi
};

/**
 * Map the leader's session-format dilemma count (3/5/7, the group wire value)
 * to the three acts' sizes; unexpected values fall back to the classica split.
 */
export function buildDuoActPlan(dilemmaCount: number): [number, number, number] {
  const split = ACT_SPLITS[dilemmaCount] ?? ACT_SPLITS[5];
  return [...split];
}

/** Expand act sizes into the per-dilemma act list: [2,1,1] → [1,1,2,3]. */
export function expandActs(plan: number[]): number[] {
  return plan.flatMap((size, i) => Array<number>(size).fill(i + 1));
}
