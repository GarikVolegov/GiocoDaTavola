// Bot voting behaviour, operating on a Room with an injected rng. Extracted from
// RoomStore; coordinators call these on entry to VOTE_1 / VOTE_2. Type-only import
// from rooms.ts keeps it cycle-free.
import type { Room, VoteChoice } from './rooms';
import { tally } from './voteCount';

/** Cast each bot's (random) first vote on entry to VOTE_1. */
export function castBotFirstVotes(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (p.isBot) room.votes.set(p.id, rng() < 0.5 ? 'A' : 'B');
  }
}

/**
 * Apply each bot's VOTE_2 swing based on its persona and the revealed first-vote
 * split (votes1): roccione holds; gregge drifts to the majority; bastian to the
 * minority; indeciso/equilibrato flip with a persona-specific probability. On a
 * tied split, gregge/bastian hold (no clear majority to chase).
 */
export function applyBotSecondVotes(room: Room, rng: () => number): void {
  const t = tally(room.votes1);
  const majority: VoteChoice | null = t.A > t.B ? 'A' : t.B > t.A ? 'B' : null;
  const minority: VoteChoice | null = majority ? (majority === 'A' ? 'B' : 'A') : null;
  for (const p of room.players.values()) {
    if (!p.isBot || !p.persona) continue;
    const current = room.votes.get(p.id);
    if (!current) continue;
    const other: VoteChoice = current === 'A' ? 'B' : 'A';
    let next: VoteChoice = current;
    switch (p.persona) {
      case 'roccione':
        break;
      case 'indeciso':
        next = rng() < 0.7 ? other : current;
        break;
      case 'equilibrato':
        next = rng() < 0.35 ? other : current;
        break;
      case 'gregge':
        if (minority && current === minority) next = majority as VoteChoice;
        break;
      case 'bastian':
        if (majority && current === majority) next = minority as VoteChoice;
        break;
    }
    room.votes.set(p.id, next);
  }
}
