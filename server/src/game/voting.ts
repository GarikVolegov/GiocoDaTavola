// Core voting domain: the secret A/B vote, the VOTE_2 confirmation, the aggregate
// tally/split, and the swing computation. Operates on a Room; RoomStore delegates
// after the room lookup. Type-only imports from rooms.ts keep it cycle-free; vote
// counting comes from voteCount, phase predicates from phases.
import type { Room, VoteResult, VoteTally, SwingResult, PublicSwing, DefenseImpact } from './rooms';
import { tally, isVoteChoice } from './voteCount';
import { isVotingPhase, isSplitRevealed } from './phases';

export type ConfirmVoteResult =
  | { ok: true; room: Room }
  | { ok: false; error: 'NOT_VOTE2_PHASE' | 'NOT_IN_ROOM' };

/** Cast (or change) a player's secret A/B vote during a voting phase. */
export function vote(room: Room, playerId: string, choice: string): VoteResult {
  if (!isVotingPhase(room.phase)) return { ok: false, error: 'NOT_VOTING_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!isVoteChoice(choice)) return { ok: false, error: 'INVALID_CHOICE' };
  room.votes.set(playerId, choice);
  // Casting/changing during VOTE_2 is itself a confirmation.
  if (room.phase === 'VOTE_2') room.confirmedVote2.add(playerId);
  return { ok: true, room };
}

/** How many connected players have cast a vote this round (aggregate only). */
export function voteCount(room: Room): number {
  return room.votes.size;
}

/** Aggregate A vs B tally for the current round (no identities). */
export function voteTally(room: Room): VoteTally {
  return tally(room.votes);
}

/**
 * Compare the second vote (VOTE_2, the live `votes`) against the first (the
 * `votes1` snapshot): the two aggregate tallies, how many voters changed side,
 * and the net swing toward each side. Counts only — individual votes never leave.
 */
export function computeSwing(room: Room): SwingResult {
  const first = tally(room.votes1);
  const second = tally(room.votes);
  let switched = 0;
  for (const [id, firstChoice] of room.votes1) {
    const secondChoice = room.votes.get(id);
    if (secondChoice && secondChoice !== firstChoice) switched++;
  }
  return {
    first,
    second,
    switched,
    netSwing: { A: second.A - first.A, B: second.B - first.B },
  };
}

/**
 * Public results view, only during PHASE_RESULTS (null otherwise): the swing plus,
 * for each defender whose side gained votes, how many votes moved their way.
 */
export function publicSwing(room: Room): PublicSwing | null {
  if (room.phase !== 'PHASE_RESULTS') return null;
  const swing = computeSwing(room);
  const attribution: DefenseImpact[] = [];
  for (const d of room.defenders) {
    const gained = swing.netSwing[d.side];
    if (gained > 0) attribution.push({ defender: d, votes: gained });
  }
  return { ...swing, attribution };
}

/** The aggregate A/B split, only when the phase reveals it (SPLIT_REVEAL); else null. */
export function publicSplit(room: Room): { A: number; B: number } | null {
  if (!isSplitRevealed(room.phase)) return null;
  return tally(room.votes);
}

/** True once every connected player has voted (ends VOTE_1 early). */
export function allVoted(room: Room): boolean {
  const present = [...room.players.values()].filter((p) => p.connected !== false);
  if (present.length === 0) return false;
  return present.every((p) => room.votes.has(p.id));
}

/** Mark a player's (pre-filled) second vote as explicitly confirmed. VOTE_2 only. */
export function confirmVote(room: Room, playerId: string): ConfirmVoteResult {
  if (room.phase !== 'VOTE_2') return { ok: false, error: 'NOT_VOTE2_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  room.confirmedVote2.add(playerId);
  return { ok: true, room };
}

/** How many players have confirmed their second vote this round (aggregate only). */
export function confirmedCount(room: Room): number {
  return room.confirmedVote2.size;
}

/** True once every connected player has confirmed their second vote (ends VOTE_2 early). */
export function allConfirmed(room: Room): boolean {
  const present = [...room.players.values()].filter((p) => p.connected !== false);
  if (present.length === 0) return false;
  return present.every((p) => room.confirmedVote2.has(p.id));
}
