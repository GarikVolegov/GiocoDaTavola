import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { AddressInfo } from 'net';
import { inspect } from 'util';

// The /api/me/* routes must answer FAST with 503 when Postgres is unreachable
// (quota-exhausted Neon, network partition, …). Express 4 does not forward an
// async handler's rejection: without a guard the request would never get a
// response and the platform edge kills it after ~60s (observed as HTTP 499 in
// production). These tests boot the real app with a DB whose every query
// rejects and assert each route replies quickly with a clean JSON error.

vi.mock('../clerk', () => ({
  verifyClerkToken: async (token?: string) => (token === 'tok-valid' ? 'user_test_1' : null),
}));

// Every consumer of ./db (index.ts, profile.ts, persistence.ts, snapshotStore.ts)
// must see the same failing pool, so all four exports are provided.
vi.mock('../db', () => {
  const query = () => Promise.reject(new Error('exceeded the compute time quota'));
  return {
    getPool: () => ({ query }) as unknown as import('pg').Pool,
    dbEnabled: () => true,
    migrate: () => Promise.reject(new Error('exceeded the compute time quota')),
    __resetPoolForTests: () => {},
  };
});

import { httpServer } from '../index';

let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  base = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

const AUTH = { authorization: 'Bearer tok-valid' };

/** GET/PUT and assert: 503 {error:'db-unavailable'} well before any edge timeout. */
async function expectFast503(path: string, init: RequestInit = {}): Promise<void> {
  const started = Date.now();
  const res = await fetch(`${base}${path}`, { headers: AUTH, ...init });
  expect(Date.now() - started).toBeLessThan(2000);
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: 'db-unavailable' });
}

describe('/api/me/* con DB irraggiungibile (ogni query rejecta)', () => {
  it('GET /api/me/awards → 503 db-unavailable, veloce', async () => {
    await expectFast503('/api/me/awards');
  });

  it('GET /api/me/dashboard → 503 veloce (Promise.all di 5 query che rejectano)', async () => {
    await expectFast503('/api/me/dashboard');
  });

  it('GET /api/me/profile → 503 veloce (loadProfile throwa)', async () => {
    await expectFast503('/api/me/profile');
  });

  it('PUT /api/me/profile con body valido → 503 veloce (saveProfile throwa)', async () => {
    await expectFast503('/api/me/profile', {
      method: 'PUT',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ann', avatar: null }),
    });
  });

  it("l'auth viene prima del DB: senza token → 401 anche con DB giù", async () => {
    const res = await fetch(`${base}/api/me/profile`);
    expect(res.status).toBe(401);
  });

  it("GET /api/health resta 200 e riporta db:'down'", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: 'down' });
  });
});

// Gli errori di body-parser arrivano al middleware finale PRIMA di ogni route
// e senza auth: devono restare errori client (4xx) e non finire nei log col
// body raw (vettore di log-forging non autenticato).
describe('errori body-parser → middleware finale', () => {
  it('JSON malformato → 400 bad-request, non 500', async () => {
    const res = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: `${'A'.repeat(2000)}SENTINEL_END`,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad-request' });
  });

  it('il body raw NON finisce nei log del server', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await fetch(`${base}/api/me/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: `{"x": ${'B'.repeat(2000)}SENTINEL_LOG_END`,
      });
      // Formatta come farebbe console.error (util.inspect mostra le proprietà
      // enumerabili — è lì che body-parser appende il body raw all'errore).
      const logged = spy.mock.calls.map((call) => call.map((a) => inspect(a)).join(' ')).join('\n');
      expect(logged).not.toContain('SENTINEL_LOG_END');
    } finally {
      spy.mockRestore();
    }
  });
});
