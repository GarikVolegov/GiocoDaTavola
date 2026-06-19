// Socket.IO event names + payload shapes shared by the host and player views.
// Keep these in sync with the server handlers in server/src/index.ts.

export const SocketEvents = {
  /** Host asks the server to create (or recover) its room. */
  HostCreateRoom: 'host:createRoom',
  /** Server tells the host which room code to display. */
  HostRoomCreated: 'host:roomCreated',
  /** Player asks to join a room with a code + nickname. */
  PlayerJoin: 'player:join',
  /** Server confirms the join to the joining player. */
  PlayerJoined: 'player:joined',
  /** Server rejects the join (bad code, full room, missing nickname). */
  PlayerJoinError: 'player:joinError',
  /** Server broadcasts the current lobby roster to everyone in the room. */
  LobbyUpdate: 'lobby:update',
} as const;

export interface RoomCreatedPayload {
  code: string;
}

export interface PlayerJoinPayload {
  code: string;
  nickname: string;
}

/** Public, non-secret player info safe to show on host + all phones. */
export interface PublicPlayer {
  id: string;
  nickname: string;
}

export interface PlayerJoinedPayload {
  code: string;
  player: PublicPlayer;
}

export type JoinError = 'ROOM_NOT_FOUND' | 'NICKNAME_REQUIRED' | 'ROOM_FULL';

export interface PlayerJoinErrorPayload {
  error: JoinError;
}

export interface LobbyUpdatePayload {
  players: PublicPlayer[];
}

/** User-facing (Italian) messages for join errors. */
export const JOIN_ERROR_MESSAGES: Record<JoinError, string> = {
  ROOM_NOT_FOUND: 'Codice stanza non valido',
  NICKNAME_REQUIRED: 'Inserisci un nickname',
  ROOM_FULL: 'La stanza è piena (max 8 giocatori)',
};
