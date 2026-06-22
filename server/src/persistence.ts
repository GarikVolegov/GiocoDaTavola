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

/** One finished-game record per logged-in player, feeding the dashboard's stats
 * and history. Persuasion is the game's persuasion score (duel score in duello). */
export interface PersistableGame {
  clerkUserId: string;
  gameCode: string;
  mode: string;
  nickname: string;
  rounds: number;
  persuasion: number;
  changedCount: number;
  majorityCount: number;
  awardsCount: number;
  playerCount: number;
}

/**
 * Game records to save for a finished room: one per player tagged with a
 * clerkUserId, carrying that player's final stats for the game. Anonymous
 * players are skipped. Pure (mirror of awardsToPersist).
 */
export function gamesToPersist(room: Room): PersistableGame[] {
  // Tally awards won per player so each record can show its 🏆 count.
  const awardsByPlayer = new Map<string, number>();
  for (const a of computeAwards(room)) {
    awardsByPlayer.set(a.winner.id, (awardsByPlayer.get(a.winner.id) ?? 0) + 1);
  }
  const rows: PersistableGame[] = [];
  for (const [id, player] of room.players) {
    if (!player.clerkUserId) continue;
    const stats = room.stats.get(id);
    const persuasion = room.mode === 'duello' ? room.duelScore.get(id) ?? 0 : stats?.persuasion ?? 0;
    rows.push({
      clerkUserId: player.clerkUserId,
      gameCode: room.code,
      mode: room.mode,
      nickname: player.nickname,
      rounds: stats?.rounds ?? 0,
      persuasion,
      changedCount: stats?.changedCount ?? 0,
      majorityCount: stats?.majorityCount ?? 0,
      awardsCount: awardsByPlayer.get(id) ?? 0,
      playerCount: room.players.size,
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

/**
 * Persist per-player game records: upsert the user, then upsert each record on
 * its natural key (clerk_user_id, game_code). Stats are final at FINAL_AWARDS, so
 * DO UPDATE keeps a late player:identify re-save safe. No-op when DB disabled/empty.
 */
export async function saveGameRecords(rows: PersistableGame[]): Promise<void> {
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
        `INSERT INTO game_records
           (clerk_user_id, game_code, mode, nickname, rounds, persuasion, changed_count, majority_count, awards_count, player_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (clerk_user_id, game_code) DO UPDATE SET
           mode = EXCLUDED.mode, nickname = EXCLUDED.nickname, rounds = EXCLUDED.rounds,
           persuasion = EXCLUDED.persuasion, changed_count = EXCLUDED.changed_count,
           majority_count = EXCLUDED.majority_count, awards_count = EXCLUDED.awards_count,
           player_count = EXCLUDED.player_count`,
        [r.clerkUserId, r.gameCode, r.mode, r.nickname, r.rounds, r.persuasion,
         r.changedCount, r.majorityCount, r.awardsCount, r.playerCount],
      );
    }
  } finally {
    client.release();
  }
}
