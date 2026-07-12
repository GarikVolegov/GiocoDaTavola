// Postgres access (Railway). Optional: with no DATABASE_URL the pool is null and
// every caller no-ops, so the game runs DB-less (accounts are optional).
import { Pool } from 'pg';

// Resolve the pool LAZILY (memoized), not at import time. index.ts loads
// server/.env *after* its imports run, so a top-level `const pool =
// process.env.DATABASE_URL ? …` would snapshot the var before the .env file
// populates it — leaving the DB wrongly disabled in dev (503 on profile save).
// Reading at first use sidesteps the import-vs-.env ordering entirely.
let resolved = false;
let _pool: Pool | null = null;

/** The shared pool, or null when DB-less. Resolved on first call from the env. */
export function getPool(): Pool | null {
  if (!resolved) {
    const url = process.env.DATABASE_URL;
    _pool = url ? new Pool({ connectionString: url }) : null;
    resolved = true;
  }
  return _pool;
}

export function dbEnabled(): boolean {
  return getPool() !== null;
}

/** Test-only: forget the memoized pool so a test can re-resolve from a changed env. */
export function __resetPoolForTests(): void {
  resolved = false;
  _pool = null;
}

/** Create tables/indexes if missing. No-op when the DB is disabled. Idempotent. */
export async function migrate(): Promise<void> {
  const pool = getPool();
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
