# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only admin dashboard at `/admin` that monitors live rooms, connected players, server/system health, and persisted game stats.

**Architecture:** Four `GET /api/admin/*` endpoints behind a Clerk-allowlist middleware (`requireAdmin`). Live room data comes from a new sanitized read-only snapshot method on `RoomStore` (never exposes secret votes). The client polls every 4s with the Clerk Bearer token and renders three panels (System / Live rooms / History).

**Tech Stack:** Node + Express + Socket.IO (TypeScript CommonJS, server), React + Vite (TypeScript ESM, client), Clerk auth, Postgres (optional), Vitest + @testing-library/react.

## Global Constraints

- **Votes are secret** — individual votes/guesses/roles must NEVER leave the server. Sanitization is server-side via an explicit field allowlist. (Project rule.)
- **Server is CJS, client is ESM** — keep the two module systems separate; do not import server code into the client. (Project rule.)
- **No `any`** — it is a lint error. Prefix intentionally-unused vars/args with `_`. (Project rule.)
- **Timers are server-side** — send `phaseExpiresAt` (epoch ms); the client renders the countdown. (Project rule.)
- **Read env lazily** — read `process.env` *inside* functions, never at module top-level. (Lesson: server-env-read-lazily.)
- **Gate green before every commit** — from repo root: `npm run typecheck && npm run lint && npm test && npm run build` must ALL pass. (Project rule.)
- **Tests run from repo root** with `npm test` (a single `vitest run` covering both workspaces). Client/JSX tests start with `// @vitest-environment jsdom` and use `@testing-library/react`. Server tests need no environment pragma.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `server/src/adminAuth.ts` | Create | `isAdminUser(userId)` pure predicate + `requireAdmin` Express middleware |
| `server/src/__tests__/adminAuth.test.ts` | Create | Unit tests for the above |
| `server/src/game/rooms.ts` | Modify | Add `AdminPlayerSummary`/`AdminRoomSummary` types + `adminRoomSummaries()` method on `RoomStore` |
| `server/src/game/__tests__/rooms.test.ts` | Modify | Add tests: summary shape + anti-leak assertion |
| `server/src/index.ts` | Modify | Wire 4 `GET /api/admin/*` endpoints behind `requireAdmin` |
| `server/src/__tests__/adminApi.test.ts` | Create | HTTP smoke: endpoints return 401 without a valid admin token |
| `server/.env.example` | Modify | Document `ADMIN_USER_IDS` |
| `client/src/admin/types.ts` | Create | Client-side DTO types mirroring the admin API responses |
| `client/src/admin/useAdminPoll.ts` | Create | Hook: poll the 3 data endpoints every 4s with the Clerk token |
| `client/src/admin/AdminApp.tsx` | Create | Page: whoami gate + 3 panels |
| `client/src/admin/AdminApp.module.css` | Create | Styling using existing design tokens |
| `client/src/admin/AdminApp.test.tsx` | Create | Render test: access-denied gate |
| `client/src/App.tsx` | Modify | Add lazy `/admin` route |

---

### Task 1: Admin auth (allowlist + middleware)

**Files:**
- Create: `server/src/adminAuth.ts`
- Test: `server/src/__tests__/adminAuth.test.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: `verifyClerkToken(token: string | undefined): Promise<string | null>` from `./clerk`.
- Produces:
  - `isAdminUser(userId: string | null | undefined): boolean`
  - `requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void>` — Express middleware; on success sets `(req as AdminRequest).adminUserId` and calls `next()`.
  - `type AdminRequest = Request & { adminUserId?: string }`

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/adminAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { isAdminUser, requireAdmin } from '../adminAuth';

vi.mock('../clerk', () => ({
  verifyClerkToken: vi.fn(),
}));
import { verifyClerkToken } from '../clerk';
const mockedVerify = vi.mocked(verifyClerkToken);

describe('isAdminUser', () => {
  const OLD = process.env.ADMIN_USER_IDS;
  afterEach(() => {
    process.env.ADMIN_USER_IDS = OLD;
  });

  it('is false when the allowlist is empty/unset', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdminUser('user_1')).toBe(false);
  });

  it('is true for an id in the comma list (whitespace tolerant)', () => {
    process.env.ADMIN_USER_IDS = ' user_1 , user_2 ';
    expect(isAdminUser('user_2')).toBe(true);
  });

  it('is false for an id not in the list, and for null', () => {
    process.env.ADMIN_USER_IDS = 'user_1';
    expect(isAdminUser('user_9')).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('requireAdmin', () => {
  beforeEach(() => {
    mockedVerify.mockReset();
    process.env.ADMIN_USER_IDS = 'admin_1';
  });

  it('401s when there is no Bearer token', async () => {
    const req = { header: () => '' } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s when the token is valid but the user is not an admin', async () => {
    mockedVerify.mockResolvedValue('not_admin');
    const req = { header: () => 'Bearer good' } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and stamps adminUserId for an allowlisted admin', async () => {
    mockedVerify.mockResolvedValue('admin_1');
    const req = { header: () => 'Bearer good' } as unknown as Request & { adminUserId?: string };
    const res = mockRes();
    const next = vi.fn();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.adminUserId).toBe('admin_1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- adminAuth`
Expected: FAIL — "Cannot find module '../adminAuth'" (or `isAdminUser is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `server/src/adminAuth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { verifyClerkToken } from './clerk';

export type AdminRequest = Request & { adminUserId?: string };

// Comma-separated Clerk user ids allowed into /api/admin/*. Read lazily so the
// value is picked up after server/.env loads (and so tests can set it per-case).
// Empty/unset => nobody is admin (fail-safe).
function adminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminIds().has(userId);
}

// Express guard for every admin endpoint: verify the Clerk Bearer token, then
// require allowlist membership. 401 = not authenticated, 403 = authenticated but
// not an admin. On success, stamps req.adminUserId and continues.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!isAdminUser(userId)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  (req as AdminRequest).adminUserId = userId;
  next();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- adminAuth`
Expected: PASS (6 tests).

- [ ] **Step 5: Document the env var**

Add to `server/.env.example` (append a new line; keep existing lines intact):

```bash
# Comma-separated Clerk user ids allowed into the /admin dashboard. Empty = nobody.
ADMIN_USER_IDS=
```

- [ ] **Step 6: Commit**

```bash
git add server/src/adminAuth.ts server/src/__tests__/adminAuth.test.ts server/.env.example
git commit -m "feat(admin): Clerk-allowlist requireAdmin middleware"
```

---

### Task 2: Sanitized room summaries on RoomStore

**Files:**
- Modify: `server/src/game/rooms.ts` (add types near the other exported types; add method inside `class RoomStore`, e.g. after the `get size()` getter around line 1899)
- Test: `server/src/game/__tests__/rooms.test.ts` (append a new `describe`)

**Interfaces:**
- Consumes: the existing `Room`/`Player` interfaces and `this.rooms`/`this.activeCodes()` in `RoomStore`.
- Produces:
  - `interface AdminPlayerSummary { nickname: string; isBot: boolean; connected: boolean }`
  - `interface AdminRoomSummary { code: string; format: 'classic' | 'percorso' | 'storia'; mode: GameMode; phase: GamePhase; dilemmaIndex: number; dilemmaCount: number | null; humanCount: number; botCount: number; createdAt: number; phaseExpiresAt: number | null; players: AdminPlayerSummary[] }`
  - `RoomStore.adminRoomSummaries(): AdminRoomSummary[]`

- [ ] **Step 1: Write the failing test**

Append to `server/src/game/__tests__/rooms.test.ts` (reuse the file's existing `RoomStore`/`createRoom`/`join` imports and helpers; the snippet below assumes `RoomStore` is already imported there — add it to the import if missing):

```typescript
describe('adminRoomSummaries', () => {
  it('summarizes an active room with human/bot counts and connection state', () => {
    const store = new RoomStore();
    const { code } = store.createRoom();
    const a = store.join(code, 'Anna');
    const b = store.join(code, 'Bea');
    expect(a.ok && b.ok).toBe(true);

    const summaries = store.adminRoomSummaries();
    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.code).toBe(code);
    expect(s.humanCount).toBe(2);
    expect(s.botCount).toBe(0);
    expect(s.players.map((p) => p.nickname).sort()).toEqual(['Anna', 'Bea']);
    expect(s.players.every((p) => p.connected)).toBe(true);
    expect(s.phase).toBe('LOBBY');
  });

  it('NEVER leaks secret per-player state', () => {
    const store = new RoomStore();
    const { code } = store.createRoom();
    store.join(code, 'Anna');
    const json = JSON.stringify(store.adminRoomSummaries());
    for (const secret of ['votes', 'votes1', 'confirmedVote2', 'knowGuesses', 'knowTargets', 'infiltratorId', 'accusations', 'predictions', 'swingBets']) {
      expect(json).not.toContain(secret);
    }
  });
});
```

> If `createRoom`/`join`'s exact signatures differ in this file, mirror whatever the existing tests in `rooms.test.ts` already use to create a room and add players — do not invent a new API.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rooms`
Expected: FAIL — `store.adminRoomSummaries is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add the types near the other exported `Admin`-free types in `rooms.ts` (e.g. just below the `Player` interface):

```typescript
/** A player as shown on the admin dashboard. Public, aggregate-safe fields only. */
export interface AdminPlayerSummary {
  nickname: string;
  isBot: boolean;
  connected: boolean;
}

/** A live room as shown on the admin dashboard. Built by an explicit field
 * allowlist in RoomStore.adminRoomSummaries — secret vote state never appears. */
export interface AdminRoomSummary {
  code: string;
  format: 'classic' | 'percorso' | 'storia';
  mode: GameMode;
  phase: GamePhase;
  dilemmaIndex: number;
  dilemmaCount: number | null;
  humanCount: number;
  botCount: number;
  createdAt: number;
  phaseExpiresAt: number | null;
  players: AdminPlayerSummary[];
}
```

Add the method inside `class RoomStore` (e.g. right after `get size()`):

```typescript
  // Read-only, sanitized snapshot of every live room for the admin dashboard.
  // Built field-by-field (allowlist) so NO secret vote state can ever leak —
  // do not be tempted to spread a Room here.
  adminRoomSummaries(): AdminRoomSummary[] {
    const out: AdminRoomSummary[] = [];
    for (const code of this.activeCodes()) {
      const room = this.rooms.get(code);
      if (!room) continue;
      const players = [...room.players.values()];
      out.push({
        code: room.code,
        format: room.format,
        mode: room.mode,
        phase: room.phase,
        dilemmaIndex: room.dilemmaIndex,
        dilemmaCount: room.dilemmaCount,
        humanCount: players.filter((p) => !p.isBot).length,
        botCount: players.filter((p) => p.isBot).length,
        createdAt: room.createdAt,
        phaseExpiresAt: room.phaseExpiresAt,
        players: players.map((p) => ({
          nickname: p.nickname,
          isBot: p.isBot === true,
          connected: p.connected !== false,
        })),
      });
    }
    return out;
  }
```

> `room.mode` is the `GameMode` field on `Room`. If the field has a different name in this codebase (verify against the `Room` interface), use the actual name — the summary's `mode` must reflect gruppo/duello.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rooms`
Expected: PASS (including the two new tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(admin): sanitized adminRoomSummaries on RoomStore"
```

---

### Task 3: Wire the 4 admin endpoints

**Files:**
- Modify: `server/src/index.ts` (add imports + endpoints; place the routes next to the other `app.get('/api/...')` handlers, e.g. after the `/api/health` block around line 351)
- Test: `server/src/__tests__/adminApi.test.ts` (Create)

**Interfaces:**
- Consumes: `requireAdmin` from `./adminAuth`; `rooms.adminRoomSummaries()`, `rooms.size`; `io.engine.clientsCount`; `sessions`, `graceTimers` (already in scope in index.ts); `getPool()` from `./db`; `aiDefenseEnabled()` from `./game/aiDefense`.
- Produces: HTTP endpoints `GET /api/admin/whoami`, `/api/admin/overview`, `/api/admin/rooms`, `/api/admin/stats`.

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/adminApi.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { httpServer } from '../index';

let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  base = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('admin API auth', () => {
  it('401s the data endpoints without a Bearer token', async () => {
    for (const path of ['/api/admin/overview', '/api/admin/rooms', '/api/admin/stats']) {
      const res = await fetch(base + path);
      expect(res.status).toBe(401);
    }
  });

  it('whoami returns { isAdmin: false } without a token (no 401)', async () => {
    const res = await fetch(base + '/api/admin/whoami');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isAdmin: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- adminApi`
Expected: FAIL — endpoints 404 (not wired yet), so `expect(res.status).toBe(401)` fails with 404.

- [ ] **Step 3: Write minimal implementation**

In `server/src/index.ts`, add to the imports at the top:

```typescript
import { requireAdmin, isAdminUser } from './adminAuth';
```

Then add the endpoints (after the `/api/health` handler):

```typescript
// --- Admin dashboard (read-only) -------------------------------------------
// whoami is intentionally NOT behind requireAdmin: it returns {isAdmin:false}
// for anonymous/non-admin callers so the client can render "access denied"
// without a 401. All DATA endpoints below are gated by requireAdmin.
app.get('/api/admin/whoami', async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  res.json({ isAdmin: isAdminUser(userId) });
});

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const mem = process.memoryUsage();
  let db: 'disabled' | 'ok' | 'down' = 'disabled';
  const pool = getPool();
  if (pool) {
    try {
      await pool.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
  }
  res.json({
    now: Date.now(),
    uptimeSec: Math.round(process.uptime()),
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    },
    db,
    counts: {
      rooms: rooms.size,
      socketsConnected: io.engine.clientsCount,
      sessions: sessions.size,
      reconnecting: graceTimers.size,
    },
    config: {
      aiDefense: aiDefenseEnabled(),
      clerk: Boolean(process.env.CLERK_SECRET_KEY),
      dbConfigured: pool !== null,
    },
  });
});

app.get('/api/admin/rooms', requireAdmin, (_req, res) => {
  res.json({ rooms: rooms.adminRoomSummaries() });
});

app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const pool = getPool();
  if (!pool) {
    res.json({ enabled: false });
    return;
  }
  const games = await pool.query(
    `SELECT game_code, mode, MAX(player_count) AS pc, MAX(rounds) AS rounds, MAX(played_at) AS played_at
       FROM game_records GROUP BY game_code, mode`,
  );
  const awards = await pool.query(`SELECT COUNT(*)::int AS n FROM awards`);
  const byMode: Record<string, number> = {};
  let playerSum = 0;
  for (const r of games.rows) {
    byMode[r.mode] = (byMode[r.mode] ?? 0) + 1;
    playerSum += Number(r.pc);
  }
  const totalGames = games.rows.length;
  const recent = [...games.rows]
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .slice(0, 10)
    .map((r) => ({
      gameCode: r.game_code,
      mode: r.mode,
      playerCount: Number(r.pc),
      rounds: Number(r.rounds),
      playedAt: new Date(r.played_at).getTime(),
    }));
  res.json({
    enabled: true,
    totals: {
      games: totalGames,
      awards: awards.rows[0]?.n ?? 0,
      avgPlayers: totalGames ? Math.round((playerSum / totalGames) * 10) / 10 : 0,
    },
    byMode,
    recentGames: recent,
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- adminApi`
Expected: PASS (2 tests). The DB-backed `/stats` is not exercised here (test runs DB-less); the 401 path doesn't reach it.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts server/src/__tests__/adminApi.test.ts
git commit -m "feat(admin): /api/admin overview, rooms, stats, whoami endpoints"
```

---

### Task 4: Client polling hook + types

**Files:**
- Create: `client/src/admin/types.ts`
- Create: `client/src/admin/useAdminPoll.ts`

**Interfaces:**
- Consumes: `useAuth().getToken` from `@clerk/react`; the admin API JSON shapes.
- Produces:
  - `client/src/admin/types.ts` exporting `AdminOverview`, `AdminRoomSummary`, `AdminPlayerSummary`, `AdminStats`, `AdminData`.
  - `useAdminPoll(): { data: AdminData; loading: boolean; error: string | null }` where `AdminData = { overview: AdminOverview | null; rooms: AdminRoomSummary[]; stats: AdminStats | null }`.

- [ ] **Step 1: Write the types**

Create `client/src/admin/types.ts`:

```typescript
// Client-side mirrors of the /api/admin/* JSON. Kept in the client tree (ESM)
// — the server (CJS) owns the source-of-truth shapes; these must stay in sync.

export interface AdminPlayerSummary {
  nickname: string;
  isBot: boolean;
  connected: boolean;
}

export interface AdminRoomSummary {
  code: string;
  format: 'classic' | 'percorso' | 'storia';
  mode: 'gruppo' | 'duello';
  phase: string;
  dilemmaIndex: number;
  dilemmaCount: number | null;
  humanCount: number;
  botCount: number;
  createdAt: number;
  phaseExpiresAt: number | null;
  players: AdminPlayerSummary[];
}

export interface AdminOverview {
  now: number;
  uptimeSec: number;
  memory: { rssMB: number; heapUsedMB: number };
  db: 'disabled' | 'ok' | 'down';
  counts: { rooms: number; socketsConnected: number; sessions: number; reconnecting: number };
  config: { aiDefense: boolean; clerk: boolean; dbConfigured: boolean };
}

export interface AdminRecentGame {
  gameCode: string;
  mode: string;
  playerCount: number;
  rounds: number;
  playedAt: number;
}

export interface AdminStats {
  enabled: boolean;
  totals?: { games: number; awards: number; avgPlayers: number };
  byMode?: Record<string, number>;
  recentGames?: AdminRecentGame[];
}

export interface AdminData {
  overview: AdminOverview | null;
  rooms: AdminRoomSummary[];
  stats: AdminStats | null;
}
```

- [ ] **Step 2: Write the failing test**

Create `client/src/admin/useAdminPoll.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAdminPoll } from './useAdminPoll';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: async () => 'tok' }),
}));

const overview = { now: 1, uptimeSec: 2, memory: { rssMB: 1, heapUsedMB: 1 }, db: 'disabled', counts: { rooms: 0, socketsConnected: 0, sessions: 0, reconnecting: 0 }, config: { aiDefense: false, clerk: false, dbConfigured: false } };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.includes('/overview') ? overview : url.includes('/rooms') ? { rooms: [] } : { enabled: false };
    return { ok: true, json: async () => body } as Response;
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useAdminPoll', () => {
  it('loads overview/rooms/stats on mount', async () => {
    const { result } = renderHook(() => useAdminPoll());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.overview?.uptimeSec).toBe(2);
    expect(result.current.data.rooms).toEqual([]);
    expect(result.current.data.stats).toEqual({ enabled: false });
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- useAdminPoll`
Expected: FAIL — "Cannot find module './useAdminPoll'".

- [ ] **Step 4: Write minimal implementation**

Create `client/src/admin/useAdminPoll.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { AdminData, AdminOverview, AdminRoomSummary, AdminStats } from './types';

const POLL_MS = 4000;

// Polls the three admin data endpoints on an interval with the Clerk Bearer
// token. Read-only: no writes, no socket. Errors surface as a single message;
// the last good data stays on screen across a transient failure.
export function useAdminPoll(): { data: AdminData; loading: boolean; error: string | null } {
  const { getToken } = useAuth();
  const [data, setData] = useState<AdminData>({ overview: null, rooms: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    async function tick(): Promise<void> {
      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [oRes, rRes, sRes] = await Promise.all([
          fetch('/api/admin/overview', { headers }),
          fetch('/api/admin/rooms', { headers }),
          fetch('/api/admin/stats', { headers }),
        ]);
        if (!oRes.ok || !rRes.ok || !sRes.ok) throw new Error('admin fetch failed');
        const overview = (await oRes.json()) as AdminOverview;
        const rooms = ((await rRes.json()) as { rooms: AdminRoomSummary[] }).rooms;
        const stats = (await sRes.json()) as AdminStats;
        if (alive.current) {
          setData({ overview, rooms, stats });
          setError(null);
        }
      } catch {
        if (alive.current) setError('Aggiornamento non riuscito.');
      } finally {
        if (alive.current) setLoading(false);
      }
    }
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [getToken]);

  return { data, loading, error };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- useAdminPoll`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/admin/types.ts client/src/admin/useAdminPoll.ts client/src/admin/useAdminPoll.test.tsx
git commit -m "feat(admin): client useAdminPoll hook + DTO types"
```

---

### Task 5: AdminApp page + route

**Files:**
- Create: `client/src/admin/AdminApp.tsx`
- Create: `client/src/admin/AdminApp.module.css`
- Create: `client/src/admin/AdminApp.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth` from `@clerk/react`; `useAdminPoll` from `./useAdminPoll`; design components from `../shared/ui` (`Card`, `Pill`, `Logo`).
- Produces: default-exported `AdminApp` React component; a lazy `/admin` route in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `client/src/admin/AdminApp.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import AdminApp from './AdminApp';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'tok' }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminApp', () => {
  it('shows "Accesso negato" when whoami says not admin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/whoami')) return { ok: true, json: async () => ({ isAdmin: false }) } as Response;
      return { ok: true, json: async () => ({}) } as Response;
    }));
    render(<AdminApp />);
    await waitFor(() => expect(screen.getByText(/Accesso negato/i)).toBeTruthy());
  });

  it('renders the dashboard heading when whoami says admin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/whoami')) return { ok: true, json: async () => ({ isAdmin: true }) } as Response;
      if (url.includes('/overview')) return { ok: true, json: async () => ({ now: 1, uptimeSec: 5, memory: { rssMB: 1, heapUsedMB: 1 }, db: 'disabled', counts: { rooms: 0, socketsConnected: 0, sessions: 0, reconnecting: 0 }, config: { aiDefense: false, clerk: false, dbConfigured: false } }) } as Response;
      if (url.includes('/rooms')) return { ok: true, json: async () => ({ rooms: [] }) } as Response;
      return { ok: true, json: async () => ({ enabled: false }) } as Response;
    }));
    render(<AdminApp />);
    await waitFor(() => expect(screen.getByText(/Nessuna stanza attiva/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AdminApp`
Expected: FAIL — "Cannot find module './AdminApp'".

- [ ] **Step 3: Write the component**

Create `client/src/admin/AdminApp.module.css`:

```css
.page {
  min-height: 100dvh;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 960px;
  margin: 0 auto;
  color: var(--color-text);
}
.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.metricValue {
  font-family: var(--font-display);
  font-size: 1.5rem;
}
.metricLabel {
  font-size: 0.8rem;
  opacity: 0.7;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.table th,
.table td {
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
}
.empty {
  opacity: 0.6;
  padding: 0.75rem 0;
}
.error {
  color: var(--color-danger, #e07a5f);
  font-size: 0.85rem;
}
```

Create `client/src/admin/AdminApp.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Card, Logo, Pill } from '../shared/ui';
import { useAdminPoll } from './useAdminPoll';
import styles from './AdminApp.module.css';

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtAge(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// `/admin`: read-only operations dashboard. Gated by /api/admin/whoami (the
// server is the real guard); polls overview/rooms/stats every 4s.
export default function AdminApp() {
  const { getToken } = useAuth();
  const [authState, setAuthState] = useState<'checking' | 'admin' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/admin/whoami', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = (await res.json()) as { isAdmin: boolean };
        if (!cancelled) setAuthState(json.isAdmin ? 'admin' : 'denied');
      } catch {
        if (!cancelled) setAuthState('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (authState === 'checking') return <main className={styles.page} />;
  if (authState === 'denied') {
    return (
      <main className={styles.page}>
        <div className={styles.header}>
          <Logo size={24} />
          <h1 className={styles.title}>Accesso negato</h1>
        </div>
        <p className={styles.empty}>Questa pagina è riservata agli amministratori.</p>
      </main>
    );
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { data, error } = useAdminPoll();
  const { overview, rooms, stats } = data;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Logo size={24} />
        <h1 className={styles.title}>Admin</h1>
      </div>
      {error && <div className={styles.error}>{error}</div>}

      <Card>
        <h2 className={styles.title}>Sistema</h2>
        {overview ? (
          <div className={styles.grid}>
            <Metric label="Uptime" value={fmtUptime(overview.uptimeSec)} />
            <Metric label="Memoria (RSS)" value={`${overview.memory.rssMB} MB`} />
            <Metric label="DB" value={overview.db} />
            <Metric label="Stanze" value={String(overview.counts.rooms)} />
            <Metric label="Socket" value={String(overview.counts.socketsConnected)} />
            <Metric label="Sessioni" value={String(overview.counts.sessions)} />
            <Metric label="In riconnessione" value={String(overview.counts.reconnecting)} />
            <Metric label="AI difese" value={overview.config.aiDefense ? 'on' : 'off'} />
          </div>
        ) : (
          <p className={styles.empty}>Caricamento…</p>
        )}
      </Card>

      <Card>
        <h2 className={styles.title}>Stanze live</h2>
        {rooms.length === 0 ? (
          <p className={styles.empty}>Nessuna stanza attiva</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Codice</th>
                <th>Modalità</th>
                <th>Fase</th>
                <th>Giocatori</th>
                <th>Aperta da</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>
                    {r.mode} · {r.format}
                  </td>
                  <td>{r.phase}</td>
                  <td>
                    {r.humanCount}
                    {r.botCount > 0 ? ` +${r.botCount}🤖` : ''}
                  </td>
                  <td>{fmtAge(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className={styles.title}>Storico</h2>
        {!stats ? (
          <p className={styles.empty}>Caricamento…</p>
        ) : !stats.enabled ? (
          <p className={styles.empty}>DB non configurato</p>
        ) : (
          <>
            <div className={styles.grid}>
              <Metric label="Partite" value={String(stats.totals?.games ?? 0)} />
              <Metric label="Premi" value={String(stats.totals?.awards ?? 0)} />
              <Metric label="Media giocatori" value={String(stats.totals?.avgPlayers ?? 0)} />
            </div>
            <div className={styles.grid}>
              {Object.entries(stats.byMode ?? {}).map(([mode, n]) => (
                <Pill key={mode}>
                  {mode}: {n}
                </Pill>
              ))}
            </div>
            {(stats.recentGames ?? []).length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Partita</th>
                    <th>Modalità</th>
                    <th>Giocatori</th>
                    <th>Round</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.recentGames ?? []).map((g) => (
                    <tr key={g.gameCode}>
                      <td>{g.gameCode}</td>
                      <td>{g.mode}</td>
                      <td>{g.playerCount}</td>
                      <td>{g.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}
```

> Verify `Card` and `Pill` accept `children` as used here by checking `client/src/shared/ui/index.ts` exports (both are exported there). If `Pill` requires specific props, pass the label via whatever prop it expects; otherwise keep the children usage.

- [ ] **Step 4: Add the route**

In `client/src/App.tsx`, add the lazy import alongside the others (after line 14):

```tsx
const AdminApp = lazy(() => import('./admin/AdminApp'));
```

And add the route inside `<Routes>` (after the `/impostazioni` route):

```tsx
            <Route path="/admin" element={<AdminApp />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- AdminApp`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/admin/AdminApp.tsx client/src/admin/AdminApp.module.css client/src/admin/AdminApp.test.tsx client/src/App.tsx
git commit -m "feat(admin): /admin dashboard page (system, live rooms, history)"
```

---

### Task 6: Full-gate verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete gate from repo root**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all four pass; the full Vitest suite is green (previous count + the new admin tests).

- [ ] **Step 2: Fix any failures**

If anything fails, fix it and re-run the full gate. Do not proceed until green. (If `lint` flags an `any` or unused var, address it directly — the rules forbid `any` and require `_`-prefixed unused args.)

- [ ] **Step 3: Final commit (only if Step 2 required changes)**

```bash
git add -A
git commit -m "chore(admin): green gate (typecheck/lint/test/build)"
```

> Note: per project rule, only commit already-staged intended files — review `git status` before `git add -A` to avoid committing stray/secret files. After the gate is green and committed, `git push` the branch (standing rule: finished work must reach the remote).

---

## Self-Review

**1. Spec coverage**

- Auth (Clerk + allowlist) → Task 1 ✅
- Read-only, no moderation actions → no write endpoints anywhere ✅
- REST polling ~4s → Task 4 (`POLL_MS = 4000`) ✅
- `/api/admin/whoami` (isAdmin without 401) → Task 3 ✅
- `/api/admin/overview` (uptime/mem/db/counts/config) → Task 3 ✅
- `/api/admin/rooms` (sanitized) → Task 2 + Task 3 ✅
- `/api/admin/stats` (DB aggregates, `enabled:false` fallback) → Task 3 ✅
- Sanitized `adminRoomSummaries` + anti-leak test → Task 2 ✅
- Client `/admin` route + 3 panels + access-denied gate → Task 5 ✅
- `ADMIN_USER_IDS` env, read lazily, documented → Task 1 ✅
- Tests (auth/anti-leak/endpoint-401/hook/render) → Tasks 1–5 ✅
- Green gate before commit → Task 6 ✅

**2. Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"; every code step has full code. ✅

**3. Type consistency:** `AdminRoomSummary`/`AdminPlayerSummary` fields match between server (Task 2) and client (Task 4). `requireAdmin`/`isAdminUser` signatures consistent between Task 1 and their use in Task 3. `useAdminPoll` return shape matches `AdminApp` consumption. ✅

**Assumptions flagged for the implementer to verify against the live code (do not invent APIs):**
- `Room.mode` is the `GameMode` field name (Task 2 note).
- `rooms.test.ts` room-creation helpers (`createRoom`/`join`) — mirror whatever that file already uses (Task 2 note).
- `Card`/`Pill` children API (Task 5 note).
