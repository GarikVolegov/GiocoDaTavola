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
