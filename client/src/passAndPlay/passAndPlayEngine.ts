// Pure state machine for Pass & Play ("Passa il Telefono", 1-device social mode).
// Designed around a table-first flow: one rotating Reader holds the phone and
// most modes resolve face-to-face with a single tap, passing the device only when
// true secrecy is needed (L'Infiltrato secret question).

import type {
  CruciverbaMode,
  CruciverbaCellPayload,
  CruciverbaStatePayload,
  CruciverbaWordPayload,
} from '../shared/events';
import type {
  PassMode,
  PassCard,
  PassFlashCard,
  PassInfiltratoCard,
  PassCoppieCard,
  PassAssurdoCard,
  PassCruciverbaCard,
  PassTribunaleCard,
  PassPreferirestiCard,
  PassGhigliottinaCard,
  PassStimaCard,
  PassBufalaCard,
  PassIntesaCard,
} from './fallbackDeck';

export type { CruciverbaMode };

export interface PassPlayer {
  id: string;
  name: string;
  avatar: string;
}

export type PassPhase =
  | 'SETUP'
  | 'PASS_CURTAIN'
  | 'SECRET_TURN'
  | 'DEBATE'
  | 'ROUND_RESULT'
  | 'FINAL_AWARDS';

export type SecretActionKind = 'infiltrato_read' | 'intesa_speaker';

export interface GhigliottinaPassState {
  shuffledChoices: string[];
}

export interface IntesaPassState {
  speakerId: string;
}

export interface PassCouplePair {
  id: string;
  label: string;
  memberAId: string;
  memberBId: string;
  score: number;
  matches: number;
}

export interface PassCoupleRoundOutcome {
  coupleId: string;
  memberAName: string;
  memberBName: string;
  choiceALabel: string | null;
  choiceBLabel: string | null;
  matched: boolean;
}

export interface ClassicoPassState {
  defenderAId: string;
  defenderBId: string;
  isDevilRound: boolean;
}

export interface CoppiePassState {
  featuredCoupleId: string | null;
  featuredPairIds: [string, string];
  allCouplesMode: boolean;
}

export interface CruciverbaPassState {
  mode: CruciverbaMode;
  board: PassCruciverbaCard;
  turnOrder: string[];
  turnIndex: number;
  activeWordId: string;
  wordStatus: Record<string, 'pending' | 'solved' | 'revealed'>;
  wordChoices: Record<string, string[]>;
  wrongChoices: Record<string, string[]>;
  solvedBy: Record<string, string>;
  revealedCells: string[];
  turnsTaken: number;
  maxTurns: number;
  hintsUsed: number;
  lastFeedback?: string;
}

export interface TribunalePassState {
  caseData: PassTribunaleCard;
  accusaId: string;
  difesaId: string;
  speakerIndex: 0 | 1;
  verdictReady: boolean;
  juryIds: string[];
  winner?: 'ACCUSA' | 'DIFESA' | 'TIE';
  accusaVotes?: number;
  difesaVotes?: number;
}

export interface RoundOutcome {
  kind:
    | 'split'
    | 'swing'
    | 'gogna'
    | 'dignita'
    | 'infiltrato'
    | 'coppie_align'
    | 'coppie_challenge'
    | 'cruciverba'
    | 'tribunale'
    | 'ghigliottina'
    | 'stima'
    | 'bufala'
    | 'intesa';
  countA: number;
  countB: number;
  liveVerdictLabel?: string;
  prevCountA?: number;
  prevCountB?: number;
  swingDelta?: number;
  classicoWinnerId?: string | null;
  gognaWinnerIds?: string[];
  gognaTopVotes?: number;
  infiltratoId?: string;
  infiltratoAccusedId?: string | null;
  accusedIds?: string[];
  infiltratoCaught?: boolean;
  coppieMatched?: boolean;
  coupleOutcomes?: PassCoupleRoundOutcome[];
  cruciverbaSolvedCount?: number;
  cruciverbaTotalCount?: number;
  tribunaleWinner?: 'ACCUSA' | 'DIFESA' | 'TIE';
  tribunaleWinnerIds?: string[];
  tribunaleLoserId?: string | null;
  tribunaleAccusaVotes?: number;
  tribunaleDifesaVotes?: number;
  ghigliottinaGuess?: string;
  ghigliottinaCorrect?: boolean;
  ghigliottinaWinnerId?: string | null;
  stimaSoloGuess?: number;
  stimaPrecisionPct?: number;
  stimaExact?: boolean;
  stimaWinnerId?: string | null;
  bufalaGuessIsTrue?: boolean | null;
  bufalaCorrect?: boolean;
  intesaOutcome?: 'guessed' | 'taboo' | 'skipped';
  intesaSpeakerId?: string;
  intesaWinnerId?: string | null;
  chosenSide?: 'A' | 'B';
  chosenOptionIndex?: number;
  crowdPctForChoice?: number;
  crowdSplitPcts?: number[];
  counterArgument?: string;
  soloFlipped?: boolean;
  soloMode?: boolean;
}

export interface PlayerPassStats {
  flips: number;
  minorityCount: number;
  gognaHits: number;
  infiltratoWins: number;
  infiltratoCatches: number;
  coopWins: number;
  tribunaleWins?: number;
  tvQuizWins?: number;
  rounds?: number;
  majorityCount?: number;
  steadyCount?: number;
  coppieMatches?: number;
  infiltratoRoles?: number;
}

export interface PassMomentBadge {
  emoji: string;
  label: string;
  tone: 'gold' | 'a' | 'b' | 'danger' | 'success';
}

export interface PassRoundHighlight {
  roundIndex: number;
  cardId: string;
  cardMode: Exclude<PassMode, 'mix'>;
  prompt: string;
  kind: RoundOutcome['kind'];
  countA: number;
  countB: number;
  liveVerdictLabel?: string;
  swingDelta?: number;
  infiltratoId?: string;
  infiltratoCaught?: boolean;
  gognaWinnerIds?: string[];
  gognaTopVotes?: number;
  coppieMatched?: boolean;
  cruciverbaSolvedCount?: number;
  cruciverbaTotalCount?: number;
  tribunaleWinnerIds?: string[];
  crowdPctForChoice?: number;
  soloMode?: boolean;
  soloFlipped?: boolean;
  momentBadge: PassMomentBadge;
}

export interface PassAward {
  id: string;
  emoji: string;
  title: string;
  description: string;
  winnerId: string;
  winnerName: string;
  winnerAvatar?: string;
  isJolly?: boolean;
}

export interface PassTableVerdict {
  emoji: string;
  title: string;
  subtitle: string;
  chemistryPct: number;
  chemistryLabel: string;
  roundsPlayed: number;
  playerCount: number;
  sparksCount: number;
  consensusCount: number;
}

export interface PassPlayerStatPill {
  label: string;
  value: string | number;
}

export interface PassPlayerProfile {
  player: PassPlayer;
  archetypeId: string;
  emoji: string;
  title: string;
  motto: string;
  description: string;
  lesson: string;
  awardsWon: PassAward[];
  statPills: PassPlayerStatPill[];
}

export interface PassFinaleSummary {
  verdict: PassTableVerdict;
  awards: PassAward[];
  mvp: PassAward | null;
  playerProfiles: PassPlayerProfile[];
  moments: PassRoundHighlight[];
  closingChallenges: string[];
  shareText: string;
}

export interface PassState {
  version: number;
  mode: PassMode;
  players: PassPlayer[];
  couples: PassCouplePair[];
  cards: PassCard[];
  roundIndex: number;
  phase: PassPhase;
  secretKind: SecretActionKind;
  turnIndex: number;
  infiltratoId: string | null;
  cruciverbaMode?: CruciverbaMode;
  soloFast?: boolean;
  lastSoloToast?: { chosenLabel: string; crowdPct: number } | null;
  classicoState: ClassicoPassState | null;
  coppieState: CoppiePassState | null;
  cruciverbaState: CruciverbaPassState | null;
  tribunaleState: TribunalePassState | null;
  ghigliottinaState: GhigliottinaPassState | null;
  intesaState: IntesaPassState | null;
  roundOutcome: RoundOutcome | null;
  stats: Record<string, PlayerPassStats>;
  debateDurationSec: number;
  roundHistory?: PassRoundHighlight[];
  storyChoicesA?: number;
}

export type PassAction =
  | {
      type: 'START_GAME';
      mode: PassMode;
      players: PassPlayer[];
      cards: PassCard[];
      rng?: () => number;
      cruciverbaMode?: CruciverbaMode;
      soloFast?: boolean;
    }
  | { type: 'SET_SOLO_FAST'; enabled: boolean }
  | { type: 'UNLOCK_TURN' }
  | { type: 'ACK_SECRET' }
  | { type: 'RESOLVE_FLASH'; result: 'A' | 'B' | 'SPLIT' | 'UNANIMOUS'; rng?: () => number }
  | { type: 'RESOLVE_PREFERIRESTI'; choice: 'A' | 'B' | 'C' | 'D' | 'SPLIT'; rng?: () => number }
  | { type: 'RESOLVE_CLASSICO'; outcome: 'CONVINCE_A' | 'CONVINCE_B' | 'FLIP' | 'STEADY'; rng?: () => number }
  | { type: 'SOLO_FLIP_AFTER_OBJECTION' }
  | { type: 'RESOLVE_INFILTRATO_ACCUSATION'; accusedId: string | null }
  | { type: 'RESOLVE_GOGNA'; targetId: string | null }
  | { type: 'RESOLVE_DIGNITA'; outcome: 'YES' | 'SPLIT' | 'NO'; rng?: () => number }
  | { type: 'RESOLVE_COPPIE_ALIGN'; matchedCoupleIds: string[] }
  | { type: 'RESOLVE_COPPIE_CHALLENGE'; completed: boolean; rng?: () => number }
  | { type: 'CRUCIVERBA_SELECT_WORD'; wordId: string }
  | { type: 'CRUCIVERBA_SOLVE_WORD'; wordId: string; solverId: string | null }
  | { type: 'CRUCIVERBA_GUESS_CHOICE'; wordId: string; choice: string; solverId?: string | null }
  | { type: 'CRUCIVERBA_PASS'; reason?: 'hint' | 'timeout'; rng?: () => number }
  | { type: 'CRUCIVERBA_END_NOW' }
  | { type: 'TRIBUNALE_NEXT_SPEAKER' }
  | { type: 'TRIBUNALE_RESOLVE'; winner: 'ACCUSA' | 'DIFESA' | 'TIE' }
  | { type: 'RESOLVE_GHIGLIOTTINA'; guess?: string; winnerId?: string | null }
  | { type: 'RESOLVE_STIMA'; soloGuess?: number; winnerId?: string | null }
  | { type: 'RESOLVE_BUFALA'; guessIsTrue: boolean | null }
  | { type: 'RESOLVE_INTESA'; outcome: 'guessed' | 'taboo' | 'skipped'; winnerId?: string | null }
  | { type: 'NEXT_ROUND'; rng?: () => number }
  | { type: 'RESET_TO_SETUP' };

export const PASS_STATE_VERSION = 2;
export const CRUCIVERBA_TURN_SEC = 0;
export const TRIBUNALE_SPEAK_SEC = 0;

export const PASS_AVATARS = ['🦊', '🐙', '🦁', '🐸', '🦉', '🐼', '🦄', '🐝', '🦖', '🐧'] as const;

export function minPlayersForMode(mode: PassMode): number {
  if (mode === 'infiltrato' || mode === 'tribunale') return 3;
  if (mode === 'coppie' || mode === 'intesa') return 2;
  return 1;
}

export function createInitialPassState(): PassState {
  return {
    version: PASS_STATE_VERSION,
    mode: 'mix',
    players: [],
    couples: [],
    cards: [],
    roundIndex: 0,
    phase: 'SETUP',
    secretKind: 'infiltrato_read',
    turnIndex: 0,
    infiltratoId: null,
    cruciverbaMode: 'indizi',
    soloFast: false,
    lastSoloToast: null,
    classicoState: null,
    coppieState: null,
    cruciverbaState: null,
    tribunaleState: null,
    ghigliottinaState: null,
    intesaState: null,
    roundOutcome: null,
    stats: {},
    debateDurationSec: 0,
    roundHistory: [],
    storyChoicesA: 0,
  };
}

function emptyPlayerStats(): PlayerPassStats {
  return {
    flips: 0,
    minorityCount: 0,
    gognaHits: 0,
    infiltratoWins: 0,
    infiltratoCatches: 0,
    coopWins: 0,
    tribunaleWins: 0,
    tvQuizWins: 0,
    rounds: 0,
    majorityCount: 0,
    steadyCount: 0,
    coppieMatches: 0,
    infiltratoRoles: 0,
  };
}

function emptyStats(players: PassPlayer[]): Record<string, PlayerPassStats> {
  const stats: Record<string, PlayerPassStats> = {};
  for (const p of players) {
    stats[p.id] = emptyPlayerStats();
  }
  return stats;
}

function readStat(stats: Record<string, PlayerPassStats>, playerId: string): PlayerPassStats {
  const s = stats[playerId];
  return {
    flips: s?.flips ?? 0,
    minorityCount: s?.minorityCount ?? 0,
    gognaHits: s?.gognaHits ?? 0,
    infiltratoWins: s?.infiltratoWins ?? 0,
    infiltratoCatches: s?.infiltratoCatches ?? 0,
    coopWins: s?.coopWins ?? 0,
    tribunaleWins: s?.tribunaleWins ?? 0,
    tvQuizWins: s?.tvQuizWins ?? 0,
    rounds: s?.rounds ?? 0,
    majorityCount: s?.majorityCount ?? 0,
    steadyCount: s?.steadyCount ?? 0,
    coppieMatches: s?.coppieMatches ?? 0,
    infiltratoRoles: s?.infiltratoRoles ?? 0,
  };
}

function pickInfiltratoId(players: PassPlayer[], rng: () => number): string | null {
  if (players.length === 0) return null;
  const idx = Math.min(players.length - 1, Math.floor(rng() * players.length));
  return players[idx].id;
}

function debateSecondsForMode(_mode: PassMode): number {
  return 0;
}

export function buildPassCouples(players: PassPlayer[]): PassCouplePair[] {
  const couples: PassCouplePair[] = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    couples.push({
      id: `pc_${i / 2 + 1}`,
      label: `${a.name} & ${b.name}`,
      memberAId: a.id,
      memberBId: b.id,
      score: 0,
      matches: 0,
    });
  }
  return couples;
}

export function findPassCoupleForPlayer(
  couples: PassCouplePair[],
  playerId: string,
): PassCouplePair | undefined {
  return couples.find((c) => c.memberAId === playerId || c.memberBId === playerId);
}

export function resolvePassCoppieOptions(
  card: PassCoppieCard,
  couple: PassCouplePair | undefined,
  players: PassPlayer[],
): { optionA: string; optionB: string } {
  if (card.cardType === 'allineamento') {
    if (card.optionA && card.optionB) {
      return { optionA: card.optionA, optionB: card.optionB };
    }
    if (couple) {
      const nameA = players.find((p) => p.id === couple.memberAId)?.name ?? 'Partner 1';
      const nameB = players.find((p) => p.id === couple.memberBId)?.name ?? 'Partner 2';
      return { optionA: nameA, optionB: nameB };
    }
  }
  if (card.optionA && card.optionB) {
    return { optionA: card.optionA, optionB: card.optionB };
  }
  return { optionA: '✅ Fatta insieme!', optionB: '🍺 Penitenza / Passiamo' };
}

/** Resolves the concrete gameplay mode for a card (handles Serata Mix per-card delegation). */
export function effectivePassCardMode(
  mode: PassMode,
  card: PassCard | null | undefined,
): Exclude<PassMode, 'mix'> {
  if (mode !== 'mix') return mode;
  if (!card) return 'flash';
  if (isInfiltratoCard(card)) return 'infiltrato';
  if (isCoppieCard(card)) return 'coppie';
  if (isAssurdoCard(card)) return 'assurdo';
  if (isCruciverbaCard(card)) return 'cruciverba';
  if (isTribunaleCard(card)) return 'tribunale';
  if (isPreferirestiCard(card)) return 'preferiresti';
  if (isGhigliottinaCard(card)) return 'ghigliottina';
  if (isStimaCard(card)) return 'stima';
  if (isBufalaCard(card)) return 'bufala';
  if (isIntesaCard(card)) return 'intesa';
  if (card.cardMode) return card.cardMode;
  return 'flash';
}

export function getCurrentCard(state: PassState): PassCard | null {
  return state.cards[state.roundIndex] ?? null;
}

export function getCurrentTurnPlayer(state: PassState): PassPlayer | null {
  return state.players[state.turnIndex] ?? null;
}

/** Returns the rotating Reader ("Regista del round") who holds the phone this round. */
export function getCurrentReaderPlayer(state: PassState): PassPlayer | null {
  if (state.players.length === 0) return null;
  if (state.tribunaleState && state.tribunaleState.juryIds.length > 0) {
    const jurorId =
      state.tribunaleState.juryIds[state.roundIndex % state.tribunaleState.juryIds.length];
    return state.players.find((p) => p.id === jurorId) ?? state.players[0];
  }
  return state.players[state.roundIndex % state.players.length];
}

function initPassClassicoState(
  players: PassPlayer[],
  roundIndex: number,
  rng: () => number,
): ClassicoPassState {
  const n = players.length;
  const idxA = roundIndex % n;
  const idxB = (roundIndex + 1) % n;
  return {
    defenderAId: players[idxA].id,
    defenderBId: players[idxB].id,
    isDevilRound: rng() < 0.25,
  };
}

function initPassCoppieState(
  card: PassCoppieCard,
  players: PassPlayer[],
  couples: PassCouplePair[],
  roundIndex: number,
): CoppiePassState {
  if (couples.length > 0) {
    const c = couples[roundIndex % couples.length];
    return {
      featuredCoupleId: c.id,
      featuredPairIds: [c.memberAId, c.memberBId],
      allCouplesMode: card.cardType === 'allineamento',
    };
  }
  const n = players.length;
  const idxA = (roundIndex * 2) % n;
  const idxB = (idxA + 1) % n;
  return {
    featuredCoupleId: null,
    featuredPairIds: [players[idxA].id, players[idxB].id],
    allCouplesMode: false,
  };
}

function shuffleStringsWithRng(items: readonly string[], rng: () => number): string[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findCruciverbaAnchorCell(board: PassCruciverbaCard): string | null {
  const first = board.words[0];
  if (!first) return null;
  const otherCells = new Set<string>();
  for (let wi = 1; wi < board.words.length; wi++) {
    const w = board.words[wi];
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === 'V' ? w.row + i : w.row;
      const c = w.direction === 'H' ? w.col + i : w.col;
      otherCells.add(`${r},${c}`);
    }
  }
  for (let i = 0; i < first.word.length; i++) {
    const r = first.direction === 'V' ? first.row + i : first.row;
    const c = first.direction === 'H' ? first.col + i : first.col;
    const key = `${r},${c}`;
    if (otherCells.has(key)) return key;
  }
  return `${first.row},${first.col}`;
}

function initPassCruciverbaState(
  board: PassCruciverbaCard,
  players: PassPlayer[],
  mode: CruciverbaMode = 'indizi',
  rng: () => number = Math.random,
): CruciverbaPassState {
  const wordStatus: Record<string, 'pending' | 'solved' | 'revealed'> = {};
  const wordChoices: Record<string, string[]> = {};
  for (const w of board.words) {
    wordStatus[w.id] = 'pending';
    const rawChoices =
      w.choices && w.choices.length > 0
        ? w.choices.map((c) => c.toUpperCase())
        : [w.word.toUpperCase()];
    wordChoices[w.id] = shuffleStringsWithRng(rawChoices, rng);
  }
  const revealedCells: string[] = [];
  if (mode === 'scelte') {
    const anchor = findCruciverbaAnchorCell(board);
    if (anchor) revealedCells.push(anchor);
  }
  return {
    mode,
    board,
    turnOrder: players.map((p) => p.id),
    turnIndex: 0,
    activeWordId: board.words[0].id,
    wordStatus,
    wordChoices,
    wrongChoices: {},
    solvedBy: {},
    revealedCells,
    turnsTaken: 0,
    maxTurns: Math.max(board.words.length * 3, 8),
    hintsUsed: 0,
  };
}

function initPassTribunaleState(
  caseData: PassTribunaleCard,
  players: PassPlayer[],
  roundIndex: number,
): TribunalePassState {
  const n = players.length;
  const idxA = (roundIndex * 2) % n;
  const idxB = (roundIndex * 2 + 1) % n === idxA ? (idxA + 1) % n : (roundIndex * 2 + 1) % n;
  const accusaId = players[idxA].id;
  const difesaId = players[idxB].id;
  const juryIds = players.filter((p) => p.id !== accusaId && p.id !== difesaId).map((p) => p.id);
  return {
    caseData,
    accusaId,
    difesaId,
    speakerIndex: 0,
    verdictReady: false,
    juryIds,
  };
}

function enterCurrentRound(state: PassState, rng: () => number): PassState {
  const card = getCurrentCard(state);
  if (!card) return { ...state, phase: 'FINAL_AWARDS' };

  const cardMode = effectivePassCardMode(state.mode, card);
  const baseCleared = {
    ...state,
    secretKind: 'infiltrato_read' as SecretActionKind,
    turnIndex: 0,
    infiltratoId: null,
    classicoState: null,
    coppieState: null,
    cruciverbaState: null,
    tribunaleState: null,
    ghigliottinaState: null,
    intesaState: null,
    roundOutcome: null,
    debateDurationSec: debateSecondsForMode(cardMode),
  };

  if (cardMode === 'infiltrato') {
    return {
      ...baseCleared,
      phase: 'PASS_CURTAIN',
      secretKind: 'infiltrato_read',
      infiltratoId: pickInfiltratoId(state.players, rng),
    };
  }

  if (cardMode === 'intesa' && isIntesaCard(card)) {
    const nPlayers = Math.max(1, state.players.length);
    const speakerIdx = state.roundIndex % nPlayers;
    const speakerId = state.players[speakerIdx]?.id ?? '';
    return {
      ...baseCleared,
      phase: 'PASS_CURTAIN',
      secretKind: 'intesa_speaker',
      turnIndex: speakerIdx,
      intesaState: { speakerId },
    };
  }

  if (cardMode === 'ghigliottina' && isGhigliottinaCard(card)) {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      ghigliottinaState: {
        shuffledChoices: shuffleStringsWithRng(card.choices, rng),
      },
    };
  }

  if (cardMode === 'cruciverba' && isCruciverbaCard(card)) {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      debateDurationSec: CRUCIVERBA_TURN_SEC,
      cruciverbaState: initPassCruciverbaState(
        card,
        state.players,
        state.cruciverbaMode ?? 'indizi',
        rng,
      ),
    };
  }

  if (cardMode === 'tribunale' && isTribunaleCard(card)) {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      debateDurationSec: TRIBUNALE_SPEAK_SEC,
      tribunaleState: initPassTribunaleState(card, state.players, state.roundIndex),
    };
  }

  if (cardMode === 'classico') {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      classicoState: initPassClassicoState(state.players, state.roundIndex, rng),
    };
  }

  if (cardMode === 'coppie' && isCoppieCard(card)) {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      coppieState: initPassCoppieState(card, state.players, state.couples, state.roundIndex),
    };
  }

  // flash, assurdo, stima, bufala
  return {
    ...baseCleared,
    phase: 'DEBATE',
  };
}

function cardPromptForHighlight(card: PassCard | null): string {
  if (!card) return '';
  if (isFlashOrClassicoCard(card)) return card.text;
  if (isInfiltratoCard(card)) return card.groupQuestion;
  if (isAssurdoCard(card) || isCoppieCard(card)) return card.prompt;
  if (isCruciverbaCard(card)) return `Cruciverba · ${card.theme}`;
  if (isTribunaleCard(card)) return `${card.title}: ${card.scenario}`;
  if (isPreferirestiCard(card)) return card.prompt;
  if (isGhigliottinaCard(card)) return `La Ghigliottina: ${card.clues.join(' · ')}`;
  if (isStimaCard(card)) return card.prompt;
  if (isBufalaCard(card)) return card.statement;
  if (isIntesaCard(card)) return `Parola Vietata · ${card.category}`;
  return '';
}

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic community vote distribution for solo rounds ("Tu vs La Bussola del Mondo").
 * Always sums to 100 and produces realistic splits instead of a flat 100% vs 0% (1 vote).
 */
export function computeSoloCrowdSplit(cardId: string, optionCount = 2): number[] {
  const h = deterministicHash(cardId || 'schierati');
  if (optionCount <= 2) {
    const pctA = 28 + (h % 47); // 28..74
    return [pctA, 100 - pctA];
  }
  if (optionCount === 3) {
    const base3 = [
      [48, 33, 19],
      [42, 37, 21],
      [52, 31, 17],
    ][h % 3];
    const shift = (h >>> 3) % 3;
    return [0, 1, 2].map((i) => base3[(i + shift) % 3]);
  }
  const base4 = [
    [41, 28, 19, 12],
    [36, 31, 21, 12],
    [44, 26, 18, 12],
    [34, 29, 24, 13],
  ][h % 4];
  const shift = (h >>> 2) % 4;
  return [0, 1, 2, 3].map((i) => base4[(i + shift) % 4]);
}

function soloCounterForFlash(
  card: PassFlashCard | undefined,
  side: 'A' | 'B' | undefined,
): string | undefined {
  if (!card) return undefined;
  if (side === 'A') {
    if (card.spuntiB && card.spuntiB.length > 0) return card.spuntiB[0];
    return `Chi sceglie «${card.optionB}» risponderebbe che la tua scelta trascura un effetto collaterale reale: qual è il punto più fragile della tua tesi?`;
  }
  if (side === 'B') {
    if (card.spuntiA && card.spuntiA.length > 0) return card.spuntiA[0];
    return `Chi difende «${card.optionA}» sostiene che restare prudenti qui è la mossa più lucida: cosa ti ha fatto scartare quella strada?`;
  }
  return card.spuntiA?.[0] ?? card.spuntiB?.[0];
}

function soloCounterForPreferiresti(
  options: string[],
  splitPcts: number[],
  chosenIdx: number | undefined,
): string | undefined {
  if (options.length === 0) return undefined;
  let bestAltIdx = -1;
  let bestAltPct = -1;
  for (let i = 0; i < options.length; i++) {
    if (i === chosenIdx) continue;
    const pct = splitPcts[i] ?? 0;
    if (pct > bestAltPct) {
      bestAltPct = pct;
      bestAltIdx = i;
    }
  }
  if (bestAltIdx < 0) return undefined;
  return `Il ${bestAltPct}% dei giocatori invece preferisce «${options[bestAltIdx]}»: cosa vedi in meno in quell’alternativa?`;
}

function computeMomentBadge(outcome: RoundOutcome): PassMomentBadge {
  if (outcome.soloMode && (outcome.kind === 'split' || outcome.kind === 'swing' || outcome.kind === 'dignita')) {
    const pct = outcome.crowdPctForChoice ?? 50;
    if (outcome.soloFlipped) {
      return { emoji: '🦋', label: 'Prospettiva Ribaltata!', tone: 'gold' };
    }
    if (pct >= 55) {
      return { emoji: '🎯', label: `In Sintonia (${pct}%)`, tone: 'success' };
    }
    if (pct <= 45) {
      return { emoji: '⚡', label: `Controcorrente (${pct}%)`, tone: 'gold' };
    }
    return { emoji: '⚖️', label: `Sul Filo (${pct}%)`, tone: 'b' };
  }
  if (outcome.kind === 'swing') {
    if ((outcome.swingDelta ?? 0) >= 1) {
      return {
        emoji: '🦋',
        label: outcome.liveVerdictLabel ?? 'Ribaltone al Tavolo!',
        tone: 'gold',
      };
    }
    return {
      emoji: '🗿',
      label: outcome.liveVerdictLabel ?? 'Tutti Irremovibili',
      tone: 'a',
    };
  }

  if (outcome.kind === 'split') {
    if (outcome.countA > 0 && outcome.countA === outcome.countB) {
      return { emoji: '⚖️', label: 'Spaccato a Metà!', tone: 'b' };
    }
    if (outcome.countA + outcome.countB >= 2 && (outcome.countA === 0 || outcome.countB === 0)) {
      return { emoji: '🙌', label: 'Plebiscito Totale', tone: 'success' };
    }
    return { emoji: '⚡', label: outcome.liveVerdictLabel ?? 'Tavolo Diviso', tone: 'a' };
  }

  if (outcome.kind === 'dignita') {
    return {
      emoji: '🤪',
      label: outcome.liveVerdictLabel ?? 'Prova di Dignità',
      tone: 'gold',
    };
  }

  if (outcome.kind === 'infiltrato') {
    return outcome.infiltratoCaught
      ? { emoji: '🔍', label: 'Infiltrato Smascherato!', tone: 'success' }
      : { emoji: '🕵️', label: 'Fuga Perfetta!', tone: 'danger' };
  }

  if (outcome.kind === 'gogna') {
    return { emoji: '🎯', label: 'Sentenza della Gogna', tone: 'gold' };
  }

  if (outcome.kind === 'coppie_align') {
    return outcome.coppieMatched
      ? { emoji: '💘', label: 'Sintonia Perfetta!', tone: 'success' }
      : { emoji: '⚡', label: 'Scintille al Tavolo', tone: 'b' };
  }

  if (outcome.kind === 'coppie_challenge') {
    return outcome.coppieMatched
      ? { emoji: '🔥', label: 'Sfida Completata!', tone: 'success' }
      : { emoji: '🍺', label: 'Penitenza Presa!', tone: 'b' };
  }

  if (outcome.kind === 'tribunale') {
    return outcome.tribunaleWinner === 'TIE'
      ? { emoji: '🤝', label: 'Patteggiamento in Aula', tone: 'b' }
      : { emoji: '⚖️', label: 'Verdetto del Tribunale!', tone: 'gold' };
  }

  if (outcome.kind === 'ghigliottina') {
    return outcome.ghigliottinaCorrect
      ? { emoji: '🔗', label: 'Ghigliottina Centrata!', tone: 'success' }
      : { emoji: '💡', label: 'Ghigliottina Svelata', tone: 'gold' };
  }

  if (outcome.kind === 'stima') {
    if (outcome.stimaExact) return { emoji: '🎯', label: 'Centro Perfetto!', tone: 'success' };
    if (outcome.soloMode && outcome.stimaPrecisionPct !== undefined) {
      return {
        emoji: '💰',
        label: `Precisione ${outcome.stimaPrecisionPct}%`,
        tone: outcome.stimaPrecisionPct >= 80 ? 'success' : 'gold',
      };
    }
    return { emoji: '💰', label: 'Stima Svelata!', tone: 'gold' };
  }

  if (outcome.kind === 'bufala') {
    return outcome.bufalaCorrect
      ? { emoji: '🎭', label: 'Bufala Smascherata!', tone: 'success' }
      : { emoji: '🤡', label: 'Trappola Scattata!', tone: 'danger' };
  }

  if (outcome.kind === 'intesa') {
    if (outcome.intesaOutcome === 'guessed') {
      return { emoji: '🙌', label: 'Intesa Perfetta!', tone: 'success' };
    }
    if (outcome.intesaOutcome === 'taboo') {
      return { emoji: '🚨', label: 'Parola Vietata!', tone: 'danger' };
    }
    return { emoji: '⏭️', label: 'Parola Saltata', tone: 'b' };
  }

  return (outcome.cruciverbaSolvedCount ?? 0) === (outcome.cruciverbaTotalCount ?? 4)
    ? { emoji: '🧩', label: 'Tabellone Completo!', tone: 'success' }
    : { emoji: '💡', label: 'Cruciverba Svelato', tone: 'a' };
}

function upsertRoundHighlight(state: PassState, outcome: RoundOutcome): PassRoundHighlight[] {
  const card = getCurrentCard(state);
  const entry: PassRoundHighlight = {
    roundIndex: state.roundIndex,
    cardId: card?.id ?? `round_${state.roundIndex}`,
    cardMode: effectivePassCardMode(state.mode, card),
    prompt: cardPromptForHighlight(card),
    kind: outcome.kind,
    countA: outcome.countA,
    countB: outcome.countB,
    liveVerdictLabel: outcome.liveVerdictLabel,
    swingDelta: outcome.swingDelta,
    infiltratoId: outcome.infiltratoId,
    infiltratoCaught: outcome.infiltratoCaught,
    gognaWinnerIds: outcome.gognaWinnerIds,
    gognaTopVotes: outcome.gognaTopVotes,
    coppieMatched: outcome.coppieMatched,
    cruciverbaSolvedCount: outcome.cruciverbaSolvedCount,
    cruciverbaTotalCount: outcome.cruciverbaTotalCount,
    tribunaleWinnerIds: outcome.tribunaleWinnerIds,
    crowdPctForChoice: outcome.crowdPctForChoice,
    soloMode: outcome.soloMode,
    soloFlipped: outcome.soloFlipped,
    momentBadge: computeMomentBadge(outcome),
  };
  const prev = state.roundHistory ?? [];
  const existingIdx = prev.findIndex((h) => h.roundIndex === state.roundIndex);
  if (existingIdx >= 0) {
    const next = [...prev];
    next[existingIdx] = entry;
    return next;
  }
  return [...prev, entry];
}

function incrementAllPlayersRound(
  stats: Record<string, PlayerPassStats>,
  players: PassPlayer[],
): Record<string, PlayerPassStats> {
  const next = { ...stats };
  for (const p of players) {
    const cur = readStat(next, p.id);
    next[p.id] = { ...cur, rounds: (cur.rounds ?? 0) + 1 };
  }
  return next;
}

function advanceToNextRound(state: PassState, rng: () => number): PassState {
  const nextIndex = state.roundIndex + 1;
  if (nextIndex >= state.cards.length) {
    return {
      ...state,
      phase: 'FINAL_AWARDS',
    };
  }
  return enterCurrentRound(
    {
      ...state,
      roundIndex: nextIndex,
    },
    rng,
  );
}

function revealWordCells(
  words: PassCruciverbaCard['words'],
  revealedCells: string[],
  targetWordId?: string,
): string[] {
  const cellsSet = new Set(revealedCells);
  for (const w of words) {
    if (targetWordId && w.id !== targetWordId) continue;
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === 'V' ? w.row + i : w.row;
      const c = w.direction === 'H' ? w.col + i : w.col;
      cellsSet.add(`${r},${c}`);
    }
  }
  return [...cellsSet];
}

function syncRevealedWordStatuses(
  words: PassCruciverbaCard['words'],
  wordStatus: Record<string, 'pending' | 'solved' | 'revealed'>,
  cellsSet: Set<string>,
): Record<string, 'pending' | 'solved' | 'revealed'> {
  const nextStatus = { ...wordStatus };
  for (const w of words) {
    if (nextStatus[w.id] !== 'pending') continue;
    let allKnown = true;
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === 'V' ? w.row + i : w.row;
      const c = w.direction === 'H' ? w.col + i : w.col;
      if (!cellsSet.has(`${r},${c}`)) {
        allKnown = false;
        break;
      }
    }
    if (allKnown) nextStatus[w.id] = 'revealed';
  }
  return nextStatus;
}

function applyCruciverbaSolve(
  state: PassState,
  cs: CruciverbaPassState,
  word: PassCruciverbaCard['words'][number],
  solverId: string | null,
): PassState {
  const revealedCells = revealWordCells(cs.board.words, cs.revealedCells, word.id);
  const cellsSet = new Set(revealedCells);
  const nextStatus = syncRevealedWordStatuses(
    cs.board.words,
    { ...cs.wordStatus, [word.id]: 'solved' as const },
    cellsSet,
  );

  const nextStats = { ...state.stats };
  const effectiveSolverId =
    solverId ?? (state.players.length === 1 ? state.players[0]?.id ?? null : null);
  const solverName =
    (effectiveSolverId && state.players.find((p) => p.id === effectiveSolverId)?.name) ||
    (state.players.length === 1 ? 'Tu' : 'Tavolo');
  if (effectiveSolverId) {
    const cur = readStat(nextStats, effectiveSolverId);
    nextStats[effectiveSolverId] = { ...cur, coopWins: cur.coopWins + 1 };
  }

  const pending = cs.board.words.filter((w) => nextStatus[w.id] === 'pending');
  const nextTurnsTaken = cs.turnsTaken + 1;
  const updatedSolvedBy = { ...cs.solvedBy, [word.id]: solverName };

  if (pending.length === 0) {
    const allCells = revealWordCells(cs.board.words, revealedCells);
    const solvedCount = cs.board.words.filter((w) => nextStatus[w.id] === 'solved').length;
    const roundOutcome: RoundOutcome = {
      kind: 'cruciverba',
      countA: solvedCount,
      countB: cs.board.words.length - solvedCount,
      cruciverbaSolvedCount: solvedCount,
      cruciverbaTotalCount: cs.board.words.length,
    };
    return {
      ...state,
      stats: incrementAllPlayersRound(nextStats, state.players),
      cruciverbaState: {
        ...cs,
        wordStatus: nextStatus,
        solvedBy: updatedSolvedBy,
        revealedCells: allCells,
        turnsTaken: nextTurnsTaken,
        lastFeedback: `✓ ${solverName}: ${word.word}!`,
      },
      phase: 'ROUND_RESULT',
      roundOutcome,
      roundHistory: upsertRoundHighlight(state, roundOutcome),
    };
  }

  return {
    ...state,
    stats: nextStats,
    debateDurationSec: CRUCIVERBA_TURN_SEC,
    cruciverbaState: {
      ...cs,
      activeWordId: pending[0].id,
      wordStatus: nextStatus,
      solvedBy: updatedSolvedBy,
      revealedCells,
      turnsTaken: nextTurnsTaken,
      lastFeedback: `✓ ${solverName}: ${word.word}!`,
    },
  };
}

function normalizePassWord(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function passReducer(state: PassState, action: PassAction): PassState {
  switch (action.type) {
    case 'START_GAME': {
      const minP = minPlayersForMode(action.mode);
      if (action.players.length < minP || action.cards.length === 0) return state;
      const initial: PassState = {
        ...createInitialPassState(),
        mode: action.mode,
        players: action.players,
        couples: action.players.length % 2 === 0 ? buildPassCouples(action.players) : [],
        cards: action.cards,
        roundIndex: 0,
        cruciverbaMode: action.cruciverbaMode ?? 'indizi',
        soloFast: action.soloFast ?? false,
        lastSoloToast: null,
        stats: emptyStats(action.players),
        roundHistory: [],
      };
      return enterCurrentRound(initial, action.rng ?? Math.random);
    }

    case 'SET_SOLO_FAST':
      return {
        ...state,
        soloFast: action.enabled,
      };

    case 'UNLOCK_TURN': {
      if (state.phase !== 'PASS_CURTAIN') return state;
      if (state.secretKind === 'intesa_speaker') {
        return { ...state, phase: 'DEBATE', debateDurationSec: 0 };
      }
      return { ...state, phase: 'SECRET_TURN' };
    }

    case 'ACK_SECRET': {
      if (state.phase !== 'SECRET_TURN') return state;
      const nextTurn = state.turnIndex + 1;
      if (nextTurn < state.players.length) {
        return { ...state, turnIndex: nextTurn, phase: 'PASS_CURTAIN' };
      }
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      if (state.infiltratoId) {
        const cur = readStat(nextStats, state.infiltratoId);
        nextStats[state.infiltratoId] = {
          ...cur,
          infiltratoRoles: (cur.infiltratoRoles ?? 0) + 1,
        };
      }
      return {
        ...state,
        stats: nextStats,
        phase: 'DEBATE',
        debateDurationSec: 0,
      };
    }

    case 'RESOLVE_FLASH': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const cardMode = effectivePassCardMode(state.mode, card);
      const n = state.players.length;
      const optA = card && isFlashOrClassicoCard(card) ? card.optionA : 'Prima scelta';
      const optB = card && isFlashOrClassicoCard(card) ? card.optionB : 'Seconda scelta';
      const isSolo = n === 1;
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Scelta condivisa';
      let chosenSide: 'A' | 'B' | undefined;
      let crowdPctForChoice: number | undefined;
      let crowdSplitPcts: number[] | undefined;
      let counterArgument: string | undefined;

      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const reader = getCurrentReaderPlayer(state);

      if (isSolo) {
        const splitPcts = computeSoloCrowdSplit(card?.id ?? `flash_${state.roundIndex}`, 2);
        crowdSplitPcts = splitPcts;
        countA = splitPcts[0];
        countB = splitPcts[1];
        if (action.result === 'SPLIT') {
          crowdPctForChoice = 50;
          liveVerdictLabel = 'Combattuto tra le due scelte';
          if (reader) {
            const cur = readStat(nextStats, reader.id);
            nextStats[reader.id] = {
              ...cur,
              flips: cur.flips + 1,
              minorityCount: cur.minorityCount + 1,
            };
          }
        } else {
          chosenSide = action.result === 'B' ? 'B' : 'A';
          liveVerdictLabel = chosenSide === 'A' ? optA : optB;
          crowdPctForChoice = chosenSide === 'A' ? splitPcts[0] : splitPcts[1];
          counterArgument =
            card && isFlashOrClassicoCard(card) ? soloCounterForFlash(card, chosenSide) : undefined;
          if (reader) {
            const cur = readStat(nextStats, reader.id);
            const inMajority = crowdPctForChoice >= 50;
            nextStats[reader.id] = {
              ...cur,
              majorityCount: (cur.majorityCount ?? 0) + (inMajority ? 1 : 0),
              minorityCount: cur.minorityCount + (inMajority ? 0 : 1),
              steadyCount: (cur.steadyCount ?? 0) + 1,
            };
          }
        }
      } else {
        if (action.result === 'UNANIMOUS') {
          countA = Math.max(1, n);
          countB = 0;
          liveVerdictLabel = 'Tutti d’accordo';
          chosenSide = 'A';
        } else if (action.result === 'SPLIT') {
          const effN = Math.max(2, n);
          countA = Math.ceil(effN / 2);
          countB = effN - countA;
          liveVerdictLabel = 'Spaccati a metà!';
        } else if (action.result === 'A') {
          countA = Math.max(1, Math.ceil(n * 0.7));
          countB = Math.max(1, n - countA);
          liveVerdictLabel = optA;
          chosenSide = 'A';
        } else {
          countB = Math.max(1, Math.ceil(n * 0.7));
          countA = Math.max(1, n - countB);
          liveVerdictLabel = optB;
          chosenSide = 'B';
        }

        if (reader && action.result !== 'SPLIT') {
          const cur = readStat(nextStats, reader.id);
          nextStats[reader.id] = { ...cur, majorityCount: (cur.majorityCount ?? 0) + 1 };
        }
      }

      const roundOutcome: RoundOutcome = {
        kind: 'split',
        countA,
        countB,
        liveVerdictLabel,
        ...(chosenSide ? { chosenSide } : {}),
        ...(crowdPctForChoice !== undefined ? { crowdPctForChoice } : {}),
        ...(crowdSplitPcts ? { crowdSplitPcts } : {}),
        ...(counterArgument ? { counterArgument } : {}),
        ...(isSolo ? { soloMode: true } : {}),
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
        storyChoicesA:
          (state.storyChoicesA ?? 0) + (cardMode === 'storia' && chosenSide === 'A' ? 1 : 0),
      };
      if (isSolo && state.soloFast && cardMode !== 'storia') {
        const fastUpdated: PassState = {
          ...updated,
          lastSoloToast: {
            chosenLabel: liveVerdictLabel,
            crowdPct: crowdPctForChoice ?? 50,
          },
        };
        return advanceToNextRound(fastUpdated, action.rng ?? Math.random);
      }
      if (
        isSolo ||
        (card &&
          isFlashOrClassicoCard(card) &&
          (card.storyScene || card.domandaRilancio || card.lezioneReale || card.penalty))
      ) {
        return {
          ...updated,
          lastSoloToast: null,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound({ ...updated, lastSoloToast: null }, action.rng ?? Math.random);
    }

    case 'RESOLVE_PREFERIRESTI': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const n = state.players.length;
      const isSolo = n === 1;
      const opts = card && isPreferirestiCard(card) ? card.options.slice(0, isSolo ? 2 : 4) : [];
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Tutte scelte diverse!';
      let chosenOptionIndex: number | undefined;
      let crowdPctForChoice: number | undefined;
      let crowdSplitPcts: number[] | undefined;
      let counterArgument: string | undefined;

      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const reader = getCurrentReaderPlayer(state);

      if (isSolo) {
        const splitPcts = computeSoloCrowdSplit(
          card?.id ?? `pref_${state.roundIndex}`,
          2,
        );
        crowdSplitPcts = splitPcts;
        if (action.choice === 'SPLIT') {
          crowdPctForChoice = 50;
          countA = 50;
          countB = 50;
          liveVerdictLabel = 'Combattuto tra più alternative';
          if (reader) {
            const cur = readStat(nextStats, reader.id);
            nextStats[reader.id] = {
              ...cur,
              flips: cur.flips + 1,
              minorityCount: cur.minorityCount + 1,
            };
          }
        } else {
          const idx = (['A', 'B', 'C', 'D'] as const).indexOf(action.choice);
          chosenOptionIndex = idx >= 0 ? idx : 0;
          const optionText = opts[chosenOptionIndex];
          liveVerdictLabel = optionText ?? 'La tua scelta';
          crowdPctForChoice = splitPcts[chosenOptionIndex] ?? splitPcts[0];
          countA = crowdPctForChoice;
          countB = 100 - crowdPctForChoice;
          const topPct = Math.max(...splitPcts);
          counterArgument = soloCounterForPreferiresti(opts, splitPcts, chosenOptionIndex);
          if (reader) {
            const cur = readStat(nextStats, reader.id);
            const inMajority = crowdPctForChoice >= topPct || crowdPctForChoice >= 30;
            nextStats[reader.id] = {
              ...cur,
              majorityCount: (cur.majorityCount ?? 0) + (inMajority ? 1 : 0),
              minorityCount: cur.minorityCount + (inMajority ? 0 : 1),
              steadyCount: (cur.steadyCount ?? 0) + 1,
            };
          }
        }
      } else {
        if (action.choice === 'SPLIT') {
          const effN = Math.max(2, n);
          countA = Math.ceil(effN / 2);
          countB = effN - countA;
        } else {
          const idx = (['A', 'B', 'C', 'D'] as const).indexOf(action.choice);
          const optionText = opts[idx];
          liveVerdictLabel = optionText ?? 'Scelta del tavolo';
          if (action.choice === 'A' || action.choice === 'C') {
            countA = Math.max(1, Math.ceil(n * 0.7));
            countB = Math.max(1, n - countA);
          } else {
            countB = Math.max(1, Math.ceil(n * 0.7));
            countA = Math.max(1, n - countB);
          }
        }

        if (reader) {
          const cur = readStat(nextStats, reader.id);
          if (action.choice === 'SPLIT') {
            nextStats[reader.id] = {
              ...cur,
              flips: cur.flips + 1,
              minorityCount: cur.minorityCount + 1,
            };
          } else {
            nextStats[reader.id] = { ...cur, majorityCount: (cur.majorityCount ?? 0) + 1 };
          }
        }
      }

      const roundOutcome: RoundOutcome = {
        kind: 'split',
        countA,
        countB,
        liveVerdictLabel,
        ...(chosenOptionIndex !== undefined ? { chosenOptionIndex } : {}),
        ...(crowdPctForChoice !== undefined ? { crowdPctForChoice } : {}),
        ...(crowdSplitPcts ? { crowdSplitPcts } : {}),
        ...(counterArgument ? { counterArgument } : {}),
        ...(isSolo ? { soloMode: true } : {}),
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
      if (isSolo && state.soloFast) {
        const fastUpdated: PassState = {
          ...updated,
          lastSoloToast: {
            chosenLabel: liveVerdictLabel,
            crowdPct: crowdPctForChoice ?? 50,
          },
        };
        return advanceToNextRound(fastUpdated, action.rng ?? Math.random);
      }
      if (isSolo || (card && isPreferirestiCard(card) && card.penalty)) {
        return {
          ...updated,
          lastSoloToast: null,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound({ ...updated, lastSoloToast: null }, action.rng ?? Math.random);
    }

    case 'RESOLVE_CLASSICO': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const cardMode = effectivePassCardMode(state.mode, card);
      const cs = state.classicoState;
      const n = state.players.length;
      const isSolo = n === 1;
      const effN = Math.max(2, n);
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let countA = Math.ceil(effN / 2);
      let countB = effN - countA;
      let swingDelta = 0;
      let winnerId: string | null = null;
      let liveVerdictLabel = 'Tutti irremovibili';
      let chosenSide: 'A' | 'B' | undefined;
      let crowdPctForChoice: number | undefined;
      let crowdSplitPcts: number[] | undefined;
      let counterArgument: string | undefined;

      const optA = card && isFlashOrClassicoCard(card) ? card.optionA : 'Prima scelta';
      const optB = card && isFlashOrClassicoCard(card) ? card.optionB : 'Seconda scelta';

      if (isSolo) {
        const splitPcts = computeSoloCrowdSplit(card?.id ?? `classico_${state.roundIndex}`, 2);
        crowdSplitPcts = splitPcts;
        countA = splitPcts[0];
        countB = splitPcts[1];
        const sole = state.players[0];
        if (action.outcome === 'CONVINCE_A' || action.outcome === 'CONVINCE_B') {
          chosenSide = action.outcome === 'CONVINCE_A' ? 'A' : 'B';
          liveVerdictLabel = chosenSide === 'A' ? optA : optB;
          crowdPctForChoice = chosenSide === 'A' ? splitPcts[0] : splitPcts[1];
          counterArgument =
            card && isFlashOrClassicoCard(card) ? soloCounterForFlash(card, chosenSide) : undefined;
          winnerId = sole.id;
          const cur = readStat(nextStats, sole.id);
          const inMaj = crowdPctForChoice >= 50;
          nextStats[sole.id] = {
            ...cur,
            majorityCount: (cur.majorityCount ?? 0) + (inMaj ? 1 : 0),
            minorityCount: cur.minorityCount + (inMaj ? 0 : 1),
            steadyCount: (cur.steadyCount ?? 0) + 1,
          };
        } else if (action.outcome === 'FLIP') {
          swingDelta = 2;
          crowdPctForChoice = 50;
          liveVerdictLabel = 'Cambio di prospettiva!';
          const cur = readStat(nextStats, sole.id);
          nextStats[sole.id] = { ...cur, flips: cur.flips + 1 };
        } else {
          crowdPctForChoice = 50;
          liveVerdictLabel = 'Posizione confermata';
          const cur = readStat(nextStats, sole.id);
          nextStats[sole.id] = { ...cur, steadyCount: (cur.steadyCount ?? 0) + 1 };
        }
      } else if (action.outcome === 'CONVINCE_A' && cs) {
        countA = Math.max(1, Math.ceil(n * 0.7));
        countB = Math.max(1, n - countA);
        swingDelta = 1;
        winnerId = cs.defenderAId;
        chosenSide = 'A';
        liveVerdictLabel = optA;
        const wCur = readStat(nextStats, cs.defenderAId);
        nextStats[cs.defenderAId] = { ...wCur, majorityCount: (wCur.majorityCount ?? 0) + 1 };
        if (cs.defenderBId !== cs.defenderAId) {
          const lCur = readStat(nextStats, cs.defenderBId);
          nextStats[cs.defenderBId] = { ...lCur, minorityCount: lCur.minorityCount + 1 };
        }
      } else if (action.outcome === 'CONVINCE_B' && cs) {
        countB = Math.max(1, Math.ceil(n * 0.7));
        countA = Math.max(1, n - countB);
        swingDelta = 1;
        winnerId = cs.defenderBId;
        chosenSide = 'B';
        liveVerdictLabel = optB;
        const wCur = readStat(nextStats, cs.defenderBId);
        nextStats[cs.defenderBId] = { ...wCur, majorityCount: (wCur.majorityCount ?? 0) + 1 };
        if (cs.defenderAId !== cs.defenderBId) {
          const lCur = readStat(nextStats, cs.defenderAId);
          nextStats[cs.defenderAId] = { ...lCur, minorityCount: lCur.minorityCount + 1 };
        }
      } else if (action.outcome === 'FLIP') {
        swingDelta = 2;
        liveVerdictLabel = 'Ribaltone al tavolo!';
        for (const p of state.players) {
          const cur = readStat(nextStats, p.id);
          nextStats[p.id] = { ...cur, flips: cur.flips + 1 };
        }
      } else {
        swingDelta = 0;
        liveVerdictLabel = 'Nessuno ha cambiato idea';
        for (const p of state.players) {
          const cur = readStat(nextStats, p.id);
          nextStats[p.id] = { ...cur, steadyCount: (cur.steadyCount ?? 0) + 1 };
        }
      }

      const roundOutcome: RoundOutcome = {
        kind: 'swing',
        countA,
        countB,
        swingDelta,
        classicoWinnerId: winnerId,
        liveVerdictLabel,
        ...(chosenSide ? { chosenSide } : {}),
        ...(crowdPctForChoice !== undefined ? { crowdPctForChoice } : {}),
        ...(crowdSplitPcts ? { crowdSplitPcts } : {}),
        ...(counterArgument ? { counterArgument } : {}),
        ...(isSolo ? { soloMode: true } : {}),
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
        storyChoicesA:
          (state.storyChoicesA ?? 0) + (cardMode === 'storia' && chosenSide === 'A' ? 1 : 0),
      };
      if (isSolo && state.soloFast && cardMode !== 'storia') {
        const fastUpdated: PassState = {
          ...updated,
          lastSoloToast: {
            chosenLabel: liveVerdictLabel,
            crowdPct: crowdPctForChoice ?? 50,
          },
        };
        return advanceToNextRound(fastUpdated, action.rng ?? Math.random);
      }
      if (
        isSolo ||
        (card &&
          isFlashOrClassicoCard(card) &&
          (card.storyScene || card.domandaRilancio || card.lezioneReale || card.penalty))
      ) {
        return {
          ...updated,
          lastSoloToast: null,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound({ ...updated, lastSoloToast: null }, action.rng ?? Math.random);
    }

    case 'SOLO_FLIP_AFTER_OBJECTION': {
      if (state.phase !== 'ROUND_RESULT' || state.players.length !== 1 || !state.roundOutcome) {
        return state;
      }
      const prev = state.roundOutcome;
      if (prev.soloFlipped || !prev.chosenSide) return state;
      const card = getCurrentCard(state);
      const cardMode = effectivePassCardMode(state.mode, card);
      const splitPcts = prev.crowdSplitPcts ?? [prev.countA, prev.countB];
      const oldSide = prev.chosenSide;
      const newSide: 'A' | 'B' = oldSide === 'A' ? 'B' : 'A';
      const oldPct = oldSide === 'A' ? splitPcts[0] : splitPcts[1];
      const newPct = newSide === 'A' ? splitPcts[0] : splitPcts[1];
      const newLabel =
        card && isFlashOrClassicoCard(card)
          ? newSide === 'A'
            ? card.optionA
            : card.optionB
          : card && isAssurdoCard(card)
            ? newSide === 'A'
              ? (card.optionA ?? 'Accetto!')
              : (card.optionB ?? 'Mai nella vita')
            : newSide === 'A'
              ? 'Prima scelta'
              : 'Seconda scelta';

      const sole = state.players[0];
      const cur = readStat(state.stats, sole.id);
      const wasMaj = oldPct >= 50;
      const nowMaj = newPct >= 50;
      const nextStats: Record<string, PlayerPassStats> = {
        ...state.stats,
        [sole.id]: {
          ...cur,
          flips: cur.flips + 1,
          steadyCount: Math.max(0, (cur.steadyCount ?? 0) - 1),
          majorityCount: Math.max(0, (cur.majorityCount ?? 0) + (wasMaj ? -1 : 0) + (nowMaj ? 1 : 0)),
          minorityCount: Math.max(0, cur.minorityCount + (wasMaj ? 0 : -1) + (nowMaj ? 0 : 1)),
        },
      };

      const nextCounter =
        card && isFlashOrClassicoCard(card) ? soloCounterForFlash(card, newSide) : undefined;
      const nextOutcome: RoundOutcome = {
        ...prev,
        chosenSide: newSide,
        liveVerdictLabel: newLabel,
        crowdPctForChoice: newPct,
        counterArgument: nextCounter,
        swingDelta: Math.max(1, prev.swingDelta ?? 1),
        soloFlipped: true,
      };
      const storyDelta =
        cardMode === 'storia' ? (newSide === 'A' ? 1 : -1) : 0;

      return {
        ...state,
        stats: nextStats,
        roundOutcome: nextOutcome,
        roundHistory: upsertRoundHighlight(state, nextOutcome),
        storyChoicesA: Math.max(0, (state.storyChoicesA ?? 0) + storyDelta),
      };
    }

    case 'RESOLVE_INFILTRATO_ACCUSATION': {
      if (
        state.phase !== 'DEBATE' ||
        effectivePassCardMode(state.mode, getCurrentCard(state)) !== 'infiltrato'
      ) {
        return state;
      }
      const infiltratoCaught =
        state.infiltratoId !== null && action.accusedId === state.infiltratoId;
      const nextStats = { ...state.stats };

      if (infiltratoCaught) {
        for (const p of state.players) {
          if (p.id === state.infiltratoId) continue;
          const cur = readStat(nextStats, p.id);
          nextStats[p.id] = { ...cur, infiltratoCatches: cur.infiltratoCatches + 1 };
        }
      } else if (state.infiltratoId) {
        const infCur = readStat(nextStats, state.infiltratoId);
        nextStats[state.infiltratoId] = {
          ...infCur,
          infiltratoWins: infCur.infiltratoWins + 1,
        };
      }

      const roundOutcome: RoundOutcome = {
        kind: 'infiltrato',
        countA: 0,
        countB: 0,
        infiltratoId: state.infiltratoId ?? undefined,
        infiltratoAccusedId: action.accusedId,
        accusedIds: action.accusedId ? [action.accusedId] : [],
        infiltratoCaught,
      };

      return {
        ...state,
        phase: 'ROUND_RESULT',
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_GOGNA': {
      if (state.phase !== 'DEBATE') return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      if (action.targetId) {
        const cur = readStat(nextStats, action.targetId);
        nextStats[action.targetId] = { ...cur, gognaHits: cur.gognaHits + 1 };
      }

      const roundOutcome: RoundOutcome = {
        kind: 'gogna',
        countA: 0,
        countB: 0,
        gognaWinnerIds: action.targetId ? [action.targetId] : [],
        gognaTopVotes: action.targetId ? state.players.length : 0,
      };

      return {
        ...state,
        phase: 'ROUND_RESULT',
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_DIGNITA': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const optA = card && isAssurdoCard(card) && card.optionA ? card.optionA : 'Accetto!';
      const optB = card && isAssurdoCard(card) && card.optionB ? card.optionB : 'Mai nella vita';
      const n = state.players.length;
      const isSolo = n === 1;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Tavolo spaccato';
      let chosenSide: 'A' | 'B' | undefined;
      let crowdPctForChoice: number | undefined;
      let crowdSplitPcts: number[] | undefined;
      let counterArgument: string | undefined;

      if (isSolo && action.outcome !== 'SPLIT') {
        const splitPcts = computeSoloCrowdSplit(card?.id ?? `dig_${state.roundIndex}`, 2);
        crowdSplitPcts = splitPcts;
        countA = splitPcts[0];
        countB = splitPcts[1];
        chosenSide = action.outcome === 'YES' ? 'A' : 'B';
        liveVerdictLabel = chosenSide === 'A' ? optA : optB;
        crowdPctForChoice = chosenSide === 'A' ? splitPcts[0] : splitPcts[1];
        const oppPct = chosenSide === 'A' ? splitPcts[1] : splitPcts[0];
        counterArgument =
          chosenSide === 'A'
            ? `Il ${oppPct}% risponderebbe invece «${optB}»: dov’è il tuo limite reale?`
            : `Il ${oppPct}% accetterebbe («${optA}») pur di non tirarsi indietro: sei sicuro del tuo no?`;
        const sole = state.players[0];
        const cur = readStat(nextStats, sole.id);
        const inMaj = crowdPctForChoice >= 50;
        nextStats[sole.id] = {
          ...cur,
          majorityCount: (cur.majorityCount ?? 0) + (inMaj ? 1 : 0),
          minorityCount: cur.minorityCount + (inMaj ? 0 : 1),
          steadyCount: (cur.steadyCount ?? 0) + 1,
        };
      } else if (action.outcome === 'YES') {
        countA = Math.max(1, n);
        countB = 0;
        liveVerdictLabel = optA;
        chosenSide = 'A';
      } else if (action.outcome === 'NO') {
        countA = 0;
        countB = Math.max(1, n);
        liveVerdictLabel = optB;
        chosenSide = 'B';
      } else {
        const effN = Math.max(2, n);
        countA = Math.ceil(effN / 2);
        countB = effN - countA;
        liveVerdictLabel = 'Tavolo spaccato!';
      }

      const roundOutcome: RoundOutcome = {
        kind: 'dignita',
        countA,
        countB,
        liveVerdictLabel,
        ...(chosenSide ? { chosenSide } : {}),
        ...(crowdPctForChoice !== undefined ? { crowdPctForChoice } : {}),
        ...(crowdSplitPcts ? { crowdSplitPcts } : {}),
        ...(counterArgument ? { counterArgument } : {}),
        ...(isSolo ? { soloMode: true } : {}),
      };

      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
      if (isSolo && state.soloFast) {
        return advanceToNextRound(
          {
            ...updated,
            lastSoloToast: {
              chosenLabel: liveVerdictLabel,
              crowdPct: crowdPctForChoice ?? 50,
            },
          },
          action.rng ?? Math.random,
        );
      }
      return {
        ...updated,
        lastSoloToast: null,
        phase: 'ROUND_RESULT',
      };
    }

    case 'RESOLVE_COPPIE_ALIGN': {
      if (state.phase !== 'DEBATE') return state;
      const matchedSet = new Set(action.matchedCoupleIds);
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const updatedCouples: PassCouplePair[] = [];
      const coupleOutcomes: PassCoupleRoundOutcome[] = [];

      if (state.couples.length > 0) {
        for (const c of state.couples) {
          const matched = matchedSet.has(c.id);
          const nameA = state.players.find((p) => p.id === c.memberAId)?.name ?? 'P1';
          const nameB = state.players.find((p) => p.id === c.memberBId)?.name ?? 'P2';
          coupleOutcomes.push({
            coupleId: c.id,
            memberAName: nameA,
            memberBName: nameB,
            choiceALabel: null,
            choiceBLabel: null,
            matched,
          });
          updatedCouples.push({
            ...c,
            score: c.score + (matched ? 100 : 0),
            matches: c.matches + (matched ? 1 : 0),
          });
          if (matched) {
            for (const pid of [c.memberAId, c.memberBId]) {
              const cur = readStat(nextStats, pid);
              nextStats[pid] = { ...cur, coppieMatches: (cur.coppieMatches ?? 0) + 1 };
            }
          }
        }
      } else if (state.coppieState) {
        const [idA, idB] = state.coppieState.featuredPairIds;
        const matched = matchedSet.has('dynamic_pair');
        const nameA = state.players.find((p) => p.id === idA)?.name ?? 'P1';
        const nameB = state.players.find((p) => p.id === idB)?.name ?? 'P2';
        coupleOutcomes.push({
          coupleId: 'dynamic_pair',
          memberAName: nameA,
          memberBName: nameB,
          choiceALabel: null,
          choiceBLabel: null,
          matched,
        });
        if (matched) {
          for (const pid of [idA, idB]) {
            const cur = readStat(nextStats, pid);
            nextStats[pid] = { ...cur, coppieMatches: (cur.coppieMatches ?? 0) + 1 };
          }
        }
      }

      const matchedCount = coupleOutcomes.filter((o) => o.matched).length;
      const coppieMatched = matchedCount > 0;

      const roundOutcome: RoundOutcome = {
        kind: 'coppie_align',
        countA: matchedCount,
        countB: coupleOutcomes.length - matchedCount,
        coppieMatched,
        coupleOutcomes,
      };

      return {
        ...state,
        couples: updatedCouples,
        phase: 'ROUND_RESULT',
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_COPPIE_CHALLENGE': {
      if (state.phase !== 'DEBATE') return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let updatedCouples = state.couples;

      if (action.completed && state.coppieState) {
        for (const pid of state.coppieState.featuredPairIds) {
          const cur = readStat(nextStats, pid);
          nextStats[pid] = { ...cur, coppieMatches: (cur.coppieMatches ?? 0) + 1 };
        }
        if (state.coppieState.featuredCoupleId) {
          updatedCouples = state.couples.map((c) =>
            c.id === state.coppieState?.featuredCoupleId
              ? { ...c, score: c.score + 50, matches: c.matches + 1 }
              : c,
          );
        }
      }

      const roundOutcome: RoundOutcome = {
        kind: 'coppie_challenge',
        countA: action.completed ? 1 : 0,
        countB: action.completed ? 0 : 1,
        coppieMatched: action.completed,
        liveVerdictLabel: action.completed ? 'Sfida completata!' : 'Penitenza presa!',
      };

      const updated: PassState = {
        ...state,
        couples: updatedCouples,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
      return advanceToNextRound(updated, action.rng ?? Math.random);
    }

    case 'CRUCIVERBA_SELECT_WORD': {
      const cs = state.cruciverbaState;
      if (state.phase !== 'DEBATE' || !cs) return state;
      if (cs.wordStatus[action.wordId] !== 'pending') return state;
      return {
        ...state,
        cruciverbaState: {
          ...cs,
          activeWordId: action.wordId,
          lastFeedback: undefined,
        },
      };
    }

    case 'CRUCIVERBA_SOLVE_WORD': {
      const cs = state.cruciverbaState;
      if (state.phase !== 'DEBATE' || !cs) return state;
      const word = cs.board.words.find((w) => w.id === action.wordId);
      if (!word || cs.wordStatus[word.id] !== 'pending') return state;
      return applyCruciverbaSolve(state, cs, word, action.solverId);
    }

    case 'CRUCIVERBA_GUESS_CHOICE': {
      const cs = state.cruciverbaState;
      if (state.phase !== 'DEBATE' || !cs) return state;
      const word = cs.board.words.find((w) => w.id === action.wordId);
      if (!word || cs.wordStatus[word.id] !== 'pending') return state;
      const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (norm(action.choice) === norm(word.word)) {
        return applyCruciverbaSolve(state, cs, word, action.solverId ?? null);
      }
      const wrongVal = action.choice.trim().toUpperCase();
      const prevWrong = cs.wrongChoices[word.id] ?? [];
      const nextWrong = prevWrong.includes(wrongVal) ? prevWrong : [...prevWrong, wrongVal];
      return {
        ...state,
        cruciverbaState: {
          ...cs,
          wrongChoices: {
            ...cs.wrongChoices,
            [word.id]: nextWrong,
          },
          lastFeedback: '✗ Non è questa! Guarda gli incroci o sblocca 1 lettera.',
        },
      };
    }

    case 'CRUCIVERBA_PASS': {
      const cs = state.cruciverbaState;
      if (state.phase !== 'DEBATE' || !cs) return state;
      const pending = cs.board.words.filter((w) => cs.wordStatus[w.id] === 'pending');
      const targetWord = pending.find((w) => w.id === cs.activeWordId) ?? pending[0];
      const cellsSet = new Set(cs.revealedCells);
      const rng = action.rng ?? Math.random;

      if (targetWord) {
        const hidden: string[] = [];
        for (let i = 0; i < targetWord.word.length; i++) {
          const r = targetWord.direction === 'V' ? targetWord.row + i : targetWord.row;
          const c = targetWord.direction === 'H' ? targetWord.col + i : targetWord.col;
          const k = `${r},${c}`;
          if (!cellsSet.has(k)) hidden.push(k);
        }
        if (hidden.length > 0) {
          cellsSet.add(hidden[Math.floor(rng() * hidden.length)]);
        }
      }

      const nextStatus = syncRevealedWordStatuses(cs.board.words, cs.wordStatus, cellsSet);
      const nextPending = cs.board.words.filter((w) => nextStatus[w.id] === 'pending');
      const nextTurnsTaken = cs.turnsTaken + 1;

      if (nextPending.length === 0) {
        const allCells = revealWordCells(cs.board.words, [...cellsSet]);
        const solvedCount = cs.board.words.filter((w) => nextStatus[w.id] === 'solved').length;
        const roundOutcome: RoundOutcome = {
          kind: 'cruciverba',
          countA: solvedCount,
          countB: cs.board.words.length - solvedCount,
          cruciverbaSolvedCount: solvedCount,
          cruciverbaTotalCount: cs.board.words.length,
        };
        return {
          ...state,
          stats: incrementAllPlayersRound(state.stats, state.players),
          cruciverbaState: {
            ...cs,
            wordStatus: nextStatus,
            revealedCells: allCells,
            turnsTaken: nextTurnsTaken,
            hintsUsed: cs.hintsUsed + 1,
          },
          phase: 'ROUND_RESULT',
          roundOutcome,
          roundHistory: upsertRoundHighlight(state, roundOutcome),
        };
      }

      const activeStillPending = nextPending.some((w) => w.id === cs.activeWordId);
      const nextWordId = activeStillPending ? cs.activeWordId : nextPending[0].id;

      return {
        ...state,
        debateDurationSec: CRUCIVERBA_TURN_SEC,
        cruciverbaState: {
          ...cs,
          activeWordId: nextWordId,
          wordStatus: nextStatus,
          revealedCells: [...cellsSet],
          turnsTaken: nextTurnsTaken,
          hintsUsed: cs.hintsUsed + 1,
          lastFeedback:
            action.reason === 'timeout'
              ? '⏰ Tempo! Sbloccata 1 lettera.'
              : '💡 Sbloccata 1 lettera!',
        },
      };
    }

    case 'CRUCIVERBA_END_NOW': {
      const cs = state.cruciverbaState;
      if (state.phase !== 'DEBATE' || !cs) return state;
      const allCells = revealWordCells(cs.board.words, cs.revealedCells);
      const solvedCount = cs.board.words.filter((w) => cs.wordStatus[w.id] === 'solved').length;
      const roundOutcome: RoundOutcome = {
        kind: 'cruciverba',
        countA: solvedCount,
        countB: cs.board.words.length - solvedCount,
        cruciverbaSolvedCount: solvedCount,
        cruciverbaTotalCount: cs.board.words.length,
      };
      return {
        ...state,
        stats: incrementAllPlayersRound(state.stats, state.players),
        cruciverbaState: { ...cs, revealedCells: allCells },
        phase: 'ROUND_RESULT',
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'TRIBUNALE_NEXT_SPEAKER': {
      const ts = state.tribunaleState;
      if (state.phase !== 'DEBATE' || !ts) return state;
      if (ts.speakerIndex === 0 && !ts.verdictReady) {
        return {
          ...state,
          debateDurationSec: TRIBUNALE_SPEAK_SEC,
          tribunaleState: { ...ts, speakerIndex: 1 },
        };
      }
      return {
        ...state,
        debateDurationSec: 0,
        tribunaleState: { ...ts, verdictReady: true },
      };
    }

    case 'TRIBUNALE_RESOLVE': {
      const ts = state.tribunaleState;
      if (state.phase !== 'DEBATE' || !ts) return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const juryCount = Math.max(1, ts.juryIds.length);
      let winnerIds: string[] = [ts.accusaId, ts.difesaId];
      let loserId: string | null = null;
      let accusaVotes = juryCount;
      let difesaVotes = juryCount;

      if (action.winner === 'ACCUSA') {
        winnerIds = [ts.accusaId];
        loserId = ts.difesaId;
        accusaVotes = juryCount;
        difesaVotes = 0;
      } else if (action.winner === 'DIFESA') {
        winnerIds = [ts.difesaId];
        loserId = ts.accusaId;
        accusaVotes = 0;
        difesaVotes = juryCount;
      } else {
        accusaVotes = Math.ceil(juryCount / 2);
        difesaVotes = juryCount - accusaVotes;
      }

      if (action.winner !== 'TIE') {
        for (const wid of winnerIds) {
          const cur = readStat(nextStats, wid);
          nextStats[wid] = { ...cur, tribunaleWins: (cur.tribunaleWins ?? 0) + 1 };
        }
      }

      const roundOutcome: RoundOutcome = {
        kind: 'tribunale',
        countA: accusaVotes,
        countB: difesaVotes,
        tribunaleWinner: action.winner,
        tribunaleWinnerIds: winnerIds,
        tribunaleLoserId: loserId,
        tribunaleAccusaVotes: accusaVotes,
        tribunaleDifesaVotes: difesaVotes,
      };

      return {
        ...state,
        phase: 'ROUND_RESULT',
        stats: nextStats,
        tribunaleState: { ...ts, winner: action.winner, accusaVotes, difesaVotes },
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_GHIGLIOTTINA': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      if (!card || !isGhigliottinaCard(card)) return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let correct = false;
      let effectiveWinnerId: string | null = action.winnerId ?? null;
      if (action.guess !== undefined) {
        correct = normalizePassWord(action.guess) === normalizePassWord(card.answer);
        if (action.winnerId === undefined) {
          effectiveWinnerId =
            correct && state.players.length === 1 ? (state.players[0]?.id ?? null) : null;
        }
        if (effectiveWinnerId) correct = true;
      } else if (effectiveWinnerId) {
        correct = true;
      }
      if (effectiveWinnerId) {
        const cur = readStat(nextStats, effectiveWinnerId);
        nextStats[effectiveWinnerId] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
      }
      const winnerName = effectiveWinnerId
        ? state.players.find((p) => p.id === effectiveWinnerId)?.name
        : undefined;
      const liveVerdictLabel = correct
        ? winnerName && state.players.length > 1
          ? `${card.answer} · Indovinata da ${winnerName}!`
          : `${card.answer} · Risposta esatta!`
        : `${card.answer} · Nessuno l’ha presa`;
      const roundOutcome: RoundOutcome = {
        kind: 'ghigliottina',
        countA: correct ? 1 : 0,
        countB: correct ? 0 : 1,
        liveVerdictLabel,
        ...(action.guess !== undefined ? { ghigliottinaGuess: action.guess } : {}),
        ghigliottinaCorrect: correct,
        ghigliottinaWinnerId: effectiveWinnerId,
        soloMode: state.players.length === 1,
      };
      return {
        ...state,
        stats: nextStats,
        phase: 'ROUND_RESULT',
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_STIMA': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      if (!card || !isStimaCard(card)) return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let precision: number | undefined;
      let exact = false;
      let effectiveWinnerId: string | null = action.winnerId ?? null;
      if (action.soloGuess !== undefined) {
        const span = Math.max(1, card.max - card.min);
        const diff = Math.abs(action.soloGuess - card.answer);
        precision = Math.max(0, Math.min(100, Math.round((1 - diff / span) * 100)));
        exact = diff <= Math.max(card.step, span * 0.05);
        if ((exact || precision >= 80) && state.players.length === 1 && state.players[0]) {
          effectiveWinnerId = state.players[0].id;
        }
      }
      if (effectiveWinnerId) {
        const cur = readStat(nextStats, effectiveWinnerId);
        nextStats[effectiveWinnerId] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
      }
      const winnerName = effectiveWinnerId
        ? state.players.find((p) => p.id === effectiveWinnerId)?.name
        : undefined;
      const liveVerdictLabel =
        action.soloGuess !== undefined
          ? exact
            ? `Centro perfetto! ${card.answer} ${card.unit}`
            : `Precisione ${precision}% · Risposta ${card.answer} ${card.unit}`
          : winnerName
            ? `${winnerName} più vicino (${card.answer} ${card.unit})`
            : `Risposta esatta: ${card.answer} ${card.unit}`;
      const roundOutcome: RoundOutcome = {
        kind: 'stima',
        countA: effectiveWinnerId ? 1 : 0,
        countB: effectiveWinnerId ? 0 : 1,
        liveVerdictLabel,
        ...(action.soloGuess !== undefined ? { stimaSoloGuess: action.soloGuess } : {}),
        ...(precision !== undefined ? { stimaPrecisionPct: precision } : {}),
        stimaExact: exact,
        stimaWinnerId: effectiveWinnerId,
        soloMode: state.players.length === 1,
      };
      return {
        ...state,
        stats: nextStats,
        phase: 'ROUND_RESULT',
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_BUFALA': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      if (!card || !isBufalaCard(card)) return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const correct = action.guessIsTrue !== null && action.guessIsTrue === card.isTrue;
      if (correct) {
        if (state.players.length === 1 && state.players[0]) {
          const cur = readStat(nextStats, state.players[0].id);
          nextStats[state.players[0].id] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
        } else {
          for (const p of state.players) {
            const cur = readStat(nextStats, p.id);
            nextStats[p.id] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
          }
        }
      }
      const truthLabel = card.isTrue ? 'Era VERO!' : 'Era una BUFALA!';
      const liveVerdictLabel =
        action.guessIsTrue === null
          ? `Tavolo diviso · ${truthLabel}`
          : correct
            ? `Presa! ${truthLabel}`
            : `Trappola! ${truthLabel}`;
      const roundOutcome: RoundOutcome = {
        kind: 'bufala',
        countA: correct ? 1 : 0,
        countB: correct ? 0 : 1,
        liveVerdictLabel,
        bufalaGuessIsTrue: action.guessIsTrue,
        bufalaCorrect: correct,
        soloMode: state.players.length === 1,
      };
      return {
        ...state,
        stats: nextStats,
        phase: 'ROUND_RESULT',
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'RESOLVE_INTESA': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      if (!card || !isIntesaCard(card)) return state;
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const speakerId = state.intesaState?.speakerId ?? state.players[0]?.id ?? '';
      const winnerId = action.winnerId ?? null;
      if (action.outcome === 'guessed') {
        if (speakerId) {
          const cur = readStat(nextStats, speakerId);
          nextStats[speakerId] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
        }
        if (winnerId && winnerId !== speakerId) {
          const cur = readStat(nextStats, winnerId);
          nextStats[winnerId] = { ...cur, tvQuizWins: (cur.tvQuizWins ?? 0) + 1 };
        }
      }
      const speakerName = state.players.find((p) => p.id === speakerId)?.name ?? 'Chi descrive';
      const winnerName = winnerId ? state.players.find((p) => p.id === winnerId)?.name : undefined;
      const liveVerdictLabel =
        action.outcome === 'guessed'
          ? winnerName
            ? `🎉 ${speakerName} & ${winnerName}: ${card.word}!`
            : `🎉 ${card.word} indovinata!`
          : action.outcome === 'taboo'
            ? `🚨 Parola vietata! Era ${card.word}`
            : `⏭️ Saltata (${card.word})`;
      const roundOutcome: RoundOutcome = {
        kind: 'intesa',
        countA: action.outcome === 'guessed' ? 1 : 0,
        countB: action.outcome === 'guessed' ? 0 : 1,
        liveVerdictLabel,
        intesaOutcome: action.outcome,
        intesaSpeakerId: speakerId,
        intesaWinnerId: winnerId,
      };
      return {
        ...state,
        stats: nextStats,
        phase: 'ROUND_RESULT',
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'DEBATE' && state.phase !== 'ROUND_RESULT') return state;
      return advanceToNextRound({ ...state, lastSoloToast: null }, action.rng ?? Math.random);
    }

    case 'RESET_TO_SETUP':
      return {
        ...createInitialPassState(),
        mode: state.mode,
        players: state.players,
        cruciverbaMode: state.cruciverbaMode,
        soloFast: state.soloFast,
      };

    default:
      return state;
  }
}

const JOLLY_AWARDS: ReadonlyArray<{ id: string; emoji: string; title: string; description: string }> = [
  {
    id: 'anima_serata',
    emoji: '🥂',
    title: 'Anima della Serata',
    description: 'Ha tenuto vivo il dibattito dall’inizio alla fine.',
  },
  {
    id: 'voce_tavolo',
    emoji: '🎙️',
    title: 'Voce del Tavolo',
    description: 'Ogni suo commento ha acceso una nuova scintilla.',
  },
  {
    id: 'accendimiccia',
    emoji: '🔥',
    title: 'Accendi-Miccia',
    description: 'Quando partiva la sua tesi, nessuno restava indifferente.',
  },
  {
    id: 'faccia_poker',
    emoji: '🎭',
    title: 'Faccia da Poker',
    description: 'Impossibile capire cosa stesse per rispondere fino all’ultimo.',
  },
  {
    id: 'spirito_libero',
    emoji: '⚡',
    title: 'Spirito Libero',
    description: 'Ha portato ritmo e colpi di scena in ogni giro.',
  },
  {
    id: 'bussola_gruppo',
    emoji: '🧭',
    title: 'Bussola del Gruppo',
    description: 'Punto fermo del tavolo tra risate, dubbi e dibattiti.',
  },
  {
    id: 'presenza_scenica',
    emoji: '🌟',
    title: 'Presenza Scenica',
    description: 'Ha trasformato ogni risposta in un momento da ricordare.',
  },
  {
    id: 'osservatore_acuto',
    emoji: '🦉',
    title: 'Osservatore Acuto',
    description: 'Ha letto tra le righe ogni reazione degli amici.',
  },
];

/** Computes fun social awards at the end of a Pass & Play session. */
export function computePassAwards(state: PassState): PassAward[] {
  if (state.players.length === 0) return [];
  const awards: PassAward[] = [];

  const pushAward = (
    spec: Omit<PassAward, 'winnerId' | 'winnerName' | 'winnerAvatar'>,
    winner: PassPlayer | null,
  ) => {
    if (!winner) return;
    awards.push({
      ...spec,
      winnerId: winner.id,
      winnerName: winner.name,
      winnerAvatar: winner.avatar,
    });
  };

  if (state.players.length === 1) {
    const sole = state.players[0];
    const s = readStat(state.stats, sole.id);
    const maj = s.majorityCount ?? 0;
    const min = s.minorityCount;
    const steady = s.steadyCount ?? 0;

    if (s.flips > 0) {
      pushAward(
        {
          id: 'mente_aperta',
          emoji: '🦋',
          title: 'Mente Flessibile',
          description: `Hai cambiato prospettiva ${s.flips} ${s.flips === 1 ? 'volta' : 'volte'} dopo l’obiezione opposta.`,
        },
        sole,
      );
    }
    if (min > maj && min >= 1) {
      pushAward(
        {
          id: 'controcorrente',
          emoji: '⚡',
          title: 'Pensatore Controcorrente',
          description: 'Hai scelto spesso l’alternativa che solo una minoranza avrebbe difeso.',
        },
        sole,
      );
    }
    if (steady > 0 && s.flips === 0) {
      pushAward(
        {
          id: 'bussola',
          emoji: '🧭',
          title: 'Bussola Autonoma',
          description: 'Coerenza salda dall’inizio alla fine anche davanti all’Avvocato del Diavolo.',
        },
        sole,
      );
    }
    if (s.coopWins > 0) {
      pushAward(
        {
          id: 'solutore',
          emoji: '🧩',
          title: 'Solutore Solitario',
          description: `Hai risolto ${s.coopWins} ${s.coopWins === 1 ? 'parola' : 'parole'} nel Cruciverba Show.`,
        },
        sole,
      );
    }
    if ((s.tvQuizWins ?? 0) >= 2) {
      pushAward(
        {
          id: 'campionetv',
          emoji: '🏆',
          title: 'Campione del Quiz',
          description: `Hai centrato ${s.tvQuizWins} sfide tra Ghigliottina, Stima e Bufale.`,
        },
        sole,
      );
    }
    if (maj >= 2 && maj >= min) {
      pushAward(
        {
          id: 'sintonia_mondo',
          emoji: '🔮',
          title: 'In Sintonia col Mondo',
          description: 'Il tuo istinto si è spesso allineato con la maggioranza dei giocatori.',
        },
        sole,
      );
    }
    if (awards.length === 0) {
      pushAward(
        {
          id: 'bussola',
          emoji: '🧭',
          title: 'Bussola Autonoma',
          description: 'Hai affrontato ogni scelta con il tuo punto di vista personale.',
        },
        sole,
      );
    }
    return awards;
  }

  const pickTop = (metric: (s: PlayerPassStats) => number): PassPlayer | null => {
    let best: PassPlayer | null = null;
    let bestVal = 0;
    for (const p of state.players) {
      const val = metric(readStat(state.stats, p.id));
      if (val > bestVal) {
        bestVal = val;
        best = p;
      }
    }
    return best;
  };

  pushAward(
    {
      id: 'voltagabbana',
      emoji: '🦋',
      title: 'Il Voltagabbana',
      description: 'Ha acceso i ribaltoni più clamorosi del dibattito!',
    },
    pickTop((s) => s.flips),
  );

  pushAward(
    {
      id: 'bastian',
      emoji: '🏴‍☠️',
      title: 'Bastian Contrario',
      description: 'Ha difeso a testa alta la posizione più scomoda al tavolo.',
    },
    pickTop((s) => s.minorityCount),
  );

  pushAward(
    {
      id: 'gogna',
      emoji: '🎯',
      title: 'Bersaglio Preferito',
      description: 'Il più indicato dal tavolo nei round della Gogna.',
    },
    pickTop((s) => s.gognaHits),
  );

  pushAward(
    {
      id: 'spia',
      emoji: '🕵️',
      title: 'L’Infiltrato Perfetto',
      description: 'È riuscito a farla franca senza farsi scoprire.',
    },
    pickTop((s) => s.infiltratoWins),
  );

  pushAward(
    {
      id: 'detective',
      emoji: '🔍',
      title: 'Occhio di Falco',
      description: 'Ha smascherato l’infiltrato al primo colpo.',
    },
    pickTop((s) => s.infiltratoCatches),
  );

  pushAward(
    {
      id: 'mentecollettiva',
      emoji: '🧩',
      title: 'Mente Collettiva',
      description: 'Ha risolto più parole al volo nel Cruciverba Show.',
    },
    pickTop((s) => s.coopWins),
  );

  pushAward(
    {
      id: 'avvocato',
      emoji: '⚖️',
      title: 'Principe del Foro',
      description: 'Ha vinto più cause nel Tribunale degli Amici.',
    },
    pickTop((s) => s.tribunaleWins ?? 0),
  );

  pushAward(
    {
      id: 'roccione',
      emoji: '🪨',
      title: 'Il Roccione',
      description: 'Coerenza incrollabile: non ha mai cambiato idea dopo il dibattito.',
    },
    pickTop((s) => ((s.steadyCount ?? 0) > 0 && s.flips === 0 ? (s.steadyCount ?? 0) : 0)),
  );

  pushAward(
    {
      id: 'sintonia',
      emoji: '🔮',
      title: 'In Sintonia',
      description: 'Ha convinto il tavolo o guidato la maggioranza nei confronti diretti.',
    },
    pickTop((s) => s.majorityCount ?? 0),
  );

  pushAward(
    {
      id: 'complice',
      emoji: '💘',
      title: 'Complice Perfetto',
      description: 'Allineamento telepatico e sfide vinte in coppia.',
    },
    pickTop((s) => s.coppieMatches ?? 0),
  );

  pushAward(
    {
      id: 'campionetv',
      emoji: '🏆',
      title: 'Campione del Quiz',
      description: 'Ha dominato i round TV tra Ghigliottina, Stime, Bufale e Intesa!',
    },
    pickTop((s) => s.tvQuizWins ?? 0),
  );

  const awardedIds = new Set(awards.map((a) => a.winnerId));
  const seedBase = `${state.mode}:${state.cards.map((c) => c.id).join(',')}`;
  let jollyCursor = deterministicHash(seedBase) % JOLLY_AWARDS.length;
  for (const player of state.players) {
    if (awardedIds.has(player.id)) continue;
    const j = JOLLY_AWARDS[jollyCursor % JOLLY_AWARDS.length];
    jollyCursor++;
    awards.push({
      id: j.id,
      emoji: j.emoji,
      title: j.title,
      description: j.description,
      winnerId: player.id,
      winnerName: player.name,
      winnerAvatar: player.avatar,
      isJolly: true,
    });
    awardedIds.add(player.id);
  }

  return awards;
}

const ARCHETYPE_POOL: ReadonlyArray<{
  id: string;
  emoji: string;
  title: string;
  motto: string;
  description: string;
  lesson: string;
}> = [
  {
    id: 'pragmatico',
    emoji: '🧭',
    title: 'Il Pragmatico Istintivo',
    motto: '«Fatti, non parole; opzioni concrete, non teorie.»',
    description: 'Decide d’istinto e porta subito il confronto sul terreno pratico.',
    lesson: 'Nel mondo reale: l’azione imperfetta batte l’analisi infinita, ma ascoltare un punto di vista opposto affina il tiro.',
  },
  {
    id: 'diplomatico',
    emoji: '🕊️',
    title: 'Il Mediatore del Tavolo',
    motto: '«C’è sempre un ponte tra due estremi.»',
    description: 'Sa leggere l’umore della stanza e tenere aperto il dialogo anche quando ci si divide.',
    lesson: 'Nel mondo reale: chi sa tradurre posizioni opposte diventa il punto di riferimento nei team complessi.',
  },
  {
    id: 'scintilla',
    emoji: '⚡',
    title: 'La Scintilla Creativa',
    motto: '«Se il tavolo dorme, cambia prospettiva.»',
    description: 'Porta energia, battute e angolazioni inattese che riaccendono la discussione.',
    lesson: 'Nel mondo reale: fare la domanda scomoda al momento giusto evita il pensiero di gruppo.',
  },
  {
    id: 'stratega',
    emoji: '♟️',
    title: 'Lo Stratega Silenzioso',
    motto: '«Osserva prima tutti, poi piazza la mossa.»',
    description: 'Ascolta le difese degli altri con calma prima di scoprire le proprie carte.',
    lesson: 'Nel mondo reale: raccogliere segnali prima di esporsi ti dà un vantaggio decisivo nelle trattative.',
  },
];

function computePassPlayerProfile(
  player: PassPlayer,
  stats: PlayerPassStats,
  awardsWon: PassAward[],
  playerIndex: number,
  isSolo = false,
): PassPlayerProfile {
  const rounds = Math.max(stats.rounds ?? 0, 0);
  const maj = stats.majorityCount ?? 0;
  const min = stats.minorityCount;
  const steady = stats.steadyCount ?? 0;

  let chosen: {
    id: string;
    emoji: string;
    title: string;
    motto: string;
    description: string;
    lesson: string;
  };

  if (stats.infiltratoWins > 0) {
    chosen = {
      id: 'maestro_bluff',
      emoji: '🎭',
      title: 'Il Maestro del Bluff',
      motto: '«La miglior difesa è sembrare completamente innocenti.»',
      description: 'Ha nascosto le sue carte con sangue freddo e ha depistato l’intero tavolo.',
      lesson: 'Nel mondo reale: mantenere la calma sotto pressione fa la differenza quando tutti gli occhi sono su di te.',
    };
  } else if (stats.infiltratoCatches > 0) {
    chosen = {
      id: 'segugio',
      emoji: '🔍',
      title: 'Il Segugio del Tavolo',
      motto: '«Un dettaglio fuori posto basta per capire tutto.»',
      description: 'Coglie subito le esitazioni altrui e smaschera i bluff senza esitare.',
      lesson: 'Nel mondo reale: l’ascolto attivo dei micro-segnali ti protegge dalle trappole e dalle mezze verità.',
    };
  } else if (stats.flips > 0) {
    chosen = {
      id: 'equilibrista',
      emoji: '⚖️',
      title: 'L’Equilibrista Strategico',
      motto: '«Solo chi non ascolta non cambia mai idea.»',
      description: isSolo
        ? 'Sai rimettere in discussione il tuo istinto iniziale quando leggi un’obiezione solida.'
        : 'Sa mettere in discussione la propria scelta iniziale quando sente un argomento convincente.',
      lesson: 'Nel mondo reale: la flessibilità mentale è la competenza #1 per navigare contesti che cambiano.',
    };
  } else if (stats.gognaHits >= 2) {
    chosen = {
      id: 'calamita',
      emoji: '🎯',
      title: 'La Calamita del Gruppo',
      motto: '«Nel bene o nel male, tutti pensano subito a me.»',
      description: 'È sempre al centro dei pronostici e delle storie più memorabili della compagnia.',
      lesson: 'Nel mondo reale: avere un’identità chiara ti rende memorabile — impara a usare quell’attenzione a tuo favore.',
    };
  } else if (min > maj && min >= 1) {
    chosen = {
      id: 'dissidente',
      emoji: '🦅',
      title: 'Il Dissidente Lucido',
      motto: '«La maggioranza non ha sempre ragione.»',
      description: isSolo
        ? 'Non segui la corrente per comodità: scegli ciò in cui credi anche contro la maggioranza.'
        : 'Non segue la corrente per comodità: difende la sua visione anche da solo contro tutti.',
      lesson: 'Nel mondo reale: il coraggio di essere contrarian genera valore quando lo accompagni con argomenti chiari.',
    };
  } else if (steady > 0 && stats.flips === 0) {
    chosen = {
      id: 'roccia',
      emoji: '🛡️',
      title: 'La Roccia dei Principi',
      motto: '«Radici profonde non temono il dibattito.»',
      description: isSolo
        ? 'Resti fedele alla tua prima intuizione anche davanti agli spunti dell’Avvocato del Diavolo.'
        : 'Resta fedele alla prima scelta anche sotto la pressione delle difese altrui.',
      lesson: 'Nel mondo reale: la coerenza ispira fiducia, purché resti aperta a verificare i propri presupposti.',
    };
  } else if (maj >= 2 && min === 0) {
    chosen = {
      id: 'sintonia',
      emoji: '🔮',
      title: 'Il Lettore di Risonanze',
      motto: isSolo
        ? '«Cogli al volo dove batte la sensibilità comune.»'
        : '«Sente il battito del gruppo prima che parli.»',
      description: isSolo
        ? 'Hai un intuito naturale per capire dove converge la scelta della maggioranza.'
        : 'Ha un intuito naturale per cogliere dove converge la sensibilità degli amici.',
      lesson: 'Nel mondo reale: capire il sentiment collettivo ti rende un facilitatore nato.',
    };
  } else if ((stats.coopWins ?? 0) > 0 || (stats.coppieMatches ?? 0) > 0) {
    chosen = {
      id: 'connesso',
      emoji: '🤝',
      title: isSolo ? 'Il Solutore Lucidissimo' : 'Il Ponte Telepatico',
      motto: '«Pochi indizi, massima intesa.»',
      description: isSolo
        ? 'Colleghi gli indizi al volo e arrivi dritto alla soluzione.'
        : 'Sa collegare i segnali degli altri per far vincere tutta la squadra.',
      lesson: 'Nel mondo reale: la lucidità sotto pressione trasforma gli indizi sparsi in decisioni chiare.',
    };
  } else {
    chosen = ARCHETYPE_POOL[playerIndex % ARCHETYPE_POOL.length];
  }

  const statPills: PassPlayerStatPill[] = [];
  if (maj > 0 || min > 0) {
    statPills.push({ label: isSolo ? 'In Sintonia' : 'Intese', value: maj });
    statPills.push({ label: 'Controcorrente', value: min });
  }
  if (stats.flips > 0 || steady > 0) {
    statPills.push({ label: isSolo ? 'Cambi d’idea' : 'Ribaltoni', value: stats.flips });
  }
  if (stats.gognaHits > 0) {
    statPills.push({ label: 'Gogne', value: stats.gognaHits });
  }
  if (stats.infiltratoWins > 0) {
    statPills.push({ label: 'Bluff riusciti', value: stats.infiltratoWins });
  }
  if (stats.infiltratoCatches > 0) {
    statPills.push({ label: 'Spie scovate', value: stats.infiltratoCatches });
  }
  if (stats.coopWins > 0) {
    statPills.push({ label: 'Parole trovate', value: stats.coopWins });
  }
  if ((stats.coppieMatches ?? 0) > 0) {
    statPills.push({ label: 'Sintonia', value: stats.coppieMatches ?? 0 });
  }
  if ((stats.tribunaleWins ?? 0) > 0) {
    statPills.push({ label: 'Cause vinte', value: stats.tribunaleWins ?? 0 });
  }
  if ((stats.tvQuizWins ?? 0) > 0) {
    statPills.push({ label: 'Quiz TV', value: stats.tvQuizWins ?? 0 });
  }
  while (statPills.length < 3) {
    if (!statPills.some((p) => p.label === 'Round giocati')) {
      statPills.push({ label: 'Round giocati', value: rounds });
    } else if (!statPills.some((p) => p.label === 'Premi vinti')) {
      statPills.push({ label: 'Premi vinti', value: awardsWon.length });
    } else {
      statPills.push({ label: 'Spirito', value: '100%' });
    }
  }

  return {
    player,
    archetypeId: chosen.id,
    emoji: chosen.emoji,
    title: chosen.title,
    motto: chosen.motto,
    description: chosen.description,
    lesson: chosen.lesson,
    awardsWon,
    statPills: statPills.slice(0, 3),
  };
}

/** Computes the complete, rich Pass & Play finale summary for the shared device screen. */
export function computePassFinaleSummary(state: PassState): PassFinaleSummary {
  const awards = computePassAwards(state);
  const moments = state.roundHistory ?? [];
  const roundsPlayed = Math.max(moments.length, state.cards.length);
  const playerCount = state.players.length;
  const isSolo = playerCount === 1;

  let sparksCount = 0;
  let consensusCount = 0;
  let totalFlips = 0;
  let infiltratoEscapes = 0;
  let gognaRounds = 0;
  let alignmentRatioSum = 0;
  let alignmentRatioSamples = 0;

  if (isSolo) {
    const sole = state.players[0];
    const s = sole ? readStat(state.stats, sole.id) : emptyPlayerStats();
    const maj = s.majorityCount ?? 0;
    const min = s.minorityCount;
    totalFlips = s.flips;
    consensusCount = maj;
    sparksCount = min + s.flips;
    const decisionTotal = maj + min;
    if (decisionTotal > 0) {
      alignmentRatioSum = maj / decisionTotal;
      alignmentRatioSamples = 1;
    } else {
      for (const m of moments) {
        if (m.kind === 'cruciverba') {
          const totWords = Math.max(1, m.cruciverbaTotalCount ?? 4);
          const solved = m.cruciverbaSolvedCount ?? 0;
          alignmentRatioSamples++;
          alignmentRatioSum += Math.max(0.35, solved / totWords);
          if (solved >= totWords) consensusCount++;
          else sparksCount++;
        }
      }
    }
  } else {
    for (const m of moments) {
      const total = m.countA + m.countB;
      if ((m.swingDelta ?? 0) > 0) {
        sparksCount += m.swingDelta ?? 0;
        totalFlips += m.swingDelta ?? 0;
      }
      if (m.kind === 'split' || m.kind === 'swing' || m.kind === 'dignita' || m.kind === 'coppie_align') {
        if (total >= 2) {
          const ratio = Math.max(m.countA, m.countB) / total;
          alignmentRatioSum += ratio;
          alignmentRatioSamples++;
          if (m.countA === 0 || m.countB === 0) {
            consensusCount++;
          } else {
            sparksCount++;
          }
        }
      } else if (m.kind === 'cruciverba') {
        alignmentRatioSamples++;
        const totWords = Math.max(1, m.cruciverbaTotalCount ?? 4);
        const solved = m.cruciverbaSolvedCount ?? 0;
        if (solved >= totWords) {
          consensusCount++;
          alignmentRatioSum += 1;
        } else {
          alignmentRatioSum += Math.max(0.35, solved / totWords);
        }
      } else if (m.kind === 'tribunale') {
        alignmentRatioSamples++;
        sparksCount++;
        alignmentRatioSum += 0.65;
      } else if (m.kind === 'infiltrato') {
        alignmentRatioSamples++;
        if (m.infiltratoCaught) {
          consensusCount++;
          alignmentRatioSum += 0.85;
        } else {
          infiltratoEscapes++;
          sparksCount++;
          alignmentRatioSum += 0.35;
        }
      } else if (m.kind === 'gogna') {
        gognaRounds++;
        sparksCount++;
      } else if (m.kind === 'coppie_challenge') {
        if (m.coppieMatched) consensusCount++;
        else sparksCount++;
      }
    }
  }

  const chemistryPct =
    alignmentRatioSamples > 0
      ? Math.round((alignmentRatioSum / alignmentRatioSamples) * 100)
      : 68;

  let verdict: Omit<
    PassTableVerdict,
    'chemistryPct' | 'chemistryLabel' | 'roundsPlayed' | 'playerCount' | 'sparksCount' | 'consensusCount'
  >;

  if (isSolo) {
    if (totalFlips >= 2 || (totalFlips >= 1 && moments.some((m) => m.soloFlipped))) {
      verdict = {
        emoji: '⚖️',
        title: 'Esploratore Flessibile',
        subtitle: 'Hai messo alla prova il tuo istinto davanti alle obiezioni dell’Avvocato del Diavolo.',
      };
    } else if (sparksCount > consensusCount && sparksCount >= 2) {
      verdict = {
        emoji: '⚡',
        title: 'Percorso Controcorrente',
        subtitle: 'Scegli con testa tua anche quando la maggioranza va nella direzione opposta.',
      };
    } else if (consensusCount >= Math.max(1, Math.ceil(roundsPlayed * 0.6)) && chemistryPct >= 65) {
      verdict = {
        emoji: '🎯',
        title: 'Istinto in Sintonia',
        subtitle: 'Hai un radar preciso su ciò che convince e orienta le decisioni comuni.',
      };
    } else {
      verdict = {
        emoji: '🧭',
        title: 'Specchio Decisionale',
        subtitle: 'Ogni risposta ha tracciato una mappa autentica di come ragioni sotto pressione.',
      };
    }
  } else if (infiltratoEscapes >= 1 && state.mode === 'infiltrato') {
    verdict = {
      emoji: '🕵️',
      title: 'Covo di Doppiogiochisti',
      subtitle: 'Tra bluff, sguardi sospetti e depistaggi, nessuno poteva fidarsi davvero di nessuno.',
    };
  } else if (gognaRounds > 0 && gognaRounds >= Math.ceil(roundsPlayed / 2)) {
    verdict = {
      emoji: '🤪',
      title: 'Tribunale Senza Pietà',
      subtitle: 'Risate, dita puntate e sentenze dirette: questo tavolo non fa sconti a nessuno.',
    };
  } else if (totalFlips >= 2 || (sparksCount >= 2 && chemistryPct < 65)) {
    verdict = {
      emoji: '⚡',
      title: 'Arena ad Alta Tensione',
      subtitle: 'Tesi ribaltate, spaccature nette e dibattiti accesi faccia a faccia.',
    };
  } else if (consensusCount >= Math.max(1, Math.ceil(roundsPlayed * 0.6)) && chemistryPct >= 75) {
    verdict = {
      emoji: '💘',
      title: 'Tavolo Telepatico',
      subtitle: 'Siete sulla stessa lunghezza d’onda: intesa altissima e pochissimi dubbi.',
    };
  } else {
    verdict = {
      emoji: '🔥',
      title: 'Serata Memorabile',
      subtitle: 'Un mix perfetto tra complicità, sguardi complici e scelte impossibili.',
    };
  }

  const chemistryLabel = isSolo
    ? chemistryPct >= 70
      ? `Sintonia col mondo: ${chemistryPct}%`
      : chemistryPct >= 45
        ? `Equilibrio critico (${chemistryPct}% sintonia)`
        : `Indice Controcorrente: ${100 - chemistryPct}%`
    : chemistryPct >= 80
      ? `Sintonia altissima (${chemistryPct}%)`
      : chemistryPct >= 55
        ? `Equilibrio vivo (${chemistryPct}% intesa)`
        : `Scintille e caos (${chemistryPct}% intesa)`;

  const mvp = awards.find((a) => !a.isJolly) ?? awards[0] ?? null;

  const playerProfiles: PassPlayerProfile[] = state.players.map((p, idx) => {
    const pStats = readStat(state.stats, p.id);
    const won = awards.filter((a) => a.winnerId === p.id);
    return computePassPlayerProfile(p, pStats, won, idx, isSolo);
  });

  const closingChallenges: string[] = [];
  if (isSolo) {
    closingChallenges.push(
      '🧭 Riguarda i round in cui sei andato Controcorrente: qual è l’argomento che gli altri sottovalutano?',
      totalFlips > 0
        ? `🦋 Hai cambiato scelta ${totalFlips} ${totalFlips === 1 ? 'volta' : 'volte'} dopo l’obiezione opposta: ottimo riflesso critico!`
        : '🛡️ Sei rimasto fedele al tuo istinto dall’inizio alla fine: prova un giro mettendo in dubbio la tua prima scelta.',
      '🎭 Prova «Storie», «Percorso» o «Preferiresti» da solo per esplorare un nuovo scenario!',
    );
  } else {
    if (mvp) {
      closingChallenges.push(
        `🥂 Brindisi ufficiale: ${mvp.winnerAvatar ?? '🏆'} ${mvp.winnerName} (${mvp.title}) sceglie il brindisi o la musica del prossimo giro!`,
      );
    }
    const bastion = awards.find((a) => a.id === 'bastian');
    if (bastion) {
      closingChallenges.push(
        `🏴‍☠️ Sfida della Staffa per ${bastion.winnerName}: difendi l’opinione più inaspettata che hai sostenuto stasera!`,
      );
    }
    const spy = awards.find((a) => a.id === 'spia');
    if (spy) {
      closingChallenges.push(
        `🕵️ Rivincita d’onore: ${spy.winnerName} ha bluffato tutto il tavolo. Chi lo sfida faccia a faccia nel prossimo round?`,
      );
    }
    closingChallenges.push(
      '🎭 Giro finale a voce: ogni giocatore dice in una sola frase qual è stata la scelta più difficile della serata.',
      '🔥 Alzate la posta: fate un ultimo giro in «Serata Mix» o passate alla modalità più piccante!',
    );
  }

  const awardLines = awards
    .slice(0, 5)
    .map((a) => `${a.emoji} ${a.title}: ${a.winnerAvatar ?? ''} ${a.winnerName}`.trim())
    .join('\n');
  const shareText = [
    `${verdict.emoji} SCHIERATI — ${verdict.title.toUpperCase()}`,
    `📊 ${roundsPlayed} round · ${isSolo ? '1 giocatore (Solo)' : `${playerCount} amici`} · ${chemistryLabel}`,
    awardLines ? `\n🏆 ${isSolo ? 'I Tuoi Tratti' : 'I Premi della Serata'}:\n${awardLines}` : '',
    '\nGioca anche tu su schierati!',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    verdict: {
      ...verdict,
      chemistryPct,
      chemistryLabel,
      roundsPlayed,
      playerCount,
      sparksCount,
      consensusCount,
    },
    awards,
    mvp,
    playerProfiles,
    moments,
    closingChallenges,
    shareText,
  };
}

export function isFlashOrClassicoCard(card: PassCard): card is PassFlashCard {
  return 'text' in card && 'optionA' in card && 'optionB' in card;
}

export function isInfiltratoCard(card: PassCard): card is PassInfiltratoCard {
  return 'groupQuestion' in card && 'impostorQuestion' in card;
}

export function isAssurdoCard(card: PassCard): card is PassAssurdoCard {
  return 'cardType' in card && (card.cardType === 'gogna' || card.cardType === 'dignita');
}

export function isCoppieCard(card: PassCard): card is PassCoppieCard {
  return 'cardType' in card && (card.cardType === 'allineamento' || card.cardType === 'verita' || card.cardType === 'obbligo');
}

export function isCruciverbaCard(card: PassCard): card is PassCruciverbaCard {
  return 'words' in card && Array.isArray((card as PassCruciverbaCard).words);
}

export function isTribunaleCard(card: PassCard): card is PassTribunaleCard {
  return 'accusaRole' in card && 'difesaRole' in card;
}

export function isPreferirestiCard(card: PassCard): card is PassPreferirestiCard {
  return 'options' in card && Array.isArray((card as PassPreferirestiCard).options);
}

export function isGhigliottinaCard(card: PassCard): card is PassGhigliottinaCard {
  return (
    'clues' in card &&
    Array.isArray((card as PassGhigliottinaCard).clues) &&
    'connections' in card
  );
}

export function isStimaCard(card: PassCard): card is PassStimaCard {
  return (
    'unit' in card &&
    'min' in card &&
    'max' in card &&
    typeof (card as PassStimaCard).answer === 'number'
  );
}

export function isBufalaCard(card: PassCard): card is PassBufalaCard {
  return 'statement' in card && typeof (card as PassBufalaCard).isTrue === 'boolean';
}

export function isIntesaCard(card: PassCard): card is PassIntesaCard {
  return (
    'word' in card &&
    'forbidden' in card &&
    Array.isArray((card as PassIntesaCard).forbidden)
  );
}

/** Converts Pass & Play Cruciverba state into the shared 2D CruciverbaGrid payload. */
export function toCruciverbaGridState(
  cs: CruciverbaPassState,
): Pick<CruciverbaStatePayload, 'rows' | 'cols' | 'words' | 'cells' | 'activeWordId'> & {
  theme: string;
} {
  const revealedSet = new Set(cs.revealedCells);
  const cells: Array<Array<CruciverbaCellPayload | null>> = Array.from(
    { length: cs.board.rows },
    () => Array.from({ length: cs.board.cols }, () => null),
  );

  for (const w of cs.board.words) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === 'V' ? w.row + i : w.row;
      const c = w.direction === 'H' ? w.col + i : w.col;
      if (r < 0 || r >= cs.board.rows || c < 0 || c >= cs.board.cols) continue;
      const existing = cells[r][c];
      const revealed = revealedSet.has(`${r},${c}`);
      const letter = revealed ? w.word[i] : '';
      const wordNumbers = existing ? [...existing.wordNumbers] : [];
      if (i === 0 && !wordNumbers.includes(w.number)) {
        wordNumbers.push(w.number);
      }
      cells[r][c] = {
        letter: existing?.letter || letter,
        wordNumbers,
      };
    }
  }

  const words: CruciverbaWordPayload[] = cs.board.words.map((w) => ({
    id: w.id,
    number: w.number,
    direction: w.direction,
    row: w.row,
    col: w.col,
    length: w.word.length,
    clue: cs.mode === 'scelte' ? '' : w.clue,
    choices: cs.mode === 'scelte' ? cs.wordChoices[w.id] ?? w.choices : undefined,
    wrongChoices: cs.mode === 'scelte' ? cs.wrongChoices[w.id] ?? [] : undefined,
    status: cs.wordStatus[w.id] ?? 'pending',
    solvedByName: cs.solvedBy[w.id] ?? null,
  }));

  return {
    theme: cs.board.theme,
    rows: cs.board.rows,
    cols: cs.board.cols,
    activeWordId: cs.activeWordId,
    words,
    cells,
  };
}
