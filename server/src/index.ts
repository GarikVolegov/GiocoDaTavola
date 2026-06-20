import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { RoomStore, isVotingPhase, type Room } from './game/rooms';

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
// Pending auto-advance timer per room, so we can reschedule / cancel it.
const phaseTimers = new Map<string, NodeJS.Timeout>();

// Broadcast the current (public) lobby roster to everyone in the room — host
// screen + all phones. Only aggregate, non-secret info leaves the server.
function broadcastLobby(code: string): void {
  io.to(code).emit('lobby:update', { players: rooms.listPlayers(code) });
}

// The authoritative game-state payload: phase + dilemma progress + the
// server-computed expiry timestamp the clients render a countdown from.
function gameStatePayload(room: Room) {
  return {
    phase: room.phase,
    dilemmaCount: room.dilemmaCount,
    dilemmaIndex: room.dilemmaIndex,
    phaseExpiresAt: room.phaseExpiresAt,
    // The dilemma in play this round (text + the two options); null outside a
    // dilemma. Public prompt text only — no votes/identities here.
    dilemma: room.currentDilemma,
    // How many players have voted this round. Aggregate count only — the per-
    // choice split stays secret until SPLIT_REVEAL.
    votedCount: room.votes.size,
  };
}

// Broadcast the authoritative game phase to everyone in the room so host +
// phones render the same state (lobby vs. started).
function broadcastGameState(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('game:state', gameStatePayload(room));
}

// Cancel any pending auto-advance timer for a room.
function clearPhaseTimer(code: string): void {
  const timer = phaseTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    phaseTimers.delete(code);
  }
}

// Schedule the next auto-advance from the room's server-side expiry. Replaces
// any existing timer; phases with no timer (FINAL_AWARDS) end the chain.
function schedulePhase(code: string): void {
  clearPhaseTimer(code);
  const room = rooms.get(code);
  if (!room || room.phaseExpiresAt == null) return;
  const delay = Math.max(0, room.phaseExpiresAt - Date.now());
  const timer = setTimeout(() => {
    phaseTimers.delete(code);
    advanceAndBroadcast(code);
  }, delay);
  phaseTimers.set(code, timer);
}

// Advance the state machine one step, broadcast it, and arm the next timer.
// Used by both timer expiry and the host's force-advance.
function advanceAndBroadcast(code: string): void {
  const result = rooms.advancePhase(code);
  if (!result.ok) return;
  broadcastGameState(code);
  schedulePhase(code);
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
    if (room) socket.emit('game:state', gameStatePayload(room));
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
    // Arm the server-side timer that auto-advances the state machine.
    schedulePhase(code);
  });

  // The host force-advances the state machine for the room it owns (skip the
  // remaining countdown). Same path the timer uses, so it reschedules cleanly.
  socket.on('host:advancePhase', () => {
    const code = hostRooms.get(socket.id);
    if (!code) return;
    advanceAndBroadcast(code);
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

  // A player casts (or changes) their secret A/B vote during a voting phase.
  // The vote itself never leaves the server; we only broadcast the aggregate
  // count, and auto-advance early once everyone has voted.
  socket.on('player:vote', (payload: { choice?: string }) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const result = rooms.vote(code, socket.id, String(payload?.choice ?? ''));
    if (!result.ok) {
      socket.emit('player:voteError', { error: result.error });
      return;
    }
    // Confirm the player's own current choice back to just them.
    socket.emit('player:voted', { choice: result.room.votes.get(socket.id) });
    if (rooms.allVoted(code)) {
      advanceAndBroadcast(code); // everyone voted -> skip the rest of the timer
    } else {
      broadcastGameState(code); // refresh the voted count for the host
    }
  });

  socket.on('disconnect', () => {
    hostRooms.delete(socket.id);
    const code = playerRooms.get(socket.id);
    if (code) {
      playerRooms.delete(socket.id);
      rooms.leave(code, socket.id);
      broadcastLobby(code);
      // A leaver during a vote changes the count shown on the host and may
      // complete the round (everyone still present has now voted).
      const room = rooms.get(code);
      if (room && isVotingPhase(room.phase)) {
        if (rooms.allVoted(code)) advanceAndBroadcast(code);
        else broadcastGameState(code);
      }
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
