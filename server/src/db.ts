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
  // Profile fields (added later): display name + avatar. Idempotent ALTER so an
  // already-deployed users table picks them up. `avatar` holds a `preset:<id>` or
  // a small raster data-URL (see profile.ts).
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar       text;`);
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
    CREATE TABLE IF NOT EXISTS game_records (
      id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      clerk_user_id  text NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
      game_code      text NOT NULL,
      mode           text NOT NULL,
      nickname       text NOT NULL,
      rounds         int  NOT NULL DEFAULT 0,
      persuasion     int  NOT NULL DEFAULT 0,
      changed_count  int  NOT NULL DEFAULT 0,
      majority_count int  NOT NULL DEFAULT 0,
      awards_count   int  NOT NULL DEFAULT 0,
      player_count   int  NOT NULL DEFAULT 0,
      played_at      timestamptz NOT NULL DEFAULT now()
    );`);
  await pool.query(`CREATE INDEX IF NOT EXISTS game_records_user_idx ON game_records(clerk_user_id, played_at DESC);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS game_records_uniq ON game_records(clerk_user_id, game_code);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_snapshots (
      code       text PRIMARY KEY,
      snapshot   text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
}
