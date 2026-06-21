# Account & salvataggio premi (Fetta 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in (Clerk) player save the awards they win to a Postgres-backed profile and view them at `/profilo`, with anonymous play unchanged.

**Architecture:** Server-mediated persistence. The Node server tags in-memory players with a Clerk `userId` (verified server-side), and at `FINAL_AWARDS` writes each identified winner's awards to Railway Postgres (`pg`, no ORM). An authenticated `GET /api/me/awards` feeds the client profile view. Accounts are optional: with no `DATABASE_URL` the save path is a graceful no-op.

**Tech Stack:** Node + Express + Socket.IO (TypeScript, CommonJS) · `pg` · `@clerk/backend` (token verification) · React + Vite + `@clerk/react` (already integrated) · vitest (server unit tests only).

## Global Constraints

- **Server-mediated saves:** the browser never writes the DB; the server (authoritative for awards/votes) does. Verbatim: "I salvataggi avvengono lato server; il browser non scrive sul DB."
- **Privacy:** `GET /api/me/...` returns ONLY the authenticated caller's rows. Never expose another user's data.
- **Graceful no-op:** if `process.env.DATABASE_URL` is unset, `dbEnabled()` is false and every DB call is a silent no-op; the game is unaffected.
- **No ORM**; tables created with `CREATE TABLE IF NOT EXISTS` on startup. `CLERK_SECRET_KEY` is server-only — never in client code.
- **Idempotent award save:** natural unique key `(clerk_user_id, award_id, game_code)` + `ON CONFLICT DO NOTHING`.
- **Awards are group-mode only** (`computeAwards` reads `room.stats`); duel results are out of scope for this slice (`awardsToPersist` returns `[]` for non-group rooms — harmless).
- **TypeScript:** no `any` (lint error); prefix intentionally-unused vars/args with `_`. Keep server CJS / client ESM separate.
- **Gate per task:** `npm run typecheck && npm run lint && npm test && npm run build` GREEN. The client has **no test runner** (vitest covers `server/**` only) — client tasks verify via the gate, not unit tests.
- **Shared branch:** `git add` EXPLICIT paths only (never `-A`/`.`); a parallel Ralph loop shares this tree (don't stage `server/data/dilemmas.json`, `.claude/`, `scripts/`). Commit promptly.

---

### Task 1: Player identity + which awards to persist (pure core, TDD)

The unit-testable heart: tag a player with a Clerk user id, and derive the award rows to save (identified winners only). No new deps, no DB.

**Files:**
- Modify: `server/src/game/rooms.ts` (Player interface + `setPlayerUser`)
- Create: `server/src/persistence.ts` (PersistableAward + `awardsToPersist`)
- Test: `server/src/game/__tests__/rooms.test.ts` (setPlayerUser)
- Test: `server/src/__tests__/persistence.test.ts` (awardsToPersist)

**Interfaces:**
- Produces: `Player.clerkUserId?: string`; `RoomStore.setPlayerUser(code: string, playerId: string, clerkUserId: string): boolean`; `interface PersistableAward { clerkUserId: string; awardId: string; title: string; emoji: string; description: string; gameCode: string; gameMode: string; nickname: string }`; `awardsToPersist(room: Room): PersistableAward[]`.
- Consumes: `computeAwards(room)` from `server/src/game/awards.ts`; `Room`, `Player` types from `server/src/game/rooms.ts`.

- [ ] **Step 1: Add `clerkUserId` to the Player interface**

In `server/src/game/rooms.ts`, in the `Player` interface (after the `connected?` field) add:

```ts
  /**
   * Clerk user id, set when a logged-in phone identifies itself (player:identify).
   * Absent = anonymous (the default). Used only to attribute saved awards.
   */
  clerkUserId?: string;
```

- [ ] **Step 2: Write the failing test for `setPlayerUser`**

Append to `server/src/game/__tests__/rooms.test.ts`, inside the existing `describe('RoomStore reconnection / connected state', ...)` is wrong scope — add a new describe at end of file:

```ts
describe('RoomStore.setPlayerUser', () => {
  it('tags a player with a clerk user id; false for unknown room/player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.setPlayerUser(code, 'p1', 'user_123')).toBe(true);
    expect(store.get(code)?.players.get('p1')?.clerkUserId).toBe('user_123');
    expect(store.setPlayerUser('ZZZZ', 'p1', 'user_123')).toBe(false);
    expect(store.setPlayerUser(code, 'ghost', 'user_123')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: FAIL — `store.setPlayerUser is not a function`.

- [ ] **Step 4: Implement `setPlayerUser`**

In `server/src/game/rooms.ts`, next to `setConnected`, add:

```ts
  /** Tag a player with a Clerk user id (for award attribution). False if unknown. */
  setPlayerUser(code: string, playerId: string, clerkUserId: string): boolean {
    const player = this.rooms.get(code)?.players.get(playerId);
    if (!player) return false;
    player.clerkUserId = clerkUserId;
    return true;
  }
```

- [ ] **Step 5: Write the failing test for `awardsToPersist`**

Create `server/src/__tests__/persistence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore } from '../game/rooms';
import { awardsToPersist } from '../persistence';

// Drive a tiny 1-player game where the single player wins every award, then tag
// them with a clerk id and assert only their awards are returned.
function finishedRoom(store: RoomStore, tagged: boolean): string {
  const { code } = store.create();
  store.join(code, 'p1', 'Ann');
  store.join(code, 'p2', 'Bob');
  store.join(code, 'p3', 'Cy');
  if (tagged) store.setPlayerUser(code, 'p1', 'user_ann');
  store.startGame(code, 3);
  let guard = 0;
  while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 200) {
    const room = store.get(code)!;
    if (room.phase === 'VOTE_1' || room.phase === 'VOTE_2') {
      store.vote(code, 'p1', 'A');
      store.vote(code, 'p2', 'A');
      store.vote(code, 'p3', 'A');
    }
    store.advancePhase(code);
  }
  return code;
}

describe('awardsToPersist', () => {
  it('returns rows only for winners that are tagged with a clerk user id', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, true);
    const rows = awardsToPersist(store.get(code)!);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.clerkUserId).toBe('user_ann');
      expect(r.gameCode).toBe(code);
      expect(r.gameMode).toBe('gruppo');
      expect(r.nickname).toBe('Ann');
      expect(typeof r.awardId).toBe('string');
    }
  });

  it('returns [] when no winner is tagged', () => {
    const store = new RoomStore();
    const code = finishedRoom(store, false);
    expect(awardsToPersist(store.get(code)!)).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

Run: `npx vitest run server/src/__tests__/persistence.test.ts`
Expected: FAIL — cannot find module `../persistence`.

- [ ] **Step 7: Implement `persistence.ts` (pure part only — no DB import yet)**

Create `server/src/persistence.ts`:

```ts
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
```

- [ ] **Step 8: Run both tests — green**

Run: `npx vitest run server/src/__tests__/persistence.test.ts server/src/game/__tests__/rooms.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add server/src/game/rooms.ts server/src/persistence.ts server/src/game/__tests__/rooms.test.ts server/src/__tests__/persistence.test.ts
git commit -m "feat(accounts): player.clerkUserId + awardsToPersist (pure core)"
```

---

### Task 2: DB layer — pg pool, migrate, saveAwards

Add `pg`, create `db.ts` (pool/migrate, graceful no-op without `DATABASE_URL`), and the `saveAwards` writer in `persistence.ts`.

**Files:**
- Modify: `server/package.json` + root `package-lock.json` (add `pg`, `@types/pg`)
- Create: `server/src/db.ts`
- Modify: `server/src/persistence.ts` (add `saveAwards`)
- Test: `server/src/__tests__/persistence.test.ts` (saveAwards no-op without DB)

**Interfaces:**
- Produces: `pool: Pool | null` and `dbEnabled(): boolean` and `migrate(): Promise<void>` from `server/src/db.ts`; `saveAwards(rows: PersistableAward[]): Promise<void>` from `server/src/persistence.ts`.
- Consumes: `PersistableAward` (Task 1).

- [ ] **Step 1: Add the pg dependency**

Run: `npm install pg --workspace server && npm install -D @types/pg --workspace server`
Expected: `server/package.json` gains `pg` (dep) and `@types/pg` (devDep); lockfile updated.

- [ ] **Step 2: Create `db.ts`**

Create `server/src/db.ts`:

```ts
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
}
```

- [ ] **Step 3: Add `saveAwards` to `persistence.ts`**

Append to `server/src/persistence.ts`:

```ts
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
```

- [ ] **Step 4: Write + run the no-op test (DB disabled in test env)**

Append to `server/src/__tests__/persistence.test.ts`:

```ts
import { saveAwards } from '../persistence';
import { dbEnabled } from '../db';

describe('saveAwards (no DATABASE_URL in tests)', () => {
  it('is disabled and resolves without throwing', async () => {
    expect(dbEnabled()).toBe(false);
    await expect(saveAwards([])).resolves.toBeUndefined();
  });
});
```

Run: `npx vitest run server/src/__tests__/persistence.test.ts`
Expected: PASS (the test env has no `DATABASE_URL`, so `dbEnabled()` is false).

- [ ] **Step 5: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add server/package.json package-lock.json server/src/db.ts server/src/persistence.ts server/src/__tests__/persistence.test.ts
git commit -m "feat(accounts): pg db layer (migrate) + saveAwards writer"
```

---

### Task 3: Clerk server-side token verification

Add `@clerk/backend` and a small helper that verifies a Clerk session token and returns the user id (or null). Used by both the socket identify event and the profile API.

**Files:**
- Modify: `server/package.json` + root `package-lock.json` (add `@clerk/backend`)
- Create: `server/src/clerk.ts`
- Test: `server/src/__tests__/clerk.test.ts`

**Interfaces:**
- Produces: `verifyClerkToken(token: string | undefined): Promise<string | null>` from `server/src/clerk.ts`.

- [ ] **Step 1: Add the dependency**

Run: `npm install @clerk/backend --workspace server`

- [ ] **Step 2: Write the failing test (returns null without a secret key)**

Create `server/src/__tests__/clerk.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { verifyClerkToken } from '../clerk';

describe('verifyClerkToken', () => {
  beforeEach(() => { delete process.env.CLERK_SECRET_KEY; });

  it('returns null when no secret key is configured', async () => {
    expect(await verifyClerkToken('whatever')).toBeNull();
  });

  it('returns null for an empty/undefined token', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    expect(await verifyClerkToken('')).toBeNull();
    expect(await verifyClerkToken(undefined)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run server/src/__tests__/clerk.test.ts`
Expected: FAIL — cannot find module `../clerk`.

- [ ] **Step 4: Implement `clerk.ts`**

Create `server/src/clerk.ts`:

```ts
// Verify a Clerk session JWT server-side. Returns the user id (sub) or null.
// CLERK_SECRET_KEY is server-only. Networkless except for Clerk's JWKS fetch.
import { verifyToken } from '@clerk/backend';

export async function verifyClerkToken(token: string | undefined): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || !token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run it — green**

Run: `npx vitest run server/src/__tests__/clerk.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add server/package.json package-lock.json server/src/clerk.ts server/src/__tests__/clerk.test.ts
git commit -m "feat(accounts): verifyClerkToken (server-side Clerk verification)"
```

---

### Task 4: Server wiring — identify event, save at FINAL_AWARDS, profile API

Wire the pieces into Express/Socket.IO: run migrations on boot, handle `player:identify`, persist at `FINAL_AWARDS`, and serve `GET /api/me/awards`. Add the shared event name/types. Verified via the gate + an ad-hoc integration script.

**Files:**
- Modify: `client/src/shared/events.ts` (add `PlayerIdentify` event + payload + `MyAward` type)
- Modify: `server/src/index.ts` (migrate on boot, identify handler, save call, API route)

**Interfaces:**
- Consumes: `migrate`, `dbEnabled`, `pool` (Task 2); `saveAwards`, `awardsToPersist` (Tasks 1–2); `verifyClerkToken` (Task 3); the existing `sessions: Map<socketId,{code,playerId}>` and `rooms`, `advanceAndBroadcast` in index.ts.
- Produces: socket event `player:identify`; HTTP `GET /api/me/awards`.

- [ ] **Step 1: Add the shared event + types**

In `client/src/shared/events.ts`, add to the `SocketEvents` object (next to `PlayerVote`):

```ts
  PlayerIdentify: 'player:identify',
```

And add these interfaces (near `PlayerVotePayload`):

```ts
export interface PlayerIdentifyPayload {
  /** Clerk session token; the server verifies it and tags the player with the userId. */
  token: string;
}

/** One saved award as returned by GET /api/me/awards. */
export interface MyAward {
  id: string;
  awardId: string;
  title: string;
  emoji: string;
  description: string;
  gameCode: string;
  gameMode: string;
  nickname: string;
  wonAt: string;
}
```

- [ ] **Step 2: Wire imports + migrate-on-boot in `index.ts`**

In `server/src/index.ts`, add imports after the existing game imports:

```ts
import { migrate, dbEnabled, pool } from './db';
import { saveAwards, awardsToPersist } from './persistence';
import { verifyClerkToken } from './clerk';
```

In the `httpServer.listen(...)` startup callback (after the existing logs), add:

```ts
  if (dbEnabled()) {
    migrate()
      .then(() => console.log('[db] migrated'))
      .catch((err) => console.error('[db] migrate failed', err));
  } else {
    console.log('[db] disabled (no DATABASE_URL) — awards will not be saved');
  }
```

- [ ] **Step 3: Persist at FINAL_AWARDS in `advanceAndBroadcast`**

In `server/src/index.ts`, find `advanceAndBroadcast` and add the save after `maybeGenerateAiDefense(code);`:

```ts
  const room = rooms.get(code);
  if (room && room.phase === 'FINAL_AWARDS') {
    saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards failed', e));
  }
```

- [ ] **Step 4: Add the `player:identify` handler**

In `server/src/index.ts`, inside `io.on('connection', (socket) => { ... })`, next to the `player:vote` handler, add:

```ts
  // A logged-in phone sends its Clerk token; verify it and tag the player so the
  // server can attribute saved awards. A late identify on the awards screen
  // triggers a re-save (idempotent) so results aren't lost.
  socket.on('player:identify', async (payload: { token?: string }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const userId = await verifyClerkToken(typeof payload?.token === 'string' ? payload.token : undefined);
    if (!userId) return;
    rooms.setPlayerUser(session.code, session.playerId, userId);
    const room = rooms.get(session.code);
    if (room && room.phase === 'FINAL_AWARDS') {
      saveAwards(awardsToPersist(room)).catch((e) => console.error('[db] saveAwards (identify) failed', e));
    }
  });
```

- [ ] **Step 5: Add the authenticated profile API**

In `server/src/index.ts`, after the `app.get('/api/health', ...)` route, add:

```ts
// The caller's own saved awards. Bearer token (Clerk) → userId → their rows only.
app.get('/api/me/awards', async (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = await verifyClerkToken(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!dbEnabled() || !pool) {
    res.json({ awards: [] });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, award_id, title, emoji, description, game_code, game_mode, nickname, won_at
     FROM awards WHERE clerk_user_id = $1 ORDER BY won_at DESC`,
    [userId],
  );
  res.json({
    awards: rows.map((r) => ({
      id: String(r.id),
      awardId: r.award_id,
      title: r.title,
      emoji: r.emoji,
      description: r.description,
      gameCode: r.game_code,
      gameMode: r.game_mode,
      nickname: r.nickname,
      wonAt: r.won_at,
    })),
  });
});
```

- [ ] **Step 6: Gate (the index.ts wiring is not unit-tested — verify by build)**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all GREEN. (The socket/API flow itself is verified in Task 6's integration note, against a real Postgres + token.)

- [ ] **Step 7: Commit**

```bash
git add client/src/shared/events.ts server/src/index.ts
git commit -m "feat(accounts): identify event, save at FINAL_AWARDS, /api/me/awards"
```

---

### Task 5: Client — identify when signed in + "save your awards" prompt

The phone sends its Clerk token when logged in, and shows a save prompt on the awards screen when signed out.

**Files:**
- Modify: `client/src/player/PlayerApp.tsx`

**Interfaces:**
- Consumes: `useAuth`, `Show`, `SignInButton` from `@clerk/react`; `SocketEvents.PlayerIdentify` (Task 4); existing `getSocket()`, `joinedCode`, `phase`.

- [ ] **Step 1: Identify on sign-in + emit the token**

In `client/src/player/PlayerApp.tsx`, add to the imports:

```tsx
import { useAuth, Show, SignInButton } from '@clerk/react';
```

Inside the component, after the existing hooks (e.g. after `const remaining = useCountdown(...)`), add:

```tsx
  // When the phone's user is logged in, send the Clerk token so the server can
  // attribute saved awards. Re-runs on login and on (re)joining a room.
  const { isSignedIn, getToken } = useAuth();
  useEffect(() => {
    if (!isSignedIn || !joinedCode) return;
    let cancelled = false;
    void getToken().then((token) => {
      if (token && !cancelled) getSocket().emit(SocketEvents.PlayerIdentify, { token });
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, joinedCode]);
```

- [ ] **Step 2: Add the save prompt on the awards screen**

In `client/src/player/PlayerApp.tsx`, find the `FINAL_AWARDS` branch of the post-lobby view (the `phase === 'FINAL_AWARDS'` paragraph "🏆 Guarda i premi sullo schermo!"). Replace that single paragraph with:

```tsx
        ) : phase === 'FINAL_AWARDS' ? (
          <>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              🏆 Guarda i premi sullo schermo!
            </p>
            <Show when="signed-out">
              <p style={{ fontSize: '1rem', opacity: 0.85, margin: '0.4rem 0 0' }}>
                Accedi per salvare i tuoi premi 💾
              </p>
              <SignInButton mode="modal">
                <button
                  type="button"
                  style={{
                    marginTop: '0.5rem',
                    fontWeight: 700,
                    padding: '0.6rem 1.4rem',
                    borderRadius: '0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  Accedi e salva
                </button>
              </SignInButton>
            </Show>
          </>
```

(Keep the surrounding conditional chain intact — only the `FINAL_AWARDS` arm changes from a single `<p>` to this `<>…</>` fragment.)

- [ ] **Step 3: Gate (client — no test runner)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN.

- [ ] **Step 4: Commit**

```bash
git add client/src/player/PlayerApp.tsx
git commit -m "feat(accounts): phone identifies when signed in + save prompt at awards"
```

---

### Task 6: Client — "I miei premi" profile view + route

A `/profilo` page that fetches and lists the signed-in user's saved awards. Closes the loop (write → read).

**Files:**
- Create: `client/src/profile/Profile.tsx`
- Modify: `client/src/App.tsx` (add the `/profilo` route)

**Interfaces:**
- Consumes: `useAuth`, `Show`, `SignInButton` from `@clerk/react`; `MyAward` type from `../shared/events` (Task 4).

- [ ] **Step 1: Create the Profile view**

Create `client/src/profile/Profile.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import type { MyAward } from '../shared/events';

// "I miei premi": fetches the signed-in user's saved awards from the server.
export default function Profile() {
  const { isSignedIn, getToken } = useAuth();
  const [awards, setAwards] = useState<MyAward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/me/awards', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { awards: MyAward[] };
        if (!cancelled) setAwards(data.awards);
      } catch {
        if (!cancelled) setError('Impossibile caricare i premi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  const wrap = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem 1.5rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
  } as const;

  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', margin: 0 }}>
        I miei premi
      </h1>
      <Show when="signed-out">
        <p style={{ color: 'var(--text-muted)' }}>Accedi per vedere i premi salvati.</p>
        <SignInButton mode="modal">
          <button type="button" style={{ fontWeight: 700, padding: '0.7rem 1.4rem', borderRadius: '0.7rem', cursor: 'pointer' }}>
            Accedi
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {awards == null && !error && <p style={{ color: 'var(--text-muted)' }}>Carico…</p>}
        {awards != null && awards.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Nessun premio salvato (ancora). Gioca una partita! 🎲</p>
        )}
        {awards != null && awards.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'center', maxWidth: 'min(92vw, 60rem)' }}>
            {awards.map((a) => (
              <li
                key={a.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.2rem',
                  textAlign: 'center',
                  flex: '1 1 14rem',
                  maxWidth: '16rem',
                }}
              >
                <div style={{ fontSize: '2rem' }}>{a.emoji}</div>
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
                  come {a.nickname} · {new Date(a.wonAt).toLocaleDateString('it-IT')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Show>
    </main>
  );
}
```

- [ ] **Step 2: Add the route**

In `client/src/App.tsx`, add the import and the route:

```tsx
import Profile from './profile/Profile';
```

```tsx
        <Route path="/join" element={<PlayerApp />} />
        <Route path="/profilo" element={<Profile />} />
```

- [ ] **Step 3: Gate (client)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN.

- [ ] **Step 4: Integration verification (manual, against a real Postgres + token)**

This proves the server flow the unit tests can't. Do it once after Task 6 (or defer to the deploy step). Steps, then delete any scratch file:
1. Provision a local/Railway Postgres; export `DATABASE_URL`, `CLERK_SECRET_KEY`.
2. `npm run build` then `DATABASE_URL=… CLERK_SECRET_KEY=… PORT=4500 node server/dist/index.js` → log shows `[db] migrated`.
3. With a real Clerk session token `T` (copy from the running app's network tab or `getToken()`), `curl -s -H "Authorization: Bearer $T" http://localhost:4500/api/me/awards` → `{"awards":[...]}` (200), and `curl` without the header → 401.
4. (Optional) drive a full game via the existing ad-hoc socket-script pattern, emit `player:identify` with `T`, finish to FINAL_AWARDS, then re-curl `/api/me/awards` and see the new rows.

- [ ] **Step 5: Commit**

```bash
git add client/src/profile/Profile.tsx client/src/App.tsx
git commit -m "feat(accounts): /profilo view of saved awards"
```

---

## Self-Review

**Spec coverage:**
- Schema (users + awards + indexes) → Task 2 `db.ts`. ✓
- `db.ts` (pool/dbEnabled/migrate, graceful no-op) → Task 2. ✓
- `persistence.ts` (awardsToPersist pure + saveAwards I/O) → Tasks 1 & 2. ✓
- Player.clerkUserId + setPlayerUser → Task 1. ✓
- Clerk server verify (verifyClerkToken) → Task 3. ✓
- index.ts wiring: migrate on boot, player:identify (+ late re-save), save at FINAL_AWARDS, GET /api/me/awards → Task 4. ✓
- Client identify + save prompt → Task 5. ✓
- /profilo view → Task 6. ✓
- New deps pg/@types/pg/@clerk/backend → Tasks 2 & 3. ✓
- Idempotent unique key + ON CONFLICT → Task 2 (index) + Task 2 saveAwards + Task 4 re-save. ✓
- Graceful no-op without DATABASE_URL → Task 2 (dbEnabled), tested. ✓
- Privacy (only own rows) → Task 4 API filters by `userId`. ✓
- Awards group-only / duel out of scope → Task 1 `awardsToPersist` (returns [] when winners untagged; duel has no group stats). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. Task 6 Step 4 is a manual integration *procedure* (not a code placeholder) — explicit commands, marked as such. ✓

**Type consistency:** `PersistableAward` fields (clerkUserId/awardId/title/emoji/description/gameCode/gameMode/nickname) are identical in Task 1 (definition), Task 2 (saveAwards params + SQL bind order), and the awards INSERT column order. `MyAward` (Task 4) field names match the API `res.json` mapping (Task 4) and the Profile consumer (Task 6). `setPlayerUser`/`clerkUserId`/`verifyClerkToken`/`saveAwards`/`awardsToPersist`/`dbEnabled`/`pool`/`migrate` names are consistent across tasks. `SocketEvents.PlayerIdentify` defined in Task 4 and used in Tasks 4 (server string) & 5 (client). ✓
