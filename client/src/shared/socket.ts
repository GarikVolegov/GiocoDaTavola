import { io, type Socket } from 'socket.io-client';

// Single shared Socket.IO client used by both host and player views.
// Connects back to the origin server (same host/port, proxied by Vite in dev).
export function createSocket(): Socket {
  return io({ autoConnect: true });
}
