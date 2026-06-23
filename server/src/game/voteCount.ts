// Foundational vote-counting helpers shared by RoomStore and the per-domain
// modules (predictions, swing bets, …). Pure; type-only imports keep it cycle-free.
import type { VoteChoice, VoteTally, SwingBet } from './rooms';

/** Narrow an arbitrary string to a valid A/B vote choice. */
export function isVoteChoice(c: string): c is VoteChoice {
  return c === 'A' || c === 'B';
}

/** Narrow an arbitrary string to a valid swing bet. */
export function isSwingBet(b: string): b is SwingBet {
  return b === 'ribalta' || b === 'regge';
}

/** Aggregate A vs B counts for a set of votes (no identities). */
export function tally(votes: Map<string, VoteChoice>): VoteTally {
  const t: VoteTally = { A: 0, B: 0 };
  for (const choice of votes.values()) t[choice]++;
  return t;
}
