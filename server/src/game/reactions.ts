// Live audience reactions during the speaking phases, operating on a Room.
// Extracted from RoomStore; RoomStore delegates after the room lookup. Type-only
// imports keep the type side cycle-free; the reaction allowlist/interval stay in
// rooms.ts (its public vocabulary, used at call time) and the speaker lookup comes
// from defenseTurns, the stats accessor from awards.
import type { Room, ReactResult, Reaction } from './rooms';
import { REACTIONS, REACTION_MIN_INTERVAL_MS } from './rooms';
import { ensureStats } from './awards';
import { currentSpeakerId } from './defenseTurns';

function isReaction(e: string): e is Reaction {
  return (REACTIONS as readonly string[]).includes(e);
}

/**
 * Record a live audience reaction from a phone during DEFENSE / INTERVENTI /
 * DUEL_ARGUE, attributed to whoever is currently speaking (their
 * `reactionsReceived` for the end-game award). Rate-limited per player and
 * restricted to the emoji allowlist. Reactions never touch the secret votes.
 */
export function react(room: Room, playerId: string, emoji: string, now: number): ReactResult {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI' && room.phase !== 'DUEL_ARGUE') {
    return { ok: false, error: 'NOT_REACTING_PHASE' };
  }
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!isReaction(emoji)) return { ok: false, error: 'INVALID_EMOJI' };
  const last = room.lastReactionAt.get(playerId);
  if (last != null && now - last < REACTION_MIN_INTERVAL_MS) {
    return { ok: false, error: 'RATE_LIMITED' };
  }
  room.lastReactionAt.set(playerId, now);
  const speakerId = currentSpeakerId(room);
  if (speakerId) {
    const s = ensureStats(room, speakerId);
    s.reactionsReceived = (s.reactionsReceived ?? 0) + 1;
  }
  return { ok: true, emoji };
}
