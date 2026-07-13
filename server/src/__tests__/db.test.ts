import { describe, it, expect, afterEach } from 'vitest';
import { dbEnabled, getPool, __resetPoolForTests } from '../db';

// Regression guard for the "503 on profile save in dev" bug. db.ts used to snapshot
// process.env.DATABASE_URL at import time, but index.ts loads server/.env AFTER its
// imports run — so the var was read before it existed, the pool stayed null, and
// every DB write 503'd even though DATABASE_URL was correctly set in server/.env.
// The fix resolves the pool LAZILY on first use, so any value present before the
// first query is honored regardless of import-vs-.env ordering.
describe('db pool resolution', () => {
  const original = process.env.DATABASE_URL;

  afterEach(async () => {
    const p = getPool();
    if (p) await p.end(); // a Pool created from a dummy URL never connected; close cleanly
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    __resetPoolForTests();
  });

  it('is disabled when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    __resetPoolForTests();
    expect(dbEnabled()).toBe(false);
    expect(getPool()).toBeNull();
  });

  it('resolves DATABASE_URL lazily at first use, not at import time', () => {
    // Force an early resolve while the var is unset (this is what import-time did).
    delete process.env.DATABASE_URL;
    __resetPoolForTests();
    expect(dbEnabled()).toBe(false);

    // Set it AFTER that resolve — mimicking .env loaded after the import. A lazy
    // pool picks it up at the next use; the old eager snapshot would have ignored it.
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/db';
    __resetPoolForTests();
    expect(dbEnabled()).toBe(true);
    expect(getPool()).not.toBeNull();
  });

  it('configures fail-fast timeouts on the pool', () => {
    // A dead/quota-exhausted DB must surface as an error in seconds, not hang
    // a request until the platform edge kills it (~60s → HTTP 499 in prod).
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/db';
    __resetPoolForTests();
    const pool = getPool();
    expect(pool).not.toBeNull();
    expect(pool!.options.connectionTimeoutMillis).toBe(5000);
    expect(pool!.options.query_timeout).toBe(8000);
  });

  it('registra un listener error sul pool (client idle uccisi dal provider)', () => {
    // Neon/pooler che chiudono un client idle emettono 'error' sul pool: senza
    // listener diventa un uncaughtException invece di una riga di log.
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/db';
    __resetPoolForTests();
    expect(getPool()!.listenerCount('error')).toBe(1);
  });
});
