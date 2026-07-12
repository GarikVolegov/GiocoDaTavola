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
import { isKnowRound } from './knowRound';

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

/** True once every connected human has predicted (and at least one is
 * present). Excludes a player who late-joined THIS round (3.2). */
export function allPredicted(room: Room): boolean {
  const humans = [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
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

/** True once every connected human has placed a swing bet (mirror of
 * allPredicted). Excludes a player who late-joined THIS round (3.2). */
export function allSwingBet(room: Room): boolean {
  const humans = [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
  if (humans.length === 0) return false;
  return humans.every((p) => room.swingBets.has(p.id));
}

/**
 * Whether this is the game's FINAL round — the swing bet pays double points here
 * (6.2, "struttura a 3 atti"): one more beat of designed escalation, landing right
 * after the devil round's twist two rounds earlier.
 */
export function isFinalRound(room: Room): boolean {
  return room.dilemmaCount != null && room.dilemmaIndex === room.dilemmaCount;
}

/**
 * Whether the leading side changed between the first vote (votes1) and the second
 * (votes) — a tie counts as its own "side", so A→tie or tie→A both flip.
 */
export function leadFlipped(room: Room): boolean {
  const lead = (t: VoteTally): VoteChoice | null => (t.A > t.B ? 'A' : t.B > t.A ? 'B' : null);
  return lead(tally(room.votes1)) !== lead(tally(room.votes));
}

/** Whether one connected human has finished every action PREDICT asks of
 * them: the side prediction, the swing bet, and — in the "Quanto mi conosci"
 * round, only if they were assigned a target — their guess. */
function predictActionDone(room: Room, playerId: string): boolean {
  if (!room.predictions.has(playerId)) return false;
  if (!room.swingBets.has(playerId)) return false;
  if (isKnowRound(room) && room.knowTargets.has(playerId) && !room.knowGuesses.has(playerId)) {
    return false;
  }
  return true;
}

/**
 * How many connected humans have finished PREDICT and who's still missing
 * something (by nickname only — never which choice). Null outside PREDICT.
 * The single source of truth for both the early-advance gate below and the
 * "who are we waiting on" UI.
 */
export function predictProgress(
  room: Room,
): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'PREDICT') return null;
  const humans = [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
  const missing = humans.filter((p) => !predictActionDone(room, p.id));
  return {
    done: humans.length - missing.length,
    total: humans.length,
    missingNicknames: missing.map((p) => p.nickname),
  };
}

/**
 * Single source of truth for "has everyone finished PREDICT?" — replaces the
 * old two independent call sites (the predict/swingBet handlers checked
 * predict+swingBet only; the knowGuess handler checked knowGuessed only),
 * which in the know round could each fire the early-advance before the
 * OTHER kind of input was done, cutting a player's action short.
 */
export function predictPhaseComplete(room: Room): boolean {
  const progress = predictProgress(room);
  return progress != null && progress.total > 0 && progress.done === progress.total;
}

/**
 * Force a plausible default for any connected human still missing a PREDICT
 * action once the phase is forced through (soft-timeout or a leader skip):
 * the side prediction defaults to the currently-leading side (a tie -> A),
 * the swing bet defaults to "regge" (majority holds), and — in the "Quanto
 * mi conosci" round — a still-missing know-guess defaults to that same
 * leading side too (the same "no signal, guess the popular pick" heuristic;
 * otherwise that sub-part is silently dropped while prediction/swingBet
 * still get scored, an asymmetry with no player:knowGuessResult ever
 * reaching that phone). Idempotent — a no-op for anyone who already acted,
 * so it's safe to call unconditionally on every PREDICT exit.
 */
export function applyPredictDefaults(room: Room): void {
  if (room.phase !== 'PREDICT') return;
  const t = tally(room.votes);
  const leading: VoteChoice = t.A >= t.B ? 'A' : 'B';
  const present = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  const know = isKnowRound(room);
  for (const p of present) {
    if (!room.predictions.has(p.id)) room.predictions.set(p.id, leading);
    if (!room.swingBets.has(p.id)) room.swingBets.set(p.id, 'regge');
    if (know && room.knowTargets.has(p.id) && !room.knowGuesses.has(p.id)) {
      room.knowGuesses.set(p.id, leading);
    }
  }
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
