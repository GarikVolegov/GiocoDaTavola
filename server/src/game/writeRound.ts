// "In Altre Parole" (4.2): the write+vote breather round, operating on a Room.
// Everyone writes a short answer to the same prompt (WRITE), then votes
// anonymously for their favorite among the OTHERS' answers (WRITE_VOTE); a
// public reveal (WRITE_REVEAL) shows each answer with its author + vote
// count. Type-only import from rooms.ts keeps this cycle-free (mirrors
// groupMind.ts / knowRound.ts).
import type { Room } from './rooms';

export interface WritePrompt {
  id: string;
  /** The short free-text prompt everyone answers, e.g. "La tua filosofia di vita in uno slogan da maglietta." */
  text: string;
}

/** A small starter bank (vita + business), same spirit as groupMind.ts's questions. */
export const WRITE_PROMPTS: WritePrompt[] = [
  { id: 'wp01', text: 'La tua filosofia di vita in uno slogan da maglietta.' },
  { id: 'wp02', text: "Vendi in una frase l'oggetto più inutile sulla tua scrivania." },
  { id: 'wp03', text: 'Il titolo del film sulla tua vita, se fosse una commedia.' },
  { id: 'wp04', text: 'Un consiglio pessimo che sembra ottimo.' },
  { id: 'wp05', text: 'La scusa perfetta per arrivare tardi a una riunione.' },
  { id: 'wp06', text: 'Descrivi il gruppo di stasera in tre parole.' },
  { id: 'wp07', text: "L'hashtag della tua ultima settimana di lavoro." },
  { id: 'wp08', text: "Il nome di un'azienda che vende esattamente niente." },
  { id: 'wp09', text: 'La regola non scritta più importante di questo gruppo.' },
  { id: 'wp10', text: "Un motto per l'ufficio scritto malissimo apposta." },
];

/** Generic filler answers a bot writes when it's its turn (Fase B, no LLM needed here). */
const BOT_WRITE_FILLERS = [
  '42.',
  'Dipende dal giorno.',
  'Chiedete al gruppo Whatsapp.',
  'Non lo so, improvviso.',
  'La prima cosa che mi è venuta in mente.',
  'Boh, sembrava una buona idea.',
];

export function pickWritePrompt(usedIds: Set<string>, rng: () => number): WritePrompt | null {
  const pool = WRITE_PROMPTS.filter((p) => !usedIds.has(p.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}

/** Cast each bot's filler answer immediately on WRITE entry. */
export function castBotWrite(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    room.writeAnswers.set(p.id, BOT_WRITE_FILLERS[Math.floor(rng() * BOT_WRITE_FILLERS.length)]);
  }
}

export type WriteSubmitError = 'ROOM_NOT_FOUND' | 'NOT_WRITE_PHASE' | 'NOT_IN_ROOM' | 'EMPTY' | 'TOO_LONG';
export type WriteSubmitResult = { ok: true; room: Room } | { ok: false; error: WriteSubmitError };

const WRITE_ANSWER_MAX = 120;

/** Record (or change) a player's own written answer during WRITE. */
export function submitWrite(room: Room, playerId: string, text: string): WriteSubmitResult {
  if (room.phase !== 'WRITE') return { ok: false, error: 'NOT_WRITE_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  if (trimmed.length > WRITE_ANSWER_MAX) return { ok: false, error: 'TOO_LONG' };
  room.writeAnswers.set(playerId, trimmed);
  return { ok: true, room };
}

function presentWriters(room: Room) {
  return [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
}

export function writePhaseComplete(room: Room): boolean {
  const present = presentWriters(room);
  if (present.length === 0) return false;
  return present.every((p) => room.writeAnswers.has(p.id));
}

export function writeProgress(room: Room): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'WRITE') return null;
  const present = presentWriters(room);
  const missing = present.filter((p) => !room.writeAnswers.has(p.id));
  return { done: present.length - missing.length, total: present.length, missingNicknames: missing.map((p) => p.nickname) };
}

/** Force an empty-ish placeholder for anyone still missing an answer once forced through. */
export function applyWriteDefaults(room: Room): void {
  if (room.phase !== 'WRITE') return;
  for (const p of presentWriters(room)) {
    if (!room.writeAnswers.has(p.id)) room.writeAnswers.set(p.id, '(nessuna risposta)');
  }
}

/** Freeze this round's shuffled voting order (a Fisher–Yates over everyone who
 * wrote) once WRITE ends — the anonymized public list walks this fixed order,
 * so it doesn't reshuffle on every payload build. */
export function freezeWriteOrder(room: Room, rng: () => number): void {
  const ids = [...room.writeAnswers.keys()];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  room.writeOrder = ids;
}

export interface PublicWrittenAnswer {
  id: string;
  text: string;
}

/**
 * The answer's opaque per-round token: its position in the frozen shuffled
 * `writeOrder`, NOT the author's real player id. The roster (`lobby:update`)
 * already sends every id+nickname to everyone, so exposing the real id here
 * would let a client cross-reference and de-anonymize an answer before the
 * vote even closes. The token means nothing outside this one round's ballot.
 */
function tokenFor(room: Room, authorId: string): string {
  return String(room.writeOrder.indexOf(authorId));
}

/** Resolve a client-submitted token back to the real author id, or undefined
 * for a stale/invalid token (out of range, or the round already moved on). */
function authorForToken(room: Room, token: string): string | undefined {
  const i = Number(token);
  return Number.isInteger(i) ? room.writeOrder[i] : undefined;
}

/**
 * The anonymized answer list, in the round's frozen shuffled order — same
 * for everyone (broadcastable). Gated to WRITE_VOTE.
 */
export function publicWrittenAnswers(room: Room): PublicWrittenAnswer[] | null {
  if (room.phase !== 'WRITE_VOTE') return null;
  return room.writeOrder.map((id) => ({ id: tokenFor(room, id), text: room.writeAnswers.get(id) ?? '' }));
}

/** This player's own answer token this round (so the client can filter its
 * own entry out of the vote list without ever seeing another author's real
 * id). Null if they didn't write one, or outside WRITE_VOTE. */
export function myWrittenAnswerToken(room: Room, playerId: string): string | null {
  if (room.phase !== 'WRITE_VOTE' || !room.writeAnswers.has(playerId)) return null;
  return tokenFor(room, playerId);
}

/** Cast each bot's vote (random, never for itself) immediately on WRITE_VOTE entry. */
export function castBotWriteVote(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    const choices = room.writeOrder.filter((id) => id !== p.id);
    if (choices.length === 0) continue;
    room.writeVotes.set(p.id, choices[Math.floor(rng() * choices.length)]);
  }
}

export type WriteVoteError = 'ROOM_NOT_FOUND' | 'NOT_WRITE_VOTE_PHASE' | 'NOT_IN_ROOM' | 'SELF_VOTE' | 'INVALID_TARGET';
export type WriteVoteResult = { ok: true; room: Room } | { ok: false; error: WriteVoteError };

/** Record (or change) a player's secret vote for their favorite answer (never
 * their own). `votedForToken` is the opaque per-round token from
 * publicWrittenAnswers/myWrittenAnswerToken, resolved here to the real author. */
export function writeVote(room: Room, voterId: string, votedForToken: string): WriteVoteResult {
  if (room.phase !== 'WRITE_VOTE') return { ok: false, error: 'NOT_WRITE_VOTE_PHASE' };
  if (!room.players.has(voterId)) return { ok: false, error: 'NOT_IN_ROOM' };
  const votedForId = authorForToken(room, votedForToken);
  if (!votedForId || !room.writeAnswers.has(votedForId)) return { ok: false, error: 'INVALID_TARGET' };
  if (voterId === votedForId) return { ok: false, error: 'SELF_VOTE' };
  room.writeVotes.set(voterId, votedForId);
  return { ok: true, room };
}

export function writeVotePhaseComplete(room: Room): boolean {
  const present = presentWriters(room);
  if (present.length === 0) return false;
  // Someone who wrote but has no valid target (degenerate: only their own
  // answer exists) is vacuously done — nothing they could vote for anyway.
  return present.every((p) => {
    const choices = room.writeOrder.filter((id) => id !== p.id);
    return choices.length === 0 || room.writeVotes.has(p.id);
  });
}

export function writeVoteProgress(room: Room): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'WRITE_VOTE') return null;
  const present = presentWriters(room).filter((p) => room.writeOrder.filter((id) => id !== p.id).length > 0);
  const missing = present.filter((p) => !room.writeVotes.has(p.id));
  return { done: present.length - missing.length, total: present.length, missingNicknames: missing.map((p) => p.nickname) };
}

/** Force no default vote for stragglers (an abstention is fine — unlike a
 * dilemma vote, nothing downstream requires every voter to have picked). */

export interface WriteRevealAnswer {
  id: string;
  text: string;
  authorNickname: string;
  votes: number;
}

/** Each answer with its author + vote count, gated to WRITE_REVEAL. Individual
 * ballots (who voted for what) never leave the server — aggregate counts only. */
export function writeRevealResults(room: Room): WriteRevealAnswer[] | null {
  if (room.phase !== 'WRITE_REVEAL') return null;
  const counts = new Map<string, number>();
  for (const votedForId of room.writeVotes.values()) counts.set(votedForId, (counts.get(votedForId) ?? 0) + 1);
  return room.writeOrder.map((id) => ({
    id,
    text: room.writeAnswers.get(id) ?? '',
    authorNickname: room.players.get(id)?.nickname ?? '',
    votes: counts.get(id) ?? 0,
  }));
}
