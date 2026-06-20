import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { RoomStore, isVotingPhase, type Room } from './game/rooms';
import { generateBotDefense, aiDefenseEnabled } from './game/aiDefense';

// Load server/.env (e.g. AI_BASE_URL / AI_MODEL for self-hosted LLM defenses) if
// present. Zero-dependency: uses Node's built-in env-file loader (Node 20.12+).
const envFile = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFile)) {
  (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(envFile);
}

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
// Pending auto-advance timer per room, so we can reschedule / cancel it.
const phaseTimers = new Map<string, NodeJS.Timeout>();

// --- Player sessions & reconnection -----------------------------------------
// A phone's identity is a stable, public `playerId` (kept in the room) plus a
// secret `token` (never broadcast) it stores in localStorage. On reconnect the
// phone re-sends the token to reclaim its seat + secret vote.
//
// sessions  : live socket -> its room + playerId (vote/disconnect lookup).
// tokens    : secret token -> room + playerId (survives socket drops; the
//             reauth table). Cleared only when the grace period finally removes
//             the player.
// playerSocket: playerId -> the CURRENT live socket, so a lingering old socket
//             disconnecting after a reconnect doesn't evict the present player.
// graceTimers : playerId -> pending removal; a reconnect cancels it.
const sessions = new Map<string, { code: string; playerId: string }>();
const tokens = new Map<string, { code: string; playerId: string }>();
const playerSocket = new Map<string, string>();
const graceTimers = new Map<string, NodeJS.Timeout>();

// How long a disconnected phone keeps its seat + secret vote before removal.
const RECONNECT_GRACE_MS = 45_000;

function cancelGrace(playerId: string): void {
  const t = graceTimers.get(playerId);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(playerId);
  }
}

// After a roster change during a vote: VOTE_1 / DUEL_PICK can complete early
// once every present player has voted; otherwise just refresh the host's count.
// (VOTE_2 / DUEL_REPICK always run their full timer — they start pre-filled.)
function refreshAfterRosterChange(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  if ((room.phase === 'VOTE_1' || room.phase === 'DUEL_PICK') && rooms.allVoted(code)) {
    advanceAndBroadcast(code);
  } else {
    broadcastGameState(code);
  }
}

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
    register: room.register,
    dilemmaIndex: room.dilemmaIndex,
    phaseExpiresAt: room.phaseExpiresAt,
    // The dilemma in play this round (text + the two options); null outside a
    // dilemma. Public prompt text only — no votes/identities here.
    dilemma: room.currentDilemma,
    // How many players have voted this round. Aggregate count only — the per-
    // choice split stays secret until SPLIT_REVEAL.
    votedCount: room.votes.size,
    // The aggregate A/B split, gated to SPLIT_REVEAL (null otherwise). Counts
    // only — never who voted what.
    split: rooms.publicSplit(room.code),
    // Who is defending + turn progress, gated to DEFENSE (null otherwise). Only
    // the chosen defenders' identities/side are public; no other votes leak.
    defense: rooms.publicDefense(room.code),
    // The swing + per-defender attribution, gated to PHASE_RESULTS (null
    // otherwise). Aggregate counts only — never who voted what.
    swing: rooms.publicSwing(room.code),
    // The end-of-game awards, gated to FINAL_AWARDS (null otherwise).
    awards: rooms.publicAwards(room.code),
    // 1v1 duel: the room's mode + the duel views, each gated to its own phase.
    mode: room.mode,
    duelReveal: rooms.publicDuelReveal(room.code),
    duelTurn: rooms.publicDuelTurn(room.code),
    duelResult: rooms.publicDuelResult(room.code),
    duelSummary: rooms.publicDuelSummary(room.code),
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

// When a bot is the current DEFENSE speaker, ask the self-hosted LLM for its
// argument and, once it returns, upgrade the (already-broadcast) templated line
// in place and re-broadcast. Fire-and-forget: if AI is disabled or the call
// fails, the template stands; stale results (turn advanced) are dropped by the store.
function maybeGenerateAiDefense(code: string): void {
  const ctx = rooms.botDefenderContext(code);
  if (!ctx) return;
  generateBotDefense(ctx.persona, ctx.dilemma, ctx.side)
    .then((text) => {
      if (text && rooms.setBotDefenseArgument(code, ctx.dilemmaIndex, ctx.defenseTurnIndex, text)) {
        broadcastGameState(code);
      }
    })
    .catch(() => {
      /* keep the templated fallback */
    });
}

// Advance the state machine one step, broadcast it, and arm the next timer.
// Used by both timer expiry and the host's force-advance.
function advanceAndBroadcast(code: string): void {
  const result = rooms.advancePhase(code);
  if (!result.ok) return;
  broadcastGameState(code);
  schedulePhase(code);
  maybeGenerateAiDefense(code);
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
  socket.on('host:startGame', (payload: { dilemmaCount?: number; register?: string; mode?: string }) => {
    const code = hostRooms.get(socket.id);
    if (!code) {
      socket.emit('host:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    const result = rooms.startGame(
      code,
      Number(payload?.dilemmaCount),
      String(payload?.register ?? 'misto'),
      String(payload?.mode ?? 'gruppo'),
    );
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

  // The host adds a bot to fill a seat (enables solo play). Bots have no socket;
  // the server drives their votes. Broadcast the updated roster on success.
  socket.on('host:addBot', () => {
    const code = hostRooms.get(socket.id);
    if (!code) return;
    if (rooms.addBot(code).ok) broadcastLobby(code);
  });

  // The host removes a bot by id from the room it owns.
  socket.on('host:removeBot', (payload: { id?: string }) => {
    const code = hostRooms.get(socket.id);
    if (!code) return;
    if (rooms.removeBot(code, String(payload?.id ?? ''))) broadcastLobby(code);
  });

  // A player joins from their phone with a room code + nickname. An optional
  // `token` from a previous session reclaims the same seat (reconnection).
  socket.on('player:join', (payload: { code?: string; nickname?: string; token?: string }) => {
    const code = String(payload?.code ?? '').trim().toUpperCase();
    const nickname = String(payload?.nickname ?? '');
    const sentToken = typeof payload?.token === 'string' ? payload.token : undefined;

    // Reconnect path: a known token for THIS room whose seat still exists.
    const prior = sentToken ? tokens.get(sentToken) : undefined;
    const reconnecting =
      prior != null && prior.code === code && rooms.get(code)?.players.has(prior.playerId) === true;

    const playerId = reconnecting ? prior!.playerId : `p_${randomUUID()}`;
    const token = reconnecting ? sentToken! : randomUUID();

    const result = rooms.join(code, playerId, nickname);
    if (!result.ok) {
      socket.emit('player:joinError', { error: result.error });
      return;
    }

    cancelGrace(playerId); // back in time — don't drop the seat
    tokens.set(token, { code, playerId });
    sessions.set(socket.id, { code, playerId });
    playerSocket.set(playerId, socket.id);
    socket.join(code);
    // The token goes ONLY to this socket (never broadcast) for localStorage.
    socket.emit('player:joined', { code, player: result.player, token });
    // A phone reconnecting mid-game needs the current phase to render the right
    // screen immediately (the lobby broadcast alone wouldn't place it in-game).
    const room = rooms.get(code);
    if (room) socket.emit('game:state', gameStatePayload(room));
    broadcastLobby(code);
    if (reconnecting && room && isVotingPhase(room.phase)) broadcastGameState(code);
  });

  // A player casts (or changes) their secret A/B vote during a voting phase.
  // The vote itself never leaves the server; we only broadcast the aggregate
  // count, and auto-advance early once everyone has voted.
  socket.on('player:vote', (payload: { choice?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.vote(code, playerId, String(payload?.choice ?? ''));
    if (!result.ok) {
      socket.emit('player:voteError', { error: result.error });
      return;
    }
    // Confirm the player's own current choice back to just them.
    socket.emit('player:voted', { choice: result.room.votes.get(playerId) });
    // VOTE_1 / DUEL_PICK start empty and end early once everyone has voted.
    // VOTE_2 / DUEL_REPICK start pre-filled with the first vote (the default),
    // so "all voted" is already true — they run their full timer to give everyone
    // time to change their mind.
    const phase = result.room.phase;
    if ((phase === 'VOTE_1' || phase === 'DUEL_PICK') && rooms.allVoted(code)) {
      advanceAndBroadcast(code); // everyone voted -> skip the rest of the timer
    } else {
      broadcastGameState(code); // refresh the voted count for the host
    }
  });

  socket.on('disconnect', () => {
    hostRooms.delete(socket.id);
    const session = sessions.get(socket.id);
    sessions.delete(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    // Ignore a lingering OLD socket whose player already reconnected elsewhere:
    // only the player's current live socket triggers the absence + grace.
    if (playerSocket.get(playerId) !== socket.id) return;
    playerSocket.delete(playerId);

    // Hold the seat + secret vote: flag absent now, schedule removal after the
    // grace window (a reconnect with the token cancels it).
    rooms.setConnected(code, playerId, false);
    broadcastLobby(code);
    if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);

    cancelGrace(playerId);
    graceTimers.set(
      playerId,
      setTimeout(() => {
        graceTimers.delete(playerId);
        const tok = [...tokens].find(([, v]) => v.playerId === playerId)?.[0];
        if (tok) tokens.delete(tok);
        rooms.leave(code, playerId);
        broadcastLobby(code);
        if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);
      }, RECONNECT_GRACE_MS),
    );
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
  console.log(
    `[server] AI bot defenses: ${aiDefenseEnabled() ? `on (${process.env.AI_MODEL || 'gemma3:4b'} @ ${process.env.AI_BASE_URL})` : 'off (templated fallback)'}`,
  );
});
