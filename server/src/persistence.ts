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

import { pool, dbEnabled } from './db';

/**
 * Persist award rows: upsert the user, then insert each award idempotently
 * (ON CONFLICT on the natural key). No-op when the DB is disabled or rows empty.
 */
export async function saveAwards(rows: PersistableAward[]): Promise<void> {
  if (!dbEnabled() || !pool || rows.length === 0) return;
  const client = await pool.connect();
  try {
    for (const r of rows) {
      await client.query(
        `INSERT INTO users (clerk_user_id, last_seen) VALUES ($1, now())
         ON CONFLICT (clerk_user_id) DO UPDATE SET last_seen = now()`,
        [r.clerkUserId],
      );
      await client.query(
        `INSERT INTO awards (clerk_user_id, award_id, title, emoji, description, game_code, game_mode, nickname)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (clerk_user_id, award_id, game_code) DO NOTHING`,
        [r.clerkUserId, r.awardId, r.title, r.emoji, r.description, r.gameCode, r.gameMode, r.nickname],
      );
    }
  } finally {
    client.release();
  }
}
