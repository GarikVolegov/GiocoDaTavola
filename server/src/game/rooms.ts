// In-memory store of game rooms. The server is authoritative; rooms live here
// only for the lifetime of the process (no DB).

import { Deck, dilemmasForRegister, loadDilemmas, type Dilemma, type ContentRegister } from './deck';
import { botDefenseArgument } from './botDefense';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 4;

/** Max players allowed in a single room (in-person party game). */
export const MAX_PLAYERS = 8;

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
  | 'DEFENSE'
  | 'VOTE_2'
  | 'PHASE_RESULTS'
  | 'FINAL_AWARDS'
  // 1v1 "Duello" mode phases (run instead of the group sequence when mode==='duello').
  | 'DUEL_PICK'
  | 'DUEL_REVEAL'
  | 'DUEL_ARGUE'
  | 'DUEL_REPICK'
  | 'DUEL_RESULT'
  | 'FINAL_DUEL';

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
  VOTE_1: 20_000,
  SPLIT_REVEAL: 6_000,
  DEFENSE: 60_000,
  VOTE_2: 20_000,
  PHASE_RESULTS: 8_000,
  FINAL_AWARDS: null,
  DUEL_PICK: 20_000,
  DUEL_REVEAL: 5_000,
  DUEL_ARGUE: 45_000,
  DUEL_REPICK: 20_000,
  DUEL_RESULT: 8_000,
  FINAL_DUEL: null,
};

/** A single secret vote: which side a player chose. */
export type VoteChoice = 'A' | 'B';

/** Game mode: the classic group game, or the 2-player duel. */
export type GameMode = 'gruppo' | 'duello';
export const GAME_MODES = ['gruppo', 'duello'] as const;
function isGameMode(v: string): v is GameMode {
  return v === 'gruppo' || v === 'duello';
}

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

/** Phase in which players defend their side out loud, one turn per defender. */
export function isDefensePhase(phase: GamePhase): boolean {
  return phase === 'DEFENSE';
}

function isVoteChoice(c: string): c is VoteChoice {
  return c === 'A' || c === 'B';
}

/** Ordered phases that make up a single dilemma round. */
const DILEMMA_SEQUENCE: GamePhase[] = [
  'DILEMMA_REVEAL',
  'VOTE_1',
  'SPLIT_REVEAL',
  'DEFENSE',
  'VOTE_2',
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
}

/**
 * A player auto-selected to defend a side in DEFENSE. Their identity + side
 * become public during the defense (inherent to speaking) — no OTHER votes leak.
 */
export interface Defender {
  id: string;
  nickname: string;
  side: VoteChoice;
}

/** Public view of the defense phase: who is speaking + turn progress. */
export interface DefenseState {
  /** The defender currently speaking; null if nobody voted (no defenders). */
  speaker: Defender | null;
  /** 1-based index of the current turn (0 when there are no defenders). */
  turn: number;
  /** Total number of defense turns this round (0, 1, or 2). */
  totalTurns: number;
  /**
   * The current speaker's canned argument when they are a bot (Fase B), shown on
   * the host screen since a bot can't speak aloud; null when a human is speaking.
   */
  argument: string | null;
}

export interface Room {
  code: string;
  createdAt: number;
  /** Players currently in the lobby, keyed by player id. */
  players: Map<string, Player>;
  /** Current phase of the game state machine. */
  phase: GamePhase;
  /** Number of dilemmas chosen at start; null until the game starts. */
  dilemmaCount: number | null;
  /** Content register chosen at start; null until the game starts. */
  register: ContentRegister | null;
  /** Which dilemma (1-based) is being played; 0 before the first reveal. */
  dilemmaIndex: number;
  /** Epoch ms when the current phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** The deck for this game; created at start, drawn once per DILEMMA_REVEAL. */
  deck: Deck | null;
  /** The dilemma in play this round; null in the lobby/intro and after the game. */
  currentDilemma: Dilemma | null;
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
  | 'ALREADY_STARTED';

export type StartGameResult =
  | { ok: true; room: Room }
  | { ok: false; error: StartGameError };

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
export interface PlayerStats {
  /** Rounds the player took part in (voted in both VOTE_1 and VOTE_2). */
  rounds: number;
  /** Rounds where the second vote differed from the first. */
  changedCount: number;
  /** Rounds the player ended on the majority side of the second vote. */
  majorityCount: number;
  /** Rounds the player ended on the minority side of the second vote. */
  minorityCount: number;
  /** Net votes that swung toward sides this player defended. */
  persuasion: number;
}

/** The fun end-of-game superlatives (persuasion-themed). */
export type AwardId = 'persuasore' | 'banderuola' | 'roccione' | 'sintonia' | 'bastian';

/** An award and who won it. Only awards with a real winner are ever returned. */
export interface Award {
  id: AwardId;
  title: string;
  emoji: string;
  description: string;
  winner: Player;
}

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
   * Auto-select one defender per side from that side's secret voters (side A
   * before B). A side with 0 votes is skipped. Which of a side's voters speaks
   * is chosen via the injectable rng, so tests can pin the pick.
   */
  private selectDefenders(room: Room): Defender[] {
    const defenders: Defender[] = [];
    for (const side of ['A', 'B'] as const) {
      const voters = [...room.votes.entries()]
        .filter(([, choice]) => choice === side)
        .map(([id]) => id);
      if (voters.length === 0) continue; // side with no votes -> no defender
      const chosen = voters[Math.floor(this.rng() * voters.length)];
      const player = room.players.get(chosen);
      if (player) defenders.push({ id: player.id, nickname: player.nickname, side });
    }
    return defenders;
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
    const tally = RoomStore.tally(room.votes1);
    const majority: VoteChoice | null = tally.A > tally.B ? 'A' : tally.B > tally.A ? 'B' : null;
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

  /** Get (creating if needed) the accumulating stats record for a player. */
  private static ensureStats(room: Room, id: string): PlayerStats {
    let s = room.stats.get(id);
    if (!s) {
      s = { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 };
      room.stats.set(id, s);
    }
    return s;
  }

  /**
   * Fold the just-finished round into each player's accumulating stats: who took
   * part, who changed their mind, who ended on the majority/minority side, and
   * how many votes each defender's side gained (persuasion). Called once on entry
   * to PHASE_RESULTS, while votes1 (first vote), votes (second) and defenders are
   * still intact for this round.
   */
  private recordRoundStats(room: Room): void {
    const first = RoomStore.tally(room.votes1);
    const second = RoomStore.tally(room.votes);
    const majoritySide: VoteChoice | null =
      second.A > second.B ? 'A' : second.B > second.A ? 'B' : null;
    for (const [id, firstChoice] of room.votes1) {
      const secondChoice = room.votes.get(id);
      if (!secondChoice) continue; // left before the second vote -> skip this round
      const s = RoomStore.ensureStats(room, id);
      s.rounds++;
      if (secondChoice !== firstChoice) s.changedCount++;
      if (majoritySide) {
        if (secondChoice === majoritySide) s.majorityCount++;
        else s.minorityCount++;
      }
    }
    const netSwing: VoteTally = { A: second.A - first.A, B: second.B - first.B };
    for (const d of room.defenders) {
      if (netSwing[d.side] > 0) RoomStore.ensureStats(room, d.id).persuasion += netSwing[d.side];
    }
  }

  /** The (up to two) human players of a duel room, in insertion order. */
  private duelPlayers(room: Room): Player[] {
    return [...room.players.values()].filter((p) => !p.isBot);
  }

  /** True when both duel players picked the same side this round (current votes). */
  private duelAgreed(room: Room): boolean {
    const players = this.duelPlayers(room);
    if (players.length !== 2) return false;
    const a = room.votes.get(players[0].id);
    const b = room.votes.get(players[1].id);
    return a != null && a === b;
  }

  /**
   * Fold a finished duel round into the score: if the two first picks (votes1)
   * already agreed, count one agreement; otherwise a player whose re-pick changed
   * side was convinced, so the OTHER player earns +1 persuasion. Called on entry to
   * DUEL_RESULT, while votes1 (first pick) and votes (re-pick) are still intact.
   */
  private recordDuelResult(room: Room): void {
    const players = this.duelPlayers(room);
    if (players.length !== 2) return;
    const first0 = room.votes1.get(players[0].id);
    const first1 = room.votes1.get(players[1].id);
    if (first0 != null && first0 === first1) {
      room.duelAgreements++;
      return;
    }
    for (let i = 0; i < players.length; i++) {
      const me = players[i];
      const other = players[1 - i];
      const before = room.votes1.get(me.id);
      const after = room.votes.get(me.id);
      if (before && after && before !== after) {
        room.duelScore.set(other.id, (room.duelScore.get(other.id) ?? 0) + 1);
      }
    }
  }

  /**
   * Advance the 1v1 duel state machine one step (the duello analogue of the group
   * logic in advancePhase). DUEL_ARGUE runs one timed turn per player (mirror of
   * DEFENSE); DUEL_REVEAL branches on whether the two picks agree; entering a new
   * round (DUEL_PICK) draws a dilemma and clears the picks; DUEL_REPICK snapshots
   * the first pick; DUEL_RESULT records the round's outcome.
   */
  private advanceDuelPhase(room: Room): AdvancePhaseResult {
    if (room.phase === 'DUEL_ARGUE' && room.duelTurnIndex < this.duelPlayers(room).length - 1) {
      room.duelTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DUEL_ARGUE');
      return { ok: true, room };
    }
    const agreed = room.phase === 'DUEL_REVEAL' ? this.duelAgreed(room) : false;
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
      this.recordDuelResult(room);
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
      players: new Map(),
      phase: 'LOBBY',
      dilemmaCount: null,
      register: null,
      dilemmaIndex: 0,
      phaseExpiresAt: null,
      deck: null,
      currentDilemma: null,
      votes: new Map(),
      votes1: new Map(),
      defenders: [],
      defenseTurnIndex: 0,
      defenseArgument: null,
      stats: new Map(),
      botSeq: 0,
      mode: 'gruppo',
      duelTurnIndex: 0,
      duelScore: new Map(),
      duelAgreements: 0,
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
  ): StartGameResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'LOBBY') return { ok: false, error: 'ALREADY_STARTED' };
    if (!isDilemmaCount(dilemmaCount)) return { ok: false, error: 'INVALID_DILEMMA_COUNT' };
    if (!isContentRegister(register)) return { ok: false, error: 'INVALID_REGISTER' };
    if (!isGameMode(mode)) return { ok: false, error: 'INVALID_REGISTER' };
    const humanCount = [...room.players.values()].filter((p) => !p.isBot).length;
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

    room.mode = mode;
    room.dilemmaCount = dilemmaCount;
    room.register = register;
    room.dilemmaIndex = 0;
    room.phase = 'PHASE_INTRO';
    room.phaseExpiresAt = this.expiryFor('PHASE_INTRO');
    room.deck = this.makeDeck(register);
    room.currentDilemma = null;
    room.stats = new Map();
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

    // DEFENSE runs one timed turn per defender. While turns remain, advance to
    // the next speaker (re-arming the per-turn timer) instead of leaving the
    // phase; only once every defender has spoken do we fall through to VOTE_2.
    if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) {
      room.defenseTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DEFENSE');
      room.defenseArgument = this.argumentForCurrentDefender(room);
      return { ok: true, room };
    }

    const transition = nextPhase(room.phase, room.dilemmaIndex, room.dilemmaCount ?? 0);
    room.phase = transition.phase;
    room.dilemmaIndex = transition.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(transition.phase);
    // Entering a new dilemma reveal draws the next (non-repeating) dilemma and
    // resets the round's secret votes so each dilemma starts from a clean tally.
    if (transition.phase === 'DILEMMA_REVEAL') {
      room.currentDilemma = room.deck?.draw() ?? null;
      room.votes.clear();
      room.votes1.clear();
    }
    // Entering DEFENSE picks the defenders from this round's votes and starts at
    // the first turn (the per-turn timer was set by expiryFor above).
    if (transition.phase === 'DEFENSE') {
      room.defenders = this.selectDefenders(room);
      room.defenseTurnIndex = 0;
      room.defenseArgument = this.argumentForCurrentDefender(room);
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
    }
    // Entering PHASE_RESULTS: fold this round's outcome into the per-player stats
    // while the votes/votes1/defenders are still intact (cleared next reveal).
    if (transition.phase === 'PHASE_RESULTS') {
      this.recordRoundStats(room);
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
    if (!isVotingPhase(room.phase)) return { ok: false, error: 'NOT_VOTING_PHASE' };
    if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
    if (!isVoteChoice(choice)) return { ok: false, error: 'INVALID_CHOICE' };

    room.votes.set(playerId, choice);
    return { ok: true, room };
  }

  /** How many connected players have cast a vote this round (aggregate only). */
  voteCount(code: string): number {
    return this.rooms.get(code)?.votes.size ?? 0;
  }

  /** Aggregate A vs B counts of a votes map (no identities). */
  private static tally(votes: Map<string, VoteChoice>): VoteTally {
    const tally: VoteTally = { A: 0, B: 0 };
    for (const choice of votes.values()) tally[choice]++;
    return tally;
  }

  /** Aggregate A vs B tally for the current round (no identities). */
  voteTally(code: string): VoteTally {
    const room = this.rooms.get(code);
    return room ? RoomStore.tally(room.votes) : { A: 0, B: 0 };
  }

  /**
   * Compare the second vote (VOTE_2, the live `votes`) against the first
   * (the `votes1` snapshot taken when VOTE_2 began): the two aggregate tallies,
   * how many voters changed side, and the net swing toward each side. Counts
   * only — individual votes never leave the server. An unknown room yields zeros.
   */
  computeSwing(code: string): SwingResult {
    const room = this.rooms.get(code);
    const first = room ? RoomStore.tally(room.votes1) : { A: 0, B: 0 };
    const second = room ? RoomStore.tally(room.votes) : { A: 0, B: 0 };
    let switched = 0;
    if (room) {
      for (const [id, firstChoice] of room.votes1) {
        const secondChoice = room.votes.get(id);
        if (secondChoice && secondChoice !== firstChoice) switched++;
      }
    }
    return {
      first,
      second,
      switched,
      netSwing: { A: second.A - first.A, B: second.B - first.B },
    };
  }

  /**
   * Public results view, only during PHASE_RESULTS (null otherwise): the swing
   * plus, for each defender whose side gained votes, how many votes moved their
   * way. Aggregate only; the only identities are the (already public) defenders.
   */
  publicSwing(code: string): PublicSwing | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'PHASE_RESULTS') return null;
    const swing = this.computeSwing(code);
    const attribution: DefenseImpact[] = [];
    for (const d of room.defenders) {
      const gained = swing.netSwing[d.side];
      if (gained > 0) attribution.push({ defender: d, votes: gained });
    }
    return { ...swing, attribution };
  }

  /**
   * The aggregate A/B split when the current phase reveals it (SPLIT_REVEAL),
   * otherwise null — the gated, public-facing version of voteTally that the
   * server broadcasts. Counts only; never identities.
   */
  publicSplit(code: string): { A: number; B: number } | null {
    const room = this.rooms.get(code);
    if (!room || !isSplitRevealed(room.phase)) return null;
    return this.voteTally(code);
  }

  /**
   * Public defense view (who's speaking + turn progress), only during DEFENSE;
   * null otherwise. The defenders' identities/side are intentionally public —
   * no other secret votes are revealed.
   */
  publicDefense(code: string): DefenseState | null {
    const room = this.rooms.get(code);
    if (!room || !isDefensePhase(room.phase)) return null;
    const totalTurns = room.defenders.length;
    const speaker = room.defenders[room.defenseTurnIndex] ?? null;
    return {
      speaker,
      turn: totalTurns === 0 ? 0 : room.defenseTurnIndex + 1,
      totalTurns,
      argument: room.defenseArgument,
    };
  }

  /**
   * Public duel reveal (only DUEL_REVEAL, null otherwise): both players' picks +
   * whether they agreed. The picks are intentionally public here — that's the
   * point of the reveal; no other state leaks.
   */
  publicDuelReveal(code: string): {
    picks: Array<{ id: string; nickname: string; choice: VoteChoice }>;
    agreed: boolean;
  } | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'DUEL_REVEAL') return null;
    const picks = this.duelPlayers(room)
      .map((p) => ({ id: p.id, nickname: p.nickname, choice: room.votes.get(p.id) }))
      .filter((p): p is { id: string; nickname: string; choice: VoteChoice } => p.choice != null);
    return { picks, agreed: this.duelAgreed(room) };
  }

  /**
   * Public duel argue turn (only DUEL_ARGUE, null otherwise): who is arguing now
   * (the current player + their picked side) and the turn progress.
   */
  publicDuelTurn(code: string): {
    speaker: { id: string; nickname: string; side: VoteChoice } | null;
    turn: number;
    totalTurns: number;
  } | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'DUEL_ARGUE') return null;
    const players = this.duelPlayers(room);
    const total = players.length;
    const cur = players[room.duelTurnIndex];
    const side = cur ? room.votes.get(cur.id) ?? null : null;
    return {
      speaker: cur && side ? { id: cur.id, nickname: cur.nickname, side } : null,
      turn: total === 0 ? 0 : room.duelTurnIndex + 1,
      totalTurns: total,
    };
  }

  /**
   * Public duel result (only DUEL_RESULT, null otherwise): whether they agreed,
   * and—if not—who convinced whom (a player whose re-pick changed was convinced
   * by the other). Derived from votes1 (first pick) vs votes (re-pick).
   */
  publicDuelResult(code: string): {
    agreed: boolean;
    convinced: Array<{
      persuader: { id: string; nickname: string };
      convinced: { id: string; nickname: string };
    }>;
  } | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'DUEL_RESULT') return null;
    const players = this.duelPlayers(room);
    const first0 = players[0] ? room.votes1.get(players[0].id) : undefined;
    const first1 = players[1] ? room.votes1.get(players[1].id) : undefined;
    const agreed = players.length === 2 && first0 != null && first0 === first1;
    const convinced: Array<{
      persuader: { id: string; nickname: string };
      convinced: { id: string; nickname: string };
    }> = [];
    if (!agreed) {
      for (let i = 0; i < players.length; i++) {
        const me = players[i];
        const other = players[1 - i];
        const before = room.votes1.get(me.id);
        const after = room.votes.get(me.id);
        if (other && before && after && before !== after) {
          convinced.push({
            persuader: { id: other.id, nickname: other.nickname },
            convinced: { id: me.id, nickname: me.nickname },
          });
        }
      }
    }
    return { agreed, convinced };
  }

  /**
   * Public duel summary (only FINAL_DUEL, null otherwise): each player's total
   * persuasions and how many rounds the two agreed.
   */
  publicDuelSummary(code: string): {
    scores: Array<{ id: string; nickname: string; persuasions: number }>;
    agreements: number;
  } | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'FINAL_DUEL') return null;
    const scores = this.duelPlayers(room).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      persuasions: room.duelScore.get(p.id) ?? 0,
    }));
    return { scores, agreements: room.duelAgreements };
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
    if (!room) return [];
    const entries = [...room.stats.entries()]; // insertion order == join order
    const winnerBy = (
      score: (s: PlayerStats) => number,
      eligible: (s: PlayerStats) => boolean,
    ): Player | null => {
      let best: { id: string; score: number } | null = null;
      for (const [id, s] of entries) {
        if (!eligible(s)) continue;
        const value = score(s);
        if (best === null || value > best.score) best = { id, score: value };
      }
      if (!best) return null;
      const nickname = room.players.get(best.id)?.nickname ?? '';
      return { id: best.id, nickname };
    };
    const defs: Array<Omit<Award, 'winner'> & { winner: Player | null }> = [
      { id: 'persuasore', title: 'Il Persuasore', emoji: '🏆',
        description: 'Le sue difese hanno spostato più voti.',
        winner: winnerBy((s) => s.persuasion, (s) => s.persuasion > 0) },
      { id: 'banderuola', title: 'La Banderuola', emoji: '🎏',
        description: 'Ha cambiato idea più spesso.',
        winner: winnerBy((s) => s.changedCount, (s) => s.changedCount > 0) },
      { id: 'roccione', title: 'Il Roccione', emoji: '🪨',
        description: 'Non ha mai cambiato idea.',
        winner: winnerBy((s) => s.rounds, (s) => s.rounds > 0 && s.changedCount === 0) },
      { id: 'sintonia', title: 'In sintonia col gruppo', emoji: '🔮',
        description: 'Più spesso dalla parte della maggioranza.',
        winner: winnerBy((s) => s.majorityCount, (s) => s.majorityCount > 0) },
      { id: 'bastian', title: 'Bastian Contrario', emoji: '🦓',
        description: 'Più spesso in minoranza.',
        winner: winnerBy((s) => s.minorityCount, (s) => s.minorityCount > 0) },
    ];
    return defs.filter((d): d is Award => d.winner !== null);
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
   * True once every CONNECTED player has voted (and at least one is present).
   * Disconnected players (mid-grace) are ignored so a locked phone doesn't block
   * the early-advance — bots count as connected. Used only to short-circuit the
   * VOTE_1 timer; the phase timer still bounds the round regardless.
   */
  allVoted(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const present = [...room.players.values()].filter((p) => p.connected !== false);
    if (present.length === 0) return false;
    return present.every((p) => room.votes.has(p.id));
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

  /**
   * Add a player to a room's lobby. Re-joining with the same id keeps the
   * existing slot (StrictMode double-mount / reconnect safe) and updates the
   * nickname. Enforces the room exists, a non-empty nickname, and MAX_PLAYERS.
   */
  join(code: string, playerId: string, nickname: string): JoinResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const name = nickname.trim();
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
    return room.players.delete(playerId);
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

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  get size(): number {
    return this.rooms.size;
  }
}
