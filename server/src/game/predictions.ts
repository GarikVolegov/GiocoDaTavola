// PREDICT-phase domain: the post-defense side prediction and the swing bet
// ("ribaltone"), operating on a Room. Extracted from RoomStore; RoomStore
// delegates after the room lookup. Type-only imports from rooms.ts keep it
// cycle-free; vote counting comes from the foundational voteCount module.
import type {
  Room,
  VoteChoice,
  VoteTally,
  PredictResult,
  PredictionResult,
  SwingBetResult,
  SwingBetOutcome,
} from './rooms';
import { tally, isVoteChoice, isSwingBet } from './voteCount';

/** Record (or change) a player's secret post-defense prediction. */
export function predict(room: Room, playerId: string, choice: string): PredictResult {
  if (room.phase !== 'PREDICT') return { ok: false, error: 'NOT_PREDICT_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!isVoteChoice(choice)) return { ok: false, error: 'INVALID_CHOICE' };
  room.predictions.set(playerId, choice);
  return { ok: true, room };
}

/** How many players have made a prediction this round (aggregate only). */
export function predictedCount(room: Room): number {
  return room.predictions.size;
}

/** True once every connected human has predicted (and at least one is present). */
export function allPredicted(room: Room): boolean {
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  if (humans.length === 0) return false;
  return humans.every((p) => room.predictions.has(p.id));
}

/**
 * Each predictor's own outcome for the just-finished round (private emit at
 * PHASE_RESULTS). `actual` is the second-vote majority (null on a tie).
 */
export function predictionResults(room: Room): PredictionResult[] {
  const t = tally(room.votes);
  const actual: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
  return [...room.predictions].map(([playerId, predicted]) => ({
    playerId,
    predicted,
    actual,
    correct: actual != null && predicted === actual,
  }));
}

/** Record (or change) a player's secret swing bet during PREDICT. */
export function swingBet(room: Room, playerId: string, bet: string): SwingBetResult {
  if (room.phase !== 'PREDICT') return { ok: false, error: 'NOT_PREDICT_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!isSwingBet(bet)) return { ok: false, error: 'INVALID_BET' };
  room.swingBets.set(playerId, bet);
  return { ok: true, room };
}

/** How many players have placed a swing bet this round (aggregate only). */
export function swingBetCount(room: Room): number {
  return room.swingBets.size;
}

/** True once every connected human has placed a swing bet (mirror of allPredicted). */
export function allSwingBet(room: Room): boolean {
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  if (humans.length === 0) return false;
  return humans.every((p) => room.swingBets.has(p.id));
}

/**
 * Whether the leading side changed between the first vote (votes1) and the second
 * (votes) — a tie counts as its own "side", so A→tie or tie→A both flip.
 */
export function leadFlipped(room: Room): boolean {
  const lead = (t: VoteTally): VoteChoice | null => (t.A > t.B ? 'A' : t.B > t.A ? 'B' : null);
  return lead(tally(room.votes1)) !== lead(tally(room.votes));
}

/** Each bettor's own swing-bet outcome (private emit at PHASE_RESULTS). */
export function swingBetResults(room: Room): SwingBetOutcome[] {
  const flipped = leadFlipped(room);
  return [...room.swingBets].map(([playerId, bet]) => ({
    playerId,
    bet,
    flipped,
    correct: (bet === 'ribalta') === flipped,
  }));
}
