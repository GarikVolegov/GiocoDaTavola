// Player-submitted dilemmas (lobby) domain, operating on a Room. Extracted from
// RoomStore; RoomStore delegates after the room lookup. Type-only imports from
// rooms.ts keep it cycle-free.
import type { Room, SubmitDilemmaResult } from './rooms';

/** Max player-submitted dilemmas a single player may add in the lobby. */
export const MAX_SUBMISSIONS_PER_PLAYER = 2;
/** Length caps for a player-submitted dilemma (prompt / each option). */
const SUBMISSION_TEXT_MAX = 200;
const SUBMISSION_OPTION_MAX = 100;

/** Validate + record a player's own dilemma during the lobby (capped per player). */
export function submitDilemma(
  room: Room,
  playerId: string,
  text: string,
  optionA: string,
  optionB: string,
): SubmitDilemmaResult {
  if (room.phase !== 'LOBBY') return { ok: false, error: 'NOT_LOBBY' };
  const player = room.players.get(playerId);
  if (!player || player.isBot) return { ok: false, error: 'NOT_IN_ROOM' };
  const t = text.trim();
  const a = optionA.trim();
  const b = optionB.trim();
  if (!t || !a || !b) return { ok: false, error: 'EMPTY' };
  if (t.length > SUBMISSION_TEXT_MAX || a.length > SUBMISSION_OPTION_MAX || b.length > SUBMISSION_OPTION_MAX) {
    return { ok: false, error: 'TOO_LONG' };
  }
  if (a.toLowerCase() === b.toLowerCase()) return { ok: false, error: 'SAME_OPTIONS' };
  const mine = [...room.dilemmaAuthors.values()].filter((v) => v === playerId).length;
  if (mine >= MAX_SUBMISSIONS_PER_PLAYER) return { ok: false, error: 'LIMIT_REACHED' };
  const id = `usr-${playerId}-${mine + 1}`;
  room.submittedDilemmas.push({
    id,
    text: t,
    optionA: a,
    optionB: b,
    register: 'vita',
    spuntiA: [],
    spuntiB: [],
  });
  room.dilemmaAuthors.set(id, playerId);
  return { ok: true, room, count: mine + 1 };
}

/** How many player-written dilemmas the room has collected (aggregate, lobby UI). */
export function submittedCount(room: Room): number {
  return room.submittedDilemmas.length;
}
