// In-memory store of game rooms. The server is authoritative; rooms live here
// only for the lifetime of the process (no DB).

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 4;

/** Max players allowed in a single room (in-person party game). */
export const MAX_PLAYERS = 8;

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
}

export type JoinError = 'ROOM_NOT_FOUND' | 'NICKNAME_REQUIRED' | 'ROOM_FULL';

export type JoinResult =
  | { ok: true; player: Player }
  | { ok: false; error: JoinError };

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
    const room: Room = { code, createdAt: Date.now(), players: new Map() };
    this.rooms.set(code, room);
    return room;
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
