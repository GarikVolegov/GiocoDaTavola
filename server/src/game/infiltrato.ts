// "L'Infiltrato" domain logic, operating on a Room. Extracted from RoomStore so
// the accusation + reveal rules live in one focused place; RoomStore delegates
// after looking up the room. Type-only imports from rooms.ts keep this cycle-free.
import type { Room, AccuseResult, InfiltratoResult } from './rooms';

/** Record (or change) an accusation: who the accuser thinks the infiltrator is. */
export function accuse(room: Room, accuserId: string, accusedId: string): AccuseResult {
  if (room.phase !== 'ACCUSE') return { ok: false, error: 'NOT_ACCUSE_PHASE' };
  if (!room.players.has(accuserId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!room.players.has(accusedId) || accusedId === accuserId) return { ok: false, error: 'INVALID_TARGET' };
  room.accusations.set(accuserId, accusedId);
  return { ok: true, room };
}

/** How many players have accused this game (aggregate only). */
export function accusedCount(room: Room): number {
  return room.accusations.size;
}

/** True once every connected human has accused (ends the ACCUSE phase early). */
export function allAccused(room: Room): boolean {
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  if (humans.length === 0) return false;
  return humans.every((p) => room.accusations.has(p.id));
}

/** The resolved infiltrator reveal, only at FINAL_AWARDS; null otherwise / normal games. */
export function publicInfiltratoResult(room: Room): InfiltratoResult | null {
  if (room.phase !== 'FINAL_AWARDS') return null;
  return room.infiltratoResult;
}

/**
 * Resolve the infiltrator outcome from the accusation tally: caught only on a
 * UNIQUE top accusation that names them; they win if they overturned at least
 * one round AND evaded that. Stored on the room for the FINAL_AWARDS reveal.
 */
export function resolveInfiltrato(room: Room): void {
  const id = room.infiltratorId;
  if (!id) {
    room.infiltratoResult = null;
    return;
  }
  const counts = new Map<string, number>();
  for (const accused of room.accusations.values()) {
    counts.set(accused, (counts.get(accused) ?? 0) + 1);
  }
  let top = 0;
  for (const c of counts.values()) if (c > top) top = c;
  const topAccused = [...counts.entries()].filter(([, c]) => c === top && top > 0).map(([pid]) => pid);
  const caught = topAccused.length === 1 && topAccused[0] === id;
  const flips = room.infiltratorFlips;
  room.infiltratoResult = {
    infiltratorId: id,
    infiltratorNickname: room.players.get(id)?.nickname ?? '',
    flips,
    caught,
    won: flips > 0 && !caught,
    votesAgainst: counts.get(id) ?? 0,
  };
}
