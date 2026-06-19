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
  /** Host starts the game, choosing how many dilemmas to play. */
  HostStartGame: 'host:startGame',
  /** Server rejects the start (not enough players, bad count, already started). */
  HostStartError: 'host:startError',
  /** Server broadcasts the current game phase to everyone in the room. */
  GameState: 'game:state',
} as const;

/** Number of dilemmas the host can choose to play in a game. */
export const DILEMMA_COUNT_OPTIONS = [3, 4, 5] as const;
export type DilemmaCount = (typeof DILEMMA_COUNT_OPTIONS)[number];

/** Minimum connected players required before the host can start. */
export const MIN_PLAYERS_TO_START = 3;

/** Phases of the game state machine (extended in US-005). */
export type GamePhase = 'LOBBY' | 'PHASE_INTRO';

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

export interface StartGamePayload {
  dilemmaCount: number;
}

export interface GameStatePayload {
  phase: GamePhase;
  dilemmaCount: number | null;
}

export type StartGameError =
  | 'ROOM_NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_DILEMMA_COUNT'
  | 'ALREADY_STARTED';

export interface HostStartErrorPayload {
  error: StartGameError;
}

/** User-facing (Italian) messages for start-game errors. */
export const START_ERROR_MESSAGES: Record<StartGameError, string> = {
  ROOM_NOT_FOUND: 'Stanza non trovata',
  NOT_ENOUGH_PLAYERS: 'Servono almeno 3 giocatori',
  INVALID_DILEMMA_COUNT: 'Numero di dilemmi non valido',
  ALREADY_STARTED: 'La partita è già iniziata',
};
