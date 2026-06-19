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
 * Phases of a game. US-004 only drives LOBBY -> PHASE_INTRO; the full
 * state machine (DILEMMA_REVEAL, VOTE_1, ...) arrives in US-005.
 */
export type GamePhase = 'LOBBY' | 'PHASE_INTRO';

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

  // `genCode` is injectable so tests can force collisions deterministically.
  constructor(private readonly genCode: () => string = generateRoomCode) {}

  /** Create a room with a code unique among the rooms currently in memory. */
  create(): Room {
    let code = this.genCode();
    while (this.rooms.has(code)) {
      code = this.genCode();
    }
    const room: Room = {
      code,
      createdAt: Date.now(),
      players: new Map(),
      phase: 'LOBBY',
      dilemmaCount: null,
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
    room.phase = 'PHASE_INTRO';
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
