// Pure event→sound mapping for the host. Decides which sting (if any) to fire on a
// phase change, with no Web Audio dependency so it stays unit-testable. `sfx.ts` turns
// the returned name into an actual sound.

import type { GamePhase, PartyMode } from '../../shared/events';

export type SfxName =
  | 'reveal'
  | 'swing'
  | 'win'
  | 'awards'
  | 'timerWarn'
  | 'handRaise'
  | 'unanimous'
  | 'discard'
  | 'warp'
  | 'clash'
  | 'insight';

/** The slice of game state cue decisions need; `GameStatePayload` satisfies it structurally. */
export interface CueGame {
  swing: { switched: number; leadFlipped?: boolean } | null;
  /** Percorso in 2 round outcome (DUO_ROUND_RESULT): any scoring means a 'win' sting. */
  duoRoundResult?: {
    convinced: readonly unknown[];
    vacillare: readonly { received: 0 | 1 | 2 }[];
  } | null;
  partyMode?: PartyMode;
  partyCard?: { mode?: PartyMode } | null;
}

/** The sting to play when the host moves from `prev` to `next`, or null for a quiet change. */
export function sfxForTransition(
  prev: GamePhase | null,
  next: GamePhase,
  game: CueGame,
): SfxName | null {
  if (next === prev) return null;

  switch (next) {
    case 'SPLIT_REVEAL':
    case 'DILEMMA_REVEAL':
    case 'DUO_SYNC_REVEAL':
    case 'DUO_REVEAL':
      return 'reveal';
    case 'UNANIMOUS_REVEAL':
      // "Tutti d'accordo!" — the whole debate is skipped, celebrate the accord.
      return 'unanimous';
    case 'PHASE_RESULTS':
      // 'swing' is the dramatic "ribaltone" sting — reserved for a genuine
      // ribaltone (the lead itself flipped, or 2+ voters switched), not any
      // single switch that left the majority unchanged.
      return game.swing && (game.swing.switched >= 2 || game.swing.leadFlipped) ? 'swing' : 'reveal';
    case 'DUO_ROUND_RESULT': {
      const r = game.duoRoundResult;
      const scored = !!r && (r.convinced.length > 0 || r.vacillare.some((v) => v.received > 0));
      return scored ? 'win' : 'reveal';
    }
    case 'STORY_INTRO':
    case 'SCENE_INTRO':
    case 'TAPPA_RECAP':
      return 'warp';
    case 'DEFENSE': {
      const mode = game.partyCard?.mode ?? game.partyMode;
      // Infiltrato plays its emergency siren via HostApp instead of a debate clash.
      return mode === 'infiltrato' ? null : 'clash';
    }
    case 'DUO_ARGUE':
    case 'TRIBUNALE_ARGUE':
    case 'INTESA_PLAY':
      return 'clash';
    case 'SCENE_CONSEQUENCE':
    case 'STORY_EPILOGUE':
    case 'GROUP_MIND_REVEAL':
    case 'WRITE_REVEAL':
    case 'HOT_TAKE_REVEAL':
    case 'CRUCIVERBA_REVEAL':
    case 'TRIBUNALE_REVEAL':
    case 'TELEPATHY_REVEAL':
    case 'GHIGLIOTTINA_REVEAL':
    case 'STIMA_REVEAL':
    case 'BUFALA_REVEAL':
    case 'INTESA_REVEAL':
      return 'insight';
    case 'FINAL_AWARDS':
    case 'DUO_PORTRAIT':
      return 'awards';
    default:
      return null;
  }
}

/** Seconds left at/below which the countdown starts ticking. */
const WARN_FROM = 5;

/** True when the countdown just dropped to a new second within the final stretch (1..WARN_FROM). */
export function shouldWarnAt(prev: number | null, curr: number | null): boolean {
  if (prev == null || curr == null) return false;
  if (curr < 1 || curr > WARN_FROM) return false;
  return curr < prev; // only while counting down, not on a reset
}

/** True when the intervention queue grew, i.e. a new hand went up. */
export function handRaised(prevLen: number | null, currLen: number | null): boolean {
  if (prevLen == null || currLen == null) return false;
  return currLen > prevLen;
}
