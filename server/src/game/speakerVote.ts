// SPEAKER_VOTE domain: the secret "who was most convincing?" vote among this
// round's defenders, operating on a Room. Extracted from RoomStore; RoomStore
// delegates after the room lookup. Type-only imports keep it cycle-free.
import type { Room, SpeakerVoteResult, Defender } from './rooms';

/** Record (or change) a secret vote for the most convincing defender. */
export function voteSpeaker(room: Room, voterId: string, defenderId: string): SpeakerVoteResult {
  if (room.phase !== 'SPEAKER_VOTE') return { ok: false, error: 'NOT_SPEAKER_VOTE_PHASE' };
  if (!room.players.has(voterId)) return { ok: false, error: 'NOT_IN_ROOM' };
  const isDefender = room.defenders.some((d) => d.id === defenderId);
  if (!isDefender || defenderId === voterId) return { ok: false, error: 'INVALID_TARGET' };
  room.speakerVotes.set(voterId, defenderId);
  return { ok: true, room };
}

/** The defenders to choose between during SPEAKER_VOTE; null otherwise. */
export function speakerCandidates(room: Room): Defender[] | null {
  if (room.phase !== 'SPEAKER_VOTE') return null;
  return room.defenders;
}

/** How many players have cast a best-speaker vote this round (aggregate only). */
export function speakerVotedCount(room: Room): number {
  return room.speakerVotes.size;
}

/** True once every connected human has cast a best-speaker vote (ends the phase early). */
export function allSpeakerVoted(room: Room): boolean {
  const humans = [...room.players.values()].filter((p) => !p.isBot && p.connected !== false);
  if (humans.length === 0) return false;
  return humans.every((p) => room.speakerVotes.has(p.id));
}
