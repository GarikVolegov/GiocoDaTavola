# Stabilizzazione SCHIERATI — Fase 3: snapshot / ripristino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sopravvivere le partite attive a un riavvio del server: snapshot periodico delle stanze su Postgres e ripristino all'avvio, così un crash a metà partita non perde il gioco.

**Architecture:** Un modulo puro `roomSnapshot` serializza/deserializza una `Room` con un **replacer/reviver JSON generico** (ogni `Map` → `{__t:'Map'}`, il `Deck` → `{__t:'Deck'}`) — field-agnostic, quindi robusto alla crescita di `Room` (Ralph aggiunge Map ad ogni story). Un layer `snapshotStore` persiste/carica/elimina le righe JSON su Postgres (no-op senza DB). `index.ts` snapshotta su transizione di fase + periodicamente, elimina lo snapshot al reaping, e all'avvio ricarica le stanze in `RoomStore`.

**Tech Stack:** Node + Express + Socket.IO (TypeScript CommonJS, tsx/tsc), Postgres (`pg`), Vitest.

## Global Constraints

- Eseguire i comandi dalla **root del repo**; `typecheck` · `lint` · `test` · `build` tutti verdi prima di ogni commit.
- Niente `any` (errore lint); unused con prefisso `_`.
- Server CJS / client ESM separati.
- Voti/pronostici **segreti**: lo snapshot è SOLO server-side (mai inviato ai client); nessuna identità per-scelta lascia il server via socket.
- Il DB è **opzionale**: senza `DATABASE_URL` ogni funzione di `snapshotStore` è no-op e il gioco gira identico (in-memory).
- Messaggi di commit terminano con: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### Vincolo di esecuzione (ambiente Ralph)

Implementare in un **git worktree isolato** durante una finestra tranquilla (nessun processo `ralph.sh`: `pgrep -fl ralph`). `rooms.ts`/`index.ts` sono file caldi che Ralph riscrive spesso — rivalidare gli anchor di riga al momento dell'esecuzione. Il modulo `roomSnapshot.ts` è field-agnostic apposta, così resta valido se `Room` cresce.

---

### Task 1: `Deck.cards` — esporre le carte rimaste per la serializzazione

Il `Deck` tiene `remaining: Dilemma[]` privato. Per serializzarlo serve leggerlo; per ricostruirlo basta `new Deck(cards)` (il costruttore accetta già la lista).

**Files:**
- Modify: `server/src/game/deck.ts` (classe `Deck`)
- Test: `server/src/game/__tests__/deck.test.ts`

**Interfaces:**
- Produces: `Deck.cards: Dilemma[]` (getter) — copia delle carte ancora estraibili.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in `server/src/game/__tests__/deck.test.ts`:

```ts
import { Deck } from '../deck';
// (riusa il fixture di dilemmi già presente nel file; altrimenti costruiscine 2)

describe('Deck.cards (snapshot support)', () => {
  it('exposes the remaining cards and shrinks as they are drawn', () => {
    const d1 = { id: 'a', text: 'A?', optionA: 'x', optionB: 'y', register: 'vita' as const, spuntiA: [], spuntiB: [] };
    const d2 = { id: 'b', text: 'B?', optionA: 'x', optionB: 'y', register: 'vita' as const, spuntiA: [], spuntiB: [] };
    const deck = new Deck([d1, d2], () => 0);
    expect(deck.cards.map((c) => c.id)).toEqual(['a', 'b']);
    deck.draw(); // rng=0 picks index 0 -> 'a'
    expect(deck.cards.map((c) => c.id)).toEqual(['b']);
  });

  it('returns a copy (mutating the result does not change the deck)', () => {
    const d1 = { id: 'a', text: 'A?', optionA: 'x', optionB: 'y', register: 'vita' as const, spuntiA: [], spuntiB: [] };
    const deck = new Deck([d1]);
    deck.cards.pop();
    expect(deck.remainingCount).toBe(1);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npm test -- deck.test.ts -t "snapshot support"`
Expected: FAIL — `deck.cards` is undefined / not a getter.

- [ ] **Step 3: Implementa il getter**

In `server/src/game/deck.ts`, dentro la classe `Deck`, accanto a `remainingCount`:

```ts
  /** A copy of the cards still available to draw (for snapshotting the deck). */
  get cards(): Dilemma[] {
    return [...this.remaining];
  }
```

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npm test -- deck.test.ts -t "snapshot support"`
Expected: PASS (entrambi).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/deck.ts server/src/game/__tests__/deck.test.ts
git commit -m "feat(deck): expose remaining cards for snapshotting

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `roomSnapshot.ts` — serialize/deserialize generici (round-trip)

Il cuore: un replacer/reviver JSON che gestisce `Map` e `Deck` in modo **field-agnostic**, così ogni nuova Map di `Room` è coperta automaticamente. Modulo puro, niente DB.

**Files:**
- Create: `server/src/game/roomSnapshot.ts`
- Test: `server/src/game/__tests__/roomSnapshot.test.ts`

**Interfaces:**
- Consumes: `Deck.cards` (Task 1), `Deck` constructor `new Deck(cards)`, `type Room` da `./rooms`.
- Produces: `serializeRoom(room: Room): string`, `deserializeRoom(json: string): Room`.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `server/src/game/__tests__/roomSnapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore } from '../rooms';
import { Deck, type Dilemma, type ContentRegister } from '../deck';
import { serializeRoom, deserializeRoom } from '../roomSnapshot';

const FIXTURE: Dilemma[] = Array.from({ length: 4 }, (_, i) => ({
  id: `d${i + 1}`, text: `D${i + 1}?`, optionA: `A${i + 1}`, optionB: `B${i + 1}`,
  register: 'vita' as const, spuntiA: [], spuntiB: [],
}));
const makeDeck = (_r: ContentRegister) => new Deck(FIXTURE, () => 0);

// Drive a room into VOTE_1 with two votes + one prediction so the snapshot
// carries populated Maps and a partially-drawn Deck.
function liveRoom(): RoomStore extends never ? never : ReturnType<RoomStore['get']> {
  const store = new RoomStore(undefined, () => 1_000, makeDeck);
  const { code } = store.create();
  store.join(code, 'p0', 'Ann');
  store.join(code, 'p1', 'Bob');
  store.join(code, 'p2', 'Cy');
  store.startGame(code, 3);
  store.advancePhase(code); // DILEMMA_REVEAL (draws d1)
  store.advancePhase(code); // VOTE_1
  store.vote(code, 'p0', 'A');
  store.vote(code, 'p1', 'B');
  return store.get(code);
}

describe('roomSnapshot round-trip', () => {
  it('preserves primitives, Maps and the Deck across serialize -> deserialize', () => {
    const room = liveRoom()!;
    const restored = deserializeRoom(serializeRoom(room));

    // Primitives
    expect(restored.code).toBe(room.code);
    expect(restored.phase).toBe('VOTE_1');
    expect(restored.createdAt).toBe(room.createdAt);

    // Maps come back as real Maps with the same entries
    expect(restored.players).toBeInstanceOf(Map);
    expect([...restored.players.keys()].sort()).toEqual(['p0', 'p1', 'p2']);
    expect(restored.votes).toBeInstanceOf(Map);
    expect(restored.votes.get('p0')).toBe('A');
    expect(restored.votes.get('p1')).toBe('B');

    // Deck comes back as a real Deck with the same remaining count + draw behaviour
    expect(restored.deck).toBeInstanceOf(Deck);
    expect(restored.deck!.remainingCount).toBe(room.deck!.remainingCount);
    expect(restored.deck!.draw()?.id).toBe(room.deck!.cards[0].id);
  });

  it('round-trips an empty/lobby room (no deck, empty Maps)', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const restored = deserializeRoom(serializeRoom(store.get(code)!));
    expect(restored.phase).toBe('LOBBY');
    expect(restored.deck).toBeNull();
    expect(restored.votes).toBeInstanceOf(Map);
    expect(restored.votes.size).toBe(0);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npm test -- roomSnapshot.test.ts`
Expected: FAIL — cannot find module `../roomSnapshot`.

- [ ] **Step 3: Implementa il modulo**

Crea `server/src/game/roomSnapshot.ts`:

```ts
// Server-side serialization of a live Room for crash-recovery snapshots. Uses a
// generic JSON replacer/reviver so it is field-agnostic: any Map on the Room
// (current or future) round-trips automatically; only the Deck class instance
// needs a named case. NEVER sent to clients — secret votes stay server-side.
import { Deck } from './deck';
import type { Room } from './rooms';

interface TaggedMap {
  __t: 'Map';
  e: [unknown, unknown][];
}
interface TaggedDeck {
  __t: 'Deck';
  cards: Deck['cards'];
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __t: 'Map', e: [...value.entries()] } satisfies TaggedMap;
  if (value instanceof Deck) return { __t: 'Deck', cards: value.cards } satisfies TaggedDeck;
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__t' in value) {
    const tag = value as { __t: string };
    if (tag.__t === 'Map') return new Map((value as TaggedMap).e);
    if (tag.__t === 'Deck') return new Deck((value as TaggedDeck).cards);
  }
  return value;
}

/** Serialize a Room to a JSON string (Maps + Deck preserved). */
export function serializeRoom(room: Room): string {
  return JSON.stringify(room, replacer);
}

/** Reconstruct a Room from a snapshot JSON string (real Maps + Deck restored). */
export function deserializeRoom(json: string): Room {
  return JSON.parse(json, reviver) as Room;
}
```

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npm test -- roomSnapshot.test.ts`
Expected: PASS (entrambi).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/roomSnapshot.ts server/src/game/__tests__/roomSnapshot.test.ts
git commit -m "feat(snapshot): field-agnostic Room serialize/deserialize (Maps + Deck)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `RoomStore.restore(room)` — reinserire una stanza deserializzata

`RoomStore` tiene le stanze in una `Map` privata; serve un modo per reinserire una stanza ricostruita all'avvio.

**Files:**
- Modify: `server/src/game/rooms.ts` (classe `RoomStore`, accanto a `delete`/`get`/`has`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `RoomStore.restore(room: Room): void` — registra la stanza sotto la sua `code`.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('RoomStore.restore (snapshot)', () => {
  it('reinserts a room so get/has/size see it', () => {
    const store = new RoomStore();
    const { code } = store.create();
    const room = store.get(code)!;
    store.delete(code);
    expect(store.has(code)).toBe(false);

    store.restore(room);
    expect(store.has(code)).toBe(true);
    expect(store.get(code)).toBe(room);
    expect(store.size).toBe(1);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npm test -- rooms.test.ts -t "reinserts a room"`
Expected: FAIL — `store.restore is not a function`.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, dentro `RoomStore`, dopo `delete`:

```ts
  /** Reinsert a room (e.g. one rebuilt from a snapshot at boot). */
  restore(room: Room): void {
    this.rooms.set(room.code, room);
  }
```

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npm test -- rooms.test.ts -t "reinserts a room"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(rooms): RoomStore.restore to reinsert a snapshot room

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `snapshotStore.ts` + tabella DB — persist/load/delete (no-op senza DB)

Layer Postgres isolato (mirror di `persistence.ts`). Riusa `pool`/`dbEnabled` da `./db` e aggiunge la tabella in `migrate()`.

**Files:**
- Modify: `server/src/db.ts` (funzione `migrate`)
- Create: `server/src/snapshotStore.ts`
- Test: `server/src/__tests__/snapshotStore.test.ts`

**Interfaces:**
- Consumes: `pool`, `dbEnabled` da `./db`; `serializeRoom` (Task 2).
- Produces: `persistSnapshot(code: string, json: string): Promise<void>`, `loadAllSnapshots(): Promise<{ code: string; json: string }[]>`, `deleteSnapshot(code: string): Promise<void>`.

- [ ] **Step 1: Scrivi il test che fallisce (comportamento no-op senza DB)**

Crea `server/src/__tests__/snapshotStore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { persistSnapshot, loadAllSnapshots, deleteSnapshot } from '../snapshotStore';

// With no DATABASE_URL the pool is null: every function must no-op without throwing
// (the game runs DB-less). This mirrors persistence.test.ts.
describe('snapshotStore (DB disabled)', () => {
  it('persist/delete resolve to no-op and load returns empty', async () => {
    await expect(persistSnapshot('ABCD', '{"code":"ABCD"}')).resolves.toBeUndefined();
    await expect(deleteSnapshot('ABCD')).resolves.toBeUndefined();
    await expect(loadAllSnapshots()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui e verifica il fallimento**

Run: `npm test -- snapshotStore.test.ts`
Expected: FAIL — cannot find module `../snapshotStore`.

- [ ] **Step 3a: Aggiungi la tabella in `migrate()`**

In `server/src/db.ts`, dentro `migrate()` (dopo la creazione delle altre tabelle, prima della chiusura della funzione):

```ts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_snapshots (
      code       text PRIMARY KEY,
      snapshot   text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
```

- [ ] **Step 3b: Implementa `snapshotStore.ts`**

Crea `server/src/snapshotStore.ts`:

```ts
// Postgres persistence of live-room snapshots for crash recovery. Optional: with
// no DATABASE_URL every function no-ops (mirror of persistence.ts). Stores the
// opaque JSON string from roomSnapshot.serializeRoom — never inspected as votes.
import { pool, dbEnabled } from './db';

/** Upsert a room's snapshot JSON keyed by room code. No-op when DB disabled. */
export async function persistSnapshot(code: string, json: string): Promise<void> {
  if (!dbEnabled() || !pool) return;
  await pool.query(
    `INSERT INTO room_snapshots (code, snapshot, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (code) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [code, json],
  );
}

/** All persisted snapshots (for boot-time restore). Empty when DB disabled. */
export async function loadAllSnapshots(): Promise<{ code: string; json: string }[]> {
  if (!dbEnabled() || !pool) return [];
  const { rows } = await pool.query(`SELECT code, snapshot FROM room_snapshots`);
  return rows.map((r) => ({ code: String(r.code), json: String(r.snapshot) }));
}

/** Drop a room's snapshot (called when the room is reaped). No-op when disabled. */
export async function deleteSnapshot(code: string): Promise<void> {
  if (!dbEnabled() || !pool) return;
  await pool.query(`DELETE FROM room_snapshots WHERE code = $1`, [code]);
}
```

- [ ] **Step 4: Esegui e verifica il successo**

Run: `npm test -- snapshotStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/snapshotStore.ts server/src/__tests__/snapshotStore.test.ts
git commit -m "feat(snapshot): room_snapshots table + persist/load/delete (no-op DB-less)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wiring in `index.ts` — snapshot su transizione + periodico, delete al reap, restore al boot

Wiring sottile. Verificato dallo smoke (Task 6): la logica testabile vive in Task 1-4.

**Files:**
- Modify: `server/src/index.ts` — import; `advanceAndBroadcast`; `reapRoom`; un interval periodico; il blocco di boot dopo `migrate()`.

**Interfaces:**
- Consumes: `serializeRoom`/`deserializeRoom` (Task 2), `persistSnapshot`/`loadAllSnapshots`/`deleteSnapshot` (Task 4), `RoomStore.restore` (Task 3), `schedulePhase`/`reapRoom` esistenti.

- [ ] **Step 1: Import**

In testa a `server/src/index.ts`, accanto agli altri import di gioco:

```ts
import { serializeRoom, deserializeRoom } from './game/roomSnapshot';
import { persistSnapshot, loadAllSnapshots, deleteSnapshot } from './snapshotStore';
```

- [ ] **Step 2: Snapshot su transizione di fase**

In `advanceAndBroadcast`, dopo `broadcastGameState(code);`, aggiungi (fire-and-forget):

```ts
  const snapRoom = rooms.get(code);
  if (snapRoom) persistSnapshot(code, serializeRoom(snapRoom)).catch((e) => console.error('[snapshot] persist failed', e));
```

- [ ] **Step 3: Snapshot periodico (cattura i voti infra-fase)**

Vicino allo sweep delle stanze abbandonate, aggiungi un secondo interval:

```ts
const SNAPSHOT_INTERVAL_MS = 15_000;
setInterval(() => {
  for (const code of rooms.activeCodes()) {
    const room = rooms.get(code);
    if (room) persistSnapshot(code, serializeRoom(room)).catch((e) => console.error('[snapshot] persist failed', e));
  }
}, SNAPSHOT_INTERVAL_MS).unref();
```

Questo richiede un piccolo lettore su `RoomStore` per elencare i codici attivi — aggiungilo in `server/src/game/rooms.ts` dentro `RoomStore` (accanto a `get size`):

```ts
  /** Codes of all rooms currently in memory (for periodic snapshotting). */
  activeCodes(): string[] {
    return [...this.rooms.keys()];
  }
```

e un test in `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('RoomStore.activeCodes (snapshot)', () => {
  it('lists every live room code', () => {
    const store = new RoomStore();
    const a = store.create().code;
    const b = store.create().code;
    expect(store.activeCodes().sort()).toEqual([a, b].sort());
    store.delete(a);
    expect(store.activeCodes()).toEqual([b]);
  });
});
```

(Scrivi questo test PRIMA dell'implementazione di `activeCodes`, verifica rosso → verde, come da TDD; poi procedi al wiring.)

- [ ] **Step 4: Elimina lo snapshot al reaping**

In `reapRoom`, dopo `rooms.delete(code);`:

```ts
  deleteSnapshot(code).catch((e) => console.error('[snapshot] delete failed', e));
```

- [ ] **Step 5: Ripristino all'avvio**

Trova il blocco di boot che chiama `migrate()` (è in un `.then()` vicino a `httpServer.listen`). Dopo che `migrate()` ha risolto, ricarica gli snapshot:

```ts
migrate()
  .then(async () => {
    const snaps = await loadAllSnapshots();
    let restored = 0;
    for (const { code, json } of snaps) {
      try {
        const room = deserializeRoom(json);
        rooms.restore(room);
        schedulePhase(code); // re-arm the timer; a past expiry advances immediately
        restored++;
      } catch (e) {
        console.error('[snapshot] restore failed for', code, e);
      }
    }
    if (restored) console.log('[snapshot] restored', restored, 'room(s) from disk');
  })
  .catch((err) => console.error('[db] migrate failed', err));
```

(Adatta all'esatta forma del `.then()` esistente; se `migrate()` è già concatenato, integra il caricamento dentro lo stesso `.then`.)

- [ ] **Step 6: Verifica statica + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti verdi (incluso il test `activeCodes`).

```bash
git add server/src/index.ts server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(snapshot): persist on phase change + periodic, restore at boot, delete on reap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Verifica end-to-end con DB + chiusura

- [ ] **Step 1: Suite completa verde**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti e quattro verdi.

- [ ] **Step 2: Smoke con Postgres locale**

Avvia un Postgres locale (o usa il `DATABASE_URL` di staging) e lancia il server con `DATABASE_URL` impostato:
- Crea una stanza, avvia una partita, porta la partita oltre il primo voto.
- Verifica nei log `[snapshot] persist` e che la riga compaia in `room_snapshots` (`SELECT code, updated_at FROM room_snapshots`).
- **Riavvia** il server e verifica nei log `[snapshot] restored N room(s)`; un telefono con token deve riprendere la sessione.
- Termina la partita (FINAL_AWARDS) e poi falla reapare (tutti escono): verifica che la riga in `room_snapshots` venga eliminata.

- [ ] **Step 3: Verifica DB-less invariata**

Senza `DATABASE_URL`: avvia, gioca un round, conferma nessun errore e nessun cambiamento di comportamento (snapshot no-op).

- [ ] **Step 4: Chiusura ramo**

Invoca `superpowers:finishing-a-development-branch`. Merge in `ralph/skeleton-dilemma` con `--ff-only` durante una finestra tranquilla (vedi vincolo di esecuzione in testa).

---

## Self-Review

**Spec coverage (vs `2026-06-21-stabilizzazione-design.md`, sezione Fase 3):**
- Modulo isolato `roomSnapshot` (serialize/deserialize) → Task 2. ✓
- Riuso del layer Postgres esistente → Task 4 (`snapshotStore`, riusa `pool`/`dbEnabled`/`migrate`). ✓
- Snapshot su transizione di fase + periodico → Task 5 (step 2 + 3). ✓
- Ricarica all'avvio + ripresa sessioni con token → Task 5 step 5 (i token sopravvivono in memoria solo finché il processo vive; dopo un riavvio il telefono ri-emette `player:join` col token salvato in localStorage e la stanza ripristinata ha lo stesso `playerId`, quindi il path di reconnect esistente lo riaggancia). ✓
- Logica di gioco in-memory invariata → `rooms.ts` cambia solo per `restore`/`activeCodes` (additivi). ✓
- Serializzazione di TUTTE le Map → garantita dal replacer generico (field-agnostic), non da un elenco di campi → robusto alla crescita di `Room`. ✓
- Segretezza → lo snapshot è solo su DB server-side, mai broadcastato. ✓
- Test round-trip preserva lo stato (incluse Map + Deck) → Task 2. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step mostra codice/comando con output atteso. Gli adattamenti agli anchor di `index.ts` sono segnalati (file caldo Ralph) ma il codice da inserire è completo.

**Type consistency:** `serializeRoom(room): string` / `deserializeRoom(json): string→Room`; `persistSnapshot(code, json)` / `loadAllSnapshots(): {code,json}[]` / `deleteSnapshot(code)`; `RoomStore.restore(room)` / `RoomStore.activeCodes(): string[]`; `Deck.cards: Dilemma[]` — usati coerentemente tra i task.
