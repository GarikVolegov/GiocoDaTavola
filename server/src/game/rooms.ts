// In-memory store of game rooms. The server is authoritative; rooms live here
// only for the lifetime of the process (no DB).

import { Deck, loadDilemmas, type Dilemma } from './deck';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 4;

/** Max players allowed in a single room (in-person party game). */
export const MAX_PLAYERS = 8;

/** Minimum connected players required before the host can start the game. */
export const MIN_PLAYERS_TO_START = 3;

/** How many dilemmas the host may choose to play in one game. */
export const DILEMMA_COUNT_OPTIONS = [3, 4, 5] as const;
export type DilemmaCount = (typeof DILEMMA_COUNT_OPTIONS)[number];

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
  | 'FINAL_AWARDS';

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
};

/** A single secret vote: which side a player chose. */
export type VoteChoice = 'A' | 'B';

/** Phases in which phones may cast/change a secret vote (the first + second). */
export function isVotingPhase(phase: GamePhase): boolean {
  return phase === 'VOTE_1' || phase === 'VOTE_2';
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

export interface Player {
  /** Stable identity for the lifetime of the connection (socket id for now). */
  id: string;
  nickname: string;
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
}

export type JoinError = 'ROOM_NOT_FOUND' | 'NICKNAME_REQUIRED' | 'ROOM_FULL';

export type JoinResult =
  | { ok: true; player: Player }
  | { ok: false; error: JoinError };

export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_DILEMMA_COUNT'
  | 'ALREADY_STARTED';

export type StartGameResult =
  | { ok: true; room: Room }
  | { ok: false; error: StartGameError };

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
    private readonly makeDeck: () => Deck = () => new Deck(loadDilemmas()),
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
      dilemmaIndex: 0,
      phaseExpiresAt: null,
      deck: null,
      currentDilemma: null,
      votes: new Map(),
      votes1: new Map(),
      defenders: [],
      defenseTurnIndex: 0,
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
  startGame(code: string, dilemmaCount: number): StartGameResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'LOBBY') return { ok: false, error: 'ALREADY_STARTED' };
    if (!isDilemmaCount(dilemmaCount)) return { ok: false, error: 'INVALID_DILEMMA_COUNT' };
    if (room.players.size < MIN_PLAYERS_TO_START) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };

    room.dilemmaCount = dilemmaCount;
    room.dilemmaIndex = 0;
    room.phase = 'PHASE_INTRO';
    room.phaseExpiresAt = this.expiryFor('PHASE_INTRO');
    room.deck = this.makeDeck();
    room.currentDilemma = null;
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
    if (room.phase === 'LOBBY' || room.phase === 'FINAL_AWARDS') {
      return { ok: false, error: 'NO_NEXT_PHASE' };
    }

    // DEFENSE runs one timed turn per defender. While turns remain, advance to
    // the next speaker (re-arming the per-turn timer) instead of leaving the
    // phase; only once every defender has spoken do we fall through to VOTE_2.
    if (room.phase === 'DEFENSE' && room.defenseTurnIndex < room.defenders.length - 1) {
      room.defenseTurnIndex++;
      room.phaseExpiresAt = this.expiryFor('DEFENSE');
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
    }
    // Entering VOTE_2: snapshot the first vote so the live re-vote can be
    // compared against it (swing). `votes` is left intact, so each player's
    // first vote becomes the default they can keep or change.
    if (transition.phase === 'VOTE_2') {
      room.votes1 = new Map(room.votes);
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
    };
  }

  /** True once every connected player has voted (and the room is non-empty). */
  allVoted(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.players.size === 0) return false;
    return room.votes.size >= room.players.size;
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
