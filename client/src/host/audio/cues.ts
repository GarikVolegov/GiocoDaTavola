// Pure event→sound mapping for the host. Decides which sting (if any) to fire on a
// phase change, with no Web Audio dependency so it stays unit-testable. `sfx.ts` turns
// the returned name into an actual sound.

import type { GamePhase } from '../../shared/events';

export type SfxName = 'reveal' | 'swing' | 'win' | 'awards' | 'timerWarn' | 'handRaise';

/** The slice of game state cue decisions need; `GameStatePayload` satisfies it structurally. */
export interface CueGame {
  swing: { switched: number } | null;
  duelResult: { convinced: readonly unknown[] } | null;
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
    case 'DUEL_REVEAL':
    case 'DILEMMA_REVEAL':
      return 'reveal';
    case 'PHASE_RESULTS':
      return game.swing && game.swing.switched > 0 ? 'swing' : 'reveal';
    case 'DUEL_RESULT':
      return game.duelResult && game.duelResult.convinced.length > 0 ? 'win' : 'reveal';
    case 'FINAL_AWARDS':
    case 'FINAL_DUEL':
      return 'awards';
    default:
      return null;
  }
}
