// Postgres access (Railway). Optional: with no DATABASE_URL the pool is null and
// every caller no-ops, so the game runs DB-less (accounts are optional).
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
export const pool: Pool | null = url ? new Pool({ connectionString: url }) : null;

export function dbEnabled(): boolean {
  return pool !== null;
}

/** Create tables/indexes if missing. No-op when the DB is disabled. Idempotent. */
export async function migrate(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      clerk_user_id text PRIMARY KEY,
      created_at    timestamptz NOT NULL DEFAULT now(),
      last_seen     timestamptz NOT NULL DEFAULT now()
    );`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS awards (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      clerk_user_id text NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
      award_id      text NOT NULL,
      title         text NOT NULL,
      emoji         text NOT NULL,
      description   text NOT NULL,
      game_code     text NOT NULL,
      game_mode     text NOT NULL,
      nickname      text NOT NULL,
      won_at        timestamptz NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS awards_user_idx ON awards(clerk_user_id, won_at DESC);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS awards_uniq ON awards(clerk_user_id, award_id, game_code);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_snapshots (
      code       text PRIMARY KEY,
      snapshot   text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
}
