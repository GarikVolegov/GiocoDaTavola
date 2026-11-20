import express from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { RoomStore, isVotingPhase, tappaCounts, percorsoCounts, storieCatalog, loadStories, type Room } from './game/rooms';
import { loadDilemmas, dilemmasForRegister, filterByFamiliarita, isFamiliarita, type ContentRegister, type Familiarita } from './game/deck';
import { generateBotDefense, aiDefenseEnabled } from './game/aiDefense';
import { migrate, dbEnabled, getPool } from './db';
import { saveAwards, awardsToPersist, saveGameRecords, gamesToPersist } from './persistence';
import { validateProfileInput, loadProfile, saveProfile } from './profile';
import { verifyClerkToken } from './clerk';
import { serializeRoom, deserializeRoom } from './game/roomSnapshot';
import { persistSnapshot, loadAllSnapshots, deleteSnapshot } from './snapshotStore';
import { createRateLimiter } from './rateLimit';
import { getOrGenerateTts, MAX_TTS_TEXT_LENGTH } from './audioTts';
import { generatePartyCards, getCuratedCards, isGeminiAvailable, type PartyMode, type CoppieIntensity, type PartyCard, type AssurdoCard } from './game/geminiGenerator';
import { CRUCIVERBA_BOARDS, getCurrentCruciverbaPlayerId, type CruciverbaMode } from './game/cruciverba';
import { getSoloDilemmas, enforceTwoOptionsForSolo } from './game/soloDecks';
import { TRIBUNALE_CASES, getTribunaleSpeakerId } from './game/tribunale';
import { GHIGLIOTTINA_PUZZLES } from './game/ghigliottina';
import { STIMA_QUESTIONS } from './game/stima';
import { BUFALA_QUESTIONS } from './game/bufala';
import { INTESA_CARDS } from './game/intesa';
import { buildPercorsoPlan, isDurata, getPercorsoMeta } from './game/percorso';
import { buildStoriaPlan } from './game/storie';
import {
  buildCspHeader,
  extractClientIp,
  isOriginAllowed,
  resolveAllowedOrigins,
  sanitizeAiTheme,
  sanitizeTtsText,
} from './security';

// Load server/.env (DATABASE_URL, CLERK_SECRET_KEY, AI_BASE_URL/AI_MODEL, …) if
// present. Zero-dependency: uses Node's built-in env-file loader (Node 20.12+).
// Skipped under test so the suite stays hermetic / DB-less regardless of a
// developer's local .env (the pool is resolved lazily in ./db, so it would
// otherwise pick up a real DATABASE_URL and hit Postgres during tests).
const envFile = path.resolve(__dirname, '../.env');
if (process.env.NODE_ENV !== 'test' && fs.existsSync(envFile)) {
  (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.(envFile);
}

// A single room's unexpected exception (e.g. a corrupt/pre-schema snapshot
// slipping past normalizeRestoredRoom) must never take down every OTHER live
// room's game with it. Log and keep the process alive instead of the default
// crash — which, on Railway, would just restart into the same bad state and
// crash-loop. Skipped under test: vitest has its own failure reporting.
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', (err) => {
    console.error('[server] uncaught exception (kept alive)', err);
  });
  // Same keep-alive stance for promise rejections nobody awaited, but labeled
  // truthfully (without this listener Node folds them into uncaughtException).
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandled rejection (kept alive)', reason);
  });
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
// Baseline HTTP security headers (no extra dependency needed).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', buildCspHeader());
  if (req.secure || req.header('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
// Parse JSON request bodies (the profile PUT). Capped well above a resized
// avatar data-URL (~tens of KB) but small enough to bound hostile payloads.
app.use(express.json({ limit: '500kb' }));
// Exported so integration tests can listen on an ephemeral port without the
// module auto-starting on its own (see the NODE_ENV guard around listen below).
export const httpServer = createServer(app);
const allowedOrigins = resolveAllowedOrigins(process.env);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  allowRequest: (req, callback) => {
    if (isOriginAllowed(req.headers.origin, allowedOrigins)) {
      callback(null, true);
    } else {
      callback('ORIGIN_NOT_ALLOWED', false);
    }
  },
  maxHttpBufferSize: 100 * 1024, // 100 KB cap per socket packet
});

// Authoritative in-memory room store (no DB).
const rooms = new RoomStore();
// Throttle room create/join per socket & per IP: bounds room spam, join floods, and bursts.
const joinLimiter = createRateLimiter(10, 10_000);
const ttsLimiter = createRateLimiter(30, 60_000);
const reactLimiter = createRateLimiter(15, 5_000);
const writeLimiter = createRateLimiter(12, 30_000);
const identifyLimiter = createRateLimiter(10, 10_000);
const MAX_SOCKETS_PER_IP = 30;
const socketsPerIp = new Map<string, number>();
const socketIpById = new Map<string, string>();
const ipCreateRoomLimiter = createRateLimiter(15, 60_000);
const ipJoinLimiter = createRateLimiter(60, 60_000);
const ipIdentifyLimiter = createRateLimiter(30, 60_000);
const actionLimiter = createRateLimiter(60, 10_000);
const apiMeLimiter = createRateLimiter(60, 60_000);

function socketClientIp(socket: { handshake: { headers: Record<string, string | string[] | undefined>; address: string } }): string {
  return extractClientIp(socket.handshake.headers['x-forwarded-for'], socket.handshake.address, true);
}

io.use((socket, next) => {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }
  const ip = socketClientIp(socket);
  const current = socketsPerIp.get(ip) ?? 0;
  if (current >= MAX_SOCKETS_PER_IP) {
    next(new Error('TOO_MANY_CONNECTIONS'));
    return;
  }
  socketsPerIp.set(ip, current + 1);
  socketIpById.set(socket.id, ip);
  next();
});
// Available dilemmas per tappa, computed once at boot — surfaced to the host so
// the percorso setup can show an accurate (capped) length estimate. Static data.
const ALL_DILEMMAS = loadDilemmas();
const TAPPA_COUNTS = tappaCounts(ALL_DILEMMAS);
const PERCORSO_COUNTS = percorsoCounts(ALL_DILEMMAS);
// The story catalog (ids + teasers, no prose), computed once at boot — surfaced
// to the host so the storia setup can list the available tales. Static data.
const STORIE_CATALOG = storieCatalog(loadStories());
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
// 5 minutes covers a real short break (bagno, telefonata, la porta), not just
// a screen-lock blip.
const RECONNECT_GRACE_MS = 5 * 60_000;

// Safety-net sweep: reap rooms abandoned (no connected humans) for well over the
// reconnect grace window, in case a per-player grace path missed one (e.g. a
// bots-only leftover). Skips rooms that still have a pending grace (reconnectable).
const ABANDONED_ROOM_MAX_IDLE_MS = 30 * 60_000; // 30 min, >> RECONNECT_GRACE_MS
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

// Periodic snapshot of every live room (catches within-phase changes like votes,
// between the phase-transition snapshots) so a crash loses at most a few seconds.
const SNAPSHOT_INTERVAL_MS = 15_000;
setInterval(() => {
  for (const code of rooms.activeCodes()) {
    const room = rooms.get(code);
    if (room) void persistSnapshot(code, serializeRoom(room)); // never rejects; failures open its breaker
  }
}, SNAPSHOT_INTERVAL_MS).unref();

function cancelGrace(playerId: string): void {
  const t = graceTimers.get(playerId);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(playerId);
  }
}

// After a roster change during a vote: the cast-style phases can complete early
// once every present player has voted; otherwise just refresh the host's count.
function refreshAfterRosterChange(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  const isCastPhase =
    room.phase === 'VOTE_1' || room.phase === 'DUO_SIDE_PICK' || room.phase === 'DUO_PICK';
  if (isCastPhase && rooms.allVoted(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'VOTE_2' && rooms.allConfirmed(code)) {
    advanceAndBroadcast(code); // a leaver was the last unconfirmed -> don't block
  } else if (room.phase === 'DUO_REPICK' && rooms.duoRepickComplete(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'TRIBUNALE_VOTE' && rooms.tribunaleVotesComplete(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'TELEPATHY' && rooms.telepathyPhaseComplete(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'GHIGLIOTTINA' && rooms.ghigliottinaComplete(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'STIMA_GUESS' && rooms.stimaComplete(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'BUFALA_VOTE' && rooms.bufalaComplete(code)) {
    advanceAndBroadcast(code);
  } else {
    if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
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
    turnExpiresAt: room.turnExpiresAt,
    readingEndsAt: room.readingEndsAt,
    paused: room.paused,
    // Session format + percorso view (null in classic). Secret-safe: progress and
    // tappa metadata only, never an individual vote. tappaCounts is static setup data.
    format: room.format,
    percorso: rooms.publicPercorso(room.code),
    tappaCounts: TAPPA_COUNTS,
    percorsoCounts: PERCORSO_COUNTS,
    // Storie: the narrative view (prose + progress; null in classic/percorso) and
    // the static story catalog for the host's setup picker. Secret-safe.
    storia: rooms.publicStoria(room.code),
    storieCatalog: STORIE_CATALOG,
    // The dilemma in play this round (text + the two options); null outside a
    // dilemma. Public prompt text only — no votes/identities here.
    dilemma: room.currentDilemma,
    // How many players have voted this round. Aggregate count only — the per-
    // choice split stays secret until SPLIT_REVEAL.
    votedCount: room.votes.size,
    confirmedCount: rooms.confirmedCount(room.code),
    // Nicknames of connected players still missing their action this voting
    // phase (VOTE_1/VOTE_2 e le fasi duo); null otherwise. Never
    // reveals WHICH choice — presence only.
    missingVoters: rooms.missingVoters(room.code),
    // How many players have made a secret prediction this round (PREDICT phase).
    // Aggregate count only — never who predicted what.
    predictedCount: room.predictions.size,
    // Nicknames of connected humans still missing a PREDICT action
    // (prediction, swing bet, or — in the know round — their guess); null
    // outside PREDICT.
    missingPredictors: rooms.predictProgress(room.code)?.missingNicknames ?? null,
    // How many players have placed a secret swing bet this round (PREDICT phase).
    // Aggregate count only — never who bet what.
    swingBetCount: room.swingBets.size,
    // How many player-written dilemmas the group has added (LOBBY). Count only.
    submittedCount: room.submittedDilemmas.length,
    // "Quanto mi conosci" round: the public guesser->target ring (gated to the
    // know round, null otherwise) + how many have guessed. Guesses stay secret.
    knowPairs: rooms.publicKnowPairs(room.code),
    knowGuessedCount: room.knowGuesses.size,
    // "La Mente del Gruppo" (4.1): the current question (GROUP_MIND/GROUP_MIND_REVEAL,
    // null otherwise), who's still missing their submission, and — gated to the
    // reveal — the aggregate split + correct-guesser count. Own answers stay secret.
    groupMindQuestion: room.groupMindQuestion,
    groupMindProgress: rooms.groupMindProgress(room.code),
    groupMindTally: rooms.publicGroupMindTally(room.code),
    // "In Altre Parole" (4.2): the current prompt (WRITE/WRITE_VOTE/WRITE_REVEAL,
    // null otherwise), who's still missing their answer/vote, the anonymized
    // answer list (gated to WRITE_VOTE — own text stays known only to the
    // author who wrote it), and the authored reveal (gated to WRITE_REVEAL).
    // Individual ballots never leave the server — aggregate vote counts only.
    writePrompt: room.writePrompt,
    writeProgress: rooms.writeProgress(room.code),
    writtenAnswers: rooms.publicWrittenAnswers(room.code),
    writeVoteProgress: rooms.writeVoteProgress(room.code),
    writeReveal: rooms.writeRevealResults(room.code),
    hotTakePrompt: rooms.publicHotTakePrompt(room.code),
    hotTakeReveal: rooms.publicHotTakeReveal(room.code),
    hotTakeSubmittedCount: rooms.hotTakeSubmittedCount(room.code),
    missingHotTakers: rooms.hotTakeProgress(room.code)?.missingNicknames ?? null,
    cruciverbaState: rooms.publicCruciverbaState(room.code),
    tribunaleState: rooms.publicTribunaleState(room.code),
    telepathyPrompt: rooms.publicTelepathyPrompt(room.code),
    telepathyProgress: rooms.telepathyProgress(room.code),
    telepathyReveal: rooms.publicTelepathyReveal(room.code),
    ghigliottinaState: rooms.publicGhigliottinaState(room.code),
    stimaState: rooms.publicStimaState(room.code),
    bufalaState: rooms.publicBufalaState(room.code),
    intesaState: rooms.publicIntesaState(room.code),
    // "L'Infiltrato": how many have accused (ACCUSE) + the FINAL_AWARDS reveal.
    accusedCount: room.accusations.size,
    infiltratoResult: rooms.publicInfiltratoResult(room.code),
    // "L'Infiltrato col merito" (4.5): whether the once-per-round sabotage tool
    // has already been used this round — public (doesn't reveal WHO used it,
    // nobody else has this ability), drives the infiltrator's own button state.
    infiltratoToolUsed: room.infiltratoToolUsedThisRound,
    // "Squadre": team assignments + running scores; null when teams are off.
    teams: rooms.publicTeams(room.code),
    // The defenders to vote between, gated to SPEAKER_VOTE (null otherwise), plus
    // how many have voted. Aggregate only — never who voted which speaker.
    speakerCandidates: rooms.speakerCandidates(room.code),
    speakerVotedCount: room.speakerVotes.size,
    // The aggregate A/B split, gated to SPLIT_REVEAL (null otherwise). Counts
    // only — never who voted what.
    split: rooms.publicSplit(room.code),
    // The unanimous side + count, gated to UNANIMOUS_REVEAL (null otherwise).
    // Aggregate only — never who voted what.
    unanimous: rooms.publicUnanimous(room.code),
    // Who is defending + turn progress, gated to DEFENSE (null otherwise). Only
    // the chosen defenders' identities/side are public; no other votes leak.
    defense: rooms.publicDefense(room.code),
    // The just-finished speaker's applause tally ("applausometro"); null
    // before any turn has ended this round, or if it drew no reactions.
    lastTurnApplause: rooms.lastTurnApplause(room.code),
    // Whether this is the surprise "Avvocato del Diavolo" round (defenders argue
    // the side they did NOT vote). Revealed only from DEFENSE on, so it can't
    // skew the first vote/prediction.
    isDevilRound: rooms.publicDevilRound(room.code),
    // Whether this is the game's FINAL round, where the swing bet pays double
    // (6.2, "posta doppia") — not a secret twist, so shown unconditionally.
    finalStakesRound: rooms.publicFinalStakes(room.code),
    // This round's silly performance constraint for the defenders (2.3),
    // public during DEFENSE/INTERVENTI; null otherwise or if none was drawn.
    absurdConstraint: rooms.publicAbsurdConstraint(room.code),
    // This round's surprise mechanical twist (4.3: difesa lampo, niente
    // interventi, doppio difensore, …), public during DEFENSE/INTERVENTI;
    // null otherwise or if none was drawn. The leader's caos dial, for the host.
    twist: rooms.publicTwist(room.code),
    caos: room.caos,
    // The swing + per-defender attribution, gated to PHASE_RESULTS (null
    // otherwise). Aggregate counts only — never who voted what.
    swing: rooms.publicSwing(room.code),
    // The current dilemma's author nickname, revealed only at PHASE_RESULTS
    // (null otherwise, or for a deck dilemma nobody wrote).
    dilemmaAuthor: rooms.currentDilemmaAuthor(room.code),
    // The end-of-game awards, gated to FINAL_AWARDS (null otherwise).
    awards: rooms.publicAwards(room.code),
    // "I momenti della serata" (5.5): every titled moment across the game,
    // shown before the awards, gated to FINAL_AWARDS (null otherwise).
    namedMoments: rooms.publicNamedMoments(room.code),
    // The final "Punti Serata" podium/ranking, gated to FINAL_AWARDS (null
    // otherwise). Point totals only — never individual votes.
    podium: rooms.publicPodium(room.code),
    // Percorso in 2: the room's mode + the duo views, each gated to its own
    // phase inside the store readers (predictions secret until the sync
    // reveal, waver ratings secret until the round result; counts are
    // aggregate-only like every other progress number here).
    mode: room.mode,
    // The leader-player's id, so the creator's phone shows its controls.
    leaderId: room.leaderId,
    duoAct: rooms.publicDuoActState(room.code),
    // The twist round's devil's advocate (public only while it plays out) — the
    // phones use it to hide the re-pick/waver controls from the advocate.
    duoAdvocateId: rooms.publicDuoAdvocateId(room.code),
    duoSyncedCount: room.duoPredictions.size,
    duoWaverCount: room.duoWaverRatings.size,
    duoSyncReveal: rooms.publicDuoSyncReveal(room.code),
    duoTurn: rooms.publicDuoTurn(room.code),
    duoRoundResult: rooms.publicDuoRoundResult(room.code),
    duoPortrait: rooms.publicDuoPortrait(room.code),
    partyMode: room.partyMode ?? undefined,
    partyCard: rooms.publicPartyCard(room.code),
    soloFast: room.soloFast,
    lastSoloFeedback: room.lastSoloFeedback,
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

const turnTimers = new Map<string, NodeJS.Timeout>();

function clearTurnTimer(code: string): void {
  const timer = turnTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(code);
  }
}

// Cancel any pending auto-advance timer for a room.
function clearPhaseTimer(code: string): void {
  clearTurnTimer(code);
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

// Reap a dead room: stop its phase timer, drop its tokens/sessions/grace timers, remove from memory.
function reapRoom(code: string): void {
  clearPhaseTimer(code);
  const room = rooms.get(code);
  if (room) {
    for (const playerId of room.players.keys()) {
      cancelGrace(playerId);
      const sid = playerSocket.get(playerId);
      if (sid) {
        sessions.delete(sid);
        playerSocket.delete(playerId);
      }
    }
  }
  for (const [sid, s] of sessions) {
    if (s.code === code) sessions.delete(sid);
  }
  pruneTokensForRoom(code);
  rooms.delete(code);
  deleteSnapshot(code).catch((e) => console.error('[snapshot] delete failed', e));
  console.log('[server] reaped abandoned room', code);
}

function scheduleTurnTimer(code: string): void {
  clearTurnTimer(code);
  const room = rooms.get(code);
  if (!room || room.paused) return;

  // Timers are disabled globally for humans; keep automated turns ONLY for bots
  // so bot players never deadlock a room.
  if (room.phase === 'CRUCIVERBA' && room.cruciverbaState) {
    const activeId = getCurrentCruciverbaPlayerId(room.cruciverbaState);
    if (activeId && room.players.get(activeId)?.isBot) {
      const botTimer = setTimeout(() => {
        if (turnTimers.get(code) !== botTimer) return;
        turnTimers.delete(code);
        const botRes = rooms.performCruciverbaBotTurn(code);
        if (botRes && botRes.roundEnded) {
          advanceAndBroadcast(code);
        } else {
          broadcastGameState(code);
          scheduleTurnTimer(code);
        }
      }, 1_800);
      turnTimers.set(code, botTimer);
    }
    return;
  }

  if (room.phase === 'TRIBUNALE_ARGUE' && room.tribunaleState) {
    const speakerId = getTribunaleSpeakerId(room.tribunaleState);
    const isBotSpeaker = room.players.get(speakerId)?.isBot === true;
    if (!isBotSpeaker) return;
    const timer = setTimeout(() => {
      if (turnTimers.get(code) !== timer) return;
      turnTimers.delete(code);
      const adv = rooms.advanceTribunaleSpeaker(code);
      if (adv.enteredVote) {
        broadcastAdvance(code, false);
      } else {
        broadcastGameState(code);
        scheduleTurnTimer(code);
      }
    }, 2_500);
    turnTimers.set(code, timer);
  }
}

// Schedule the next auto-advance from the room's server-side expiry. Replaces
// any existing timer; phases with no timer (FINAL_AWARDS) end the chain.
function schedulePhase(code: string): void {
  clearPhaseTimer(code);
  scheduleTurnTimer(code);
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

function emitSecretQuestionIfNeeded(room: Room | undefined, targetPlayerId?: string): void {
  if (!room || room.phase === 'LOBBY' || room.phase === 'FINAL_AWARDS') return;
  const activeMode =
    room.partyMode === 'mix'
      ? (room.mixPlan[Math.max(0, room.dilemmaIndex - 1)] ?? room.partyMode)
      : room.partyMode;
  if (activeMode !== 'infiltrato' || !room.currentPartyCard || !('groupQuestion' in room.currentPartyCard)) {
    return;
  }
  const card = room.currentPartyCard as { groupQuestion?: string; impostorQuestion?: string };
  const recipients = targetPlayerId
    ? (() => {
        const p = room.players.get(targetPlayerId);
        return p ? [p] : [];
      })()
    : [...room.players.values()];
  for (const player of recipients) {
    if (player.isBot) continue;
    const sid = playerSocket.get(player.id);
    if (!sid) continue;
    const isInfiltrator = player.id === room.infiltratorId;
    const question = isInfiltrator ? (card.impostorQuestion ?? '') : (card.groupQuestion ?? '');
    io.to(sid).emit('player:secretQuestion', {
      question,
      isInfiltrator,
      round: room.dilemmaIndex,
    });
  }
}

function emitIntesaSecretIfNeeded(room: Room | undefined, targetPlayerId?: string): void {
  if (!room || room.phase !== 'INTESA_PLAY' || !room.intesaState) return;
  const speakerId = room.intesaState.speakerId;
  if (targetPlayerId && targetPlayerId !== speakerId) return;
  const sid = playerSocket.get(speakerId);
  if (!sid) return;
  const secret = rooms.privateIntesaSecret(room.code, speakerId);
  if (secret) io.to(sid).emit('player:intesaSecret', secret);
}

// Broadcast + side effects shared by every path that lands the room on a new
// phase: the leader's force-advance, a timer expiry, AND the leader's
// "Scarta dilemma" (which also re-enters DILEMMA_REVEAL or can fall through
// to FINAL_AWARDS on an exhausted deck). `hadLateJoiners` must be sampled
// BEFORE the phase change that might promote one, by the caller.
function broadcastAdvance(code: string, hadLateJoiners: boolean): void {
  const snapRoom = rooms.get(code);
  // Push per-player secrets/tokens BEFORE broadcasting game:state so clients
  // receive their round-scoped clue, secret question, and write-vote token
  // synchronously before switching screens.
  emitSecretQuestionIfNeeded(snapRoom);
  emitIntesaSecretIfNeeded(snapRoom);
  if (snapRoom && snapRoom.phase === 'WRITE_VOTE') {
    for (const player of snapRoom.players.values()) {
      if (player.isBot) continue;
      const token = rooms.myWrittenAnswerToken(code, player.id);
      if (!token) continue;
      const sid = playerSocket.get(player.id);
      if (sid) io.to(sid).emit('player:myWriteToken', { token });
    }
  }
  broadcastGameState(code);
  if (hadLateJoiners) broadcastLobby(code);
  if (snapRoom) void persistSnapshot(code, serializeRoom(snapRoom)); // never rejects; failures open its breaker
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
  if (room && room.phase === 'GROUP_MIND_REVEAL') {
    // Privately tell each player whether their majority guess was right
    // (mirrors the PHASE_RESULTS prediction-result pattern above).
    for (const r of rooms.groupMindResults(code)) {
      const sid = playerSocket.get(r.playerId);
      if (sid) io.to(sid).emit('player:groupMindResult', { correct: r.correct, guess: r.guess, actual: r.actual });
    }
  }
  if (room && (room.phase === 'FINAL_AWARDS' || room.phase === 'DUO_PORTRAIT')) {
    saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards failed', e));
    saveGameRecords(gamesToPersist(room)).catch((e) => console.error('[db] saveGameRecords failed', e));
  }
}

// Advance the state machine one step, broadcast it, and arm the next timer.
// Used by both timer expiry and the leader's force-advance.
function advanceAndBroadcast(code: string): void {
  // A pending late-joiner (3.2) may get promoted to giocatore on this very
  // advance (the round-boundary DILEMMA_REVEAL) — re-broadcast the roster
  // afterward so their role badge updates everywhere, not just game state.
  const hadLateJoiners = (rooms.get(code)?.lateJoiners.size ?? 0) > 0;
  const result = rooms.advancePhase(code);
  if (!result.ok) return;
  if (result.room.players.size === 1 && result.room.soloFast) {
    const fastSkipPhases = new Set([
      'SPLIT_REVEAL',
      'PHASE_RESULTS',
      'GROUP_MIND_REVEAL',
      'TAPPA_INTRO',
      'TAPPA_RECAP',
    ]);
    let guard = 0;
    while (fastSkipPhases.has(result.room.phase) && guard < 4) {
      const next = rooms.advancePhase(code);
      if (!next.ok) break;
      guard++;
    }
  }
  broadcastAdvance(code, hadLateJoiners);
}

// Express 4 does not forward an async handler's rejection to any middleware:
// a DB-backed route whose await throws would never send a response and the
// platform edge kills the request after ~60s (HTTP 499). Wrap the DB-backed
// routes so a thrown query answers fast with 503 instead.
function dbRoute(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res) => {
    void fn(req, res).catch((err: unknown) => {
      console.error('[api]', req.method, req.path, 'failed:', err instanceof Error ? err.message : err);
      if (!res.headersSent) res.status(503).json({ error: 'db-unavailable' });
    });
  };
}

app.get('/api/health', async (_req, res) => {
  // Report DB reachability too: 'disabled' when DB-less, 'ok'/'down' otherwise.
  // A down DB still returns ok:true (the game runs in-memory without it).
  let db: 'disabled' | 'ok' | 'down' = 'disabled';
  const pool = getPool();
  if (pool) {
    try {
      await pool.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
  }
  res.json({
    ok: true,
    db,
    activeRooms: rooms.activeCodes().length,
    uptimeSec: Math.floor(process.uptime()),
    dilemmasLoaded: ALL_DILEMMAS.length,
  });
});

// Dynamic neural TTS narration endpoint (male Diego studio voice).
app.get('/api/audio/tts', async (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!ttsLimiter.allow(clientIp)) {
    res.status(429).json({ error: 'too-many-requests' });
    return;
  }
  const text = sanitizeTtsText(typeof req.query.text === 'string' ? req.query.text : '');
  if (!text) {
    res.status(400).json({ error: 'Testo mancante' });
    return;
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    res.status(400).json({ error: 'Testo troppo lungo' });
    return;
  }
  try {
    const filePath = await getOrGenerateTts(text);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.sendFile(filePath);
  } catch (err) {
    console.error('[tts] generation error:', err);
    res.status(500).json({ error: 'Errore generazione voce narrante' });
  }
});

app.use('/api/me', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!apiMeLimiter.allow(req.ip || 'unknown')) {
    res.status(429).json({ error: 'too-many-requests' });
    return;
  }
  next();
});

// The caller's own saved awards. Bearer token (Clerk) → userId → their rows only.
app.get('/api/me/awards', dbRoute(async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const pool = getPool();
  if (!pool) {
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
}));

// The caller's dashboard data in one round-trip: aggregate stats, recent games,
// and a small awards preview. Same Bearer-token auth as /api/me/awards.
app.get('/api/me/dashboard', dbRoute(async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const empty = {
    stats: { gamesPlayed: 0, totalPersuasion: 0, bestPersuasion: 0, awardsCount: 0 },
    recentGames: [],
    recentAwards: [],
    profile: { displayName: null, avatar: null },
  };
  const pool = getPool();
  if (!pool) {
    res.json(empty);
    return;
  }
  const [agg, games, awards, awardsCount, profile] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS games_played,
              coalesce(sum(persuasion), 0)::int AS total_persuasion,
              coalesce(max(persuasion), 0)::int AS best_persuasion
       FROM game_records WHERE clerk_user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, game_code, mode, nickname, persuasion, rounds, awards_count, played_at
       FROM game_records WHERE clerk_user_id = $1 ORDER BY played_at DESC LIMIT 20`,
      [userId],
    ),
    pool.query(
      `SELECT id, award_id, title, emoji, description, nickname, won_at
       FROM awards WHERE clerk_user_id = $1 ORDER BY won_at DESC LIMIT 6`,
      [userId],
    ),
    pool.query(`SELECT count(*)::int AS n FROM awards WHERE clerk_user_id = $1`, [userId]),
    loadProfile(userId),
  ]);
  res.json({
    stats: {
      gamesPlayed: agg.rows[0].games_played,
      totalPersuasion: agg.rows[0].total_persuasion,
      bestPersuasion: agg.rows[0].best_persuasion,
      awardsCount: awardsCount.rows[0].n,
    },
    profile,
    recentGames: games.rows.map((r) => ({
      id: String(r.id),
      gameCode: r.game_code,
      mode: r.mode,
      nickname: r.nickname,
      persuasion: r.persuasion,
      rounds: r.rounds,
      awardsCount: r.awards_count,
      playedAt: r.played_at,
    })),
    recentAwards: awards.rows.map((r) => ({
      id: String(r.id),
      awardId: r.award_id,
      title: r.title,
      emoji: r.emoji,
      description: r.description,
      nickname: r.nickname,
      wonAt: r.won_at,
    })),
  });
}));

// The caller's profile (display name + avatar). Same Bearer-token auth.
app.get('/api/me/profile', dbRoute(async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.json(await loadProfile(userId));
}));

// Update the caller's profile. Validates (trim/cap name; preset or small raster
// data-URL avatar) then upserts. Needs the DB; 503 when DB-less.
app.put('/api/me/profile', dbRoute(async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const result = validateProfileInput((req.body ?? {}) as Record<string, unknown>);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (!dbEnabled()) {
    res.status(503).json({ error: 'db-unavailable' });
    return;
  }
  await saveProfile(userId, result.value);
  res.json(result.value);
}));

// Save a completed Pass & Play session to the authenticated user's game history.
app.post('/api/me/pass-and-play-record', dbRoute(async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const validModes = ['flash', 'infiltrato', 'coppie', 'assurdo', 'preferiresti', 'cruciverba', 'tribunale', 'ghigliottina', 'stima', 'bufala', 'intesa', 'mix', 'classico', 'percorso', 'storia'];
  const partyMode = typeof body.partyMode === 'string' && validModes.includes(body.partyMode)
    ? body.partyMode
    : null;
  if (!partyMode) {
    res.status(400).json({ error: 'invalid-mode' });
    return;
  }

  const rounds = typeof body.rounds === 'number' && Number.isFinite(body.rounds) ? Math.floor(body.rounds) : 0;
  if (rounds < 1 || rounds > 100) {
    res.status(400).json({ error: 'invalid-rounds' });
    return;
  }

  const playerCount =
    typeof body.playerCount === 'number' && Number.isFinite(body.playerCount)
      ? Math.max(1, Math.min(30, Math.floor(body.playerCount)))
      : 2;
  const score =
    typeof body.score === 'number' && Number.isFinite(body.score)
      ? Math.max(0, Math.min(100_000, Math.floor(body.score)))
      : 0;
  const rawNickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 32) : '';
  const nickname = rawNickname || 'Pass & Play';

  if (!dbEnabled()) {
    res.status(503).json({ error: 'db-unavailable' });
    return;
  }

  const gameCode = `PNP-${Date.now().toString(36).toUpperCase()}`;
  await saveGameRecords([
    {
      clerkUserId: userId,
      gameCode,
      mode: `party:${partyMode}`,
      nickname,
      persuasion: score,
      rounds,
      changedCount: 0,
      majorityCount: 0,
      awardsCount: 0,
      playerCount,
    },
  ]);
  res.json({ ok: true, gameCode });
}));

const deckLimiter = createRateLimiter(20, 60_000);

function cardMatchesExclude(card: Record<string, unknown>, excludeSet: Set<string>): boolean {
  if (excludeSet.size === 0) return false;
  for (const key of ['id', 'text', 'prompt', 'groupQuestion'] as const) {
    const val = card[key];
    if (typeof val === 'string' && excludeSet.has(val)) return true;
  }
  return false;
}

app.get('/api/pass-and-play/stories', (_req: Request, res: Response) => {
  res.json({ stories: STORIE_CATALOG });
});

// Deck endpoint for Pass & Play ("Passa il Telefono", 1-device local mode).
// Returns curated or AI-generated cards without requiring a Socket.IO room.
app.post('/api/pass-and-play/deck', async (req: Request, res: Response) => {
  const clientIp = req.ip || 'unknown';
  if (!deckLimiter.allow(clientIp)) {
    res.status(429).json({ error: 'too-many-requests' });
    return;
  }

  try {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const modeRaw = typeof body.mode === 'string' ? body.mode : 'flash';
  const countRaw = typeof body.count === 'number' && Number.isFinite(body.count) ? Math.floor(body.count) : 5;
  const count = Math.max(1, Math.min(20, countRaw));
  const intensity: CoppieIntensity =
    body.intensity === 'piccante'
      ? 'piccante'
      : body.intensity === 'profondo'
        ? 'profondo'
        : 'complicita';
  const rawTono = body.infiltratoTono;
  const infiltratoTono: 'risate' | 'profondo' | 'misto' =
    rawTono === 'risate' || rawTono === 'leggero'
      ? 'risate'
      : rawTono === 'profondo' || rawTono === 'spinto'
        ? 'profondo'
        : 'misto';
  const rawTheme =
    typeof body.theme === 'string'
      ? body.theme
      : typeof body.topic === 'string'
        ? body.topic
        : undefined;
  const theme = rawTheme ? sanitizeAiTheme(rawTheme) || undefined : undefined;
  const registerRaw = typeof body.register === 'string' ? body.register : 'misto';
  const register: ContentRegister =
    registerRaw === 'vita' || registerRaw === 'business' || registerRaw === 'carriera' ? registerRaw : 'misto';
  const familiaritaRaw = typeof body.familiarita === 'string' ? body.familiarita : 'misto';
  const familiarita: Familiarita = isFamiliarita(familiaritaRaw) ? familiaritaRaw : 'misto';
  const playerCount =
    typeof body.playerCount === 'number' && Number.isFinite(body.playerCount)
      ? Math.max(1, Math.floor(body.playerCount))
      : 4;
  const isSolo = playerCount === 1;
  const excludeSet = new Set<string>(
    Array.isArray(body.excludeIds)
      ? body.excludeIds.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 200)
      : [],
  );

  const getPassClassicoCards = (limit: number) => {
    const basePool = isSolo
      ? getSoloDilemmas()
      : dilemmasForRegister(ALL_DILEMMAS, register).filter((d) => !d.delicato && !d.roster);
    const famPool = isSolo ? basePool : filterByFamiliarita(basePool, familiarita);
    const freshPool = famPool.filter((d) => !cardMatchesExclude(d as unknown as Record<string, unknown>, excludeSet));
    const arr = freshPool.length > 0 ? [...freshPool] : [...famPool];
    const capped = Math.min(limit, arr.length);
    for (let i = 0; i < capped; i++) {
      const j = i + Math.floor(Math.random() * (arr.length - i));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, capped).map((d) => ({ ...d, cardMode: 'classico' }));
  };

  if (modeRaw === 'classico') {
    res.json({ mode: 'classico', cards: getPassClassicoCards(count), source: 'curated' });
    return;
  }

  if (modeRaw === 'percorso') {
    const percorsoId = typeof body.percorsoId === 'string' ? body.percorsoId : 'bussola';
    const startTappa =
      typeof body.startTappa === 'number' && Number.isFinite(body.startTappa) ? body.startTappa : 1;
    const durata = typeof body.durata === 'string' && isDurata(body.durata) ? body.durata : 'corto';
    const plan = buildPercorsoPlan(
      ALL_DILEMMAS,
      startTappa,
      durata,
      Math.random,
      percorsoId,
      excludeSet,
      playerCount,
      familiarita,
    );
    const meta = getPercorsoMeta(percorsoId);
    const cards = plan.dilemmas.map((d, i) => ({
      ...d,
      cardMode: 'percorso',
      tappa: plan.tappe[i],
      tappaNome: meta.tappe.find((t) => t.id === plan.tappe[i])?.nome ?? `Tappa ${plan.tappe[i]}`,
    }));
    res.json({ mode: 'percorso', cards, source: 'curated' });
    return;
  }

  if (modeRaw === 'storia') {
    const stories = loadStories();
    const storyId = typeof body.storyId === 'string' ? body.storyId : '';
    const story = stories.find((s) => s.id === storyId) ?? stories[0];
    if (!story) {
      res.json({ mode: 'storia', cards: [], source: 'curated' });
      return;
    }
    const plan = buildStoriaPlan(story);
    const cards = plan.dilemmas.map((d, i) => ({
      ...d,
      cardMode: 'storia',
      storyScene: {
        storyId: story.id,
        title: story.title,
        protagonist: story.protagonist,
        premessa: i === 0 ? story.premessa : undefined,
        actTitle: story.acts[plan.acts[i]]?.title ?? `Atto ${plan.acts[i] + 1}`,
        sceneNarration: plan.scenes[i].narration,
        consequenceA: plan.scenes[i].consequenceA,
        consequenceB: plan.scenes[i].consequenceB,
        epiloghi: i === plan.dilemmas.length - 1 ? story.epiloghi : undefined,
      },
    }));
    res.json({ mode: 'storia', cards, source: 'curated' });
    return;
  }

  function pickPassDeckSlice<T extends { id: string }>(
    allItems: readonly T[],
    limit: number,
    mapFn: (item: T) => Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const fresh = allItems.filter((item) => !excludeSet.has(item.id));
    const source = [...(fresh.length >= limit ? fresh : allItems)];
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    return source.slice(0, limit).map(mapFn);
  }

  const getPassCruciverbaCards = (limit: number) =>
    pickPassDeckSlice(CRUCIVERBA_BOARDS, limit, (b) => ({
      id: b.id,
      cardMode: 'cruciverba',
      theme: b.theme,
      rows: b.rows,
      cols: b.cols,
      words: b.words,
    }));

  const getPassTribunaleCards = (limit: number) =>
    pickPassDeckSlice(TRIBUNALE_CASES, limit, (c) => ({
      id: c.id,
      cardMode: 'tribunale',
      title: c.title,
      scenario: c.scenario,
      accusaRole: c.accusaRole,
      difesaRole: c.difesaRole,
      penalty: c.penalty,
    }));

  const getPassGhigliottinaCards = (limit: number) =>
    pickPassDeckSlice(GHIGLIOTTINA_PUZZLES, limit, (p) => ({
      id: p.id,
      cardMode: 'ghigliottina',
      clues: [...p.clues],
      answer: p.answer,
      choices: [...p.choices],
      connections: [...p.connections],
    }));

  const getPassStimaCards = (limit: number) =>
    pickPassDeckSlice(STIMA_QUESTIONS, limit, (q) => ({
      id: q.id,
      cardMode: 'stima',
      prompt: q.prompt,
      unit: q.unit,
      min: q.min,
      max: q.max,
      step: q.step,
      answer: q.answer,
      funFact: q.funFact,
    }));

  const getPassBufalaCards = (limit: number) =>
    pickPassDeckSlice(BUFALA_QUESTIONS, limit, (q) => ({
      id: q.id,
      cardMode: 'bufala',
      statement: q.statement,
      isTrue: q.isTrue,
      explanation: q.explanation,
      category: q.category,
    }));

  const getPassIntesaCards = (limit: number) =>
    pickPassDeckSlice(INTESA_CARDS, limit, (c) => ({
      id: c.id,
      cardMode: 'intesa',
      word: c.word,
      forbidden: [...c.forbidden],
      category: c.category,
    }));

  if (modeRaw === 'cruciverba') {
    res.json({ mode: 'cruciverba', cards: getPassCruciverbaCards(count), source: 'curated' });
    return;
  }
  if (modeRaw === 'tribunale') {
    res.json({ mode: 'tribunale', cards: getPassTribunaleCards(count), source: 'curated' });
    return;
  }
  if (modeRaw === 'ghigliottina') {
    res.json({ mode: 'ghigliottina', cards: getPassGhigliottinaCards(count), source: 'curated' });
    return;
  }
  if (modeRaw === 'stima') {
    res.json({ mode: 'stima', cards: getPassStimaCards(count), source: 'curated' });
    return;
  }
  if (modeRaw === 'bufala') {
    res.json({ mode: 'bufala', cards: getPassBufalaCards(count), source: 'curated' });
    return;
  }
  if (modeRaw === 'intesa') {
    res.json({ mode: 'intesa', cards: getPassIntesaCards(count), source: 'curated' });
    return;
  }

  const validPartyModes: PartyMode[] = ['flash', 'infiltrato', 'coppie', 'assurdo', 'preferiresti', 'mix'];
  const partyMode: PartyMode = validPartyModes.includes(modeRaw as PartyMode) ? (modeRaw as PartyMode) : 'flash';
  const useAi = Boolean(theme && isGeminiAvailable());

  if (partyMode === 'mix') {
    const subModes: Array<Exclude<PartyMode, 'mix'>> =
      playerCount >= 2 ? ['flash', 'preferiresti', 'assurdo', 'coppie'] : ['flash', 'preferiresti', 'assurdo'];
    if (playerCount >= 3) subModes.push('infiltrato');
    const totalSubModes = subModes.length + 5 + (playerCount >= 2 ? 1 : 0) + (playerCount >= 3 ? 1 : 0);
    const perMode = Math.max(1, Math.ceil(count / totalSubModes));
    const rawBuckets = await Promise.all([
      ...subModes.map(async (sub) => {
        const fetchCount = sub === 'assurdo' && playerCount < 2 ? perMode * 2 : perMode;
        const rawCards = useAi
          ? await generatePartyCards(sub, { count: fetchCount, intensity, infiltratoTono, familiarita, theme, isSolo })
          : getCuratedCards(sub, { count: fetchCount, intensity, infiltratoTono, familiarita, excludeIds: excludeSet, isSolo });
        const soloSafe =
          sub === 'assurdo' && isSolo
            ? rawCards.filter((c) => (c as AssurdoCard).cardType === 'dignita')
            : rawCards;
        const baseCards = soloSafe.length > 0 ? soloSafe : rawCards;
        const filtered = baseCards.filter((c) => !cardMatchesExclude(c as unknown as Record<string, unknown>, excludeSet));
        const finalSlice = filtered.length > 0 ? filtered : baseCards;
        return finalSlice.slice(0, perMode).map((c) => {
          const normalized = isSolo ? enforceTwoOptionsForSolo(c) : c;
          return { ...(normalized as object), cardMode: sub } as Record<string, unknown>;
        });
      }),
      Promise.resolve(getPassCruciverbaCards(perMode)),
      Promise.resolve(getPassClassicoCards(perMode)),
      Promise.resolve(getPassGhigliottinaCards(perMode)),
      Promise.resolve(getPassStimaCards(perMode)),
      Promise.resolve(getPassBufalaCards(perMode)),
      ...(playerCount >= 2 ? [Promise.resolve(getPassIntesaCards(perMode))] : []),
      ...(playerCount >= 3 ? [Promise.resolve(getPassTribunaleCards(perMode))] : []),
    ]);
    const buckets = rawBuckets
      .filter((cards) => cards.length > 0)
      .map((cards) => ({ cards, cursor: 0 }));
    for (let i = buckets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
    }
    const mixed: Array<Record<string, unknown>> = [];
    let lastMode: unknown = null;
    while (mixed.length < count) {
      const withCards = buckets.filter((b) => b.cursor < b.cards.length);
      if (withCards.length === 0) break;
      const distinct = withCards.filter((b) => b.cards[b.cursor].cardMode !== lastMode);
      const pool = distinct.length > 0 ? distinct : withCards;
      const minCursor = Math.min(...pool.map((b) => b.cursor));
      const candidates = pool.filter((b) => b.cursor === minCursor);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const card = chosen.cards[chosen.cursor++];
      mixed.push(card);
      lastMode = card.cardMode ?? null;
    }
    res.json({ mode: 'mix', cards: mixed, source: useAi ? 'gemini' : 'curated' });
    return;
  }

  const fetchCount = partyMode === 'assurdo' && isSolo ? count * 2 : count;
  const rawCards: PartyCard[] = useAi
    ? await generatePartyCards(partyMode, { count: fetchCount, intensity, infiltratoTono, familiarita, theme, isSolo })
    : getCuratedCards(partyMode, { count: fetchCount, intensity, infiltratoTono, familiarita, excludeIds: excludeSet, isSolo });
  const soloSafe =
    partyMode === 'assurdo' && isSolo
      ? rawCards.filter((c) => (c as AssurdoCard).cardType === 'dignita')
      : rawCards;
  const baseCards = soloSafe.length > 0 ? soloSafe : rawCards;
  const filtered = baseCards.filter((c) => !cardMatchesExclude(c as unknown as Record<string, unknown>, excludeSet));
  const outCards = (filtered.length > 0 ? filtered : baseCards)
    .slice(0, count)
    .map((c) => (isSolo ? enforceTwoOptionsForSolo(c) : c));
  res.json({
    mode: partyMode,
    cards: outCards,
    source: useAi ? 'gemini' : 'curated',
  });
  } catch (err) {
    console.error('[deck] failed:', err instanceof Error ? err.message : err);
    if (!res.headersSent) res.status(500).json({ error: 'deck-generation-failed' });
  }
});

io.on('connection', (socket) => {
  console.log('[server] client connected:', socket.id);

  // A player creates a room from their phone: they join as a player AND become
  // the room's leader (the controls live on their phone; the TV is optional).
  socket.on('player:createRoom', (payload: { nickname?: string }) => {
    if (
      !joinLimiter.allow(socket.id) ||
      (process.env.NODE_ENV !== 'test' && !ipCreateRoomLimiter.allow(socketClientIp(socket)))
    ) {
      socket.emit('player:joinError', { error: 'RATE_LIMITED' });
      return;
    }
    if (!rooms.canCreate()) {
      socket.emit('player:joinError', { error: 'SERVER_BUSY' });
      return;
    }
    const prev = sessions.get(socket.id);
    if (prev) {
      socket.leave(prev.code);
      sessions.delete(socket.id);
    }
    const nickname = String(payload?.nickname ?? '');
    const { code } = rooms.create();
    const playerId = `p_${randomUUID()}`;
    const token = randomUUID();
    const result = rooms.join(code, playerId, nickname);
    if (!result.ok) {
      rooms.delete(code);
      socket.emit('player:joinError', { error: result.error });
      return;
    }
    rooms.setLeader(code, playerId);
    tokens.set(token, { code, playerId });
    rooms.registerToken(code, token, playerId);
    sessions.set(socket.id, { code, playerId });
    playerSocket.set(playerId, socket.id);
    socket.join(code);
    socket.emit('player:joined', { code, player: result.player, token });
    broadcastLobby(code);
    broadcastGameState(code); // carries leaderId so the creator sees their controls
  });

  // A spectator screen (TV) attaches to an existing room in read-only mode.
  socket.on('spectator:join', (payload: { code?: string }) => {
    if (
      !joinLimiter.allow(socket.id) ||
      (process.env.NODE_ENV !== 'test' && !ipJoinLimiter.allow(socketClientIp(socket)))
    ) {
      socket.emit('player:joinError', { error: 'RATE_LIMITED' });
      return;
    }
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
  socket.on('leader:startGame', (payload: { dilemmaCount?: number; register?: string; mode?: string; infiltrato?: boolean; squadre?: boolean; format?: string; startTappa?: number; durata?: string; percorsoId?: string; storyId?: string; mood?: string; delicatoOptIn?: boolean; serataLunga?: boolean; caos?: string; seenDilemmaIds?: string[]; partyMode?: string; partyIntensity?: string; infiltratoTono?: string; familiarita?: string; theme?: string; couples?: Array<[string, string]>; cruciverbaMode?: string; soloFast?: boolean }) => {
    if (!actionLimiter.allow(socket.id)) return;
    const code = leaderCodeFor(socket.id);
    if (!code) {
      socket.emit('leader:startError', { error: 'ROOM_NOT_FOUND' });
      return;
    }
    // "Percorso" format carries its own config (percorsoId + start tappa + duration) instead
    // of a dilemma count / register; presence of `percorso` switches the mode.
    const percorso =
      payload?.format === 'percorso'
        ? {
            startTappa: Number(payload?.startTappa),
            durata: String(payload?.durata),
            ...(payload?.percorsoId ? { percorsoId: String(payload.percorsoId) } : {}),
          }
        : undefined;
    // "Storia" format carries the chosen story id; like percorso it overrides the
    // classic count/register and always runs in gruppo mode.
    const storia =
      payload?.format === 'storia' ? { storyId: String(payload?.storyId ?? '') } : undefined;
    // 5.1: the leader's own device memory of already-seen dilemmas (localStorage,
    // sent fresh on every start). Capped + sanitized against a hostile payload.
    const seenDilemmaIds = Array.isArray(payload?.seenDilemmaIds)
      ? payload.seenDilemmaIds
          .slice(0, 2000)
          .map((id) => String(id).trim())
          .filter((id) => id.length > 0 && id.length <= 64)
      : [];
    const partyMode = payload?.partyMode && ['flash', 'infiltrato', 'coppie', 'assurdo', 'preferiresti', 'cruciverba', 'tribunale', 'ghigliottina', 'stima', 'bufala', 'intesa', 'classico', 'mix'].includes(payload.partyMode)
      ? (payload.partyMode as PartyMode)
      : undefined;
    const partyIntensity =
      payload?.partyIntensity === 'piccante'
        ? 'piccante'
        : payload?.partyIntensity === 'profondo'
          ? 'profondo'
          : 'complicita';
    const infiltratoTono =
      payload?.infiltratoTono === 'risate' || payload?.infiltratoTono === 'profondo'
        ? payload.infiltratoTono
        : 'misto';
    const familiarita: Familiarita =
      typeof payload?.familiarita === 'string' && isFamiliarita(payload.familiarita)
        ? payload.familiarita
        : 'misto';
    const theme = typeof payload?.theme === 'string' ? sanitizeAiTheme(payload.theme) : undefined;
    const couples = Array.isArray(payload?.couples)
      ? payload.couples
          .filter((pair): pair is [string, string] => Array.isArray(pair) && pair.length === 2)
          .map(([a, b]) => [String(a), String(b)] as [string, string])
      : undefined;
    const cruciverbaMode: CruciverbaMode = payload?.cruciverbaMode === 'scelte' ? 'scelte' : 'indizi';
    const soloFast = Boolean(payload?.soloFast);

    const result = rooms.startGame(
      code,
      Number(payload?.dilemmaCount),
      String(payload?.register ?? 'misto'),
      String(payload?.mode ?? 'gruppo'),
      Boolean(payload?.infiltrato || partyMode === 'infiltrato'),
      Boolean(payload?.squadre),
      percorso,
      storia,
      String(payload?.mood ?? 'mista'),
      Boolean(payload?.delicatoOptIn),
      Boolean(payload?.serataLunga),
      String(payload?.caos ?? 'assente'),
      seenDilemmaIds,
      partyMode,
      partyIntensity,
      theme,
      infiltratoTono,
      familiarita,
      couples,
      cruciverbaMode,
      soloFast,
    );
    if (!result.ok) {
      socket.emit('leader:startError', { error: result.error });
      return;
    }
    const isSoloRoom = result.room.players.size === 1;
    if (partyMode && isGeminiAvailable()) {
      if (partyMode !== 'mix' && ['flash', 'infiltrato', 'coppie', 'assurdo', 'preferiresti'].includes(partyMode)) {
        generatePartyCards(partyMode, { count: Number(payload?.dilemmaCount) || 5, intensity: partyIntensity, infiltratoTono, familiarita, theme, isSolo: isSoloRoom })
          .then((aiCards) => {
            const r = rooms.get(code);
            if (r && r.partyMode === partyMode && aiCards.length > 0) {
              const safeCards = r.players.size === 1 ? aiCards.map((c) => enforceTwoOptionsForSolo(c)) : aiCards;
              r.partyCards.splice(r.dilemmaIndex, safeCards.length, ...safeCards);
            }
          })
          .catch(() => {});
      } else if (partyMode === 'mix' && theme) {
        const cardSubModes = ['flash', 'infiltrato', 'coppie', 'assurdo', 'preferiresti'] as const;
        for (const sub of cardSubModes) {
          const matchingIndices = result.room.mixPlan
            .map((k, idx) => (k === sub ? idx : -1))
            .filter((idx) => idx >= 0);
          if (matchingIndices.length === 0) continue;
          generatePartyCards(sub, { count: matchingIndices.length, intensity: partyIntensity, infiltratoTono, familiarita, theme, isSolo: isSoloRoom })
            .then((aiCards) => {
              const r = rooms.get(code);
              if (!r || r.partyMode !== 'mix' || aiCards.length === 0) return;
              matchingIndices.forEach((slotIdx, aiIdx) => {
                if (slotIdx >= r.dilemmaIndex && aiCards[aiIdx]) {
                  r.partyCards[slotIdx] = r.players.size === 1 ? enforceTwoOptionsForSolo(aiCards[aiIdx]) : aiCards[aiIdx];
                }
              });
            })
            .catch(() => {});
        }
      }
    }
    // Privately tell the infiltrator their secret role + mission (only their phone).
    const infiltratorId = result.room.infiltratorId;
    if (infiltratorId) {
      const sid = playerSocket.get(infiltratorId);
      if (sid) {
        io.to(sid).emit('player:infiltratoRole', {
          mission: 'Sei l’Infiltrato! Fai ribaltare il gruppo verso la minoranza, senza farti smascherare.',
        });
      }
    }
    if (result.room.players.size === 1 && result.room.soloFast && result.room.format !== 'storia') {
      rooms.advancePhase(code);
      if (result.room.phase === 'TAPPA_INTRO') {
        rooms.advancePhase(code);
      }
    }
    broadcastGameState(code);
    schedulePhase(code);
  });

  // The leader force-advances the state machine (skip the remaining countdown).
  socket.on('leader:advancePhase', () => {
    if (!actionLimiter.allow(socket.id)) return;
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    advanceAndBroadcast(code);
  });

  // The leader discards the current dilemma (DILEMMA_REVEAL or an open VOTE_1):
  // a fresh card replays the same round, or — deck exhausted — the round just
  // advances (which, on the game's last round, lands straight on FINAL_AWARDS).
  // Everyone gets a room:dilemmaSkipped ping (toast + sting); broadcastAdvance
  // covers the rest exactly like a normal advance (blind spots, awards
  // persistence, …) so this path can't silently skip them.
  socket.on('leader:skipDilemma', () => {
    if (!actionLimiter.allow(socket.id)) return;
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    const hadLateJoiners = (rooms.get(code)?.lateJoiners.size ?? 0) > 0;
    const result = rooms.skipDilemma(code);
    if (!result.ok) return;
    io.to(code).emit('room:dilemmaSkipped', {});
    broadcastAdvance(code, hadLateJoiners);
  });

  // The leader returns a finished room to LOBBY for a rematch: same roster,
  // code, and leader; the next game's deck skips this game's dilemmas.
  socket.on('leader:rematch', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    const result = rooms.rematch(code);
    if (!result.ok) return;
    broadcastLobby(code);
    broadcastGameState(code);
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

  // The leader manually frees an OFFLINE player's seat (before the automatic
  // grace period elapses). Rejects an online player or an unknown id. Mirrors
  // the automatic grace-expiry path (below, on 'disconnect') so a manual
  // removal behaves exactly like an early grace expiry: same cleanup, same
  // roster/game-state refresh.
  socket.on('leader:removePlayer', (payload: { id?: string }) => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    const id = String(payload?.id ?? '');
    const wasLeader = rooms.isLeader(code, id);
    if (!rooms.removeIfOffline(code, id)) return;
    // Cancel the now-moot grace timer + drop the stale reconnect token, same
    // cleanup the timer itself runs when it fires naturally (see below).
    cancelGrace(id);
    const tok = [...tokens].find(([, v]) => v.playerId === id)?.[0];
    if (tok) tokens.delete(tok);
    if (rooms.get(code) && rooms.get(code)!.players.size === 0) {
      reapRoom(code);
      return;
    }
    broadcastLobby(code);
    if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);
    if (wasLeader) broadcastGameState(code);
  });

  // The leader pauses the game: freezes the current phase's countdown
  // indefinitely. RoomStore.advancePhase/skipDilemma both refuse to run
  // while paused, so nothing advances — timer, force-advance, a completed
  // vote — until leader:resumeGame. No-op outside an active round or if
  // already paused.
  socket.on('leader:pauseGame', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (!rooms.pauseGame(code)) return;
    clearPhaseTimer(code);
    broadcastGameState(code);
  });

  // The leader resumes a paused game: restores the frozen countdown from
  // where it left off.
  socket.on('leader:resumeGame', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (!rooms.resumeGame(code)) return;
    schedulePhase(code);
    broadcastGameState(code);
  });

  // A player joins from their phone with a room code + nickname. An optional
  // `token` from a previous session reclaims the same seat (reconnection).
  socket.on('player:join', (payload: { code?: string; nickname?: string; token?: string }) => {
    if (
      !joinLimiter.allow(socket.id) ||
      (process.env.NODE_ENV !== 'test' && !ipJoinLimiter.allow(socketClientIp(socket)))
    ) {
      socket.emit('player:joinError', { error: 'RATE_LIMITED' });
      return;
    }
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
    const prevSession = sessions.get(socket.id);
    if (prevSession && prevSession.code !== code) {
      socket.leave(prevSession.code);
      sessions.delete(socket.id);
    }
    tokens.set(token, { code, playerId });
    rooms.registerToken(code, token, playerId);
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
    if (room && room.phase === 'WRITE_VOTE') {
      const token = rooms.myWrittenAnswerToken(code, playerId);
      if (token) socket.emit('player:myWriteToken', { token });
    }
    emitSecretQuestionIfNeeded(room, playerId);
    emitIntesaSecretIfNeeded(room, playerId);
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
    socket.emit('player:voted', {
      choice: result.room.preferirestiVotes.get(playerId) ?? result.room.votes.get(playerId),
    });
    // Advance as soon as everyone present has acted. VOTE_1 and the duo picks:
    // everyone has voted. VOTE_2 / DUO_REPICK: changing the vote also confirms
    // it (store), so advance once everyone required has confirmed.
    const phase = result.room.phase;
    const isCastPhase = phase === 'VOTE_1' || phase === 'DUO_SIDE_PICK' || phase === 'DUO_PICK';
    if (isCastPhase && rooms.allVoted(code)) {
      advanceAndBroadcast(code);
    } else if (phase === 'VOTE_2' && rooms.allConfirmed(code)) {
      advanceAndBroadcast(code);
    } else if (phase === 'DUO_REPICK' && rooms.duoRepickComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the count for the host
    }
  });

  // Player votes for a friend in ASSURDO MA SEMPLICE ("La Gogna") mode.
  socket.on('player:gognaVote', (payload: { targetId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const targetId = String(payload?.targetId ?? '');
    const result = rooms.recordGognaVote(code, playerId, targetId);
    if (!result.ok) return;
    socket.emit('player:gognaVoted', { targetId });
    if (rooms.allVoted(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // Percorso in 2, Atto I: a player submits their own pick AND the prediction of
  // the partner's pick in one move. Both stay secret until DUO_SYNC_REVEAL; the
  // phase early-advances once both players have submitted.
  socket.on('player:duoSync', (payload: { own?: string; predict?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const own = String(payload?.own ?? '');
    const predict = String(payload?.predict ?? '');
    const valid =
      (own === 'A' || own === 'B') &&
      (predict === 'A' || predict === 'B') &&
      rooms.duoSync(code, playerId, own, predict);
    if (!valid) {
      socket.emit('player:duoSyncError', { error: 'NOT_SYNC_PHASE' });
      return;
    }
    socket.emit('player:duoSynced', { own, predict });
    if (rooms.duoSyncComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the aggregate count
    }
  });

  // Percorso in 2: a listener rates the arringa ("ti ha fatto vacillare?").
  // Ratings stay secret until DUO_ROUND_RESULT; early-advance once all rated.
  socket.on('player:duoWaver', (payload: { rating?: number }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const rating = Number(payload?.rating);
    const valid =
      (rating === 0 || rating === 1 || rating === 2) &&
      rooms.duoWaver(code, playerId, rating as 0 | 1 | 2);
    if (!valid) {
      socket.emit('player:duoWaverError', { error: 'NOT_WAVER_PHASE' });
      return;
    }
    socket.emit('player:duoWavered', { rating });
    if (rooms.duoWaverComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // A player confirms their pre-filled second vote (VOTE_2) without changing it.
  // Like a vote it never leaves the server individually — only the aggregate
  // confirmed count — and the phase auto-advances once everyone present confirmed.
  socket.on('player:confirmVote', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code } = session;
    const result = rooms.confirmVote(code, session.playerId);
    if (!result.ok) return;
    const done =
      result.room.phase === 'DUO_REPICK'
        ? rooms.duoRepickComplete(code) // the advocate never re-picks
        : rooms.allConfirmed(code);
    if (done) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
  });

  // A player taps a live reaction during DEFENSE / DUO_ARGUE. The store validates
  // the phase/emoji and rate-limits per player, then attributes it to the current
  // speaker; we re-broadcast just the emoji as a lightweight stream the host
  // animates (no full game:state — reactions are ephemeral, never secret votes).
  socket.on('player:react', (payload: { emoji?: string }) => {
    if (!reactLimiter.allow(socket.id)) return;
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.react(session.code, session.playerId, String(payload?.emoji ?? ''));
    if (result.ok) io.to(session.code).emit('room:reaction', { emoji: result.emoji });
  });

  // A player raises/lowers their hand during a defender's turn (DEFENSE). Toggle:
  // the server echoes the new state to the sender only; everyone else sees just the
  // aggregate ✋ count via game:state — never who raised, until INTERVENTI.
  socket.on('player:raiseHand', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.raiseHand(session.code, session.playerId);
    if (!result.ok) {
      socket.emit('player:raiseHandError', { error: result.error });
      return;
    }
    socket.emit('player:handRaised', { raised: result.raised });
    broadcastGameState(session.code);
  });

  // The current speaker (defender or intervenor) ends their turn from their phone,
  // valid only once the per-turn minimum has elapsed. Advances exactly like the
  // safety-cap timer would; rejection goes back only to the sender.
  socket.on('player:finishTurn', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const result = rooms.finishTurn(session.code, session.playerId);
    if (!result.ok) {
      socket.emit('player:finishTurnError', { error: result.error });
      return;
    }
    advanceAndBroadcast(session.code);
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
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
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
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the swing-bet count for the host
    }
  });

  // A player answers + predicts the group's majority in one submission during
  // GROUP_MIND ("La Mente del Gruppo", 4.1). Like PREDICT, ends early once every
  // present human has submitted; the per-choice answers stay secret.
  socket.on('player:groupMind', (payload: { answer?: string; guess?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.groupMindSubmit(code, playerId, String(payload?.answer ?? ''), String(payload?.guess ?? ''));
    if (!result.ok) {
      socket.emit('player:groupMindError', { error: result.error });
      return;
    }
    socket.emit('player:groupMindSubmitted', {
      answer: result.room.groupMindAnswers.get(playerId),
      guess: result.room.groupMindGuesses.get(playerId),
    });
    if (rooms.groupMindPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the missing-submitters list for the host
    }
  });

  // A player submits (or changes) their own written answer during WRITE
  // ("In Altre Parole", 4.2). Ends early once every present human has written;
  // the answers stay attributed-but-hidden until the anonymized WRITE_VOTE list.
  socket.on('player:write', (payload: { text?: string }) => {
    if (!writeLimiter.allow(socket.id)) {
      socket.emit('player:writeError', { error: 'RATE_LIMITED' });
      return;
    }
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitWrite(code, playerId, String(payload?.text ?? ''));
    if (!result.ok) {
      socket.emit('player:writeError', { error: result.error });
      return;
    }
    socket.emit('player:writeSubmitted', { text: result.room.writeAnswers.get(playerId) });
    if (rooms.writePhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the missing-writers list for the host
    }
  });

  // A player votes for their favorite OTHER answer during WRITE_VOTE, identified
  // by its opaque per-round token (never a real player id — see writeRound.ts).
  // Ends early once every present human (with a valid target) has voted; only
  // the aggregate vote counts are ever revealed (at WRITE_REVEAL) — never who
  // voted for what.
  socket.on('player:writeVote', (payload: { votedForToken?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const votedForToken = String(payload?.votedForToken ?? '');
    const result = rooms.writeVote(code, playerId, votedForToken);
    if (!result.ok) {
      socket.emit('player:writeVoteError', { error: result.error });
      return;
    }
    // Echo back the TOKEN the client sent — never the real author id that
    // rooms.writeVote resolved it to internally.
    socket.emit('player:writeVoted', { votedForToken });
    if (rooms.writeVotePhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the missing-voters list for the host
    }
  });

  // Termometro (Hot Take 1-10): player submits or updates their 1-10 slider score.
  socket.on('player:hotTake', (payload: { score?: number }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const score = Number(payload?.score);
    const result = rooms.submitHotTake(code, playerId, score);
    if (!result.ok) {
      socket.emit('player:hotTakeError', { error: result.error });
      return;
    }
    socket.emit('player:hotTakeSubmitted', { score });
    if (rooms.hotTakePhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
  });

  // Cruciverba Show: active player submits a word guess during their 15s turn.
  socket.on('player:cruciverbaAttempt', (payload: { guess?: string; wordId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const res = rooms.submitCruciverbaAttempt(
      code,
      playerId,
      String(payload?.guess ?? ''),
      typeof payload?.wordId === 'string' ? payload.wordId : undefined,
    );
    socket.emit('player:cruciverbaFeedback', res);
    if (!res.ok) return;
    if (res.roundEnded) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
      if (res.correct) scheduleTurnTimer(code);
    }
  });

  // Cruciverba Show: active player unlocks 1 letter of the current word and passes.
  socket.on('player:cruciverbaPass', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const res = rooms.passOrTimeoutCruciverba(code, 'hint', playerId);
    if (!res.ok) return;
    if (res.roundEnded) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
      scheduleTurnTimer(code);
    }
  });

  // Tribunale degli Amici: active contender finishes their 15s speech turn early.
  socket.on('player:tribunaleFinishTurn', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const adv = rooms.advanceTribunaleSpeaker(code, playerId);
    if (!adv.ok) {
      socket.emit('player:tribunaleError', { error: adv.error });
      return;
    }
    if (adv.enteredVote) {
      broadcastAdvance(code, false);
    } else {
      broadcastGameState(code);
      scheduleTurnTimer(code);
    }
  });

  // Pre-debate reading grace window: leader or active contender/defender skips straight to the 15s timer.
  socket.on('player:finishReading', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const res = rooms.finishReading(code, playerId);
    if (!res.ok) return;
    broadcastGameState(code);
    schedulePhase(code);
  });

  // Tribunale degli Amici: jury votes ACCUSA or DIFESA during TRIBUNALE_VOTE.
  socket.on('player:tribunaleVote', (payload: { choice?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const choice = payload?.choice === 'ACCUSA' ? 'ACCUSA' : payload?.choice === 'DIFESA' ? 'DIFESA' : null;
    if (!choice) return;
    const res = rooms.submitTribunaleVote(code, playerId, choice);
    if (!res.ok) {
      socket.emit('player:tribunaleError', { error: res.error });
      return;
    }
    socket.emit('player:tribunaleVoted', { choice });
    if (rooms.tribunaleVotesComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
  });

  // Telepatia (silent 1-word sync mode): player submits or updates their word.
  socket.on('player:telepathy', (payload: { word?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitTelepathy(code, playerId, String(payload?.word ?? ''));
    if (!result.ok) {
      socket.emit('player:telepathyError', { error: result.error });
      return;
    }
    socket.emit('player:telepathySubmitted', { word: result.word });
    if (rooms.telepathyPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
  });

  // La Ghigliottina: submit guess via free text (+150) or 4-choice quick pick (+100).
  socket.on('player:ghigliottina', (payload: { guess?: string; usedChoices?: boolean }) => {
    if (!actionLimiter.allow(socket.id)) return;
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitGhigliottina(
      code,
      playerId,
      String(payload?.guess ?? ''),
      payload?.usedChoices !== false,
    );
    if (!result.ok) {
      socket.emit('player:ghigliottinaError', { error: result.error });
      return;
    }
    socket.emit('player:ghigliottinaSubmitted', { guess: result.guess });
    if (rooms.ghigliottinaComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // Quanto Vale? (Stima): submit numeric slider estimate.
  socket.on('player:stima', (payload: { value?: number }) => {
    if (!actionLimiter.allow(socket.id)) return;
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitStima(code, playerId, Number(payload?.value));
    if (!result.ok) {
      socket.emit('player:stimaError', { error: result.error });
      return;
    }
    socket.emit('player:stimaSubmitted', { value: result.value });
    if (rooms.stimaComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // Vero o Bufala?: submit boolean vote.
  socket.on('player:bufala', (payload: { vote?: boolean }) => {
    if (!actionLimiter.allow(socket.id)) return;
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.submitBufala(code, playerId, Boolean(payload?.vote));
    if (!result.ok) {
      socket.emit('player:bufalaError', { error: result.error });
      return;
    }
    socket.emit('player:bufalaSubmitted', { vote: result.vote });
    if (rooms.bufalaComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
  });

  // Parola Vietata (Intesa / Taboo): speaker or leader resolves round.
  socket.on(
    'player:intesaResolve',
    (payload: { outcome?: 'guessed' | 'taboo' | 'skipped'; winnerId?: string | null }) => {
      if (!actionLimiter.allow(socket.id)) return;
      const session = sessions.get(socket.id);
      if (!session) return;
      const { code, playerId } = session;
      const outcome =
        payload?.outcome === 'guessed' || payload?.outcome === 'taboo' || payload?.outcome === 'skipped'
          ? payload.outcome
          : 'skipped';
      const winnerId = typeof payload?.winnerId === 'string' ? payload.winnerId : null;
      const result = rooms.resolveIntesa(code, playerId, outcome, winnerId);
      if (!result.ok) {
        socket.emit('player:intesaError', { error: result.error });
        return;
      }
      advanceAndBroadcast(code);
    },
  );

  // A player writes their own dilemma in the LOBBY (max 2/player). The store
  // validates + caps it; on success the room's submitted count is broadcast.
  socket.on('player:submitDilemma', (payload: { text?: string; optionA?: string; optionB?: string }) => {
    if (!writeLimiter.allow(socket.id)) {
      socket.emit('player:submitDilemmaError', { error: 'RATE_LIMITED' });
      return;
    }
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
    if (rooms.predictPhaseComplete(code)) {
      advanceAndBroadcast(code);
    } else {
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code); // refresh the guessed count
    }
  });

  // The infiltrator seeds a decoy spunto into the current speaker's suggestions
  // (4.5), once per round, only while someone is speaking. Not gated to "the
  // opposing side" — the store only checks phase/identity/once-per-round.
  socket.on('player:infiltratoTool', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.useInfiltratoTool(code, playerId);
    if (!result.ok) {
      socket.emit('player:infiltratoToolError', { error: result.error });
      return;
    }
    broadcastGameState(code); // refresh the public spunti + toolUsed flag for everyone
  });

  // A player accuses who they think the infiltrator is (ACCUSE phase). The store
  // gates it; the phase ends early once everyone present has accused.
  socket.on('player:accuse', (payload: { accusedId?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code, playerId } = session;
    const result = rooms.accuse(code, playerId, String(payload?.accusedId ?? ''));
    if (!result.ok) {
      socket.emit('player:accuseError', { error: result.error });
      return;
    }
    socket.emit('player:accused', { accusedId: result.room.accusations.get(playerId) });
    if (rooms.allAccused(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code); // refresh the accused count
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
      if (rooms.maybeArmSoftTimeout(code)) schedulePhase(code);
      broadcastGameState(code);
    }
  });

  // A logged-in phone sends its Clerk token; verify it and tag the player so the
  // server can attribute saved awards. A late identify on the awards screen
  // triggers a re-save (idempotent) so results aren't lost.
  socket.on('player:identify', async (payload: { token?: string }) => {
    if (
      !identifyLimiter.allow(socket.id) ||
      (process.env.NODE_ENV !== 'test' && !ipIdentifyLimiter.allow(socketClientIp(socket)))
    ) {
      return;
    }
    const session = sessions.get(socket.id);
    if (!session) return;
    const userId = await verifyClerkToken(typeof payload?.token === 'string' ? payload.token : undefined);
    if (!userId) return;
    rooms.setPlayerUser(session.code, session.playerId, userId);
    const room = rooms.get(session.code);
    emitSecretQuestionIfNeeded(room, session.playerId);
    emitIntesaSecretIfNeeded(room, session.playerId);
    if (room && (room.phase === 'FINAL_AWARDS' || room.phase === 'DUO_PORTRAIT')) {
      saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards (identify) failed', e));
      saveGameRecords(gamesToPersist(room)).catch((e) => console.error('[db] saveGameRecords (identify) failed', e));
    }
  });

  socket.on('disconnect', () => {
    const connIp = socketIpById.get(socket.id);
    if (connIp) {
      socketIpById.delete(socket.id);
      const nextCount = (socketsPerIp.get(connIp) ?? 1) - 1;
      if (nextCount <= 0) socketsPerIp.delete(connIp);
      else socketsPerIp.set(connIp, nextCount);
    }
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
  app.use(
    express.static(clientDist, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith(`${path.sep}index.html`) || filePath.endsWith(`${path.sep}sw.js`)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }),
  );
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Safety net for synchronous throws / explicit next(err) in future routes.
// Express 4 async rejections do NOT land here — dbRoute above is the real
// guard for those. The unused-var name keeps the 4-arg signature Express
// requires to recognize an error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Message only, never the inspected object: body-parser attaches the raw
  // request body to its errors as an enumerable prop, so logging the object
  // would let any unauthenticated caller write kilobytes of chosen text
  // (including forged log lines) into the server logs.
  console.error('[api] unhandled route error:', err instanceof Error ? err.message : String(err));
  // body-parser errors carry a meaningful 4xx (400 malformed, 413 too large,
  // 415 bad charset) — a client fault must not surface as a 5xx.
  const maybeStatus = (err as { status?: unknown }).status;
  const status = typeof maybeStatus === 'number' && maybeStatus >= 400 && maybeStatus < 500 ? maybeStatus : 500;
  if (!res.headersSent) res.status(status).json({ error: status < 500 ? 'bad-request' : 'internal' });
});

const PORT = Number(process.env.PORT) || 3001;

// Migrate + restore any rooms persisted before a restart, so a crash mid-party
// doesn't lose the game. Awaited BEFORE the server accepts connections: a
// phone reconnecting in the first instants after boot must find its room
// already rebuilt, not a transient ROOM_NOT_FOUND. A migrate/restore failure
// still lets the server come up DB-less rather than never starting at all.
async function restoreFromSnapshots(): Promise<void> {
  if (!dbEnabled()) {
    console.log('[db] disabled (no DATABASE_URL) — awards will not be saved');
    return;
  }
  try {
    await migrate();
    console.log('[db] migrated');
    const snaps = await loadAllSnapshots();
    let restored = 0;
    for (const { code, json } of snaps) {
      try {
        const room = deserializeRoom(json);
        rooms.restore(room);
        // The reconnect-token table lives only in memory; rehydrate it from
        // the room's own persisted mirror (see Room.tokens) so phones can
        // reclaim their seat instead of joining as a fresh spectator.
        for (const [token, playerId] of room.tokens) tokens.set(token, { code, playerId });
        schedulePhase(code); // re-arm the timer; a past expiry advances immediately
        restored++;
      } catch (e) {
        console.error('[snapshot] restore failed for', code, e);
        // Malformed JSON (truncated write, hand-edited row, …) would otherwise
        // reload and fail identically every restart — drop it so the room is
        // simply gone rather than crash-looping the whole server forever.
        deleteSnapshot(code).catch((e2) => console.error('[snapshot] delete failed', e2));
      }
    }
    if (restored) console.log('[snapshot] restored', restored, 'room(s) from disk');
  } catch (err) {
    console.error('[db] migrate failed', err);
  }
}

// Skip auto-listen under test: integration tests import `httpServer` and call
// listen(0) themselves on an ephemeral port. Vitest sets NODE_ENV=test.
if (process.env.NODE_ENV !== 'test') {
  restoreFromSnapshots().finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
      console.log(
        `[server] AI bot defenses: ${aiDefenseEnabled() ? `on (${process.env.AI_MODEL || 'gemma3:4b'} @ ${process.env.AI_BASE_URL})` : 'off (templated fallback)'}`,
      );
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received — flushing snapshots & shutting down`);
    const forceTimer = setTimeout(() => process.exit(0), 5_000);
    forceTimer.unref();
    try {
      const saves: Promise<void>[] = [];
      for (const code of rooms.activeCodes()) {
        clearPhaseTimer(code);
        const room = rooms.get(code);
        if (room) saves.push(persistSnapshot(code, serializeRoom(room)));
      }
      await Promise.allSettled(saves);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await getPool()?.end().catch(() => {});
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
