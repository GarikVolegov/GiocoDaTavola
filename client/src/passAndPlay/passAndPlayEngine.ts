// Pure state machine for Pass & Play ("Passa il Telefono", 1-device mode).
// Keeps all secret votes and secret roles encapsulated inside state transitions;
// only aggregate results are exposed in `roundOutcome` so no individual vote is
// ever leaked on the shared screen.

import type {
  PassMode,
  PassCard,
  PassFlashCard,
  PassInfiltratoCard,
  PassCoppieCard,
  PassAssurdoCard,
} from './fallbackDeck';

export interface PassPlayer {
  id: string;
  name: string;
  avatar: string;
}

export type PassPhase =
  | 'SETUP'
  | 'CARD_INTRO'
  | 'PASS_CURTAIN'
  | 'SECRET_TURN'
  | 'REVEAL_SUSPENSE'
  | 'DEBATE'
  | 'ROUND_RESULT'
  | 'FINAL_AWARDS';

export type SecretActionKind =
  | 'vote1'
  | 'vote2'
  | 'gogna'
  | 'infiltrato_read'
  | 'infiltrato_accuse'
  | 'coppie_align';

export interface RoundOutcome {
  kind: 'split' | 'swing' | 'gogna' | 'infiltrato' | 'coppie_align' | 'coppie_challenge';
  countA: number;
  countB: number;
  prevCountA?: number;
  prevCountB?: number;
  swingDelta?: number;
  gognaWinnerIds?: string[];
  gognaTopVotes?: number;
  infiltratoId?: string;
  accusedIds?: string[];
  infiltratoCaught?: boolean;
  coppieMatched?: boolean;
}

export interface PlayerPassStats {
  flips: number;
  minorityCount: number;
  gognaHits: number;
  infiltratoWins: number;
  infiltratoCatches: number;
}

export interface PassAward {
  id: string;
  emoji: string;
  title: string;
  description: string;
  winnerId: string;
  winnerName: string;
}

export interface PassState {
  mode: PassMode;
  players: PassPlayer[];
  cards: PassCard[];
  roundIndex: number;
  phase: PassPhase;
  secretKind: SecretActionKind;
  turnIndex: number;
  // Secret maps kept internal during the round (never rendered directly per-player)
  vote1Map: Record<string, 'A' | 'B'>;
  vote2Map: Record<string, 'A' | 'B'>;
  targetMap: Record<string, string>;
  infiltratoId: string | null;
  roundOutcome: RoundOutcome | null;
  stats: Record<string, PlayerPassStats>;
  debateDurationSec: number;
}

export type PassAction =
  | { type: 'START_GAME'; mode: PassMode; players: PassPlayer[]; cards: PassCard[]; rng?: () => number }
  | { type: 'BEGIN_ROUND'; rng?: () => number }
  | { type: 'UNLOCK_TURN' }
  | { type: 'SUBMIT_VOTE'; choice: 'A' | 'B' }
  | { type: 'SUBMIT_TARGET'; targetId: string }
  | { type: 'ACK_SECRET' }
  | { type: 'FINISH_SUSPENSE' }
  | { type: 'START_REVOTE' }
  | { type: 'START_ACCUSE' }
  | { type: 'REVEAL_INFILTRATO_NOW' }
  | { type: 'NEXT_ROUND'; rng?: () => number }
  | { type: 'RESET_TO_SETUP' };

export const PASS_AVATARS = ['🦊', '🐙', '🦁', '🐸', '🦉', '🐼', '🦄', '🐝', '🦖', '🐧'] as const;

export function minPlayersForMode(mode: PassMode): number {
  if (mode === 'infiltrato') return 3;
  return 2;
}

export function createInitialPassState(): PassState {
  return {
    mode: 'flash',
    players: [],
    cards: [],
    roundIndex: 0,
    phase: 'SETUP',
    secretKind: 'vote1',
    turnIndex: 0,
    vote1Map: {},
    vote2Map: {},
    targetMap: {},
    infiltratoId: null,
    roundOutcome: null,
    stats: {},
    debateDurationSec: 30,
  };
}

function emptyStats(players: PassPlayer[]): Record<string, PlayerPassStats> {
  const stats: Record<string, PlayerPassStats> = {};
  for (const p of players) {
    stats[p.id] = {
      flips: 0,
      minorityCount: 0,
      gognaHits: 0,
      infiltratoWins: 0,
      infiltratoCatches: 0,
    };
  }
  return stats;
}

function countAB(votes: Record<string, 'A' | 'B'>): { countA: number; countB: number } {
  let countA = 0;
  let countB = 0;
  for (const v of Object.values(votes)) {
    if (v === 'A') countA++;
    else countB++;
  }
  return { countA, countB };
}

function pickInfiltratoId(players: PassPlayer[], rng: () => number): string | null {
  if (players.length === 0) return null;
  const idx = Math.min(players.length - 1, Math.floor(rng() * players.length));
  return players[idx].id;
}

function debateSecondsForMode(mode: PassMode): number {
  if (mode === 'flash') return 30;
  if (mode === 'infiltrato') return 60;
  if (mode === 'classico') return 60;
  return 30;
}

export function getCurrentCard(state: PassState): PassCard | null {
  return state.cards[state.roundIndex] ?? null;
}

export function getCurrentTurnPlayer(state: PassState): PassPlayer | null {
  return state.players[state.turnIndex] ?? null;
}

function resolveCardIntro(state: PassState, rng: () => number): PassState {
  const card = getCurrentCard(state);
  if (!card) return { ...state, phase: 'FINAL_AWARDS' };

  if (state.mode === 'infiltrato') {
    return {
      ...state,
      phase: 'PASS_CURTAIN',
      secretKind: 'infiltrato_read',
      turnIndex: 0,
      vote1Map: {},
      vote2Map: {},
      targetMap: {},
      infiltratoId: pickInfiltratoId(state.players, rng),
      roundOutcome: null,
    };
  }

  if (state.mode === 'coppie') {
    const c = card as PassCoppieCard;
    if (c.cardType === 'allineamento') {
      return {
        ...state,
        phase: 'PASS_CURTAIN',
        secretKind: 'coppie_align',
        turnIndex: 0,
        vote1Map: {},
        vote2Map: {},
        targetMap: {},
        roundOutcome: null,
      };
    }
    return {
      ...state,
      phase: 'DEBATE',
      roundOutcome: { kind: 'coppie_challenge', countA: 0, countB: 0 },
    };
  }

  if (state.mode === 'assurdo') {
    const a = card as PassAssurdoCard;
    return {
      ...state,
      phase: 'PASS_CURTAIN',
      secretKind: a.cardType === 'gogna' ? 'gogna' : 'vote1',
      turnIndex: 0,
      vote1Map: {},
      vote2Map: {},
      targetMap: {},
      roundOutcome: null,
    };
  }

  // flash or classico
  return {
    ...state,
    phase: 'PASS_CURTAIN',
    secretKind: 'vote1',
    turnIndex: 0,
    vote1Map: {},
    vote2Map: {},
    targetMap: {},
    roundOutcome: null,
  };
}

function finalizeMinorityStats(
  stats: Record<string, PlayerPassStats>,
  votes: Record<string, 'A' | 'B'>,
): Record<string, PlayerPassStats> {
  const { countA, countB } = countAB(votes);
  if (countA === countB || countA === 0 || countB === 0) return stats;
  const minorityChoice: 'A' | 'B' = countA < countB ? 'A' : 'B';
  const next = { ...stats };
  for (const [playerId, choice] of Object.entries(votes)) {
    if (choice === minorityChoice && next[playerId]) {
      next[playerId] = { ...next[playerId], minorityCount: next[playerId].minorityCount + 1 };
    }
  }
  return next;
}

function resolveAfterAllTurns(state: PassState): PassState {
  const { secretKind, vote1Map, vote2Map, targetMap, stats } = state;

  if (secretKind === 'infiltrato_read') {
    return {
      ...state,
      phase: 'DEBATE',
      debateDurationSec: debateSecondsForMode('infiltrato'),
    };
  }

  if (secretKind === 'infiltrato_accuse') {
    const counts: Record<string, number> = {};
    for (const targetId of Object.values(targetMap)) {
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }
    let maxVotes = 0;
    for (const c of Object.values(counts)) {
      if (c > maxVotes) maxVotes = c;
    }
    const accusedIds = Object.entries(counts)
      .filter(([, c]) => c === maxVotes && maxVotes > 0)
      .map(([id]) => id);
    const infiltratoCaught =
      state.infiltratoId !== null && accusedIds.includes(state.infiltratoId);

    const nextStats = { ...stats };
    if (state.infiltratoId && nextStats[state.infiltratoId] && !infiltratoCaught) {
      nextStats[state.infiltratoId] = {
        ...nextStats[state.infiltratoId],
        infiltratoWins: nextStats[state.infiltratoId].infiltratoWins + 1,
      };
    }
    for (const [voterId, targetId] of Object.entries(targetMap)) {
      if (targetId === state.infiltratoId && nextStats[voterId]) {
        nextStats[voterId] = {
          ...nextStats[voterId],
          infiltratoCatches: nextStats[voterId].infiltratoCatches + 1,
        };
      }
    }

    return {
      ...state,
      phase: 'ROUND_RESULT',
      stats: nextStats,
      roundOutcome: {
        kind: 'infiltrato',
        countA: 0,
        countB: 0,
        infiltratoId: state.infiltratoId ?? undefined,
        accusedIds,
        infiltratoCaught,
      },
    };
  }

  if (secretKind === 'gogna') {
    const counts: Record<string, number> = {};
    const nextStats = { ...stats };
    for (const targetId of Object.values(targetMap)) {
      counts[targetId] = (counts[targetId] ?? 0) + 1;
      if (nextStats[targetId]) {
        nextStats[targetId] = { ...nextStats[targetId], gognaHits: nextStats[targetId].gognaHits + 1 };
      }
    }
    let topVotes = 0;
    for (const c of Object.values(counts)) {
      if (c > topVotes) topVotes = c;
    }
    const gognaWinnerIds = Object.entries(counts)
      .filter(([, c]) => c === topVotes && topVotes > 0)
      .map(([id]) => id);

    return {
      ...state,
      phase: 'ROUND_RESULT',
      stats: nextStats,
      roundOutcome: {
        kind: 'gogna',
        countA: 0,
        countB: 0,
        gognaWinnerIds,
        gognaTopVotes: topVotes,
      },
    };
  }

  if (secretKind === 'coppie_align') {
    const { countA, countB } = countAB(vote1Map);
    const coppieMatched = countA === state.players.length || countB === state.players.length;
    return {
      ...state,
      phase: 'ROUND_RESULT',
      roundOutcome: {
        kind: 'coppie_align',
        countA,
        countB,
        coppieMatched,
      },
    };
  }

  if (secretKind === 'vote2') {
    const prev = countAB(vote1Map);
    const next = countAB(vote2Map);
    let swingDelta = 0;
    const nextStats = { ...stats };
    for (const p of state.players) {
      if (vote1Map[p.id] && vote2Map[p.id] && vote1Map[p.id] !== vote2Map[p.id]) {
        swingDelta++;
        if (nextStats[p.id]) {
          nextStats[p.id] = { ...nextStats[p.id], flips: nextStats[p.id].flips + 1 };
        }
      }
    }
    return {
      ...state,
      phase: 'ROUND_RESULT',
      stats: finalizeMinorityStats(nextStats, vote2Map),
      roundOutcome: {
        kind: 'swing',
        countA: next.countA,
        countB: next.countB,
        prevCountA: prev.countA,
        prevCountB: prev.countB,
        swingDelta,
      },
    };
  }

  // vote1 -> REVEAL_SUSPENSE -> DEBATE
  const { countA, countB } = countAB(vote1Map);
  return {
    ...state,
    phase: 'REVEAL_SUSPENSE',
    stats: finalizeMinorityStats(stats, vote1Map),
    roundOutcome: {
      kind: 'split',
      countA,
      countB,
    },
  };
}

export function passReducer(state: PassState, action: PassAction): PassState {
  switch (action.type) {
    case 'START_GAME': {
      const minP = minPlayersForMode(action.mode);
      if (action.players.length < minP || action.cards.length === 0) return state;
      return {
        mode: action.mode,
        players: action.players,
        cards: action.cards,
        roundIndex: 0,
        phase: 'CARD_INTRO',
        secretKind: 'vote1',
        turnIndex: 0,
        vote1Map: {},
        vote2Map: {},
        targetMap: {},
        infiltratoId: null,
        roundOutcome: null,
        stats: emptyStats(action.players),
        debateDurationSec: debateSecondsForMode(action.mode),
      };
    }

    case 'BEGIN_ROUND': {
      if (state.phase !== 'CARD_INTRO') return state;
      return resolveCardIntro(state, action.rng ?? Math.random);
    }

    case 'UNLOCK_TURN': {
      if (state.phase !== 'PASS_CURTAIN') return state;
      return { ...state, phase: 'SECRET_TURN' };
    }

    case 'SUBMIT_VOTE': {
      if (state.phase !== 'SECRET_TURN') return state;
      const currentPlayer = getCurrentTurnPlayer(state);
      if (!currentPlayer) return state;

      const isVote2 = state.secretKind === 'vote2';
      const updatedState: PassState = isVote2
        ? { ...state, vote2Map: { ...state.vote2Map, [currentPlayer.id]: action.choice } }
        : { ...state, vote1Map: { ...state.vote1Map, [currentPlayer.id]: action.choice } };

      const nextTurn = state.turnIndex + 1;
      if (nextTurn < state.players.length) {
        return { ...updatedState, turnIndex: nextTurn, phase: 'PASS_CURTAIN' };
      }
      return resolveAfterAllTurns(updatedState);
    }

    case 'SUBMIT_TARGET': {
      if (state.phase !== 'SECRET_TURN') return state;
      const currentPlayer = getCurrentTurnPlayer(state);
      if (!currentPlayer) return state;

      const updatedState: PassState = {
        ...state,
        targetMap: { ...state.targetMap, [currentPlayer.id]: action.targetId },
      };

      const nextTurn = state.turnIndex + 1;
      if (nextTurn < state.players.length) {
        return { ...updatedState, turnIndex: nextTurn, phase: 'PASS_CURTAIN' };
      }
      return resolveAfterAllTurns(updatedState);
    }

    case 'ACK_SECRET': {
      if (state.phase !== 'SECRET_TURN') return state;
      const nextTurn = state.turnIndex + 1;
      if (nextTurn < state.players.length) {
        return { ...state, turnIndex: nextTurn, phase: 'PASS_CURTAIN' };
      }
      return resolveAfterAllTurns(state);
    }

    case 'FINISH_SUSPENSE': {
      if (state.phase !== 'REVEAL_SUSPENSE') return state;
      return {
        ...state,
        phase: 'DEBATE',
        debateDurationSec: debateSecondsForMode(state.mode),
      };
    }

    case 'START_REVOTE': {
      if (state.phase !== 'DEBATE') return state;
      return {
        ...state,
        phase: 'PASS_CURTAIN',
        secretKind: 'vote2',
        turnIndex: 0,
        vote2Map: {},
      };
    }

    case 'START_ACCUSE': {
      if (state.phase !== 'DEBATE' || state.mode !== 'infiltrato') return state;
      return {
        ...state,
        phase: 'PASS_CURTAIN',
        secretKind: 'infiltrato_accuse',
        turnIndex: 0,
        targetMap: {},
      };
    }

    case 'REVEAL_INFILTRATO_NOW': {
      if (state.phase !== 'DEBATE' || state.mode !== 'infiltrato') return state;
      return {
        ...state,
        phase: 'ROUND_RESULT',
        roundOutcome: {
          kind: 'infiltrato',
          countA: 0,
          countB: 0,
          infiltratoId: state.infiltratoId ?? undefined,
          accusedIds: [],
          infiltratoCaught: false,
        },
      };
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'DEBATE' && state.phase !== 'ROUND_RESULT') return state;
      const nextIndex = state.roundIndex + 1;
      if (nextIndex >= state.cards.length) {
        return { ...state, phase: 'FINAL_AWARDS' };
      }
      return {
        ...state,
        roundIndex: nextIndex,
        phase: 'CARD_INTRO',
        turnIndex: 0,
        vote1Map: {},
        vote2Map: {},
        targetMap: {},
        infiltratoId: null,
        roundOutcome: null,
      };
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

/** Computes fun social awards at the end of a Pass & Play session. */
export function computePassAwards(state: PassState): PassAward[] {
  if (state.players.length === 0) return [];
  const awards: PassAward[] = [];

  const pickTop = (metric: (s: PlayerPassStats) => number): PassPlayer | null => {
    let best: PassPlayer | null = null;
    let bestVal = 0;
    for (const p of state.players) {
      const val = metric(state.stats[p.id] ?? { flips: 0, minorityCount: 0, gognaHits: 0, infiltratoWins: 0, infiltratoCatches: 0 });
      if (val > bestVal) {
        bestVal = val;
        best = p;
      }
    }
    return best;
  };

  const flipper = pickTop((s) => s.flips);
  if (flipper) {
    awards.push({
      id: 'voltagabbana',
      emoji: '🦋',
      title: 'Il Voltagabbana',
      description: 'Ha cambiato idea più volte dopo il dibattito!',
      winnerId: flipper.id,
      winnerName: flipper.name,
    });
  }

  const rebel = pickTop((s) => s.minorityCount);
  if (rebel) {
    awards.push({
      id: 'bastian',
      emoji: '🏴‍☠️',
      title: 'Bastian Contrario',
      description: 'Sempre dalla parte della minoranza, contro tutto il tavolo.',
      winnerId: rebel.id,
      winnerName: rebel.name,
    });
  }

  const gognaKing = pickTop((s) => s.gognaHits);
  if (gognaKing) {
    awards.push({
      id: 'gogna',
      emoji: '🎯',
      title: 'Bersaglio Preferito',
      description: 'Il più votato nei round della Gogna.',
      winnerId: gognaKing.id,
      winnerName: gognaKing.name,
    });
  }

  const spy = pickTop((s) => s.infiltratoWins);
  if (spy) {
    awards.push({
      id: 'spia',
      emoji: '🕵️',
      title: 'L’Infiltrato Perfetto',
      description: 'È riuscito a farla franca senza farsi scoprire.',
      winnerId: spy.id,
      winnerName: spy.name,
    });
  }

  const detective = pickTop((s) => s.infiltratoCatches);
  if (detective) {
    awards.push({
      id: 'detective',
      emoji: '🔍',
      title: 'Occhio di Falco',
      description: 'Ha smascherato l’infiltrato al primo colpo.',
      winnerId: detective.id,
      winnerName: detective.name,
    });
  }

  if (awards.length === 0) {
    const first = state.players[0];
    awards.push({
      id: 'anima_serata',
      emoji: '🥂',
      title: 'Anima della Serata',
      description: 'Ha tenuto vivo il dibattito dall’inizio alla fine.',
      winnerId: first.id,
      winnerName: first.name,
    });
  }

  return awards;
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
