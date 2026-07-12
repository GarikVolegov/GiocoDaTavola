// Postgres persistence of live-room snapshots for crash recovery. Optional: with
// no DATABASE_URL every function no-ops (mirror of persistence.ts). Stores the
// opaque JSON string from roomSnapshot.serializeRoom — never inspected as votes.
import { getPool } from './db';

/** Upsert a room's snapshot JSON keyed by room code. No-op when DB disabled. */
export async function persistSnapshot(code: string, json: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO room_snapshots (code, snapshot, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (code) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [code, json],
  );
}

/** All persisted snapshots (for boot-time restore). Empty when DB disabled. */
export async function loadAllSnapshots(): Promise<{ code: string; json: string }[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query(`SELECT code, snapshot FROM room_snapshots`);
  return rows.map((r) => ({ code: String(r.code), json: String(r.snapshot) }));
}

/** Drop a room's snapshot (called when the room is reaped). No-op when disabled. */
export async function deleteSnapshot(code: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`DELETE FROM room_snapshots WHERE code = $1`, [code]);
}
