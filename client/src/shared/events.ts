// Socket.IO event names + payload shapes shared by the host and player views.
// Keep these in sync with the server handlers in server/src/index.ts.

export const SocketEvents = {
  /** Host asks the server to create (or recover) its room. */
  HostCreateRoom: 'host:createRoom',
  /** Server tells the host which room code to display. */
  HostRoomCreated: 'host:roomCreated',
} as const;

export interface RoomCreatedPayload {
  code: string;
}
