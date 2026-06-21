import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { RoomStore, isVotingPhase, type Room } from './game/rooms';
import { generateBotDefense, aiDefenseEnabled } from './game/aiDefense';
import { migrate, dbEnabled, pool } from './db';
import { saveAwards, awardsToPersist } from './persistence';
import { verifyClerkToken } from './clerk';

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

// Safety-net sweep: reap rooms abandoned (no connected humans) for well over the
// reconnect grace window, in case a per-player grace path missed one (e.g. a
// bots-only leftover). Skips rooms that still have a pending grace (reconnectable).
const ABANDONED_ROOM_MAX_IDLE_MS = 5 * 60_000; // 5 min, >> RECONNECT_GRACE_MS
const ABANDONED_SWEEP_INTERVAL_MS = 60_000;

function hasPendingGrace(code: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  for (const id of room.players.keys()) {
    if (graceTimers.has(id)) return true;
  }
  return false;
}

setInterval(() => {
  for (const code of rooms.abandonedRooms(ABANDONED_ROOM_MAX_IDLE_MS)) {
    if (!hasPendingGrace(code)) reapRoom(code);
  }
}, ABANDONED_SWEEP_INTERVAL_MS).unref(); // .unref so the timer never blocks exit

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
    // How many players have made a secret prediction this round (PREDICT phase).
    // Aggregate count only — never who predicted what.
    predictedCount: room.predictions.size,
    // How many players have placed a secret swing bet this round (PREDICT phase).
    // Aggregate count only — never who bet what.
    swingBetCount: room.swingBets.size,
    // How many player-written dilemmas the group has added (LOBBY). Count only.
    submittedCount: room.submittedDilemmas.length,
    // "Quanto mi conosci" round: the public guesser->target ring (gated to the
    // know round, null otherwise) + how many have guessed. Guesses stay secret.
    knowPairs: rooms.publicKnowPairs(room.code),
    knowGuessedCount: room.knowGuesses.size,
    // The defenders to vote between, gated to SPEAKER_VOTE (null otherwise), plus
    // how many have voted. Aggregate only — never who voted which speaker.
    speakerCandidates: rooms.speakerCandidates(room.code),
    speakerVotedCount: room.speakerVotes.size,
    // The aggregate A/B split, gated to SPLIT_REVEAL (null otherwise). Counts
    // only — never who voted what.
    split: rooms.publicSplit(room.code),
    // Who is defending + turn progress, gated to DEFENSE (null otherwise). Only
    // the chosen defenders' identities/side are public; no other votes leak.
    defense: rooms.publicDefense(room.code),
    // Whether this is the surprise "Avvocato del Diavolo" round (defenders argue
    // the side they did NOT vote). Revealed only from DEFENSE on, so it can't
    // skew the first vote/prediction.
    isDevilRound: rooms.publicDevilRound(room.code),
    // The swing + per-defender attribution, gated to PHASE_RESULTS (null
    // otherwise). Aggregate counts only — never who voted what.
    swing: rooms.publicSwing(room.code),
    // The end-of-game awards, gated to FINAL_AWARDS (null otherwise).
    awards: rooms.publicAwards(room.code),
    // 1v1 duel: the room's mode + the duel views, each gated to its own phase.
    mode: room.mode,
    // The leader-player's id, so the creator's phone shows its controls.
    leaderId: room.leaderId,
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

// At FINAL_AWARDS, send each HUMAN player their own private blind-spot tip — to
// their socket only (never broadcast). Bots and offline players are skipped.
function emitBlindSpots(code: string): void {
  const room = rooms.get(code);
  if (!room || room.phase !== 'FINAL_AWARDS') return;
  for (const player of room.players.values()) {
    if (player.isBot) continue;
    const sid = playerSocket.get(player.id);
    if (!sid) continue;
    const tip = rooms.blindSpotFor(code, player.id);
    if (tip) io.to(sid).emit('player:blindSpot', tip);
  }
}

// Cancel any pending auto-advance timer for a room.
function clearPhaseTimer(code: string): void {
  const timer = phaseTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    phaseTimers.delete(code);
  }
}

// Drop a deleted room's leftover reconnect tokens so they don't accumulate.
function pruneTokensForRoom(code: string): void {
  for (const [tok, v] of tokens) {
    if (v.code === code) tokens.delete(tok);
  }
}

// Reap a dead room: stop its phase timer, drop its tokens, remove it from memory.
function reapRoom(code: string): void {
  clearPhaseTimer(code);
  pruneTokensForRoom(code);
  rooms.delete(code);
  console.log('[server] reaped abandoned room', code);
}

// Schedule the next auto-advance from the room's server-side expiry. Replaces
// any existing timer; phases with no timer (FINAL_AWARDS) end the chain.
function schedulePhase(code: string): void {
  clearPhaseTimer(code);
  const room = rooms.get(code);
  if (!room || room.phaseExpiresAt == null) return;
  const delay = Math.max(0, room.phaseExpiresAt - Date.now());
  const timer = setTimeout(() => {
    // If a manual advance (leader/host) already replaced this timer, this stale
    // callback must not advance the phase a second time.
    if (phaseTimers.get(code) !== timer) return;
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

// The room a socket may control: only if its player is that room's leader.
function leaderCodeFor(socketId: string): string | null {
  const session = sessions.get(socketId);
  if (!session) return null;
  return rooms.isLeader(session.code, session.playerId) ? session.code : null;
}

// Advance the state machine one step, broadcast it, and arm the next timer.
// Used by both timer expiry and the leader's force-advance.
function advanceAndBroadcast(code: string): void {
  const result = rooms.advancePhase(code);
  if (!result.ok) return;
  broadcastGameState(code);
  if (rooms.get(code)?.phase === 'FINAL_AWARDS') emitBlindSpots(code);
  schedulePhase(code);
  maybeGenerateAiDefense(code);
  const room = rooms.get(code);
  if (room && room.phase === 'PHASE_RESULTS') {
    // Privately tell each predictor whether they called the post-defense majority
    // (mirrors the secret-vote pattern: only your own result reaches your phone).
    for (const r of rooms.predictionResults(code)) {
      const sid = playerSocket.get(r.playerId);
      if (sid) io.to(sid).emit('player:predictionResult', { correct: r.correct, predicted: r.predicted, actual: r.actual });
    }
    // Same for each swing bettor's own result (only their result reaches them).
    for (const r of rooms.swingBetResults(code)) {
      const sid = playerSocket.get(r.playerId);
      if (sid) io.to(sid).emit('player:swingBetResult', { correct: r.correct, bet: r.bet, flipped: r.flipped });
    }
    // …and each know-round guesser's own result.
    for (const r of rooms.knowGuessResults(code)) {
      const sid = playerSocket.get(r.guesserId);
      if (sid) {
        io.to(sid).emit('player:knowGuessResult', {
          correct: r.correct, guess: r.guess, actual: r.actual, targetId: r.targetId,
        });
      }
    }
  }
  if (room && room.phase === 'FINAL_AWARDS') {
    saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards failed', e));
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// The caller's own saved awards. Bearer token (Clerk) → userId → their rows only.
app.get('/api/me/awards', async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!dbEnabled() || !pool) {
    res.json({ awards: [] });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, award_id, title, emoji, description, game_code, game_mode, nickname, won_at
     FROM awards WHERE clerk_user_id = $1 ORDER BY won_at DESC`,
    [userId],
  );
  res.json({
    awards: rows.map((r) => ({
      id: String(r.id),
      awardId: r.award_id,
      title: r.title,
      emoji: r.emoji,
      description: r.description,
      gameCode: r.game_code,
      gameMode: r.game_mode,
      nickname: r.nickname,
      wonAt: r.won_at,
    })),
  });
});

io.on('connection', (socket) => {
  console.log('[server] client connected:', socket.id);

  // A player creates a room from their phone: they join as a player AND become
  // the room's leader (the controls live on their phone; the TV is optional).
  socket.on('player:createRoom', (payload: { nickname?: string }) => {
    const nickname = String(payload?.nickname ?? '');
    const { code } = rooms.create();
    const playerId = `p_${randomUUID()}`;
    const token = randomUUID();
    const result = rooms.join(code, playerId, nickname);
    if (!result.ok) {
      socket.emit('player:joinError', { error: result.error });
      return;
    }
    rooms.setLeader(code, playerId);
    tokens.set(token, { code, playerId });
    sessions.set(socket.id, { code, playerId });
    playerSocket.set(playerId, socket.id);
    socket.join(code);
    socket.emit('player:joined', { code, player: result.player, token });
    broadcastLobby(code);
    broadcastGameState(code); // carries leaderId so the creator sees their controls
  });

  // A spectator screen (TV) attaches to an existing room in read-only mode.
  socket.on('spectator:join', (payload: { code?: string }) => {
    const code = String(payload?.code ?? '').trim().toUpperCase();
    if (!rooms.has(code)) {
      socket.emit('player:joinError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    socket.join(code);
    socket.emit('lobby:update', { players: rooms.listPlayers(code) });
    const room = rooms.get(code);
    if (room) socket.emit('game:state', gameStatePayload(room));
  });

  // The leader starts the game for their room, choosing the dilemma count.
  // Gated: only the socket whose player is the room leader may start.
  socket.on('leader:startGame', (payload: { dilemmaCount?: number; register?: string; mode?: string }) => {
    const code = leaderCodeFor(socket.id);
    if (!code) {
      socket.emit('leader:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    const result = rooms.startGame(
      code,
      Number(payload?.dilemmaCount),
      String(payload?.register ?? 'misto'),
      String(payload?.mode ?? 'gruppo'),
    );
    if (!result.ok) {
      socket.emit('leader:startError', { error: result.error });
      return;
    }
    broadcastGameState(code);
    schedulePhase(code);
  });

  // The leader force-advances the state machine (skip the remaining countdown).
  socket.on('leader:advancePhase', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    advanceAndBroadcast(code);
  });

  // The leader adds a bot to fill a seat (enables solo play). Bots have no
  // socket; the server drives their votes. Broadcast the updated roster.
  socket.on('leader:addBot', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (rooms.addBot(code).ok) broadcastLobby(code);
  });

  // The leader removes a bot by id from their room.
  socket.on('leader:removeBot', (payload: { id?: string }) => {
    const code = leaderCodeFor(socket.id);
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
    if (room && room.phase === 'FINAL_AWARDS') {
      const tip = rooms.blindSpotFor(code, playerId);
      if (tip) socket.emit('player:blindSpot', tip);
    }
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

  // A player taps a live reaction during DEFENSE / DUEL_ARGUE. The store validates
  // the phase/emoji and rate-limits per player, then attributes it to the current
  // speaker; we re-broadcast just the emoji as a lightweight stream the host
  // animates (no full game:state — reactions are ephemeral, never secret votes).
  socket.on('player:react', (payload: { emoji?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.react(session.code, session.playerId, String(payload?.emoji ?? ''));
    if (result.ok) io.to(session.code).emit('room:reaction', { emoji: result.emoji });
  });

  // A player makes (or changes) their secret prediction during PREDICT. Like the
  // first vote, the phase ends early once every present human has predicted; the
  // per-choice predictions stay secret (only the aggregate count is broadcast).
  socket.on('player:predict', (payload: { choice?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.predict(code, playerId, String(payload?.choice ?? ''));
    if (!result.ok) {
      socket.emit('player:predictError', { error: result.error });
      return;
    }
    socket.emit('player:predicted', { choice: result.room.predictions.get(playerId) });
    // End PREDICT early only once everyone has done BOTH the side prediction AND
    // the swing bet, so nobody's bet is cut off.
    if (rooms.allPredicted(code) && rooms.allSwingBet(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the predicted count for the host
    }
  });

  // A player places (or changes) their secret swing bet during PREDICT: whether
  // the leading side will change after the defenses. Mirrors player:predict.
  socket.on('player:swingBet', (payload: { bet?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.swingBet(code, playerId, String(payload?.bet ?? ''));
    if (!result.ok) {
      socket.emit('player:swingBetError', { error: result.error });
      return;
    }
    socket.emit('player:swingBetted', { bet: result.room.swingBets.get(playerId) });
    if (rooms.allPredicted(code) && rooms.allSwingBet(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the swing-bet count for the host
    }
  });

  // A player writes their own dilemma in the LOBBY (max 2/player). The store
  // validates + caps it; on success the room's submitted count is broadcast.
  socket.on('player:submitDilemma', (payload: { text?: string; optionA?: string; optionB?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitDilemma(
      code,
      playerId,
      String(payload?.text ?? ''),
      String(payload?.optionA ?? ''),
      String(payload?.optionB ?? ''),
    );
    if (!result.ok) {
      socket.emit('player:submitDilemmaError', { error: result.error });
      return;
    }
    socket.emit('player:dilemmaSubmitted', { count: result.count });
    broadcastGameState(code); // refresh the submitted count for everyone
  });

  // A player guesses how their assigned friend voted in the "Quanto mi conosci"
  // round (PREDICT). The store gates it; the phase ends early once all have guessed.
  socket.on('player:knowGuess', (payload: { choice?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.knowGuess(code, playerId, String(payload?.choice ?? ''));
    if (!result.ok) {
      socket.emit('player:knowGuessError', { error: result.error });
      return;
    }
    socket.emit('player:knowGuessed', { choice: result.room.knowGuesses.get(playerId) });
    if (rooms.allKnowGuessed(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the guessed count
    }
  });

  // A player votes the most convincing defender during SPEAKER_VOTE. The store
  // validates the phase/target; the phase ends early once every present human has
  // voted. Only the aggregate count + the per-defender tally (folded into stats)
  // ever leave the server — never who voted whom.
  socket.on('player:voteSpeaker', (payload: { defenderId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.voteSpeaker(code, playerId, String(payload?.defenderId ?? ''));
    if (!result.ok) {
      socket.emit('player:speakerVoteError', { error: result.error });
      return;
    }
    socket.emit('player:speakerVoted', { defenderId: result.room.speakerVotes.get(playerId) });
    if (rooms.allSpeakerVoted(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // A logged-in phone sends its Clerk token; verify it and tag the player so the
  // server can attribute saved awards. A late identify on the awards screen
  // triggers a re-save (idempotent) so results aren't lost.
  socket.on('player:identify', async (payload: { token?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const userId = await verifyClerkToken(typeof payload?.token === 'string' ? payload.token : undefined);
    if (!userId) return;
    rooms.setPlayerUser(session.code, session.playerId, userId);
    const room = rooms.get(session.code);
    if (room && room.phase === 'FINAL_AWARDS') {
      saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards (identify) failed', e));
    }
  });

  socket.on('disconnect', () => {
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
        const wasLeader = rooms.isLeader(code, playerId);
        rooms.leave(code, playerId);
        // Last one out: reap the now-empty room (no slots left to reconnect to)
        // so it doesn't linger in memory with its phase timer still cycling.
        if (rooms.get(code) && rooms.get(code)!.players.size === 0) {
          reapRoom(code);
          return;
        }
        broadcastLobby(code);
        if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);
        if (wasLeader) broadcastGameState(code);
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
  if (dbEnabled()) {
    migrate()
      .then(() => console.log('[db] migrated'))
      .catch((err) => console.error('[db] migrate failed', err));
  } else {
    console.log('[db] disabled (no DATABASE_URL) — awards will not be saved');
  }
});
