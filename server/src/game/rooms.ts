// In-memory store of game rooms. The server is authoritative; rooms live here
// only for the lifetime of the process (no DB).

import { Deck, dilemmasForRegister, loadDilemmas, COMPLESSITA_RANK, type Dilemma, type ContentRegister, type Tappa } from './deck';
import { botDefenseArgument } from './botDefense';
import * as knowRound from './knowRound';
import * as infiltrato from './infiltrato';
import * as predictions from './predictions';
import * as speakerVote from './speakerVote';
import * as submittedDilemmas from './submittedDilemmas';
import * as voting from './voting';
import * as defenseTurns from './defenseTurns';
import * as reactions from './reactions';
import * as devilAdvocate from './devilAdvocate';
import * as roundStats from './roundStats';
import { tally } from './voteCount';
import {
  type GamePhase,
  PHASE_DURATIONS_MS,
  DEFENSE_MIN_MS,
  INTERVENTO_MIN_MS,
  DEFENSE_MAX_MS,
  INTERVENTI_MAX_MS,
  TURN_BOT_MS,
  nextPhase,
  nextDuelPhase,
  nextPercorsoPhase,
} from './phases';
import {
  buildPercorsoPlan,
  isDurata,
  clampTappa,
  N_TAPPE,
  type Durata,
} from './percorso';
import { computeAwards as computeAwardsFor, type Award, type PlayerStats } from './awards';
import { computeBlindSpot, type BlindSpot } from './blindspots';
import {
  duelPlayers,
  duelAgreed,
  recordDuelResult,
  duelReveal,
  duelTurn,
  duelResult,
  duelSummary,
} from './duel';

// Re-export the phase state machine so existing importers (tests, index.ts)
// keep importing GamePhase / PHASE_DURATIONS_MS / nextPhase / … from './rooms'.
export * from './phases';
// Re-export the percorso planning helpers (TAPPE, buildPercorsoPlan, …) so
// index.ts can surface tappe metadata + counts without a separate import path.
export * from './percorso';
// Re-export the scoring types so consumers keep importing them from './rooms'.
export type { Award, AwardId, PlayerStats } from './awards';
export type { BlindSpot, BlindSpotId } from './blindspots';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 4;

/** Max players allowed in a single room (in-person party game). */
export const MAX_PLAYERS = 8;

/** Max nickname length — truncated (not rejected) for a forgiving UX. */
export const NICKNAME_MAX = 24;

/** Minimum connected players required before the host can start the game. */
export const MIN_PLAYERS_TO_START = 3;

/** How many dilemmas the host may choose to play in one game. */
export const DILEMMA_COUNT_OPTIONS = [3, 5, 7] as const;
export type DilemmaCount = (typeof DILEMMA_COUNT_OPTIONS)[number];

/** Content registers the host can pick (mirror of deck.ts ContentRegister). */
export const CONTENT_REGISTERS = ['vita', 'business', 'misto'] as const;

/**
 * Behaviour-based bot personalities (Fase B). The persona doesn't pick a *side*
 * (the first vote is random) — it governs how the bot changes its mind at VOTE_2:
 *  - roccione: never changes; indeciso: changes often; gregge: drifts to the
 *    majority; bastian: drifts to the minority; equilibrato: changes sometimes.
 * Content-aware personas (prudente/spericolato) come in Fase C with the LLM.
 */
export const BOT_PERSONAS = ['roccione', 'indeciso', 'gregge', 'bastian', 'equilibrato'] as const;
export type BotPersona = (typeof BOT_PERSONAS)[number];

/** Display names cycled through when adding bots to a room. */
const BOT_NAMES = ['Robo', 'Bipbo', 'Circù', 'Dado', 'Echo', 'Fulmine', 'Giro', 'Hal'] as const;

function isContentRegister(v: string): v is ContentRegister {
  return (CONTENT_REGISTERS as readonly string[]).includes(v);
}

/**
 * The fixed allowlist of live audience-reaction emojis a phone may send during
 * DEFENSE / DUEL_ARGUE. A small set keeps the host's "swarm" readable and the
 * input un-spoofable (anything else is rejected).
 */
export const REACTIONS = ['👏', '🔥', '🤯', '😂', '🤔'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Minimum gap between two reactions from the SAME player (anti-spam), in ms. */
export const REACTION_MIN_INTERVAL_MS = 400;

/** A single secret vote: which side a player chose. */
export type VoteChoice = 'A' | 'B';

/** Game mode: the classic group game, or the 2-player duel. */
export type GameMode = 'gruppo' | 'duello';
export const GAME_MODES = ['gruppo', 'duello'] as const;
function isGameMode(v: string): v is GameMode {
  return v === 'gruppo' || v === 'duello';
}



export interface Player {
  /** Stable, public per-player id (NOT the socket id and NOT the reconnect
   * token): survives reconnects so votes/stats keyed by it persist, and the
   * phone compares it to defender ids for "your turn". The secret reconnect
   * token lives only in index.ts's session table, never on this object. */
  id: string;
  nickname: string;
  /** True for server-driven bot players (Fase B). Absent/false for humans. */
  isBot?: boolean;
  /** The bot's behaviour persona; only set when isBot. */
  persona?: BotPersona;
  /**
   * Connection state. Absent/true = present; `false` = temporarily gone (phone
   * locked/refreshed) during the index.ts grace period, slot + secret vote held
   * for a reconnect. Kept OPTIONAL so a freshly-joined player is just
   * `{id, nickname}` (mirrors `isBot?`).
   */
  connected?: boolean;
  /**
   * Clerk user id, set when a logged-in phone identifies itself (player:identify).
   * Absent = anonymous (the default). Used only to attribute saved awards.
   */
  clerkUserId?: string;
}

/**
 * A player auto-selected to defend a side in DEFENSE. Their identity + side
 * become public during the defense (inherent to speaking) — no OTHER votes leak.
 */
export interface Defender {
  id: string;
  nickname: string;
  side: VoteChoice;
  /**
   * True when this defender must argue AGAINST their own vote (the surprise
   * "Avvocato del Diavolo" round). `side` is the side they ARGUE; their real
   * vote is the opposite. Absent/false in normal rounds.
   */
  devil?: boolean;
}

/** Public view of the defense/interventi phase: who is speaking + turn/queue state. */
export interface DefenseState {
  /** 'defense' = a chosen defender is speaking; 'intervento' = a queued mini-turn. */
  kind: 'defense' | 'intervento';
  /** The defender currently speaking (only in 'defense'); null in 'intervento'/no defenders. */
  speaker: Defender | null;
  /** The current intervenor (only in 'intervento'); null in 'defense'. */
  intervenor: { id: string; nickname: string } | null;
  /** Id of whoever is talking now (defender or intervenor), so the phone can match "your turn". */
  speakerId: string | null;
  /** 1-based index of the current turn (defense turn, or intervenor position). */
  turn: number;
  /** Total turns: defenders this round, or queued intervenors during INTERVENTI. */
  totalTurns: number;
  /**
   * The current speaker's canned argument when they are a bot (Fase B), shown on
   * the host screen since a bot can't speak aloud; null when a human is speaking / in interventi.
   */
  argument: string | null;
  /** Talking points for the defender's side; null in interventi / no speaker. */
  spunti: string[] | null;
  /** Live count of raised hands during the current defender's turn (0 in INTERVENTI). */
  raisedCount: number;
  /** Ordered intervenor names — only from INTERVENTI on; null during DEFENSE. */
  queue: { id: string; nickname: string }[] | null;
  /** When the current turn's minimum elapses (epoch ms); null for bot/absent speakers. */
  minEndsAt: number | null;
  /** Whether the current speaker may end now (minimum elapsed). */
  canFinish: boolean;
  /** When the current turn started (epoch ms); the client renders the count-up from here. */
  startedAt: number | null;
}

export interface Room {
  code: string;
  createdAt: number;
  /** The leader-player's stable id (drives the game from their phone); null until set. */
  leaderId: string | null;
  /** Players currently in the lobby, keyed by player id. */
  players: Map<string, Player>;
  /** Current phase of the game state machine. */
  phase: GamePhase;
  /** Number of dilemmas chosen at start; null until the game starts. In percorso it equals the planned ascent's length. */
  dilemmaCount: number | null;
  /** Content register chosen at start; null until the game starts (and always null in percorso). */
  register: ContentRegister | null;
  /** Session format: 'classic' (3/5/7) or 'percorso' (themed ascent). Default 'classic'. */
  format: 'classic' | 'percorso';
  /** Percorso: the tappa the host chose to start from (1..4); null in classic. */
  startTappa: Tappa | null;
  /** Percorso: the duration preset chosen at start; null in classic. */
  durata: Durata | null;
  /** Percorso: the precomputed ordered dilemmas of the ascent; empty in classic. */
  plannedDilemmas: Dilemma[];
  /** Percorso: parallel to plannedDilemmas — the tappa of each planned dilemma (ascending). */
  plannedTappe: number[];
  /** Percorso: the tappa currently in play (1..4); null in classic / before start. */
  currentTappa: Tappa | null;
  /** Percorso: dilemmas played in the current tappa so far (recap accumulator; reset on TAPPA_INTRO). */
  tappaDilemmas: number;
  /** Percorso: rounds in the current tappa whose leading side flipped (recap accumulator). Aggregate only. */
  tappaSwings: number;
  /** Which dilemma (1-based) is being played; 0 before the first reveal. */
  dilemmaIndex: number;
  /** Epoch ms when the current phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** The deck for this game; created at start, drawn once per DILEMMA_REVEAL. */
  deck: Deck | null;
  /** The dilemma in play this round; null in the lobby/intro and after the game. */
  currentDilemma: Dilemma | null;
  /**
   * Dilemmas written by the players themselves in the LOBBY (max 2/player). Mixed
   * into the game ahead of the official deck so the group's own dilemmas are sure
   * to be played. Grows as `player:submitDilemma` arrives; read at `startGame`.
   */
  submittedDilemmas: Dilemma[];
  /** Map of a submitted dilemma's id -> the player id who authored it (for the ✍️ award + per-player cap). */
  dilemmaAuthors: Map<string, string>;
  /** The shuffled player-submitted dilemmas still to play, drawn (in order) BEFORE the deck. Built at `startGame`. */
  submittedQueue: Dilemma[];
  /**
   * The 1-based dilemma index chosen at start to be the surprise "Avvocato del
   * Diavolo" round, where defenders argue the side they did NOT vote. null when
   * no twist applies (duello mode, or fewer than 2 dilemmas). Never the first round.
   */
  devilRoundIndex: number | null;
  /**
   * The 1-based round chosen to be the surprise "Quanto mi conosci" round (guess
   * how a friend voted), or null when it doesn't apply (short games / duello).
   */
  knowRoundIndex: number | null;
  /** Quanto mi conosci: guesser id -> target id (the ring), set on PREDICT entry of the know round. */
  knowTargets: Map<string, string>;
  /** Quanto mi conosci: guesser id -> their secret guess of the target's first vote. */
  knowGuesses: Map<string, VoteChoice>;
  /** "L'Infiltrato": the secret infiltrator's player id, or null when not enabled. */
  infiltratorId: string | null;
  /** Rounds the infiltrator overturned the group (minority → majority). */
  infiltratorFlips: number;
  /** End-game accusation votes: accuser id -> accused id (ACCUSE phase). */
  accusations: Map<string, string>;
  /** Resolved infiltrator outcome, computed on entry to FINAL_AWARDS; null otherwise. */
  infiltratoResult: InfiltratoResult | null;
  /** "Squadre" mode: player id -> team colour. Empty when teams are off. */
  teams: Map<string, Team>;
  /**
   * Secret votes for the current dilemma, keyed by player id. Holds the first
   * vote during VOTE_1 and the (live, changeable) second vote during VOTE_2 —
   * each VOTE_2 entry starts equal to the player's first vote (the default).
   * Stays server-side — only aggregate counts ever leave the server. Cleared at
   * the start of each dilemma round (on DILEMMA_REVEAL); holds only present
   * players' votes (a leaving player's vote is dropped).
   */
  votes: Map<string, VoteChoice>;
  /**
   * Snapshot of the first-round (VOTE_1) votes, taken when VOTE_2 begins, so the
   * second vote can be compared against it (swing computation) without losing
   * the original. Also cleared on DILEMMA_REVEAL and pruned when a player leaves.
   */
  votes1: Map<string, VoteChoice>;
  /**
   * Players who EXPLICITLY confirmed (or changed) their second vote during VOTE_2.
   * VOTE_2 starts pre-filled with the first vote, so "has a vote" is not "has
   * confirmed"; this set drives the auto-advance (no timer). Bots are added on
   * entry to VOTE_2. Cleared on DILEMMA_REVEAL; pruned on leave.
   */
  confirmedVote2: Set<string>;
  /**
   * The auto-selected defenders for the current round (one per side that got
   * votes, side A before B). Recomputed on entry to DEFENSE from the secret
   * votes; only these chosen identities are ever made public.
   */
  defenders: Defender[];
  /** Which defender (0-based) is currently speaking during DEFENSE. */
  defenseTurnIndex: number;
  /**
   * The current defender's canned argument when they are a bot (Fase B), recomputed
   * on each DEFENSE turn so the host shows a stable line; null for human speakers.
   */
  defenseArgument: string | null;
  /**
   * Raised hands during the CURRENT defender's turn, in FIFO order (player ids) —
   * the speaking order for the INTERVENTI mini-turns that follow. Reset at the
   * start of each defender turn and on DILEMMA_REVEAL; pruned on leave. Only the
   * aggregate count leaves the server during DEFENSE (names only from INTERVENTI).
   */
  raisedHands: string[];
  /** Frozen snapshot of raisedHands taken when a defender finishes; walked in INTERVENTI. */
  interventiQueue: string[];
  /** Which intervenor (0-based) is speaking during INTERVENTI. */
  interventiIndex: number;
  /**
   * When the current turn's minimum elapses (epoch ms); below it "Ho finito" is
   * rejected. null for bot/absent speakers (no floor) and outside DEFENSE/INTERVENTI.
   */
  turnMinEndsAt: number | null;
  /**
   * When the current DEFENSE/INTERVENTI turn started (epoch ms); source for the
   * client's count-up timer. null outside a speaking turn.
   */
  turnStartedAt: number | null;
  /**
   * Per-player tallies accumulated across the game (keyed by player id), updated
   * once per round on entry to PHASE_RESULTS and read at FINAL_AWARDS. Empty
   * until the first round's results; reset when a new game starts.
   */
  stats: Map<string, PlayerStats>;
  /** Monotonic counter for generating unique bot ids/names within the room. */
  botSeq: number;
  /** Game mode: 'gruppo' (classic) or 'duello' (2-player). Default 'gruppo'. */
  mode: GameMode;
  /** Which duel argue turn (0-based) is speaking during DUEL_ARGUE. */
  duelTurnIndex: number;
  /** Duel score: persuasions per player id (times they flipped the other). */
  duelScore: Map<string, number>;
  /** Duel: how many rounds the two players already agreed (no duel needed). */
  duelAgreements: number;
  /**
   * Last time (epoch ms) each player sent a live reaction, keyed by player id —
   * used only to rate-limit the reaction stream. Reset never needed (stale
   * entries are harmless); pruned with the player on leave.
   */
  lastReactionAt: Map<string, number>;
  /**
   * Secret predictions for the current round, keyed by player id: which side each
   * player thinks will hold the majority AFTER the defenses (PREDICT phase). Like
   * votes they never leave the server as identities — only the aggregate count is
   * public, and each predictor learns only their OWN result. Cleared each
   * DILEMMA_REVEAL; pruned when a player leaves.
   */
  predictions: Map<string, VoteChoice>;
  /**
   * Secret swing bets for the current round (PREDICT phase): 'ribalta' = the
   * leading side will change after the defenses, 'regge' = it'll hold. Like
   * predictions, only the aggregate count is public and each bettor learns only
   * their OWN result. Cleared each DILEMMA_REVEAL; pruned when a player leaves.
   */
  swingBets: Map<string, SwingBet>;
  /**
   * Secret peer votes for the most convincing defender this round, keyed by voter
   * id with the chosen defender's id as value (SPEAKER_VOTE phase). Aggregate only
   * (we expose the candidate list + a count, never who voted whom). Cleared each
   * DILEMMA_REVEAL; pruned when a player leaves.
   */
  speakerVotes: Map<string, string>;
  /**
   * Quante volte ogni player (per id) è stato scelto come difensore nella
   * partita corrente. Guida l'equa rotazione in `selectDefenders` (priorità a
   * chi ha difeso meno). Vuota alla creazione, azzerata a `startGame`. Resta
   * lato server: è solo un conteggio, non espone voti.
   */
  defenseCounts: Map<string, number>;
}

export type JoinError = 'ROOM_NOT_FOUND' | 'NICKNAME_REQUIRED' | 'ROOM_FULL';

export type JoinResult =
  | { ok: true; player: Player }
  | { ok: false; error: JoinError };

export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_HUMAN_PLAYERS'
  | 'WRONG_PLAYER_COUNT'
  | 'INVALID_DILEMMA_COUNT'
  | 'INVALID_REGISTER'
  | 'INVALID_PERCORSO'
  | 'INFILTRATO_NEEDS_PLAYERS'
  | 'SQUADRE_NEEDS_PLAYERS'
  | 'ALREADY_STARTED';

export type StartGameResult =
  | { ok: true; room: Room }
  | { ok: false; error: StartGameError };

/** Minimum humans required to enable "L'Infiltrato" (enough to hide + accuse). */
export const MIN_INFILTRATO_HUMANS = 4;

/** Minimum players required to enable "Squadre" (two teams of at least two). */
export const MIN_SQUADRE_PLAYERS = 4;

export type AccuseError = 'ROOM_NOT_FOUND' | 'NOT_ACCUSE_PHASE' | 'NOT_IN_ROOM' | 'INVALID_TARGET';

export type AccuseResult =
  | { ok: true; room: Room }
  | { ok: false; error: AccuseError };

/** "Squadre" team colour. */
export type Team = 'blu' | 'arancio';

/** Public team assignments + running scores (sum of members' persuasion). */
export interface TeamState {
  assignments: Array<{ playerId: string; nickname: string; team: Team }>;
  scores: { blu: number; arancio: number };
}

/** Per-tappa progress within a percorso (planned total + dilemmas reached). */
export interface PercorsoTappaProgress {
  id: number;
  total: number;
  done: number;
}

/** Secret-safe percorso view broadcast to host/phones (no individual votes). */
export interface PercorsoView {
  startTappa: number;
  durata: Durata;
  currentTappa: number | null;
  totalDilemmas: number;
  /** 1-based index of the dilemma in play across the whole ascent (0 before the first). */
  dilemmaIndex: number;
  tappe: PercorsoTappaProgress[];
  /** Current tappa recap: dilemmas played so far + leading-side flips (aggregate). */
  tappaDilemmas: number;
  tappaSwings: number;
}

/** Public reveal of the infiltrator outcome at FINAL_AWARDS (null in normal games). */
export interface InfiltratoResult {
  infiltratorId: string;
  infiltratorNickname: string;
  /** Rounds the infiltrator overturned the group (minority became majority). */
  flips: number;
  /** True if the group pinned them (unique top of the accusation vote). */
  caught: boolean;
  /** True if they overturned at least one round AND evaded detection. */
  won: boolean;
  /** How many accusation votes the infiltrator received. */
  votesAgainst: number;
}

export type AddBotError = 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_STARTED';

export type AddBotResult =
  | { ok: true; player: Player }
  | { ok: false; error: AddBotError };

export type AdvancePhaseError = 'ROOM_NOT_FOUND' | 'NO_NEXT_PHASE';

export type AdvancePhaseResult =
  | { ok: true; room: Room }
  | { ok: false; error: AdvancePhaseError };

export type VoteError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_VOTING_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_CHOICE';

export type VoteResult =
  | { ok: true; room: Room }
  | { ok: false; error: VoteError };

export type ReactError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_REACTING_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_EMOJI'
  | 'RATE_LIMITED';

export type ReactResult =
  | { ok: true; emoji: Reaction }
  | { ok: false; error: ReactError };

export type RaiseHandError = 'ROOM_NOT_FOUND' | 'NOT_RAISE_PHASE' | 'NOT_IN_ROOM' | 'IS_SPEAKER';
export type RaiseHandResult =
  | { ok: true; room: Room; raised: boolean }
  | { ok: false; error: RaiseHandError };

export type FinishTurnError = 'ROOM_NOT_FOUND' | 'NOT_FINISHING_PHASE' | 'NOT_SPEAKER' | 'TOO_EARLY';
export type FinishTurnResult = { ok: true; room: Room } | { ok: false; error: FinishTurnError };

export type PredictError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_PREDICT_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_CHOICE';

export type PredictResult =
  | { ok: true; room: Room }
  | { ok: false; error: PredictError };

/** One predictor's outcome, revealed privately to them at PHASE_RESULTS. */
export interface PredictionResult {
  playerId: string;
  predicted: VoteChoice;
  /** The post-defense (second-vote) majority side, or null on a tie. */
  actual: VoteChoice | null;
  correct: boolean;
}

/**
 * A secret bet, placed during PREDICT, on whether the leading side will change
 * after the defenses: 'ribalta' (the majority flips) vs 'regge' (it holds).
 */
export type SwingBet = 'ribalta' | 'regge';

export type SwingBetError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_PREDICT_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_BET';

export type SwingBetResult =
  | { ok: true; room: Room }
  | { ok: false; error: SwingBetError };

/** One bettor's swing-bet outcome, revealed privately to them at PHASE_RESULTS. */
export interface SwingBetOutcome {
  playerId: string;
  bet: SwingBet;
  /** Whether the leading side actually changed (pre- vs post-defense). */
  flipped: boolean;
  correct: boolean;
}

export type SubmitDilemmaError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_LOBBY'
  | 'NOT_IN_ROOM'
  | 'EMPTY'
  | 'TOO_LONG'
  | 'SAME_OPTIONS'
  | 'LIMIT_REACHED';

export type SubmitDilemmaResult =
  | { ok: true; room: Room; count: number }
  | { ok: false; error: SubmitDilemmaError };

export type KnowGuessError = 'ROOM_NOT_FOUND' | 'NOT_KNOW_PHASE' | 'NO_TARGET' | 'INVALID_CHOICE';

export type KnowGuessResult =
  | { ok: true; room: Room }
  | { ok: false; error: KnowGuessError };

/** One guesser's outcome at PHASE_RESULTS of the "Quanto mi conosci" round. */
export interface KnowGuessOutcome {
  guesserId: string;
  targetId: string;
  guess: VoteChoice;
  /** The target's first vote, or null if unknown (e.g. they left). */
  actual: VoteChoice | null;
  correct: boolean;
}

/** A guesser→target pair, made public during the know round so phones know whom to read. */
export interface KnowPair {
  guesserId: string;
  guesserNickname: string;
  targetId: string;
  targetNickname: string;
}

export type SpeakerVoteError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_SPEAKER_VOTE_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_TARGET';

export type SpeakerVoteResult =
  | { ok: true; room: Room }
  | { ok: false; error: SpeakerVoteError };

/** Aggregate A/B tally for one round of voting. Counts only — no identities. */
export interface VoteTally {
  A: number;
  B: number;
}

/**
 * The result of comparing the first vote (VOTE_1) to the second (VOTE_2):
 * the two aggregate tallies, how many voters changed side, and the net change
 * in each side's count. All aggregate — individual votes never leave the server.
 */
export interface SwingResult {
  /** A/B counts from the first vote (the VOTE_1 snapshot). */
  first: VoteTally;
  /** A/B counts from the second vote (the live VOTE_2 votes). */
  second: VoteTally;
  /** How many voters present in both rounds changed side. */
  switched: number;
  /** Net change in each side's count, second minus first. */
  netSwing: VoteTally;
}

/** How many votes a defender's side gained between the first and second vote. */
export interface DefenseImpact {
  defender: Defender;
  votes: number;
}

/**
 * Public results view (gated to PHASE_RESULTS): the swing plus, for each defender
 * whose side gained votes, how many votes moved their way. Drives the "the
 * defense of X moved N votes" narration. Aggregate only — no identities beyond
 * the (already public) defenders.
 */
export interface PublicSwing extends SwingResult {
  attribution: DefenseImpact[];
}

/**
 * Per-player tallies accumulated across the whole game, used to compute the
 * end-of-game awards. Recorded once per round on entry to PHASE_RESULTS — never
 * sent to clients during play (only the final awards superlatives are public).
 */
function isDilemmaCount(n: number): n is DilemmaCount {
  return (DILEMMA_COUNT_OPTIONS as readonly number[]).includes(n);
}

/** Generate a random 4-letter uppercase room code. */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  // `genCode`, `now`, `makeDeck` and `rng` are injectable so tests can force
  // code collisions, drive phase timers deterministically, supply a small
  // deterministic dilemma deck, and pin defender selection.
  constructor(
    private readonly genCode: () => string = generateRoomCode,
    private readonly now: () => number = () => Date.now(),
    private readonly makeDeck: (register: ContentRegister) => Deck =
      (register) => new Deck(dilemmasForRegister(loadDilemmas(), register)),
    private readonly rng: () => number = Math.random,
  ) {}

  /** Compute the auto-advance expiry for a phase, or null if it has no timer. */
  private expiryFor(phase: GamePhase): number | null {
    const duration = PHASE_DURATIONS_MS[phase];
    return duration == null ? null : this.now() + duration;
  }

  /**
   * Set the current turn's minimum-floor + safety-cap timers for the speaker in
   * DEFENSE/INTERVENTI. A human speaker gets a MIN (below which "Ho finito" is
   * rejected) plus a generous cap; a bot or absent speaker can't tap, so they get
   * only TURN_BOT_MS and no floor. Overrides whatever expiryFor set generically.
   */
  private armTurn(room: Room): void {
    const interventi = room.phase === 'INTERVENTI';
    const speakerId = defenseTurns.currentSpeakerId(room);
    const speaker = speakerId ? room.players.get(speakerId) : undefined;
    const now = this.now();
    room.turnStartedAt = now;
    if (speaker && !speaker.isBot) {
      room.turnMinEndsAt = now + (interventi ? INTERVENTO_MIN_MS : DEFENSE_MIN_MS);
      room.phaseExpiresAt = now + (interventi ? INTERVENTI_MAX_MS : DEFENSE_MAX_MS);
    } else {
      room.turnMinEndsAt = null;
      room.phaseExpiresAt = now + TURN_BOT_MS;
    }
  }

  /**
   * Auto-select one defender per side from that side's secret voters (side A
   * before B). A side with 0 votes is skipped. Which of a side's voters speaks
   * is chosen via the injectable rng, so tests can pin the pick.
   */
  private selectDefenders(room: Room): Defender[] {
    const devil = devilAdvocate.isDevilRound(room);
    const defenders: Defender[] = [];
    for (const side of ['A', 'B'] as const) {
      const voters = [...room.votes.entries()]
        .filter(([, choice]) => choice === side)
        .map(([id]) => id);
      if (voters.length === 0) continue; // side with no votes -> no defender
      // Equità: tra i votanti di questo lato scegli SEMPRE chi ha difeso meno
      // volte finora, così su una partita tutti ottengono un turno. Un lato può
      // essere difeso solo da chi l'ha votato: si pesca il meno-utilizzato tra
      // loro, con pareggio risolto dall'rng iniettabile (resta imprevedibile e
      // riproduce il vecchio comportamento quando i conteggi sono pari).
      const min = Math.min(...voters.map((id) => room.defenseCounts.get(id) ?? 0));
      const candidates = voters.filter((id) => (room.defenseCounts.get(id) ?? 0) === min);
      const chosen = candidates[Math.floor(this.rng() * candidates.length)];
      const player = room.players.get(chosen);
      if (!player) continue;
      room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1);
      if (devil) {
        // "Avvocato del Diavolo": argue the OPPOSITE side. Everything downstream
        // (bot/AI argument, attribution, persuasion, public display) keys off
        // `side` = the side being argued, so no other code needs to know.
        const argued: VoteChoice = side === 'A' ? 'B' : 'A';
        defenders.push({ id: player.id, nickname: player.nickname, side: argued, devil: true });
      } else {
        defenders.push({ id: player.id, nickname: player.nickname, side });
      }
    }
    return defenders;
  }

  /**
   * Pick the surprise "Avvocato del Diavolo" round: a random 1-based dilemma
   * index in [2..dilemmaCount] (never the first round, so the group learns the
   * normal flow first). null when there are fewer than 2 dilemmas.
   */
  private pickDevilRound(dilemmaCount: number): number | null {
    if (dilemmaCount < 2) return null;
    return 2 + Math.floor(this.rng() * (dilemmaCount - 1));
  }

  /** True when the round in play is the "Avvocato del Diavolo" round. */

  /**
   * Pick the surprise "Quanto mi conosci" round: a random round in [2..count]
   * distinct from the devil round. Only for longer games (>=5 dilemmas) so short
   * sessions aren't over-twisted; null otherwise.
   */
  private pickKnowRound(dilemmaCount: number, devilRound: number | null): number | null {
    if (dilemmaCount < 5) return null;
    const options: number[] = [];
    for (let i = 2; i <= dilemmaCount; i++) if (i !== devilRound) options.push(i);
    if (options.length === 0) return null;
    return options[Math.floor(this.rng() * options.length)];
  }

  /**
   * Assign each connected human a target to guess (a ring: everyone guesses the
   * next player), clearing any stale guesses. Called on entry to PREDICT in the
   * "Quanto mi conosci" round. With fewer than 2 humans nobody gets a target.
   */
  private assignKnowTargets(room: Room): void {
    room.knowTargets.clear();
    room.knowGuesses.clear();
    const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
    if (humans.length < 2) return;
    for (let i = 0; i < humans.length; i++) {
      room.knowTargets.set(humans[i].id, humans[(i + 1) % humans.length].id);
    }
  }

  /** Cast each bot's (random) first vote on entry to VOTE_1. */
  private castBotFirstVotes(room: Room): void {
    for (const p of room.players.values()) {
      if (p.isBot) room.votes.set(p.id, this.rng() < 0.5 ? 'A' : 'B');
    }
  }

  /**
   * Apply each bot's VOTE_2 swing based on its persona and the revealed first-vote
   * split (votes1): roccione holds; gregge drifts to the majority; bastian to the
   * minority; indeciso/equilibrato flip with a persona-specific probability. On a
   * tied split, gregge/bastian hold (no clear majority to chase).
   */
  private applyBotSecondVotes(room: Room): void {
    const t = tally(room.votes1);
    const majority: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
    const minority: VoteChoice | null = majority ? (majority === 'A' ? 'B' : 'A') : null;
    for (const p of room.players.values()) {
      if (!p.isBot || !p.persona) continue;
      const current = room.votes.get(p.id);
      if (!current) continue;
      const other: VoteChoice = current === 'A' ? 'B' : 'A';
      let next: VoteChoice = current;
      switch (p.persona) {
        case 'roccione': break;
        case 'indeciso': next = this.rng() < 0.7 ? other : current; break;
        case 'equilibrato': next = this.rng() < 0.35 ? other : current; break;
        case 'gregge': if (minority && current === minority) next = majority as VoteChoice; break;
        case 'bastian': if (majority && current === majority) next = minority as VoteChoice; break;
      }
      room.votes.set(p.id, next);
    }
  }

  /** The canned argument for the current defender if a bot, else null (Fase B). */
  private argumentForCurrentDefender(room: Room): string | null {
    const defender = room.defenders[room.defenseTurnIndex];
    if (!defender) return null;
    const player = room.players.get(defender.id);
    if (!player?.isBot || !player.persona || !room.currentDilemma) return null;
    return botDefenseArgument(player.persona, room.currentDilemma, defender.side, this.rng);
  }


  /**
   * Advance the 1v1 duel state machine one step (the duello analogue of the group
   * logic in advancePhase). DUEL_ARGUE runs one timed turn per player (mirror of
   * DEFENSE); DUEL_REVEAL branches on whether the two picks agree; entering a new
   * round (DUEL_PICK) draws a dilemma and clears the picks; DUEL_REPICK snapshots
   * the first pick; DUEL_RESULT records the round's outcome.
   */
  private advanceDuelPhase(room: Room): AdvancePhaseResult {
    if (room.phase === 'DUEL_ARGUE' && room.duelTurnIndex < duelPlayers(room).length - 1) {
      room.duelTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DUEL_ARGUE');
      return { ok: true, room };
    }
    const agreed = room.phase === 'DUEL_REVEAL' ? duelAgreed(room) : false;
    const t = nextDuelPhase(room.phase, room.dilemmaIndex, room.dilemmaCount ?? 0, agreed);
    room.phase = t.phase;
    room.dilemmaIndex = t.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(t.phase);
    if (t.phase === 'DUEL_PICK') {
      room.currentDilemma = room.deck?.draw() ?? null;
      room.votes.clear();
      room.votes1.clear();
      room.duelTurnIndex = 0;
    }
    if (t.phase === 'DUEL_REPICK') {
      room.votes1 = new Map(room.votes);
    }
    if (t.phase === 'DUEL_RESULT') {
      // Agreed path skips DUEL_REPICK, so votes1 was never snapshotted — take it
      // now so recordDuelResult sees first==second (no flips) and counts the agree.
      if (room.votes1.size === 0) room.votes1 = new Map(room.votes);
      recordDuelResult(room);
    }
    return { ok: true, room };
  }

  /** Create a room with a code unique among the rooms currently in memory. */
  create(): Room {
    let code = this.genCode();
    while (this.rooms.has(code)) {
      code = this.genCode();
    }
    const room: Room = {
      code,
      createdAt: this.now(),
      leaderId: null,
      players: new Map(),
      phase: 'LOBBY',
      dilemmaCount: null,
      register: null,
      format: 'classic',
      startTappa: null,
      durata: null,
      plannedDilemmas: [],
      plannedTappe: [],
      currentTappa: null,
      tappaDilemmas: 0,
      tappaSwings: 0,
      dilemmaIndex: 0,
      phaseExpiresAt: null,
      deck: null,
      currentDilemma: null,
      submittedDilemmas: [],
      dilemmaAuthors: new Map(),
      submittedQueue: [],
      devilRoundIndex: null,
      knowRoundIndex: null,
      knowTargets: new Map(),
      knowGuesses: new Map(),
      infiltratorId: null,
      infiltratorFlips: 0,
      accusations: new Map(),
      infiltratoResult: null,
      teams: new Map(),
      votes: new Map(),
      votes1: new Map(),
      confirmedVote2: new Set(),
      defenders: [],
      defenseTurnIndex: 0,
      defenseArgument: null,
      raisedHands: [],
      interventiQueue: [],
      interventiIndex: 0,
      turnMinEndsAt: null,
      turnStartedAt: null,
      stats: new Map(),
      botSeq: 0,
      mode: 'gruppo',
      duelTurnIndex: 0,
      duelScore: new Map(),
      duelAgreements: 0,
      lastReactionAt: new Map(),
      predictions: new Map(),
      swingBets: new Map(),
      speakerVotes: new Map(),
      defenseCounts: new Map(),
    };
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Start the game: validate the room, the chosen dilemma count, and that at
   * least MIN_PLAYERS_TO_START players are present, then move the room from
   * LOBBY to PHASE_INTRO. Idempotency is the caller's concern — starting an
   * already-started room is rejected with ALREADY_STARTED.
   */
  startGame(
    code: string,
    dilemmaCount: number,
    register: string = 'misto',
    mode: string = 'gruppo',
    infiltrato: boolean = false,
    squadre: boolean = false,
    percorso?: { startTappa: number; durata: string },
  ): StartGameResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'LOBBY') return { ok: false, error: 'ALREADY_STARTED' };
    // "Percorso": the long themed ascent. Its dilemma count + content come from a
    // plan we build (and validate) up front, before mutating any room state. It is
    // a group experience, so it always runs in gruppo mode.
    const usePercorso = percorso != null;
    let plan: { dilemmas: Dilemma[]; tappe: number[] } | null = null;
    if (usePercorso) {
      mode = 'gruppo';
      if (
        !Number.isInteger(percorso.startTappa) ||
        percorso.startTappa < 1 ||
        percorso.startTappa > N_TAPPE ||
        !isDurata(percorso.durata)
      ) {
        return { ok: false, error: 'INVALID_PERCORSO' };
      }
      plan = buildPercorsoPlan(this.makeDeck('misto').cards, percorso.startTappa, percorso.durata, this.rng);
      if (plan.dilemmas.length === 0) return { ok: false, error: 'INVALID_PERCORSO' };
    } else {
      if (!isDilemmaCount(dilemmaCount)) return { ok: false, error: 'INVALID_DILEMMA_COUNT' };
      if (!isContentRegister(register)) return { ok: false, error: 'INVALID_REGISTER' };
    }
    if (!isGameMode(mode)) return { ok: false, error: 'INVALID_REGISTER' };
    const humans = [...room.players.values()].filter((p) => !p.isBot);
    const humanCount = humans.length;
    if (mode === 'duello') {
      // The duel is strictly two humans (no bot opponent in this slice).
      if (room.players.size !== 2 || humanCount !== 2) {
        return { ok: false, error: 'WRONG_PLAYER_COUNT' };
      }
    } else {
      if (room.players.size < MIN_PLAYERS_TO_START) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
      // Solo play is allowed (1 human + bots), but never a bots-only game.
      if (humanCount < 1) return { ok: false, error: 'NO_HUMAN_PLAYERS' };
    }
    // "L'Infiltrato" needs gruppo + enough humans to hide among and to accuse.
    const useInfiltrato = infiltrato && mode === 'gruppo';
    if (useInfiltrato && humanCount < MIN_INFILTRATO_HUMANS) {
      return { ok: false, error: 'INFILTRATO_NEEDS_PLAYERS' };
    }
    // "Squadre" needs gruppo + enough players for two teams.
    const useSquadre = squadre && mode === 'gruppo';
    if (useSquadre && room.players.size < MIN_SQUADRE_PLAYERS) {
      return { ok: false, error: 'SQUADRE_NEEDS_PLAYERS' };
    }

    // Assign a secret infiltrator (a random human) when enabled; reset the role state.
    room.infiltratorId = useInfiltrato ? humans[Math.floor(this.rng() * humans.length)].id : null;
    room.infiltratorFlips = 0;
    room.accusations = new Map();
    room.infiltratoResult = null;
    // Split players into two teams (alternating by join order) when enabled.
    room.teams = new Map();
    if (useSquadre) {
      [...room.players.values()].forEach((p, i) => {
        room.teams.set(p.id, i % 2 === 0 ? 'blu' : 'arancio');
      });
    }

    room.mode = mode;
    room.dilemmaIndex = 0;
    room.phase = 'PHASE_INTRO';
    room.phaseExpiresAt = this.expiryFor('PHASE_INTRO');
    room.currentDilemma = null;
    room.currentTappa = null;
    room.tappaDilemmas = 0;
    room.tappaSwings = 0;
    if (usePercorso && plan) {
      // Percorso: the precomputed ascent drives everything; no register/deck and
      // (for now) no player-submitted dilemmas — the climb is the curated content.
      room.format = 'percorso';
      room.startTappa = clampTappa(percorso.startTappa);
      room.durata = percorso.durata as Durata;
      room.plannedDilemmas = plan.dilemmas;
      room.plannedTappe = plan.tappe;
      room.currentTappa = plan.tappe[0] as Tappa;
      room.dilemmaCount = plan.dilemmas.length;
      room.register = null;
      room.deck = null;
      room.submittedQueue = [];
    } else {
      room.format = 'classic';
      room.startTappa = null;
      room.durata = null;
      room.plannedTappe = [];
      // Validated above in this same (classic) branch via isContentRegister.
      room.register = register as ContentRegister;
      room.deck = this.makeDeck(register as ContentRegister);
      // Precompute the ordered sequence: submitted dilemmas first, then the deck,
      // finally escalating by complexity (alto → max → power) over the game.
      room.plannedDilemmas = this.buildClassicPlan(room.deck, room.submittedDilemmas, dilemmaCount);
      room.dilemmaCount = room.plannedDilemmas.length || dilemmaCount;
      room.submittedQueue = []; // baked into plannedDilemmas
    }
    // Pick the surprise "Avvocato del Diavolo" round up front (group mode only).
    const totalRounds = room.dilemmaCount ?? 0;
    room.devilRoundIndex = mode === 'gruppo' ? this.pickDevilRound(totalRounds) : null;
    // …and (longer games only) a "Quanto mi conosci" round, distinct from the devil one.
    room.knowRoundIndex = mode === 'gruppo' ? this.pickKnowRound(totalRounds, room.devilRoundIndex) : null;
    room.stats = new Map();
    room.defenseCounts = new Map();
    room.duelScore = new Map();
    room.duelAgreements = 0;
    room.duelTurnIndex = 0;
    return { ok: true, room };
  }

  /**
   * Advance the state machine by one step (timer expiry or host force-advance).
   * Mutates the room's phase, dilemma index, and the next auto-advance expiry.
   * LOBBY (start the game instead) and the terminal FINAL_AWARDS have no next
   * step and are rejected with NO_NEXT_PHASE.
   */
  advancePhase(code: string): AdvancePhaseResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase === 'LOBBY' || room.phase === 'FINAL_AWARDS' || room.phase === 'FINAL_DUEL') {
      return { ok: false, error: 'NO_NEXT_PHASE' };
    }

    // The 1v1 duel runs its own state machine, separate from the group sequence.
    if (room.mode === 'duello') return this.advanceDuelPhase(room);

    // "L'Infiltrato": the end-game accusation leads into FINAL_AWARDS, resolving
    // whether the infiltrator was caught and whether they won.
    if (room.phase === 'ACCUSE') {
      room.phase = 'FINAL_AWARDS';
      room.phaseExpiresAt = this.expiryFor('FINAL_AWARDS');
      infiltrato.resolveInfiltrato(room);
      return { ok: true, room };
    }

    // A finished INTERVENTI mini-turn: walk the frozen queue, then resume the
    // defenders (next defender or fall through to VOTE_2). Per-defender interventi.
    if (room.phase === 'INTERVENTI') {
      if (room.interventiIndex < room.interventiQueue.length - 1) {
        room.interventiIndex++;
        this.armTurn(room);
        return { ok: true, room };
      }
      room.interventiQueue = [];
      room.interventiIndex = 0;
      if (room.defenseTurnIndex < room.defenders.length - 1) {
        room.phase = 'DEFENSE';
        room.defenseTurnIndex++;
        room.raisedHands = [];
        room.defenseArgument = this.argumentForCurrentDefender(room);
        this.armTurn(room);
        return { ok: true, room };
      }
      // No defenders left: fall through to the normal DEFENSE -> VOTE_2 transition.
      room.phase = 'DEFENSE';
    }

    // A finished DEFENSE turn: if the defender drew raised hands, run their
    // interventi first; else advance to the next defender; else fall through to
    // VOTE_2 via the normal transition below.
    if (room.phase === 'DEFENSE' && room.raisedHands.length > 0) {
      room.phase = 'INTERVENTI';
      room.interventiQueue = [...room.raisedHands];
      room.interventiIndex = 0;
      room.raisedHands = [];
      this.armTurn(room);
      return { ok: true, room };
    }
    if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) {
      room.defenseTurnIndex++;
      room.raisedHands = [];
      room.defenseArgument = this.argumentForCurrentDefender(room);
      this.armTurn(room);
      return { ok: true, room };
    }

    // Percorso threads the same per-dilemma sequence through chapter cards/recaps;
    // classic uses the flat loop. Both share the detours below.
    const step = (phase: GamePhase, idx: number) =>
      room.format === 'percorso'
        ? nextPercorsoPhase(phase, idx, room.plannedTappe)
        : nextPhase(phase, idx, room.dilemmaCount ?? 0);
    let transition = step(room.phase, room.dilemmaIndex);
    // The peer "best speaker" vote needs at least two defenders to choose between;
    // with 0 or 1 it's degenerate, so skip straight to the results.
    if (transition.phase === 'SPEAKER_VOTE' && room.defenders.length < 2) {
      transition = step('SPEAKER_VOTE', transition.dilemmaIndex);
    }
    // Detour the end of an infiltrator game through the accusation phase.
    if (transition.phase === 'FINAL_AWARDS' && room.infiltratorId) {
      transition = { phase: 'ACCUSE', dilemmaIndex: transition.dilemmaIndex };
    }
    room.phase = transition.phase;
    room.dilemmaIndex = transition.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(transition.phase);
    // Percorso: entering a chapter card sets the upcoming tappa (the dilemma the
    // card precedes is dilemmaIndex+1) and resets the per-tappa recap counters.
    if (transition.phase === 'TAPPA_INTRO') {
      room.currentTappa = (room.plannedTappe[transition.dilemmaIndex] ?? room.currentTappa) as Tappa | null;
      room.tappaDilemmas = 0;
      room.tappaSwings = 0;
    }
    // Percorso: the end-of-tappa recap reflects the tappa just finished.
    if (transition.phase === 'TAPPA_RECAP') {
      room.currentTappa = (room.plannedTappe[transition.dilemmaIndex - 1] ?? room.currentTappa) as Tappa | null;
    }
    // Entering a new dilemma reveal draws the next (non-repeating) dilemma and
    // resets the round's secret votes so each dilemma starts from a clean tally.
    if (transition.phase === 'DILEMMA_REVEAL') {
      if (room.format === 'percorso') {
        // The ascent is precomputed: walk it by index, and track the live tappa.
        room.currentDilemma = room.plannedDilemmas[transition.dilemmaIndex - 1] ?? null;
        room.currentTappa = (room.plannedTappe[transition.dilemmaIndex - 1] ?? null) as Tappa | null;
      } else {
        // Classic: walk the precomputed complexity-escalating plan; fall back to
        // the deck only if (for any reason) the plan is empty.
        room.currentDilemma =
          room.plannedDilemmas[transition.dilemmaIndex - 1] ??
          room.submittedQueue.shift() ??
          room.deck?.draw() ??
          null;
      }
      room.votes.clear();
      room.votes1.clear();
      room.confirmedVote2.clear();
      room.predictions.clear();
      room.swingBets.clear();
      room.knowTargets.clear();
      room.knowGuesses.clear();
      room.speakerVotes.clear();
      room.raisedHands = [];
      room.interventiQueue = [];
      room.interventiIndex = 0;
      room.turnMinEndsAt = null;
    }
    // Entering PREDICT in the "Quanto mi conosci" round assigns the guessing ring.
    if (transition.phase === 'PREDICT' && knowRound.isKnowRound(room)) {
      this.assignKnowTargets(room);
    }
    // Entering DEFENSE picks the defenders from this round's votes and starts at
    // the first turn (the per-turn timer was set by expiryFor above).
    if (transition.phase === 'DEFENSE') {
      room.defenders = this.selectDefenders(room);
      room.defenseTurnIndex = 0;
      room.defenseArgument = this.argumentForCurrentDefender(room);
      room.raisedHands = [];
      this.armTurn(room);
    }
    // Entering VOTE_1: bots cast their (random) first vote so the human(s) only
    // wait on themselves; the per-choice split stays secret until SPLIT_REVEAL.
    if (transition.phase === 'VOTE_1') {
      this.castBotFirstVotes(room);
    }
    // Entering VOTE_2: snapshot the first vote so the live re-vote can be
    // compared against it (swing). `votes` is left intact, so each player's
    // first vote becomes the default they can keep or change; then bots apply
    // their persona-driven swing on top of that default.
    if (transition.phase === 'VOTE_2') {
      room.votes1 = new Map(room.votes);
      this.applyBotSecondVotes(room);
      // Fresh round of confirmations; bots have already "decided", so confirm them
      // so they never block the (timer-less) auto-advance.
      room.confirmedVote2 = new Set();
      for (const p of room.players.values()) if (p.isBot) room.confirmedVote2.add(p.id);
    }
    // Entering PHASE_RESULTS: fold this round's outcome into the per-player stats
    // while the votes/votes1/defenders are still intact (cleared next reveal).
    if (transition.phase === 'PHASE_RESULTS') {
      roundStats.recordRoundStats(room);
      // Percorso: accumulate the tappa's aggregate recap (count + leading-side
      // flips). Aggregate only — no per-player data leaks into the recap.
      if (room.format === 'percorso') {
        room.tappaDilemmas++;
        if (predictions.leadFlipped(room)) room.tappaSwings++;
      }
    }
    return { ok: true, room };
  }

  /**
   * Record (or change) a player's secret vote for the current dilemma. The vote
   * is overwritable until the phase ends, so re-voting just replaces the choice.
   * Votes never leave the server individually — only aggregate counts do.
   */
  vote(code: string, playerId: string, choice: string): VoteResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return voting.vote(room, playerId, choice);
  }

  /** The id of the player currently speaking (defender in DEFENSE, arguer in DUEL_ARGUE), or null. */
  /**
   * Record a live audience reaction from a phone during DEFENSE / DUEL_ARGUE. The
   * reaction is attributed to whoever is currently speaking (the defender/arguer),
   * accumulating their `reactionsReceived` for the end-game "Beniamino" award.
   * Rate-limited per player (anti-spam) and restricted to the emoji allowlist.
   * Reactions are public expressions broadcast as an aggregate stream — they
   * never touch the secret votes.
   */
  react(code: string, playerId: string, emoji: string): ReactResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return reactions.react(room, playerId, emoji, this.now());
  }

  /**
   * Toggle a player's raised hand during a defender's turn (DEFENSE only). Anyone
   * present except the current speaker may queue; raising again lowers it. The FIFO
   * order is the speaking order for the INTERVENTI mini-turns that follow. The
   * identities never leave the server during DEFENSE — only the aggregate count.
   */
  raiseHand(code: string, playerId: string): RaiseHandResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return defenseTurns.raiseHand(room, playerId);
  }

  /**
   * The current speaker (defender in DEFENSE, intervenor in INTERVENTI) signals
   * they are done. Valid only from the speaker and only once the per-turn minimum
   * has elapsed; the caller (index.ts) then advances the turn like the timer would.
   */
  finishTurn(code: string, playerId: string): FinishTurnResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return defenseTurns.finishTurn(room, playerId, this.now());
  }

  /**
   * Record (or change) a player's secret prediction of the post-defense majority
   * during PREDICT. Overwritable until the phase ends, like a vote. Predictions
   * never leave the server individually — only the aggregate count, plus each
   * predictor's own result at PHASE_RESULTS.
   */
  predict(code: string, playerId: string, choice: string): PredictResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return predictions.predict(room, playerId, choice);
  }

  /** How many players have made a prediction this round (aggregate only). */
  predictedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? predictions.predictedCount(room) : 0;
  }

  /** True once every connected human has predicted (ends PREDICT early). */
  allPredicted(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? predictions.allPredicted(room) : false;
  }

  /**
   * Each predictor's own outcome for the just-finished round, for the private
   * `player:predictionResult` emit at PHASE_RESULTS.
   */
  predictionResults(code: string): PredictionResult[] {
    const room = this.rooms.get(code);
    return room ? predictions.predictionResults(room) : [];
  }

  /** Record (or change) a player's secret swing bet during PREDICT. */
  swingBet(code: string, playerId: string, bet: string): SwingBetResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return predictions.swingBet(room, playerId, bet);
  }

  /** How many players have placed a swing bet this round (aggregate only). */
  swingBetCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? predictions.swingBetCount(room) : 0;
  }

  /** True once every connected human has placed a swing bet (mirror of allPredicted). */
  allSwingBet(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? predictions.allSwingBet(room) : false;
  }

  /**
   * Each bettor's own swing-bet outcome for the just-finished round, for the
   * private `player:swingBetResult` emit at PHASE_RESULTS.
   */
  swingBetResults(code: string): SwingBetOutcome[] {
    const room = this.rooms.get(code);
    return room ? predictions.swingBetResults(room) : [];
  }

  /** A fresh shuffled copy of `arr` using the injectable rng (Fisher–Yates). */
  private shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Build the ordered CLASSIC sequence: the group's own dilemmas first (shuffled),
   * then drawn from the deck to reach `count`, finally ordered by ascending
   * complexity so the game escalates alto → max → power. Submitted dilemmas have
   * no complexity, so they count as 'alto' (the warm-up). Within a tier the random
   * draw order is preserved (stable sort) for variety across games.
   */
  private buildClassicPlan(deck: Deck, submitted: Dilemma[], count: number): Dilemma[] {
    const chosen: Dilemma[] = [...this.shuffle(submitted).slice(0, count)];
    while (chosen.length < count) {
      const d = deck.draw();
      if (!d) break;
      chosen.push(d);
    }
    const rank = (d: Dilemma) => COMPLESSITA_RANK[d.complessita ?? 'alto'];
    return chosen
      .map((d, i) => ({ d, i }))
      .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
      .map((x) => x.d);
  }

  /**
   * Record a player-written dilemma during LOBBY (max 2/player). Trims + length-
   * caps the text, rejects empty/duplicate options, and tags authorship for the
   * ✍️ L'Autore award. Returns the player's own running count on success.
   */
  submitDilemma(
    code: string,
    playerId: string,
    text: string,
    optionA: string,
    optionB: string,
  ): SubmitDilemmaResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return submittedDilemmas.submitDilemma(room, playerId, text, optionA, optionB);
  }

  /** How many player-written dilemmas the room has collected (aggregate, lobby UI). */
  submittedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? submittedDilemmas.submittedCount(room) : 0;
  }

  /**
   * Record (or change) a player's secret guess of their target's first vote during
   * the "Quanto mi conosci" round (the PREDICT phase). Overwritable until the phase
   * ends; never leaves the server as an identity (only the aggregate count, plus
   * each guesser's own result at PHASE_RESULTS).
   */
  knowGuess(code: string, guesserId: string, choice: string): KnowGuessResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return knowRound.knowGuess(room, guesserId, choice);
  }

  /** How many guessers have guessed this round (aggregate only). */
  knowGuessedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? knowRound.knowGuessedCount(room) : 0;
  }

  /** True once every guesser in the ring has guessed (used to end PREDICT early). */
  allKnowGuessed(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? knowRound.allKnowGuessed(room) : false;
  }

  /**
   * The public guesser→target ring, revealed only during the "Quanto mi conosci"
   * round (PREDICT → PHASE_RESULTS) so phones know whom to read; null otherwise.
   * The ring itself is not secret (only the guesses + the actual votes are).
   */
  publicKnowPairs(code: string): KnowPair[] | null {
    const room = this.rooms.get(code);
    return room ? knowRound.publicKnowPairs(room) : null;
  }

  /**
   * Each guesser's own outcome for the just-finished know round, for the private
   * `player:knowGuessResult` emit at PHASE_RESULTS.
   */
  knowGuessResults(code: string): KnowGuessOutcome[] {
    const room = this.rooms.get(code);
    return room ? knowRound.knowGuessResults(room) : [];
  }

  /**
   * Record (or change) an accusation during the ACCUSE phase: who the accuser
   * thinks the infiltrator is. One vote per accuser, no self-accusation.
   */
  accuse(code: string, accuserId: string, accusedId: string): AccuseResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return infiltrato.accuse(room, accuserId, accusedId);
  }

  /** How many players have accused this game (aggregate only). */
  accusedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? infiltrato.accusedCount(room) : 0;
  }

  /** True once every connected human has accused (ends the ACCUSE phase early). */
  allAccused(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? infiltrato.allAccused(room) : false;
  }

  /** The resolved infiltrator reveal, only at FINAL_AWARDS; null otherwise / normal games. */
  publicInfiltratoResult(code: string): InfiltratoResult | null {
    const room = this.rooms.get(code);
    return room ? infiltrato.publicInfiltratoResult(room) : null;
  }

  /**
   * Public "Squadre" state: each player's team + the running team scores (sum of
   * members' persuasion). null when teams are off. Teams are public by design.
   */
  publicTeams(code: string): TeamState | null {
    const room = this.rooms.get(code);
    if (!room || room.teams.size === 0) return null;
    const scores: { blu: number; arancio: number } = { blu: 0, arancio: 0 };
    const assignments = [...room.teams].map(([playerId, team]) => {
      scores[team] += room.stats.get(playerId)?.persuasion ?? 0;
      return { playerId, nickname: room.players.get(playerId)?.nickname ?? '', team };
    });
    return { assignments, scores };
  }

  /**
   * Record (or change) a player's secret vote for the most convincing defender
   * during SPEAKER_VOTE. The target must be one of this round's defenders and not
   * the voter themselves (no self-vote). Overwritable until the phase ends.
   */
  voteSpeaker(code: string, voterId: string, defenderId: string): SpeakerVoteResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return speakerVote.voteSpeaker(room, voterId, defenderId);
  }

  /** The defenders to choose between during SPEAKER_VOTE; null otherwise. */
  speakerCandidates(code: string): Defender[] | null {
    const room = this.rooms.get(code);
    return room ? speakerVote.speakerCandidates(room) : null;
  }

  /** How many players have cast a best-speaker vote this round (aggregate only). */
  speakerVotedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? speakerVote.speakerVotedCount(room) : 0;
  }

  /** True once every connected human has cast a best-speaker vote (ends the phase early). */
  allSpeakerVoted(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? speakerVote.allSpeakerVoted(room) : false;
  }

  /** How many connected players have cast a vote this round (aggregate only). */
  voteCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? voting.voteCount(room) : 0;
  }

  /** Aggregate A vs B tally for the current round (no identities). */
  voteTally(code: string): VoteTally {
    const room = this.rooms.get(code);
    return room ? voting.voteTally(room) : { A: 0, B: 0 };
  }

  /**
   * Compare the second vote against the first: the two aggregate tallies, how many
   * voters changed side, and the net swing toward each side. Zeros for unknown rooms.
   */
  computeSwing(code: string): SwingResult {
    const room = this.rooms.get(code);
    return room
      ? voting.computeSwing(room)
      : { first: { A: 0, B: 0 }, second: { A: 0, B: 0 }, switched: 0, netSwing: { A: 0, B: 0 } };
  }

  /** Public PHASE_RESULTS view: the swing + per-defender attribution; null otherwise. */
  publicSwing(code: string): PublicSwing | null {
    const room = this.rooms.get(code);
    return room ? voting.publicSwing(room) : null;
  }

  /** The aggregate A/B split when the phase reveals it (SPLIT_REVEAL); otherwise null. */
  publicSplit(code: string): { A: number; B: number } | null {
    const room = this.rooms.get(code);
    return room ? voting.publicSplit(room) : null;
  }

  /**
   * The secret-safe percorso view for the host/phones: the chosen start + duration,
   * the live tappa, overall progress, and per-tappa totals/done — plus the current
   * tappa's aggregate recap (dilemmas + leading-side flips). Never any individual
   * vote. null when the room isn't a percorso. `done` per tappa is derived from the
   * 1-based dilemmaIndex against the ascending plan.
   */
  publicPercorso(code: string): PercorsoView | null {
    const room = this.rooms.get(code);
    if (!room || room.format !== 'percorso' || room.startTappa == null || room.durata == null) {
      return null;
    }
    const ids = [...new Set(room.plannedTappe)].sort((a, b) => a - b);
    let offset = 0;
    const tappe = ids.map((id) => {
      const total = room.plannedTappe.filter((t) => t === id).length;
      const done = Math.max(0, Math.min(total, room.dilemmaIndex - offset));
      offset += total;
      return { id, total, done };
    });
    return {
      startTappa: room.startTappa,
      durata: room.durata,
      currentTappa: room.currentTappa,
      totalDilemmas: room.dilemmaCount ?? room.plannedDilemmas.length,
      dilemmaIndex: room.dilemmaIndex,
      tappe,
      tappaDilemmas: room.tappaDilemmas,
      tappaSwings: room.tappaSwings,
    };
  }

  /**
   * Whether the round in play is the surprise "Avvocato del Diavolo" round, but
   * revealed only once defenses begin (DEFENSE → PHASE_RESULTS) so it can't skew
   * the first vote or the prediction. false everywhere else.
   */
  publicDevilRound(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? devilAdvocate.publicDevilRound(room) : false;
  }

  /**
   * Public defense/interventi view (who's speaking + turn/queue state), only during
   * DEFENSE or INTERVENTI; null otherwise. The defenders' (and, once interventi
   * begin, the intervenors') identities are intentionally public — no other secret
   * votes are revealed. During DEFENSE only the aggregate raised-hand COUNT leaves
   * the server; the ordered names appear only from INTERVENTI on.
   */
  publicDefense(code: string): DefenseState | null {
    const room = this.rooms.get(code);
    return room ? defenseTurns.publicDefense(room, this.now()) : null;
  }

  /**
   * Public duel reveal (only DUEL_REVEAL, null otherwise): both players' picks +
   * whether they agreed. The picks are intentionally public here — that's the
   * point of the reveal; no other state leaks.
   */
  publicDuelReveal(code: string) {
    const room = this.rooms.get(code);
    return room ? duelReveal(room) : null;
  }

  /**
   * Public duel argue turn (only DUEL_ARGUE, null otherwise): who is arguing now
   * (the current player + their picked side) and the turn progress.
   */
  publicDuelTurn(code: string) {
    const room = this.rooms.get(code);
    return room ? duelTurn(room) : null;
  }

  /**
   * Public duel result (only DUEL_RESULT, null otherwise): whether they agreed,
   * and—if not—who convinced whom (a player whose re-pick changed was convinced
   * by the other). Derived from votes1 (first pick) vs votes (re-pick).
   */
  publicDuelResult(code: string) {
    const room = this.rooms.get(code);
    return room ? duelResult(room) : null;
  }

  /**
   * Public duel summary (only FINAL_DUEL, null otherwise): each player's total
   * persuasions and how many rounds the two agreed.
   */
  publicDuelSummary(code: string) {
    const room = this.rooms.get(code);
    return room ? duelSummary(room) : null;
  }

  /**
   * Context for generating an AI defense (Fase C): non-null only when the current
   * DEFENSE speaker is a bot. Carries the persona, the dilemma, the side, and the
   * turn coordinates so a late AI result can be matched back to the right turn.
   */
  botDefenderContext(code: string): {
    persona: BotPersona;
    dilemma: Dilemma;
    side: VoteChoice;
    dilemmaIndex: number;
    defenseTurnIndex: number;
  } | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'DEFENSE' || !room.currentDilemma) return null;
    const defender = room.defenders[room.defenseTurnIndex];
    if (!defender) return null;
    const player = room.players.get(defender.id);
    if (!player?.isBot || !player.persona) return null;
    return {
      persona: player.persona,
      dilemma: room.currentDilemma,
      side: defender.side,
      dilemmaIndex: room.dilemmaIndex,
      defenseTurnIndex: room.defenseTurnIndex,
    };
  }

  /**
   * Apply an AI-generated argument to the current DEFENSE turn (Fase C). No-op
   * (returns false) unless still on the exact turn it was requested for — async
   * results that arrive after the turn advanced are safely dropped.
   */
  setBotDefenseArgument(code: string, dilemmaIndex: number, defenseTurnIndex: number, text: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'DEFENSE') return false;
    if (room.dilemmaIndex !== dilemmaIndex || room.defenseTurnIndex !== defenseTurnIndex) return false;
    room.defenseArgument = text;
    return true;
  }

  /**
   * Compute the end-of-game awards from the accumulated per-player stats. Each
   * superlative goes to its leader; ties break by join order (insertion order of
   * the stats map). Awards with no meaningful winner (e.g. nobody changed their
   * mind) are omitted. Ungated — see publicAwards for the FINAL_AWARDS gate.
   */
  computeAwards(code: string): Award[] {
    const room = this.rooms.get(code);
    return room ? computeAwardsFor(room) : [];
  }

  /**
   * The end-of-game awards, only at FINAL_AWARDS (null otherwise) — the gated,
   * public-facing version the server broadcasts at the end of the game.
   */
  publicAwards(code: string): Award[] | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'FINAL_AWARDS') return null;
    return this.computeAwards(code);
  }

  /**
   * The player's end-of-game blind-spot tip, only at FINAL_AWARDS (null
   * otherwise). Private feedback — index.ts emits it per-socket, never broadcast.
   */
  blindSpotFor(code: string, playerId: string): BlindSpot | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'FINAL_AWARDS') return null;
    const stats = room.stats.get(playerId);
    return stats ? computeBlindSpot(stats) : null;
  }

  /**
   * True once every CONNECTED player has voted (and at least one is present).
   * Disconnected players (mid-grace) are ignored so a locked phone doesn't block
   * the early-advance — bots count as connected. Used only to short-circuit the
   * VOTE_1 timer; the phase timer still bounds the round regardless.
   */
  allVoted(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? voting.allVoted(room) : false;
  }

  /** Mark a player's (pre-filled) second vote as explicitly confirmed. VOTE_2 only. */
  confirmVote(code: string, playerId: string): { ok: true; room: Room } | { ok: false; error: 'ROOM_NOT_FOUND' | 'NOT_VOTE2_PHASE' | 'NOT_IN_ROOM' } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    return voting.confirmVote(room, playerId);
  }

  /** How many players have confirmed their second vote this round (aggregate only). */
  confirmedCount(code: string): number {
    const room = this.rooms.get(code);
    return room ? voting.confirmedCount(room) : 0;
  }

  /** True once every connected player has confirmed their second vote (ends VOTE_2 early). */
  allConfirmed(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? voting.allConfirmed(room) : false;
  }

  /**
   * Flag a player present/absent without touching their slot or secret vote.
   * Called by index.ts on socket disconnect (false) and on reconnect (true);
   * actual removal happens later via `leave` once the grace period expires.
   * Returns false for an unknown room or player.
   */
  setConnected(code: string, playerId: string, connected: boolean): boolean {
    const player = this.rooms.get(code)?.players.get(playerId);
    if (!player) return false;
    if (connected) delete player.connected;
    else player.connected = false;
    return true;
  }

  /** Tag a player with a Clerk user id (for award attribution). False if unknown. */
  setPlayerUser(code: string, playerId: string, clerkUserId: string): boolean {
    const player = this.rooms.get(code)?.players.get(playerId);
    if (!player) return false;
    player.clerkUserId = clerkUserId;
    return true;
  }

  /**
   * Add a player to a room's lobby. Re-joining with the same id keeps the
   * existing slot (StrictMode double-mount / reconnect safe) and updates the
   * nickname. Enforces the room exists, a non-empty nickname, and MAX_PLAYERS.
   */
  join(code: string, playerId: string, nickname: string): JoinResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const name = nickname.trim().slice(0, NICKNAME_MAX);
    if (!name) return { ok: false, error: 'NICKNAME_REQUIRED' };

    const existing = room.players.get(playerId);
    if (existing) {
      existing.nickname = name;
      delete existing.connected; // re-joining clears any stale "absent" flag
      return { ok: true, player: existing };
    }

    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

    const player: Player = { id: playerId, nickname: name };
    room.players.set(playerId, player);
    return { ok: true, player };
  }

  /** Remove a player from a room. Returns whether a player was removed. */
  leave(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    // Drop any votes so the tally + allVoted + swing only count present players.
    room.votes.delete(playerId);
    room.votes1.delete(playerId);
    room.confirmedVote2.delete(playerId);
    room.predictions.delete(playerId);
    room.swingBets.delete(playerId);
    room.knowGuesses.delete(playerId);
    room.knowTargets.delete(playerId);
    room.accusations.delete(playerId);
    room.teams.delete(playerId);
    room.speakerVotes.delete(playerId);
    // Drop a leaver from the raised-hand / interventi queues so they never speak or
    // display; keep interventiIndex pointing at the same upcoming speaker.
    room.raisedHands = room.raisedHands.filter((id) => id !== playerId);
    const qi = room.interventiQueue.indexOf(playerId);
    if (qi >= 0) {
      room.interventiQueue.splice(qi, 1);
      if (qi < room.interventiIndex) room.interventiIndex--;
    }
    const removed = room.players.delete(playerId);
    if (removed && room.leaderId === playerId) {
      const nextHuman = [...room.players.values()].find((p) => !p.isBot);
      room.leaderId = nextHuman ? nextHuman.id : null;
    }
    return removed;
  }

  /**
   * Add a server-driven bot to a room's lobby (Fase B). Bots count toward the
   * roster (and MAX_PLAYERS) but have no socket; the server casts their votes.
   * Only allowed in the LOBBY. A persona may be forced (tests); otherwise it
   * round-robins through BOT_PERSONAS for variety.
   */
  addBot(code: string, persona?: BotPersona): AddBotResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'LOBBY') return { ok: false, error: 'ALREADY_STARTED' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };
    const seq = room.botSeq++;
    const player: Player = {
      id: `bot:${room.code}:${seq}`,
      nickname: BOT_NAMES[seq % BOT_NAMES.length],
      isBot: true,
      persona: persona ?? BOT_PERSONAS[seq % BOT_PERSONAS.length],
    };
    room.players.set(player.id, player);
    return { ok: true, player };
  }

  /** Remove a bot by id. Returns false for unknown rooms/ids or a human player. */
  removeBot(code: string, id: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const player = room.players.get(id);
    if (!player?.isBot) return false;
    return room.players.delete(id);
  }

  /** Public lobby view: ordered list of players (no secret state). */
  listPlayers(code: string): Player[] {
    const room = this.rooms.get(code);
    return room ? [...room.players.values()] : [];
  }

  /** Make a present player the room's leader. False if room/player unknown. */
  setLeader(code: string, playerId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(playerId)) return false;
    room.leaderId = playerId;
    return true;
  }

  /** Whether the given player is the room's leader. */
  isLeader(code: string, playerId: string): boolean {
    return this.rooms.get(code)?.leaderId === playerId;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  /** Remove a room from the store entirely. Returns whether one was removed. */
  delete(code: string): boolean {
    return this.rooms.delete(code);
  }

  /** Reinsert a room (e.g. one rebuilt from a snapshot at boot). */
  restore(room: Room): void {
    this.rooms.set(room.code, room);
  }

  /** Codes of all rooms currently in memory (for periodic snapshotting). */
  activeCodes(): string[] {
    return [...this.rooms.keys()];
  }

  /** How many human players are currently connected (bots and mid-grace
   * absentees excluded). Used to decide whether a room is still alive. */
  connectedHumanCount(code: string): number {
    const room = this.rooms.get(code);
    if (!room) return 0;
    let n = 0;
    for (const p of room.players.values()) {
      if (!p.isBot && p.connected !== false) n++;
    }
    return n;
  }

  /** Codes of rooms with no connected humans and older than `maxIdleMs`
   * (a safety-net sweep for abandoned rooms). Pure query — the caller deletes,
   * so it can skip rooms whose players are still within their reconnect grace. */
  abandonedRooms(maxIdleMs: number): string[] {
    const now = this.now();
    const codes: string[] = [];
    for (const [code, room] of this.rooms) {
      if (this.connectedHumanCount(code) === 0 && now - room.createdAt > maxIdleMs) {
        codes.push(code);
      }
    }
    return codes;
  }

  get size(): number {
    return this.rooms.size;
  }
}
