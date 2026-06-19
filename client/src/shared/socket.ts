import { io, type Socket } from 'socket.io-client';

// Single shared Socket.IO client reused by both host and player views.
// Connects back to the origin server (same host/port, proxied by Vite in dev).
// Memoized so every caller (and React StrictMode's double-mount) shares one
// connection instead of opening new sockets.
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ autoConnect: true });
  }
  return socket;
}
