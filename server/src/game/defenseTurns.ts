// Turn-control for the speaking phases (DEFENSE / INTERVENTI / DUEL_ARGUE): who is
// currently speaking, the raise-hand queue, and the speaker's "I'm done" signal.
// Operates on a Room; RoomStore delegates after the room lookup. Type-only imports
// from rooms.ts keep it cycle-free; the duel speaking order comes from duel.ts.
import type { Room, RaiseHandResult, FinishTurnResult, DefenseState } from './rooms';
import { duelPlayers } from './duel';
import { isDefensePhase, isInterventiPhase } from './phases';

/** The id of the player currently speaking, or null. */
export function currentSpeakerId(room: Room): string | null {
  if (room.phase === 'DEFENSE') return room.defenders[room.defenseTurnIndex]?.id ?? null;
  if (room.phase === 'INTERVENTI') return room.interventiQueue[room.interventiIndex] ?? null;
  if (room.phase === 'DUEL_ARGUE') return duelPlayers(room)[room.duelTurnIndex]?.id ?? null;
  return null;
}

/**
 * Freeze the CURRENT speaker's live applause tally into `lastTurnApplause`
 * ("applausometro") before their turn ends — call this BEFORE advancing the
 * turn index / phase (armTurn resets the live tally for the next speaker).
 * Null (not written) if nobody was speaking or the turn drew no reactions.
 */
export function snapshotApplause(room: Room): void {
  const speakerId = currentSpeakerId(room);
  const speaker = speakerId ? room.players.get(speakerId) : undefined;
  if (!speaker || Object.keys(room.turnReactionTally).length === 0) {
    room.lastTurnApplause = null;
    return;
  }
  room.lastTurnApplause = {
    speakerId: speaker.id,
    nickname: speaker.nickname,
    tally: { ...room.turnReactionTally },
  };
}

/** Max simultaneous raised hands during a defender's turn — keeps the
 * post-defense INTERVENTI mini-round bounded no matter how big the room is. */
export const INTERVENTI_QUEUE_MAX = 3;

/**
 * Toggle a player's raised hand during a defender's turn (DEFENSE only). Anyone
 * present except the current speaker may queue; raising again lowers it. The FIFO
 * order is the speaking order for the INTERVENTI mini-turns that follow. Once
 * INTERVENTI_QUEUE_MAX hands are raised, further raises are rejected with
 * QUEUE_FULL (lowering an already-raised hand is always allowed).
 */
export function raiseHand(room: Room, playerId: string): RaiseHandResult {
  if (room.phase !== 'DEFENSE') return { ok: false, error: 'NOT_RAISE_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (room.players.get(playerId)?.role === 'pubblico') return { ok: false, error: 'PUBBLICO_NEVER_DEFENDS' };
  // "interventi-vietati" twist (4.3): this round defends straight through, no interruptions.
  if (room.currentTwist?.id === 'interventi-vietati') return { ok: false, error: 'INTERVENTI_DISABLED_THIS_ROUND' };
  if (currentSpeakerId(room) === playerId) return { ok: false, error: 'IS_SPEAKER' };
  const i = room.raisedHands.indexOf(playerId);
  if (i >= 0) {
    room.raisedHands.splice(i, 1);
    return { ok: true, room, raised: false };
  }
  if (room.raisedHands.length >= INTERVENTI_QUEUE_MAX) {
    return { ok: false, error: 'QUEUE_FULL' };
  }
  room.raisedHands.push(playerId);
  return { ok: true, room, raised: true };
}

/**
 * The current speaker signals they are done. Valid only from the speaker and only
 * once the per-turn minimum has elapsed; the caller then advances the turn.
 */
export function finishTurn(room: Room, playerId: string, now: number): FinishTurnResult {
  if (room.phase !== 'DEFENSE' && room.phase !== 'INTERVENTI' && room.phase !== 'DUEL_ARGUE') {
    return { ok: false, error: 'NOT_FINISHING_PHASE' };
  }
  if (currentSpeakerId(room) !== playerId) return { ok: false, error: 'NOT_SPEAKER' };
  if (room.turnMinEndsAt != null && now < room.turnMinEndsAt) {
    return { ok: false, error: 'TOO_EARLY' };
  }
  return { ok: true, room };
}

/**
 * Public defense/interventi view (who's speaking + turn/queue state), only during
 * DEFENSE or INTERVENTI; null otherwise. The speakers' identities are intentionally
 * public — no secret vote leaks here. `now` gates the "can finish" flag.
 */
export function publicDefense(room: Room, now: number): DefenseState | null {
  if (!isDefensePhase(room.phase) && !isInterventiPhase(room.phase)) return null;
  const canFinish = room.turnMinEndsAt == null || now >= room.turnMinEndsAt;

  if (room.phase === 'INTERVENTI') {
    const speakerId = room.interventiQueue[room.interventiIndex] ?? null;
    const sp = speakerId ? room.players.get(speakerId) : undefined;
    const queue = room.interventiQueue
      .map((id) => {
        const p = room.players.get(id);
        return p ? { id: p.id, nickname: p.nickname } : null;
      })
      .filter((x): x is { id: string; nickname: string } => x != null);
    return {
      kind: 'intervento',
      speaker: null,
      intervenor: sp ? { id: sp.id, nickname: sp.nickname } : null,
      speakerId,
      turn: room.interventiIndex + 1,
      totalTurns: room.interventiQueue.length,
      argument: null,
      spunti: null,
      raisedCount: 0,
      queue,
      minEndsAt: room.turnMinEndsAt,
      canFinish,
      startedAt: room.turnStartedAt,
    };
  }

  const totalTurns = room.defenders.length;
  const speaker = room.defenders[room.defenseTurnIndex] ?? null;
  const baseSpunti =
    speaker && room.currentDilemma
      ? speaker.side === 'A'
        ? room.currentDilemma.spuntiA
        : room.currentDilemma.spuntiB
      : null;
  // "L'Infiltrato col merito" (4.5): a decoy spunto, indistinguishable from
  // the real ones, mixed in when the infiltrator just used their tool.
  const spunti = baseSpunti && room.infiltratoDecoySpunto ? [...baseSpunti, room.infiltratoDecoySpunto] : baseSpunti;
  return {
    kind: 'defense',
    speaker,
    intervenor: null,
    speakerId: speaker?.id ?? null,
    turn: totalTurns === 0 ? 0 : room.defenseTurnIndex + 1,
    totalTurns,
    argument: room.defenseArgument,
    spunti,
    raisedCount: room.raisedHands.length,
    queue: null,
    minEndsAt: room.turnMinEndsAt,
    canFinish,
    startedAt: room.turnStartedAt,
  };
}
