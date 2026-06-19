// In-memory store of game rooms. The server is authoritative; rooms live here
// only for the lifetime of the process (no DB).

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

  // `genCode` and `now` are injectable so tests can force collisions and drive
  // phase timers deterministically.
  constructor(
    private readonly genCode: () => string = generateRoomCode,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Compute the auto-advance expiry for a phase, or null if it has no timer. */
  private expiryFor(phase: GamePhase): number | null {
    const duration = PHASE_DURATIONS_MS[phase];
    return duration == null ? null : this.now() + duration;
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

    const transition = nextPhase(room.phase, room.dilemmaIndex, room.dilemmaCount ?? 0);
    room.phase = transition.phase;
    room.dilemmaIndex = transition.dilemmaIndex;
    room.phaseExpiresAt = this.expiryFor(transition.phase);
    return { ok: true, room };
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
