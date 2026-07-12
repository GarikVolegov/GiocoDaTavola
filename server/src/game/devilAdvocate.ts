// "Avvocato del Diavolo" round logic, operating on a Room. Extracted from
// RoomStore; RoomStore delegates after the room lookup. Type-only import from
// rooms.ts keeps it cycle-free.
import type { Room } from './rooms';

/** True when the current dilemma is the surprise "Avvocato del Diavolo" round. */
export function isDevilRound(room: Room): boolean {
  return room.devilRoundIndex !== null && room.dilemmaIndex === room.devilRoundIndex;
}

/**
 * Whether this is the devil round, revealed only from DEFENSE on (so it can't skew
 * the first vote/prediction); false before that or in normal rounds.
 */
export function publicDevilRound(room: Room): boolean {
  if (!isDevilRound(room)) return false;
  return (
    room.phase === 'DEFENSE' ||
    room.phase === 'VOTE_2' ||
    room.phase === 'SPEAKER_VOTE' ||
    room.phase === 'PHASE_RESULTS'
  );
}

/**
 * Pick the surprise "Avvocato del Diavolo" round: always the PENULTIMATE dilemma
 * (6.2, "struttura a 3 atti") — the twist now lands at a fixed beat right before the
 * finale, so the energy builds by design and not just by luck of the draw. Never the
 * first round (so the group learns the normal flow first) and never the last (that
 * beat is reserved for the finale's own "posta doppia" swing bet) — needs at least 3
 * rounds; null otherwise.
 */
export function pickDevilRound(dilemmaCount: number): number | null {
  if (dilemmaCount < 3) return null;
  return dilemmaCount - 1;
}
