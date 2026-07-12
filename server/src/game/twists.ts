// Surprise mechanical twists (4.3): unlike "Vincoli assurdi" (absurdConstraints.ts,
// purely theatrical staging), a twist actually changes how the round plays —
// a shorter defense, no interventions, or an extra defender per side. Drawn
// for a subset of dilemma rounds (never the breather rounds), chosen at
// startGame per the leader's "caos" dial. Type-only import from rooms.ts
// keeps this cycle-free (mirrors absurdConstraints.ts / groupMind.ts).
import type { Room } from './rooms';

export type TwistId = 'difesa-lampo' | 'interventi-vietati' | 'doppio-difensore';

export interface Twist {
  id: TwistId;
  label: string;
  description: string;
}

export const TWISTS: Twist[] = [
  { id: 'difesa-lampo', label: '⚡ Difesa lampo', description: 'Difesa in 30 secondi netti!' },
  { id: 'interventi-vietati', label: '🤐 Niente interventi', description: 'Questo round si difende senza interruzioni.' },
  { id: 'doppio-difensore', label: '👯 Doppio difensore', description: 'Due difensori per lato, qualunque sia la grandezza del gruppo.' },
];

/** DEFENSE's forced cap under the "difesa-lampo" twist, overriding room.defenseMaxMs. */
export const TWIST_DEFENSE_LAMPO_MS = 30_000;

/**
 * The leader's "caos" dial (4.3): how often a dilemma round draws a twist.
 * 'assente' is the default — a genuine off switch (0% chance), matching every
 * other opt-in extra in this codebase (infiltrato/squadre/serataLunga all
 * default off) so a room that never touches this dial behaves exactly as
 * before, deterministic-rng tests included.
 */
export type Caos = 'assente' | 'basso' | 'alto';
export const CAOS_LEVELS: Caos[] = ['assente', 'basso', 'alto'];
export function isCaos(v: string): v is Caos {
  return (CAOS_LEVELS as readonly string[]).includes(v);
}

const CAOS_PROBABILITY: Record<Caos, number> = { assente: 0, basso: 0.2, alto: 0.45 };

/**
 * Roll which (1-based) dilemma rounds get a twist this game, one independent
 * roll per round at the caos level's probability ('assente' never rolls any).
 * Once caos is on, a short "Assaggio" game (<=3 dilemmas) is guaranteed at
 * least one twist — the taster should still get a taste of it on an unlucky roll.
 */
export function planTwistRounds(dilemmaCount: number, caos: Caos, rng: () => number): Set<number> {
  const p = CAOS_PROBABILITY[caos];
  const indices = new Set<number>();
  if (p <= 0) return indices;
  for (let i = 1; i <= dilemmaCount; i++) {
    if (rng() < p) indices.add(i);
  }
  if (dilemmaCount > 0 && dilemmaCount <= 3 && indices.size === 0) {
    indices.add(1 + Math.floor(rng() * dilemmaCount));
  }
  return indices;
}

/** Draw a random twist for a round the plan selected. */
export function pickTwist(rng: () => number): Twist {
  return TWISTS[Math.floor(rng() * TWISTS.length)];
}

/** True when the CURRENT dilemma round was planned to draw a twist. */
export function isTwistRound(room: Room): boolean {
  return room.twistRoundIndices.has(room.dilemmaIndex);
}

/** This round's twist, public throughout the speaking phases (DEFENSE/INTERVENTI);
 * null otherwise, or if this round drew none. Mirrors publicAbsurdConstraint. */
export function publicTwist(room: Room): Twist | null {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') return null;
  return room.currentTwist;
}
