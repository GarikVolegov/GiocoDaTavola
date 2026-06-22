import type { GamePhase } from './events';

// Whole seconds elapsed since `startedAt` (epoch ms). null when there is no active
// turn; never negative (clamps if the clock is behind the server timestamp). Mirror
// of useCountdown's math, in the opposite direction.
export function elapsedSeconds(startedAt: number | null, now: number): number | null {
  if (startedAt == null) return null;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

// Format a whole-second count as "M:SS" (seconds zero-padded). Used for the count-up
// timer, which can exceed 60s (cap up to 180s).
export function formatMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

// Phases where the host shows a "waiting" screen and the ambient loop should play:
// idle waits for input plus listening to a speaker. Excludes the short, auto-advancing
// reveal/result cards and the finale.
const WAITING_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'LOBBY',
  'PHASE_INTRO',
  'VOTE_1',
  'PREDICT',
  'DEFENSE',
  'INTERVENTI',
  'VOTE_2',
  'SPEAKER_VOTE',
  'ACCUSE',
  'TAPPA_RECAP',
  'DUEL_PICK',
  'DUEL_REPICK',
  'DUEL_ARGUE',
]);

export function isWaitingPhase(phase: GamePhase): boolean {
  return WAITING_PHASES.has(phase);
}
