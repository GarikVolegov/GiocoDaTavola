// Deriving award rows to persist (pure) lives here alongside the DB write
// (added in Task 2). Pure first so it stays unit-testable without a database.

import { computeAwards } from './game/awards';
import type { Room } from './game/rooms';

export interface PersistableAward {
  clerkUserId: string;
  awardId: string;
  title: string;
  emoji: string;
  description: string;
  gameCode: string;
  gameMode: string;
  nickname: string;
}

/**
 * Award rows to save for a finished room: one per computed award whose winner is
 * a player tagged with a clerkUserId. Anonymous winners are skipped. Pure.
 */
export function awardsToPersist(room: Room): PersistableAward[] {
  const rows: PersistableAward[] = [];
  for (const a of computeAwards(room)) {
    const player = room.players.get(a.winner.id);
    if (!player?.clerkUserId) continue;
    rows.push({
      clerkUserId: player.clerkUserId,
      awardId: a.id,
      title: a.title,
      emoji: a.emoji,
      description: a.description,
      gameCode: room.code,
      gameMode: room.mode,
      nickname: player.nickname,
    });
  }
  return rows;
}
