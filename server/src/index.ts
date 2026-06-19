import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { RoomStore } from './game/rooms';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

// Authoritative in-memory room store (no DB).
const rooms = new RoomStore();
// Which room each host socket owns, so a re-emit (e.g. React StrictMode's
// double-mount in dev) recovers the same room instead of creating a new one.
const hostRooms = new Map<string, string>();
// Which room each player socket is in, so we can clean up on disconnect.
const playerRooms = new Map<string, string>();

// Broadcast the current (public) lobby roster to everyone in the room — host
// screen + all phones. Only aggregate, non-secret info leaves the server.
function broadcastLobby(code: string): void {
  io.to(code).emit('lobby:update', { players: rooms.listPlayers(code) });
}

// Broadcast the authoritative game phase to everyone in the room so host +
// phones render the same state (lobby vs. started).
function broadcastGameState(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('game:state', { phase: room.phase, dilemmaCount: room.dilemmaCount });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  console.log('[server] client connected:', socket.id);

  // A host opening /host requests a room; reuse this socket's room if it still
  // exists so the host always sees a single, stable code.
  socket.on('host:createRoom', () => {
    let code = hostRooms.get(socket.id);
    if (!code || !rooms.has(code)) {
      code = rooms.create().code;
      hostRooms.set(socket.id, code);
    }
    socket.join(code);
    socket.emit('host:roomCreated', { code });
    // Send the current roster + phase so a re-created/recovered host shows
    // existing players and the right screen (lobby vs. an in-progress game).
    socket.emit('lobby:update', { players: rooms.listPlayers(code) });
    const room = rooms.get(code);
    if (room) socket.emit('game:state', { phase: room.phase, dilemmaCount: room.dilemmaCount });
  });

  // The host starts the game for the room it owns, choosing the dilemma count.
  socket.on('host:startGame', (payload: { dilemmaCount?: number }) => {
    const code = hostRooms.get(socket.id);
    if (!code) {
      socket.emit('host:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    const result = rooms.startGame(code, Number(payload?.dilemmaCount));
    if (!result.ok) {
      socket.emit('host:startError', { error: result.error });
      return;
    }
    broadcastGameState(code);
  });

  // A player joins from their phone with a room code + nickname.
  socket.on('player:join', (payload: { code?: string; nickname?: string }) => {
    const code = String(payload?.code ?? '').trim().toUpperCase();
    const nickname = String(payload?.nickname ?? '');
    const result = rooms.join(code, socket.id, nickname);
    if (!result.ok) {
      socket.emit('player:joinError', { error: result.error });
      return;
    }
    playerRooms.set(socket.id, code);
    socket.join(code);
    socket.emit('player:joined', { code, player: result.player });
    broadcastLobby(code);
  });

  socket.on('disconnect', () => {
    hostRooms.delete(socket.id);
    const code = playerRooms.get(socket.id);
    if (code) {
      playerRooms.delete(socket.id);
      rooms.leave(code, socket.id);
      broadcastLobby(code);
    }
  });
});

// In production the server serves the built client from client/dist.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
