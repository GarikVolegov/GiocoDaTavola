// The game's phase state machine: the phase enum, per-phase timer durations, and
// the pure transition functions for the group game and the 1v1 duel. Extracted
// from rooms.ts so the (stateless, heavily-tested) state machine lives on its
// own; RoomStore imports from here and re-exports for backward compatibility.

/**
 * Phases of a game. The state machine runs:
 *   LOBBY -> PHASE_INTRO -> DILEMMA_REVEAL -> VOTE_1 -> SPLIT_REVEAL ->
 *   DEFENSE -> VOTE_2 -> PHASE_RESULTS -> (loop) -> FINAL_AWARDS
 * After PHASE_RESULTS the room loops back to DILEMMA_REVEAL while dilemmas
 * remain, otherwise it ends at FINAL_AWARDS.
 */
export type GamePhase =
  | 'LOBBY'
  | 'PHASE_INTRO'
  | 'DILEMMA_REVEAL'
  | 'VOTE_1'
  | 'SPLIT_REVEAL'
  | 'PREDICT'
  | 'DEFENSE'
  | 'INTERVENTI'
  | 'VOTE_2'
  | 'SPEAKER_VOTE'
  | 'PHASE_RESULTS'
  // "Percorso" mode: the chapter card shown entering a new tappa, and the
  // end-of-tappa recap/pause (handled by nextPercorsoPhase, not nextPhase).
  | 'TAPPA_INTRO'
  | 'TAPPA_RECAP'
  // "Storie" mode: narrative cards framing each crossroads (handled by
  // nextStoriaPhase). The protagonist/setting intro, the prose before a bivio,
  // the consequence of the group's choice, and the variant ending. All
  // leader-paced (no timer): the host narrates and taps "Continua ▶".
  | 'STORY_INTRO'
  | 'SCENE_INTRO'
  | 'SCENE_CONSEQUENCE'
  | 'STORY_EPILOGUE'
  // "L'Infiltrato" end-game accusation, inserted before FINAL_AWARDS only when a
  // room has an infiltrator (handled in advancePhase, not the pure sequence).
  | 'ACCUSE'
  | 'FINAL_AWARDS'
  // 1v1 "Duello" mode phases (run instead of the group sequence when mode==='duello').
  | 'DUEL_PICK'
  | 'DUEL_REVEAL'
  | 'DUEL_ARGUE'
  | 'DUEL_REPICK'
  | 'DUEL_RESULT'
  | 'FINAL_DUEL';

/**
 * Per-turn timing for the self-paced defense + interventi. A human speaker gets a
 * MIN floor (below which "Ho finito" is rejected) and a generous MAX safety cap;
 * a bot or absent speaker (who can't tap) just gets TURN_BOT_MS.
 */
export const DEFENSE_MIN_MS = 30_000;
export const INTERVENTO_MIN_MS = 15_000;
export const DEFENSE_MAX_MS = 180_000;
export const INTERVENTI_MAX_MS = 90_000;
export const TURN_BOT_MS = 60_000;

/**
 * How long each phase lasts before the server auto-advances, in ms. `null`
 * means the phase has no timer: LOBBY waits for the host to start, FINAL_AWARDS
 * is terminal. Timers are authoritative server-side; clients only render the
 * countdown from the broadcast expiry timestamp.
 */
export const PHASE_DURATIONS_MS: Record<GamePhase, number | null> = {
  LOBBY: null,
  PHASE_INTRO: 5_000,
  DILEMMA_REVEAL: 6_000,
  // Self-paced votes: no timer — advance once every present player has acted
  // (early-advance in index.ts), with the leader's "Salta ▶" as the only override.
  VOTE_1: null,
  SPLIT_REVEAL: 6_000,
  PREDICT: null,
  DEFENSE: DEFENSE_MAX_MS,
  INTERVENTI: INTERVENTI_MAX_MS,
  VOTE_2: null,
  SPEAKER_VOTE: null,
  PHASE_RESULTS: 8_000,
  // Percorso: the chapter card auto-advances; the end-of-tappa recap has no timer
  // so it doubles as a break — the host resumes with "Continua ▶" when ready.
  TAPPA_INTRO: 8_000,
  TAPPA_RECAP: null,
  // Storie: the narrator (leader) controls the pace of every prose card, so they
  // never auto-advance — the host reads aloud and resumes with "Continua ▶".
  STORY_INTRO: null,
  SCENE_INTRO: null,
  SCENE_CONSEQUENCE: null,
  STORY_EPILOGUE: null,
  ACCUSE: 30_000,
  FINAL_AWARDS: null,
  DUEL_PICK: 20_000,
  DUEL_REVEAL: 5_000,
  DUEL_ARGUE: 45_000,
  DUEL_REPICK: 20_000,
  DUEL_RESULT: 8_000,
  FINAL_DUEL: null,
};

/**
 * Phases in which phones may cast/change a secret vote: the group first/second
 * votes, and the duel pick/re-pick (which reuse the same vote() path).
 */
export function isVotingPhase(phase: GamePhase): boolean {
  return (
    phase === 'VOTE_1' ||
    phase === 'VOTE_2' ||
    phase === 'DUEL_PICK' ||
    phase === 'DUEL_REPICK'
  );
}

/**
 * Phases in which the aggregate A/B split may be shown publicly. Only
 * SPLIT_REVEAL: never during a voting phase (it would spoil/skew the vote) —
 * still only counts, never identities.
 */
export function isSplitRevealed(phase: GamePhase): boolean {
  return phase === 'SPLIT_REVEAL';
}

/** Phases in which the chosen defenders' identities/side are public. */
export function isDefensePhase(phase: GamePhase): boolean {
  return phase === 'DEFENSE';
}

/** Phase in which queued players take their post-defense mini-turns. */
export function isInterventiPhase(phase: GamePhase): boolean {
  return phase === 'INTERVENTI';
}

/** Phase in which phones secretly predict the post-defense outcome. */
export function isPredictPhase(phase: GamePhase): boolean {
  return phase === 'PREDICT';
}

/** Phase in which phones secretly vote the most convincing defender. */
export function isSpeakerVotePhase(phase: GamePhase): boolean {
  return phase === 'SPEAKER_VOTE';
}

/** Ordered phases that make up a single dilemma round. */
const DILEMMA_SEQUENCE: GamePhase[] = [
  'DILEMMA_REVEAL',
  'VOTE_1',
  'SPLIT_REVEAL',
  'PREDICT',
  'DEFENSE',
  'VOTE_2',
  'SPEAKER_VOTE',
  'PHASE_RESULTS',
];

/** Result of a single state-machine step: the next phase + dilemma counter. */
export interface PhaseTransition {
  phase: GamePhase;
  dilemmaIndex: number;
}

/**
 * Pure state-machine transition. Given the current phase and where we are in
 * the game (1-based `dilemmaIndex`, `dilemmaCount` chosen at start), return the
 * next phase. PHASE_INTRO opens the first dilemma; PHASE_RESULTS either loops to
 * the next dilemma or ends at FINAL_AWARDS. LOBBY/FINAL_AWARDS have no next step
 * and are returned unchanged.
 */
export function nextPhase(
  current: GamePhase,
  dilemmaIndex: number,
  dilemmaCount: number,
): PhaseTransition {
  if (current === 'PHASE_INTRO') {
    return { phase: 'DILEMMA_REVEAL', dilemmaIndex: 1 };
  }
  if (current === 'PHASE_RESULTS') {
    return dilemmaIndex < dilemmaCount
      ? { phase: 'DILEMMA_REVEAL', dilemmaIndex: dilemmaIndex + 1 }
      : { phase: 'FINAL_AWARDS', dilemmaIndex };
  }
  const i = DILEMMA_SEQUENCE.indexOf(current);
  if (i >= 0 && i < DILEMMA_SEQUENCE.length - 1) {
    return { phase: DILEMMA_SEQUENCE[i + 1], dilemmaIndex };
  }
  // LOBBY and FINAL_AWARDS have no automatic successor.
  return { phase: current, dilemmaIndex };
}

/**
 * Pure state-machine transition for "Percorso" mode (the long, themed ascent).
 * The per-dilemma sequence (DILEMMA_REVEAL…PHASE_RESULTS) is identical to the
 * classic game; only the chapter framing differs:
 *  - PHASE_INTRO opens the first TAPPA_INTRO (chapter card);
 *  - TAPPA_INTRO opens the next dilemma (incrementing the index);
 *  - PHASE_RESULTS continues within the tappa, or — at a tappa boundary or the
 *    very end — detours through TAPPA_RECAP (the recap/pause);
 *  - TAPPA_RECAP either announces the next tappa or ends at FINAL_AWARDS.
 * `plannedTappe[i]` is the tappa of the (1-based) dilemma i+1.
 */
export function nextPercorsoPhase(
  current: GamePhase,
  dilemmaIndex: number,
  plannedTappe: number[],
): PhaseTransition {
  const total = plannedTappe.length;
  if (current === 'PHASE_INTRO') {
    return { phase: 'TAPPA_INTRO', dilemmaIndex: 0 };
  }
  if (current === 'TAPPA_INTRO') {
    return { phase: 'DILEMMA_REVEAL', dilemmaIndex: dilemmaIndex + 1 };
  }
  if (current === 'TAPPA_RECAP') {
    return dilemmaIndex < total
      ? { phase: 'TAPPA_INTRO', dilemmaIndex }
      : { phase: 'FINAL_AWARDS', dilemmaIndex };
  }
  if (current === 'PHASE_RESULTS') {
    if (dilemmaIndex < total) {
      const sameTappa = plannedTappe[dilemmaIndex] === plannedTappe[dilemmaIndex - 1];
      return sameTappa
        ? { phase: 'DILEMMA_REVEAL', dilemmaIndex: dilemmaIndex + 1 }
        : { phase: 'TAPPA_RECAP', dilemmaIndex };
    }
    // Last dilemma done: recap the final tappa before the awards.
    return { phase: 'TAPPA_RECAP', dilemmaIndex };
  }
  // In-dilemma phases run exactly like the classic sequence.
  const i = DILEMMA_SEQUENCE.indexOf(current);
  if (i >= 0 && i < DILEMMA_SEQUENCE.length - 1) {
    return { phase: DILEMMA_SEQUENCE[i + 1], dilemmaIndex };
  }
  return { phase: current, dilemmaIndex };
}

/**
 * Pure state-machine transition for "Storie" mode (narrative tales with debated
 * crossroads). The per-bivio sequence (DILEMMA_REVEAL…PHASE_RESULTS) is identical
 * to the classic game; only the narrative framing differs:
 *  - PHASE_INTRO opens the STORY_INTRO (protagonist + setting);
 *  - STORY_INTRO opens the first SCENE_INTRO (the prose before bivio 1);
 *  - SCENE_INTRO opens the next bivio (incrementing the 1-based index);
 *  - PHASE_RESULTS leads into SCENE_CONSEQUENCE (the outcome of the group's choice);
 *  - SCENE_CONSEQUENCE opens the next scene, or — after the last bivio — the
 *    STORY_EPILOGUE (the variant ending);
 *  - STORY_EPILOGUE ends at FINAL_AWARDS.
 * `total` is the number of crossroads in the story.
 */
export function nextStoriaPhase(
  current: GamePhase,
  dilemmaIndex: number,
  total: number,
): PhaseTransition {
  if (current === 'PHASE_INTRO') {
    return { phase: 'STORY_INTRO', dilemmaIndex: 0 };
  }
  if (current === 'STORY_INTRO') {
    return { phase: 'SCENE_INTRO', dilemmaIndex: 0 };
  }
  if (current === 'SCENE_INTRO') {
    return { phase: 'DILEMMA_REVEAL', dilemmaIndex: dilemmaIndex + 1 };
  }
  if (current === 'PHASE_RESULTS') {
    return { phase: 'SCENE_CONSEQUENCE', dilemmaIndex };
  }
  if (current === 'SCENE_CONSEQUENCE') {
    return dilemmaIndex < total
      ? { phase: 'SCENE_INTRO', dilemmaIndex }
      : { phase: 'STORY_EPILOGUE', dilemmaIndex };
  }
  if (current === 'STORY_EPILOGUE') {
    return { phase: 'FINAL_AWARDS', dilemmaIndex };
  }
  // In-bivio phases run exactly like the classic sequence.
  const i = DILEMMA_SEQUENCE.indexOf(current);
  if (i >= 0 && i < DILEMMA_SEQUENCE.length - 1) {
    return { phase: DILEMMA_SEQUENCE[i + 1], dilemmaIndex };
  }
  return { phase: current, dilemmaIndex };
}

/** Ordered phases of a single 1v1 duel round. */
const DUEL_SEQUENCE: GamePhase[] = [
  'DUEL_PICK',
  'DUEL_REVEAL',
  'DUEL_ARGUE',
  'DUEL_REPICK',
  'DUEL_RESULT',
];

/**
 * Pure duel state-machine transition (the 1v1 analogue of nextPhase). PHASE_INTRO
 * opens the first pick; from DUEL_REVEAL we skip straight to DUEL_RESULT when the
 * two players already `agreed` (otherwise argue → repick → result); DUEL_RESULT
 * loops to the next dilemma's DUEL_PICK or ends at FINAL_DUEL. `agreed` is only
 * consulted leaving DUEL_REVEAL.
 */
export function nextDuelPhase(
  current: GamePhase,
  dilemmaIndex: number,
  dilemmaCount: number,
  agreed: boolean,
): PhaseTransition {
  if (current === 'PHASE_INTRO') return { phase: 'DUEL_PICK', dilemmaIndex: 1 };
  if (current === 'DUEL_REVEAL') {
    return agreed
      ? { phase: 'DUEL_RESULT', dilemmaIndex }
      : { phase: 'DUEL_ARGUE', dilemmaIndex };
  }
  if (current === 'DUEL_RESULT') {
    return dilemmaIndex < dilemmaCount
      ? { phase: 'DUEL_PICK', dilemmaIndex: dilemmaIndex + 1 }
      : { phase: 'FINAL_DUEL', dilemmaIndex };
  }
  const i = DUEL_SEQUENCE.indexOf(current);
  if (i >= 0 && i < DUEL_SEQUENCE.length - 1) {
    return { phase: DUEL_SEQUENCE[i + 1], dilemmaIndex };
  }
  return { phase: current, dilemmaIndex };
}
