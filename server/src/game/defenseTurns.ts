// Turn-control for the speaking phases (DEFENSE / INTERVENTI / DUEL_ARGUE): who is
// currently speaking, the raise-hand queue, and the speaker's "I'm done" signal.
// Operates on a Room; RoomStore delegates after the room lookup. Type-only imports
// from rooms.ts keep it cycle-free; the duel speaking order comes from duel.ts.
import type { Room, RaiseHandResult, FinishTurnResult } from './rooms';
import { duelPlayers } from './duel';

/** The id of the player currently speaking, or null. */
export function currentSpeakerId(room: Room): string | null {
  if (room.phase === 'DEFENSE') return room.defenders[room.defenseTurnIndex]?.id ?? null;
  if (room.phase === 'INTERVENTI') return room.interventiQueue[room.interventiIndex] ?? null;
  if (room.phase === 'DUEL_ARGUE') return duelPlayers(room)[room.duelTurnIndex]?.id ?? null;
  return null;
}

/**
 * Toggle a player's raised hand during a defender's turn (DEFENSE only). Anyone
 * present except the current speaker may queue; raising again lowers it. The FIFO
 * order is the speaking order for the INTERVENTI mini-turns that follow.
 */
export function raiseHand(room: Room, playerId: string): RaiseHandResult {
  if (room.phase !== 'DEFENSE') return { ok: false, error: 'NOT_RAISE_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (currentSpeakerId(room) === playerId) return { ok: false, error: 'IS_SPEAKER' };
  const i = room.raisedHands.indexOf(playerId);
  if (i >= 0) {
    room.raisedHands.splice(i, 1);
    return { ok: true, room, raised: false };
  }
  room.raisedHands.push(playerId);
  return { ok: true, room, raised: true };
}

/**
 * The current speaker signals they are done. Valid only from the speaker and only
 * once the per-turn minimum has elapsed; the caller then advances the turn.
 */
export function finishTurn(room: Room, playerId: string, now: number): FinishTurnResult {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI') {
    return { ok: false, error: 'NOT_FINISHING_PHASE' };
  }
  if (currentSpeakerId(room) !== playerId) return { ok: false, error: 'NOT_SPEAKER' };
  if (room.turnMinEndsAt != null && now < room.turnMinEndsAt) {
    return { ok: false, error: 'TOO_EARLY' };
  }
  return { ok: true, room };
}
