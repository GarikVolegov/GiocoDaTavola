// Pure state machine for Pass & Play ("Passa il Telefono", 1-device social mode).
// Designed around a table-first flow: one rotating Reader holds the phone and
// most modes resolve face-to-face with a single tap, passing the device only when
// true secrecy is needed (L'Infiltrato secret question).

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
} from './fallbackDeck';

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

export type SecretActionKind = 'infiltrato_read';

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
  board: PassCruciverbaCard;
  turnOrder: string[];
  turnIndex: number;
  activeWordId: string;
  wordStatus: Record<string, 'pending' | 'solved' | 'revealed'>;
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
    | 'tribunale';
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
  chosenSide?: 'A' | 'B';
}

export interface PlayerPassStats {
  flips: number;
  minorityCount: number;
  gognaHits: number;
  infiltratoWins: number;
  infiltratoCatches: number;
  coopWins: number;
  tribunaleWins?: number;
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
  classicoState: ClassicoPassState | null;
  coppieState: CoppiePassState | null;
  cruciverbaState: CruciverbaPassState | null;
  tribunaleState: TribunalePassState | null;
  roundOutcome: RoundOutcome | null;
  stats: Record<string, PlayerPassStats>;
  debateDurationSec: number;
  roundHistory?: PassRoundHighlight[];
  storyChoicesA?: number;
}

export type PassAction =
  | { type: 'START_GAME'; mode: PassMode; players: PassPlayer[]; cards: PassCard[]; rng?: () => number }
  | { type: 'UNLOCK_TURN' }
  | { type: 'ACK_SECRET' }
  | { type: 'RESOLVE_FLASH'; result: 'A' | 'B' | 'SPLIT' | 'UNANIMOUS'; rng?: () => number }
  | { type: 'RESOLVE_PREFERIRESTI'; choice: 'A' | 'B' | 'C' | 'D' | 'SPLIT'; rng?: () => number }
  | { type: 'RESOLVE_CLASSICO'; outcome: 'CONVINCE_A' | 'CONVINCE_B' | 'FLIP' | 'STEADY'; rng?: () => number }
  | { type: 'RESOLVE_INFILTRATO_ACCUSATION'; accusedId: string | null }
  | { type: 'RESOLVE_GOGNA'; targetId: string | null }
  | { type: 'RESOLVE_DIGNITA'; outcome: 'YES' | 'SPLIT' | 'NO' }
  | { type: 'RESOLVE_COPPIE_ALIGN'; matchedCoupleIds: string[] }
  | { type: 'RESOLVE_COPPIE_CHALLENGE'; completed: boolean; rng?: () => number }
  | { type: 'CRUCIVERBA_SELECT_WORD'; wordId: string }
  | { type: 'CRUCIVERBA_SOLVE_WORD'; wordId: string; solverId: string | null }
  | { type: 'CRUCIVERBA_PASS'; reason?: 'hint' | 'timeout'; rng?: () => number }
  | { type: 'CRUCIVERBA_END_NOW' }
  | { type: 'TRIBUNALE_NEXT_SPEAKER' }
  | { type: 'TRIBUNALE_RESOLVE'; winner: 'ACCUSA' | 'DIFESA' | 'TIE' }
  | { type: 'NEXT_ROUND'; rng?: () => number }
  | { type: 'RESET_TO_SETUP' };

export const PASS_STATE_VERSION = 2;
export const CRUCIVERBA_TURN_SEC = 0;
export const TRIBUNALE_SPEAK_SEC = 0;

export const PASS_AVATARS = ['🦊', '🐙', '🦁', '🐸', '🦉', '🐼', '🦄', '🐝', '🦖', '🐧'] as const;

export function minPlayersForMode(mode: PassMode): number {
  if (mode === 'infiltrato' || mode === 'tribunale') return 3;
  if (mode === 'coppie') return 2;
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
    classicoState: null,
    coppieState: null,
    cruciverbaState: null,
    tribunaleState: null,
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

function initPassCruciverbaState(board: PassCruciverbaCard, players: PassPlayer[]): CruciverbaPassState {
  const wordStatus: Record<string, 'pending' | 'solved' | 'revealed'> = {};
  for (const w of board.words) wordStatus[w.id] = 'pending';
  return {
    board,
    turnOrder: players.map((p) => p.id),
    turnIndex: 0,
    activeWordId: board.words[0].id,
    wordStatus,
    solvedBy: {},
    revealedCells: [],
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
    turnIndex: 0,
    infiltratoId: null,
    classicoState: null,
    coppieState: null,
    cruciverbaState: null,
    tribunaleState: null,
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

  if (cardMode === 'cruciverba' && isCruciverbaCard(card)) {
    return {
      ...baseCleared,
      phase: 'DEBATE',
      debateDurationSec: CRUCIVERBA_TURN_SEC,
      cruciverbaState: initPassCruciverbaState(card, state.players),
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

  // flash, assurdo
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
  return '';
}

function computeMomentBadge(outcome: RoundOutcome): PassMomentBadge {
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
        stats: emptyStats(action.players),
        roundHistory: [],
      };
      return enterCurrentRound(initial, action.rng ?? Math.random);
    }

    case 'UNLOCK_TURN': {
      if (state.phase !== 'PASS_CURTAIN') return state;
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
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Scelta condivisa';
      let chosenSide: 'A' | 'B' | undefined;

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
        if (n <= 1) {
          countA = 1;
          countB = 0;
        } else {
          countA = Math.max(1, Math.ceil(n * 0.7));
          countB = Math.max(1, n - countA);
        }
        liveVerdictLabel = optA;
        chosenSide = 'A';
      } else {
        if (n <= 1) {
          countB = 1;
          countA = 0;
        } else {
          countB = Math.max(1, Math.ceil(n * 0.7));
          countA = Math.max(1, n - countB);
        }
        liveVerdictLabel = optB;
        chosenSide = 'B';
      }

      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const reader = getCurrentReaderPlayer(state);
      if (reader && action.result !== 'SPLIT') {
        const cur = readStat(nextStats, reader.id);
        nextStats[reader.id] = { ...cur, majorityCount: (cur.majorityCount ?? 0) + 1 };
      }

      const roundOutcome: RoundOutcome = {
        kind: 'split',
        countA,
        countB,
        liveVerdictLabel,
        ...(chosenSide ? { chosenSide } : {}),
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
        storyChoicesA:
          (state.storyChoicesA ?? 0) + (cardMode === 'storia' && chosenSide === 'A' ? 1 : 0),
      };
      if (
        card &&
        isFlashOrClassicoCard(card) &&
        (card.storyScene || card.domandaRilancio || card.lezioneReale || card.penalty)
      ) {
        return {
          ...updated,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound(updated, action.rng ?? Math.random);
    }

    case 'RESOLVE_PREFERIRESTI': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const n = state.players.length;
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Tutte scelte diverse!';

      if (action.choice === 'SPLIT') {
        const effN = Math.max(2, n);
        countA = Math.ceil(effN / 2);
        countB = effN - countA;
      } else {
        const idx = (['A', 'B', 'C', 'D'] as const).indexOf(action.choice);
        const optionText = card && isPreferirestiCard(card) ? card.options[idx] : undefined;
        liveVerdictLabel = optionText ?? 'Scelta del tavolo';
        if (n <= 1) {
          countA = action.choice === 'A' || action.choice === 'C' ? 1 : 0;
          countB = 1 - countA;
        } else if (action.choice === 'A' || action.choice === 'C') {
          countA = Math.max(1, Math.ceil(n * 0.7));
          countB = Math.max(1, n - countA);
        } else {
          countB = Math.max(1, Math.ceil(n * 0.7));
          countA = Math.max(1, n - countB);
        }
      }

      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      const reader = getCurrentReaderPlayer(state);
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

      const roundOutcome: RoundOutcome = {
        kind: 'split',
        countA,
        countB,
        liveVerdictLabel,
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
      };
      if (card && isPreferirestiCard(card) && card.penalty) {
        return {
          ...updated,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound(updated, action.rng ?? Math.random);
    }

    case 'RESOLVE_CLASSICO': {
      if (state.phase !== 'DEBATE') return state;
      const card = getCurrentCard(state);
      const cardMode = effectivePassCardMode(state.mode, card);
      const cs = state.classicoState;
      const n = state.players.length;
      const effN = Math.max(2, n);
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let countA = Math.ceil(effN / 2);
      let countB = effN - countA;
      let swingDelta = 0;
      let winnerId: string | null = null;
      let liveVerdictLabel = 'Tutti irremovibili';
      let chosenSide: 'A' | 'B' | undefined;

      const optA = card && isFlashOrClassicoCard(card) ? card.optionA : 'Prima scelta';
      const optB = card && isFlashOrClassicoCard(card) ? card.optionB : 'Seconda scelta';

      if (action.outcome === 'CONVINCE_A' && cs) {
        countA = n <= 1 ? 1 : Math.max(1, Math.ceil(n * 0.7));
        countB = n <= 1 ? 0 : Math.max(1, n - countA);
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
        countB = n <= 1 ? 1 : Math.max(1, Math.ceil(n * 0.7));
        countA = n <= 1 ? 0 : Math.max(1, n - countB);
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
      };
      const updated: PassState = {
        ...state,
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
        storyChoicesA:
          (state.storyChoicesA ?? 0) + (cardMode === 'storia' && chosenSide === 'A' ? 1 : 0),
      };
      if (
        card &&
        isFlashOrClassicoCard(card) &&
        (card.storyScene || card.domandaRilancio || card.lezioneReale || card.penalty)
      ) {
        return {
          ...updated,
          phase: 'ROUND_RESULT',
        };
      }
      return advanceToNextRound(updated, action.rng ?? Math.random);
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
      const nextStats = incrementAllPlayersRound(state.stats, state.players);
      let countA = 0;
      let countB = 0;
      let liveVerdictLabel = 'Tavolo spaccato';

      if (action.outcome === 'YES') {
        countA = Math.max(1, n);
        countB = 0;
        liveVerdictLabel = optA;
      } else if (action.outcome === 'NO') {
        countA = 0;
        countB = Math.max(1, n);
        liveVerdictLabel = optB;
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
      };

      return {
        ...state,
        phase: 'ROUND_RESULT',
        stats: nextStats,
        roundOutcome,
        roundHistory: upsertRoundHighlight(state, roundOutcome),
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

      const revealedCells = revealWordCells(cs.board.words, cs.revealedCells, word.id);
      const cellsSet = new Set(revealedCells);
      const nextStatus = syncRevealedWordStatuses(
        cs.board.words,
        { ...cs.wordStatus, [word.id]: 'solved' as const },
        cellsSet,
      );

      const nextStats = { ...state.stats };
      const solverName =
        (action.solverId && state.players.find((p) => p.id === action.solverId)?.name) || 'Tavolo';
      if (action.solverId) {
        const cur = readStat(nextStats, action.solverId);
        nextStats[action.solverId] = { ...cur, coopWins: cur.coopWins + 1 };
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

    case 'NEXT_ROUND': {
      if (state.phase !== 'DEBATE' && state.phase !== 'ROUND_RESULT') return state;
      return advanceToNextRound(state, action.rng ?? Math.random);
    }

    case 'RESET_TO_SETUP':
      return {
        ...createInitialPassState(),
        mode: state.mode,
        players: state.players,
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

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Computes fun social awards at the end of a Pass & Play session. */
export function computePassAwards(state: PassState): PassAward[] {
  if (state.players.length === 0) return [];
  const awards: PassAward[] = [];

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
      description: 'Sa mettere in discussione la propria scelta iniziale quando sente un argomento convincente.',
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
      description: 'Non segue la corrente per comodità: difende la sua visione anche da solo contro tutti.',
      lesson: 'Nel mondo reale: il coraggio di essere contrarian genera valore quando lo accompagni con argomenti chiari.',
    };
  } else if (steady > 0 && stats.flips === 0) {
    chosen = {
      id: 'roccia',
      emoji: '🛡️',
      title: 'La Roccia dei Principi',
      motto: '«Radici profonde non temono il dibattito.»',
      description: 'Resta fedele alla prima scelta anche sotto la pressione delle difese altrui.',
      lesson: 'Nel mondo reale: la coerenza ispira fiducia, purché resti aperta a verificare i propri presupposti.',
    };
  } else if (maj >= 2 && min === 0) {
    chosen = {
      id: 'sintonia',
      emoji: '🔮',
      title: 'Il Lettore di Risonanze',
      motto: '«Sente il battito del gruppo prima che parli.»',
      description: 'Ha un intuito naturale per cogliere dove converge la sensibilità degli amici.',
      lesson: 'Nel mondo reale: capire il sentiment collettivo ti rende un facilitatore nato nei gruppi.',
    };
  } else if ((stats.coopWins ?? 0) > 0 || (stats.coppieMatches ?? 0) > 0) {
    chosen = {
      id: 'connesso',
      emoji: '🤝',
      title: 'Il Ponte Telepatico',
      motto: '«Pochi indizi, massima intesa.»',
      description: 'Sa collegare i segnali degli altri per far vincere tutta la squadra.',
      lesson: 'Nel mondo reale: il successo collettivo nasce da chi amplifica le idee altrui invece di competere.',
    };
  } else {
    chosen = ARCHETYPE_POOL[playerIndex % ARCHETYPE_POOL.length];
  }

  const statPills: PassPlayerStatPill[] = [];
  if (maj > 0 || min > 0) {
    statPills.push({ label: 'Intese', value: maj });
    statPills.push({ label: 'Controcorrente', value: min });
  }
  if (stats.flips > 0 || steady > 0) {
    statPills.push({ label: 'Ribaltoni', value: stats.flips });
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

  let sparksCount = 0;
  let consensusCount = 0;
  let totalFlips = 0;
  let infiltratoEscapes = 0;
  let gognaRounds = 0;
  let alignmentRatioSum = 0;
  let alignmentRatioSamples = 0;

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

  const chemistryPct =
    alignmentRatioSamples > 0
      ? Math.round((alignmentRatioSum / alignmentRatioSamples) * 100)
      : 68;

  let verdict: Omit<
    PassTableVerdict,
    'chemistryPct' | 'chemistryLabel' | 'roundsPlayed' | 'playerCount' | 'sparksCount' | 'consensusCount'
  >;

  if (infiltratoEscapes >= 1 && state.mode === 'infiltrato') {
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

  const chemistryLabel =
    chemistryPct >= 80
      ? `Sintonia altissima (${chemistryPct}%)`
      : chemistryPct >= 55
        ? `Equilibrio vivo (${chemistryPct}% intesa)`
        : `Scintille e caos (${chemistryPct}% intesa)`;

  const mvp = awards.find((a) => !a.isJolly) ?? awards[0] ?? null;

  const playerProfiles: PassPlayerProfile[] = state.players.map((p, idx) => {
    const pStats = readStat(state.stats, p.id);
    const won = awards.filter((a) => a.winnerId === p.id);
    return computePassPlayerProfile(p, pStats, won, idx);
  });

  const closingChallenges: string[] = [];
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

  const awardLines = awards
    .slice(0, 5)
    .map((a) => `${a.emoji} ${a.title}: ${a.winnerAvatar ?? ''} ${a.winnerName}`.trim())
    .join('\n');
  const shareText = [
    `${verdict.emoji} SCHIERATI — ${verdict.title.toUpperCase()}`,
    `📊 ${roundsPlayed} round · ${playerCount === 1 ? '1 giocatore' : `${playerCount} amici`} · ${chemistryLabel}`,
    awardLines ? `\n🏆 I Premi della Serata:\n${awardLines}` : '',
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
