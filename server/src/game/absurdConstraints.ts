// "Vincoli assurdi di difesa" (2.3): roughly 1 round in 3, the defenders get a
// silly performance constraint alongside their side — an alibi-of-a-role that
// levels the playing field (the shy player delivers the memorable moment) and
// keeps a heavy dilemma from feeling too solemn. Purely theatrical: it never
// changes the actual debate mechanics, only how it's staged.
import type { Room } from './rooms';

/** The pool of absurd performance constraints. */
export const ABSURD_CONSTRAINTS: readonly string[] = [
  'Difendila come un venditore di materassi',
  "Senza mai dire la parola 'soldi'",
  'Come se fossi un pirata',
  'Parlando sempre in terza persona',
  'Come un meteorologo che annuncia un uragano',
  'Sussurrando come se fosse un segreto',
  "Come se stessi vendendo un'auto usata",
  'Con la voce di un annunciatore di wrestling',
  'Come una nonna che racconta una favola della buonanotte',
  "Come se fossi in un'aula di tribunale drammatica",
  "Usando solo frasi che iniziano con 'Immagina'",
  'Come un allenatore motivazionale prima della finale',
];

/** 1 in 3 chance of a constraint this round; null otherwise. */
export function pickAbsurdConstraint(rng: () => number): string | null {
  if (rng() >= 1 / 3) return null;
  return ABSURD_CONSTRAINTS[Math.floor(rng() * ABSURD_CONSTRAINTS.length)];
}

/** This round's absurd constraint, public throughout the speaking phases
 * (DEFENSE/INTERVENTI); null otherwise, or if this round drew none. */
export function publicAbsurdConstraint(room: Room): string | null {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') return null;
  return room.absurdConstraint;
}
