// Postgres persistence of live-room snapshots for crash recovery. Optional: with
// no DATABASE_URL every function no-ops (mirror of persistence.ts). Stores the
// opaque JSON string from roomSnapshot.serializeRoom — never inspected as votes.
import { getPool } from './db';

// After a persist failure (dead/quota-exhausted DB) pause further attempts for
// a cooldown instead of retrying — and logging a full stack — every 15s tick.
const PERSIST_COOLDOWN_MS = 5 * 60_000;
let pausedUntil = 0;

/** Test-only: close the breaker so each test starts from a clean slate. */
export function __resetSnapshotBreakerForTests(): void {
  pausedUntil = 0;
}

/** Upsert a room's snapshot JSON keyed by room code. No-op when DB disabled.
 *  Never rejects: a failure logs one line and opens the cooldown breaker. */
export async function persistSnapshot(code: string, json: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (Date.now() < pausedUntil) return; // breaker open: recent failure, skip quietly
  try {
    await pool.query(
      `INSERT INTO room_snapshots (code, snapshot, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (code) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
      [code, json],
    );
  } catch (e) {
    // Concurrent writes from the same interval tick all fail together: only
    // the first one of the burst logs, the others just (re)open the breaker.
    const alreadyOpen = Date.now() < pausedUntil;
    pausedUntil = Date.now() + PERSIST_COOLDOWN_MS;
    if (!alreadyOpen) {
      console.error(
        '[snapshot] persist failed — pausing snapshot writes for 5 min:',
        e instanceof Error ? e.message : e,
      );
    }
  }
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
