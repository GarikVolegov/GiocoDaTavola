# Grazia più lunga, rimozione offline, pausa di gioco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere il sistema di riconnessione esistente (token stabile + grazia + snapshot) con: una finestra di grazia da 5 minuti, un comando del leader per liberare manualmente un giocatore offline, e una pausa/ripresa esplicita del gioco che non disconnette nessuno.

**Architecture:** Tre pezzi indipendenti ma correlati, tutti dentro l'infrastruttura server-autoritativa esistente (Socket.IO + `RoomStore` in-memory): (1) due costanti di timeout in `server/src/index.ts`; (2) un metodo `RoomStore.removeIfOffline` che riusa `leave()`, esposto via un nuovo evento `leader:removePlayer`; (3) un flag `Room.paused` con un **unico guard** dentro `RoomStore.advancePhase`/`skipDilemma` (il choke-point condiviso da ogni via di avanzamento fase — timer, force-advance, voto completo), pilotato da `leader:pauseGame`/`leader:resumeGame`. Lato client, tutto passa dal menu ⋮ già esistente (`LeaveGameMenu.tsx`, sul telefono del leader) più un nuovo overlay a schermo intero (`PauseOverlay`) condiviso tra `/host` e i telefoni.

**Tech Stack:** Node + Express + Socket.IO (TypeScript CommonJS) lato server; React + Vite (TypeScript ESM) lato client; Vitest per i test (server: Node; client: jsdom + Testing Library). Nessun DB coinvolto (i nuovi campi di `Room` sopravvivono al restore da snapshot gratuitamente, essendo valori JSON piatti).

## Global Constraints

- `npm run typecheck && npm run lint && npm test && npm run build` devono restare verdi prima di ogni commit (CLAUDE.md di progetto).
- Mai `git add -A`/`.`/`commit -a`: ogni commit usa pathspec espliciti.
- Votes/identità restano segreti: nessuna modifica di questo piano tocca quell'invariante.
- Server (CJS) e client (ESM) restano moduli separati; non introdurre import cross-boundary.
- Evitare `any` (errore di lint); prefissare con `_` argomenti/variabili volutamente inutilizzati.
- Stile dei commenti del progetto: solo dove il PERCHÉ non è ovvio dal codice; niente commenti che ripetono cosa fa il codice.
- Spec di riferimento (architettura approvata): `docs/superpowers/specs/2026-07-13-pausa-rimozione-grazia-design.md`.

---

## Task 1: Finestra di grazia 45s → 5 minuti + backstop 30 minuti

**Files:**
- Modify: `server/src/index.ts:85`, `server/src/index.ts:90`
- Modify: `server/src/game/rooms.ts:2824-2833` (commento di `restore()`, per non restare stantio)

**Interfaces:**
- Consumes: nessuna (costanti pure, nessuna dipendenza da altri task).
- Produces: `RECONNECT_GRACE_MS`/`ABANDONED_ROOM_MAX_IDLE_MS` con i nuovi valori — i task successivi non dipendono da questo task, ma va bene farlo per primo perché è il più piccolo e isolato.

- [ ] **Step 1: Aggiorna le due costanti in `server/src/index.ts`**

Sostituisci (riga 85):

```ts
// How long a disconnected phone keeps its seat + secret vote before removal.
const RECONNECT_GRACE_MS = 45_000;
```

con:

```ts
// How long a disconnected phone keeps its seat + secret vote before removal.
// 5 minutes covers a real short break (bagno, telefonata, la porta), not just
// a screen-lock blip.
const RECONNECT_GRACE_MS = 5 * 60_000;
```

Sostituisci (riga 90):

```ts
const ABANDONED_ROOM_MAX_IDLE_MS = 5 * 60_000; // 5 min, >> RECONNECT_GRACE_MS
```

con:

```ts
const ABANDONED_ROOM_MAX_IDLE_MS = 30 * 60_000; // 30 min, >> RECONNECT_GRACE_MS
```

- [ ] **Step 2: Aggiorna il commento ormai stantio in `server/src/game/rooms.ts`**

Il commento del metodo `restore()` (circa riga 2824-2833) descrive esplicitamente "5-minute window" e "tight 45s" — con i nuovi valori diventa impreciso. Sostituisci:

```ts
  /**
   * Reinsert a room rebuilt from a crash-recovery snapshot at boot. No socket
   * survives a restart, so every human is marked disconnected (bots are
   * untouched — they have no socket to lose and connectedHumanCount ignores
   * them anyway): without this, a room nobody reconnects to would never trip
   * connectedHumanCount === 0 and would sit in memory forever instead of being
   * caught by the abandoned-room sweep. Reconnecting phones still get their
   * generous 5-minute window via that sweep, not the tight 45s live-disconnect
   * grace period (which would evict everyone before they notice the restart).
   */
```

con:

```ts
  /**
   * Reinsert a room rebuilt from a crash-recovery snapshot at boot. No socket
   * survives a restart, so every human is marked disconnected (bots are
   * untouched — they have no socket to lose and connectedHumanCount ignores
   * them anyway): without this, a room nobody reconnects to would never trip
   * connectedHumanCount === 0 and would sit in memory forever instead of being
   * caught by the abandoned-room sweep. Reconnecting phones still get their
   * generous 30-minute window via that sweep, not the tighter 5-minute live-
   * disconnect grace period (which would evict everyone before they notice
   * the restart).
   */
```

- [ ] **Step 3: Verifica che nessun test dipenda dai vecchi valori**

Run: `cd /Users/gazz/gioco-dibattiti && npm test 2>&1 | tail -30`
Expected: PASS (nessun test referenzia direttamente `RECONNECT_GRACE_MS`/`ABANDONED_ROOM_MAX_IDLE_MS` — sono costanti interne a `index.ts`, non importate dai test di `rooms.ts`).

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts server/src/game/rooms.ts
git commit -m "$(cat <<'EOF'
feat(reconnect): grazia 45s -> 5min, backstop abbandono a 30min

Una vera breve pausa (bagno, telefonata) supera facilmente i 45s
precedenti. Il backstop di pulizia stanze sale in proporzione per
restare ampiamente sopra la nuova grazia per-giocatore.
EOF
)"
```

---

## Task 2: `RoomStore.removeIfOffline` — rimozione manuale di un giocatore offline

**Files:**
- Modify: `server/src/game/rooms.ts` (nuovo metodo, subito dopo `leave()` a riga 2745)
- Test: `server/src/game/__tests__/rooms.test.ts` (nuovo `describe` in fondo al file)

**Interfaces:**
- Consumes: `this.rooms.get(code)`, `player.connected` (esistente), `this.leave(code, playerId)` (esistente, riga 2716).
- Produces: `RoomStore.removeIfOffline(code: string, playerId: string): boolean` — usato dal Task 3 (`leader:removePlayer` in index.ts).

- [ ] **Step 1: Scrivi il test (fallirà: il metodo non esiste ancora)**

Aggiungi in fondo a `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('RoomStore.removeIfOffline', () => {
  it('removes only a player currently flagged offline', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.setConnected(code, 'p1', false);

    expect(store.removeIfOffline(code, 'p1')).toBe(true);
    expect(store.listPlayers(code)).toHaveLength(1);
    expect(store.get(code)?.players.has('p1')).toBe(false);
  });

  it('rejects an online player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.removeIfOffline(code, 'p1')).toBe(false);
    expect(store.listPlayers(code)).toHaveLength(1);
  });

  it('rejects an unknown room or player', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    expect(store.removeIfOffline('ZZZZ', 'p1')).toBe(false);
    expect(store.removeIfOffline(code, 'ghost')).toBe(false);
  });

  it('reassigns leadership when the removed offline player was the leader', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'p1', 'Ann');
    store.join(code, 'p2', 'Bob');
    store.setLeader(code, 'p1');
    store.setConnected(code, 'p1', false);

    expect(store.removeIfOffline(code, 'p1')).toBe(true);
    expect(store.get(code)?.leaderId).toBe('p2');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "removeIfOffline"`
Expected: FAIL — `store.removeIfOffline is not a function`.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, subito dopo la chiusura di `leave()` (dopo la riga `}` che chiude il metodo a riga 2745), aggiungi:

```ts
  /**
   * The leader's manual override: free an offline player's seat before the
   * automatic grace period (index.ts) would. Rejects an online player (only
   * an already-absent seat can be freed this way) or an unknown room/player.
   * Reuses `leave()`'s cleanup so a manual removal behaves exactly like an
   * automatic grace-expiry removal (votes, queues, leadership...).
   */
  removeIfOffline(code: string, playerId: string): boolean {
    const player = this.rooms.get(code)?.players.get(playerId);
    if (!player || player.connected !== false) return false;
    return this.leave(code, playerId);
  }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "removeIfOffline"`
Expected: PASS (4 test).

- [ ] **Step 5: Gate del modulo server**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace server && npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: nessun errore TS, tutti i test di `rooms.test.ts` verdi.

- [ ] **Step 6: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "$(cat <<'EOF'
feat(reconnect): RoomStore.removeIfOffline libera manualmente un posto

Riusa leave() dopo aver verificato che il giocatore sia già offline —
rifiuta un giocatore online, cosi' il leader non puo' buttare fuori
qualcuno che sta ancora giocando.
EOF
)"
```

---

## Task 3: `leader:removePlayer` — evento socket + test di integrazione

**Files:**
- Modify: `server/src/index.ts` (nuovo handler, subito dopo `leader:removeBot` a riga 753)
- Test: `server/src/__tests__/integration.test.ts` (nuovo `describe` in fondo al file)

**Interfaces:**
- Consumes: `RoomStore.removeIfOffline` (Task 2), `leaderCodeFor`, `cancelGrace`, `tokens`, `broadcastLobby`, `refreshAfterRosterChange`, `broadcastGameState`, `isVotingPhase`, `reapRoom` — tutti già definiti in `index.ts`.
- Produces: evento `leader:removePlayer` — nessun altro task lo consuma lato server; il Task 10 lo consuma lato client.

- [ ] **Step 1: Scrivi il test di integrazione (fallirà: l'evento non esiste ancora)**

Aggiungi in fondo a `server/src/__tests__/integration.test.ts` (dopo la chiusura dell'ultimo `describe` esistente):

```ts
describe('rimozione manuale di un giocatore offline (socket)', () => {
  it('leader:removePlayer frees an offline seat for a new join', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Boss' });
    const { code } = await leaderJoinedP;

    const phone = await connect();
    const joinedP = once<JoinedPayload>(phone, 'player:joined');
    phone.emit('player:join', { code, nickname: 'Alice' });
    const { player } = await joinedP;

    // Alice's phone drops — she's now offline (well before the 5-minute grace).
    const offlineRosterP = new Promise<{ players: { id: string; connected?: boolean }[] }>(
      (resolve) => leader.once('lobby:update', resolve),
    );
    phone.disconnect();
    const offlineRoster = await offlineRosterP;
    expect(offlineRoster.players.find((p) => p.id === player.id)?.connected).toBe(false);

    // Leader manually frees her seat instead of waiting.
    const removedRosterP = new Promise<{ players: { id: string }[] }>((resolve) =>
      leader.once('lobby:update', resolve),
    );
    leader.emit('leader:removePlayer', { id: player.id });
    const removedRoster = await removedRosterP;
    expect(removedRoster.players.find((p) => p.id === player.id)).toBeUndefined();
  }, 15000);
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca (timeout)**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/__tests__/integration.test.ts -t "leader:removePlayer"`
Expected: FAIL (timeout dopo 15000ms) — nessun `lobby:update` arriva in risposta a un evento sconosciuto.

- [ ] **Step 3: Implementa l'handler**

In `server/src/index.ts`, subito dopo l'handler `leader:removeBot` (dopo la riga `});` che lo chiude, circa riga 753), aggiungi:

```ts
  // The leader manually frees an OFFLINE player's seat (before the automatic
  // grace period elapses). Rejects an online player or an unknown id. Mirrors
  // the automatic grace-expiry path (below, on 'disconnect') so a manual
  // removal behaves exactly like an early grace expiry: same cleanup, same
  // roster/game-state refresh.
  socket.on('leader:removePlayer', (payload: { id?: string }) => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    const id = String(payload?.id ?? '');
    const wasLeader = rooms.isLeader(code, id);
    if (!rooms.removeIfOffline(code, id)) return;
    // Cancel the now-moot grace timer + drop the stale reconnect token, same
    // cleanup the timer itself runs when it fires naturally (see below).
    cancelGrace(id);
    const tok = [...tokens].find(([, v]) => v.playerId === id)?.[0];
    if (tok) tokens.delete(tok);
    if (rooms.get(code) && rooms.get(code)!.players.size === 0) {
      reapRoom(code);
      return;
    }
    broadcastLobby(code);
    if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);
    if (wasLeader) broadcastGameState(code);
  });
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/__tests__/integration.test.ts -t "leader:removePlayer"`
Expected: PASS.

- [ ] **Step 5: Gate completo del server**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace server && npx vitest run server/src`
Expected: nessun errore TS, tutti i test server verdi (inclusi quelli già esistenti — nessuna regressione).

- [ ] **Step 6: Commit**

```bash
git add server/src/index.ts server/src/__tests__/integration.test.ts
git commit -m "$(cat <<'EOF'
feat(reconnect): leader:removePlayer libera un giocatore offline

Espone RoomStore.removeIfOffline via socket, con la stessa pulizia
(grace timer, token) che gia' gira alla scadenza automatica della
grazia.
EOF
)"
```

---

## Task 4: `Room.paused` / `Room.pausedRemainingMs` + `RoomStore.pauseGame`/`resumeGame`

**Files:**
- Modify: `server/src/game/rooms.ts` (interfaccia `Room`, `emptyRoom`, due nuovi metodi)
- Test: `server/src/game/__tests__/rooms.test.ts` (nuovo `describe`)

**Interfaces:**
- Consumes: `this.now()`, `room.phaseExpiresAt` (esistenti).
- Produces: `Room.paused: boolean`, `Room.pausedRemainingMs: number | null`; `RoomStore.pauseGame(code): boolean`; `RoomStore.resumeGame(code): boolean` — consumati dal Task 5 (guard) e dal Task 6 (handler socket).

- [ ] **Step 1: Scrivi i test (falliranno: i campi/metodi non esistono ancora)**

Aggiungi in fondo a `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('RoomStore.pauseGame / resumeGame', () => {
  function startedRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count);
    return code;
  }

  it('freezes the countdown and restores it on resume, preserving the remaining time', () => {
    let now = 10_000;
    const store = new RoomStore(generateRoomCode, () => now);
    const code = startedRoom(store); // PHASE_INTRO
    const expiresAtPause = 10_000 + PHASE_DURATIONS_MS.PHASE_INTRO!;
    now = 12_000; // 2s elapsed since PHASE_INTRO started

    expect(store.pauseGame(code)).toBe(true);
    const paused = store.get(code)!;
    expect(paused.paused).toBe(true);
    expect(paused.phaseExpiresAt).toBeNull();
    expect(paused.pausedRemainingMs).toBe(expiresAtPause - 12_000);

    now = 60_000; // however long the pause lasts is irrelevant
    expect(store.resumeGame(code)).toBe(true);
    const resumed = store.get(code)!;
    expect(resumed.paused).toBe(false);
    expect(resumed.pausedRemainingMs).toBeNull();
    expect(resumed.phaseExpiresAt).toBe(60_000 + (expiresAtPause - 12_000));
  });

  it('rejects pausing in LOBBY, FINAL_AWARDS, or DUO_PORTRAIT', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.pauseGame(code)).toBe(false); // LOBBY
  });

  it('rejects pausing twice, and rejects resuming when not paused', () => {
    const store = new RoomStore(generateRoomCode, () => 0);
    const code = startedRoom(store);
    expect(store.pauseGame(code)).toBe(true);
    expect(store.pauseGame(code)).toBe(false); // already paused
    expect(store.resumeGame(code)).toBe(true);
    expect(store.resumeGame(code)).toBe(false); // not paused anymore
  });

  it('rejects an unknown room', () => {
    const store = new RoomStore();
    expect(store.pauseGame('ZZZZ')).toBe(false);
    expect(store.resumeGame('ZZZZ')).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "pauseGame"`
Expected: FAIL — `store.pauseGame is not a function`.

- [ ] **Step 3: Aggiungi i due campi all'interfaccia `Room`**

In `server/src/game/rooms.ts`, sostituisci (circa riga 336-337):

```ts
  /** Epoch ms when the current phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
```

con:

```ts
  /** Epoch ms when the current phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** True while the leader has explicitly paused the game (menu ⋮ "Metti in
   * pausa"): no phase transition runs (advancePhase/skipDilemma both refuse)
   * until resumeGame(); phaseExpiresAt is frozen (null) while paused so the
   * client countdown simply disappears. */
  paused: boolean;
  /** How much time was left on the current phase's countdown when paused;
   * null if the phase had no active timer. Restored into phaseExpiresAt by
   * resumeGame(). Meaningless while `paused` is false. */
  pausedRemainingMs: number | null;
```

- [ ] **Step 4: Aggiungi i default in `emptyRoom`**

Sostituisci (circa riga 942):

```ts
    phaseExpiresAt: null,
    deck: null,
```

con:

```ts
    phaseExpiresAt: null,
    paused: false,
    pausedRemainingMs: null,
    deck: null,
```

- [ ] **Step 5: Implementa `pauseGame`/`resumeGame`**

In `server/src/game/rooms.ts`, subito dopo la chiusura di `skipDilemma()` (dopo la riga `}` a riga 1534, prima del commento doc di `advancePhase`), aggiungi:

```ts
  /**
   * Freeze the current phase's countdown indefinitely (the leader's explicit
   * pause, distinct from a per-player disconnect). No-op outside an active
   * round (LOBBY/FINAL_AWARDS/DUO_PORTRAIT have nothing to stop) or if
   * already paused. `advancePhase`/`skipDilemma` both refuse to run while
   * `paused` is true, so no phase transition — timer, force-advance, or a
   * completed vote — lands until `resumeGame`, no matter what triggers it.
   */
  pauseGame(code: string): boolean {
    const room = this.rooms.get(code);
    if (
      !room ||
      room.paused ||
      room.phase === 'LOBBY' ||
      room.phase === 'FINAL_AWARDS' ||
      room.phase === 'DUO_PORTRAIT'
    ) {
      return false;
    }
    room.pausedRemainingMs =
      room.phaseExpiresAt != null ? Math.max(0, room.phaseExpiresAt - this.now()) : null;
    room.phaseExpiresAt = null;
    room.paused = true;
    return true;
  }

  /**
   * Resume a paused game: restores the frozen countdown from where it left
   * off (index.ts reschedules the actual timer against the new expiry).
   * No-op if not currently paused.
   */
  resumeGame(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.paused) return false;
    room.phaseExpiresAt =
      room.pausedRemainingMs != null ? this.now() + room.pausedRemainingMs : null;
    room.paused = false;
    room.pausedRemainingMs = null;
    return true;
  }
```

- [ ] **Step 6: Esegui il test e verifica che passi**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "pauseGame"`
Expected: PASS (4 test).

- [ ] **Step 7: Gate del modulo server**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace server && npx vitest run server/src/game/__tests__/rooms.test.ts`
Expected: nessun errore TS (compresi gli altri punti del codice che costruiscono un `Room` a mano, se presenti — il typecheck lo segnala), tutti i test verdi.

- [ ] **Step 8: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "$(cat <<'EOF'
feat(pausa): Room.paused + RoomStore.pauseGame/resumeGame

Congela il countdown della fase corrente (phaseExpiresAt) e lo
ripristina identico alla ripresa. Non tocca ancora l'avanzamento
di fase: arriva nel prossimo commit.
EOF
)"
```

---

## Task 5: Guard `paused` in `advancePhase` e `skipDilemma`

**Files:**
- Modify: `server/src/game/rooms.ts` (`AdvancePhaseError`/`SkipDilemmaError`, `advancePhase`, `skipDilemma`)
- Test: `server/src/game/__tests__/rooms.test.ts` (nuovo `describe`)

**Interfaces:**
- Consumes: `Room.paused` (Task 4).
- Produces: `advancePhase`/`skipDilemma` restituiscono `{ ok: false, error: 'PAUSED' }` quando la stanza è in pausa — questo è l'UNICO punto che il Task 6 deve rispettare: qualunque via di avanzamento futura che passi da `advancePhase` eredita il blocco gratis.

**Nota importante:** `skipDilemma` muta `room.phase = 'UNANIMOUS_REVEAL'` PRIMA di chiamare `this.advancePhase(code)` internamente (riga 1529-1530). Se il guard vivesse solo dentro `advancePhase`, una `skipDilemma` chiamata mentre la stanza è in pausa corromperebbe `room.phase` a `'UNANIMOUS_REVEAL'` (una fase sintetica mai pensata per essere visibile) senza mai riuscire ad uscirne — la stanza resterebbe rotta anche dopo la ripresa. Il guard va quindi duplicato in cima a `skipDilemma`, PRIMA di quella mutazione.

- [ ] **Step 1: Scrivi i test (falliranno: il guard non esiste ancora)**

Aggiungi in fondo a `server/src/game/__tests__/rooms.test.ts`:

```ts
describe('RoomStore.advancePhase / skipDilemma while paused', () => {
  function startedRoom(store: RoomStore, count = 3): string {
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, count);
    return code;
  }

  it('advancePhase refuses to advance while paused, and resumes normally after resumeGame', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedRoom(store);
    store.advancePhase(code); // DILEMMA_REVEAL
    expect(store.pauseGame(code)).toBe(true);

    expect(store.advancePhase(code)).toEqual({ ok: false, error: 'PAUSED' });
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL'); // untouched

    expect(store.resumeGame(code)).toBe(true);
    const result = store.advancePhase(code);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.room.phase).toBe('VOTE_1');
  });

  it('skipDilemma refuses to run while paused, without corrupting the phase', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck);
    const code = startedRoom(store);
    store.advancePhase(code); // DILEMMA_REVEAL (skippable)
    expect(store.pauseGame(code)).toBe(true);

    expect(store.skipDilemma(code)).toEqual({ ok: false, error: 'PAUSED' });
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL'); // NOT 'UNANIMOUS_REVEAL'
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "while paused"`
Expected: FAIL — `advancePhase`/`skipDilemma` restituiscono `{ ok: true, ... }` invece di `{ ok: false, error: 'PAUSED' }` (il guard non esiste ancora).

- [ ] **Step 3: Estendi i due union type di errore**

Sostituisci (riga 711):

```ts
export type AdvancePhaseError = 'ROOM_NOT_FOUND' | 'NO_NEXT_PHASE';
```

con:

```ts
export type AdvancePhaseError = 'ROOM_NOT_FOUND' | 'NO_NEXT_PHASE' | 'PAUSED';
```

Sostituisci (riga 717):

```ts
export type SkipDilemmaError = 'ROOM_NOT_FOUND' | 'NOT_SKIPPABLE_PHASE' | 'NOT_CLASSIC';
```

con:

```ts
export type SkipDilemmaError = 'ROOM_NOT_FOUND' | 'NOT_SKIPPABLE_PHASE' | 'NOT_CLASSIC' | 'PAUSED';
```

- [ ] **Step 4: Aggiungi il guard in `advancePhase`**

Sostituisci (circa riga 1542-1551):

```ts
  advancePhase(code: string): AdvancePhaseResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (
      room.phase === 'LOBBY' ||
      room.phase === 'FINAL_AWARDS' ||
      room.phase === 'DUO_PORTRAIT'
    ) {
      return { ok: false, error: 'NO_NEXT_PHASE' };
    }
```

con:

```ts
  advancePhase(code: string): AdvancePhaseResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.paused) return { ok: false, error: 'PAUSED' };
    if (
      room.phase === 'LOBBY' ||
      room.phase === 'FINAL_AWARDS' ||
      room.phase === 'DUO_PORTRAIT'
    ) {
      return { ok: false, error: 'NO_NEXT_PHASE' };
    }
```

- [ ] **Step 5: Aggiungi il guard in `skipDilemma`, PRIMA di mutare `room.phase`**

Sostituisci (circa riga 1520-1525):

```ts
  skipDilemma(code: string): SkipDilemmaResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.format !== 'classic' || room.mode === 'duello') {
      return { ok: false, error: 'NOT_CLASSIC' };
    }
```

con:

```ts
  skipDilemma(code: string): SkipDilemmaResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.paused) return { ok: false, error: 'PAUSED' };
    if (room.format !== 'classic' || room.mode === 'duello') {
      return { ok: false, error: 'NOT_CLASSIC' };
    }
```

- [ ] **Step 6: Esegui il test e verifica che passi**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/game/__tests__/rooms.test.ts -t "while paused"`
Expected: PASS (2 test).

- [ ] **Step 7: Gate completo del server (regressione su TUTTE le vie di avanzamento)**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace server && npx vitest run server/src`
Expected: nessun errore TS, tutti i test server verdi — in particolare tutti i test esistenti di `advancePhase`/`skipDilemma`/voto/duello (nessuno di quei percorsi passa mai con `room.paused === true`, quindi il nuovo guard non li tocca).

- [ ] **Step 8: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "$(cat <<'EOF'
feat(pausa): un solo guard blocca ogni avanzamento mentre in pausa

advancePhase() e' il choke-point condiviso da timer, force-advance e
ogni voto/submission completo (~19 punti di chiamata in index.ts) —
un guard li' basta per bloccarli tutti. skipDilemma() muta la fase
PRIMA di delegare ad advancePhase, quindi ha bisogno del suo stesso
guard per non corrompere room.phase mentre e' in pausa.
EOF
)"
```

---

## Task 6: `leader:pauseGame` / `leader:resumeGame` — eventi socket + `game:state.paused`

**Files:**
- Modify: `server/src/index.ts` (due nuovi handler, `gameStatePayload`)
- Test: `server/src/__tests__/integration.test.ts` (interfaccia `GameState`, nuovo `describe`)

**Interfaces:**
- Consumes: `RoomStore.pauseGame`/`resumeGame` (Task 4), il guard in `advancePhase` (Task 5), `leaderCodeFor`, `clearPhaseTimer`, `schedulePhase`, `broadcastGameState` — tutti già in `index.ts`.
- Produces: eventi `leader:pauseGame`/`leader:resumeGame`; `game:state.paused: boolean` — consumati dal Task 7 in poi lato client.

- [ ] **Step 1: Scrivi il test di integrazione (fallirà: gli eventi non esistono ancora)**

In `server/src/__tests__/integration.test.ts`, estendi l'interfaccia `GameState` in cima al file. Sostituisci (circa riga 16-21):

```ts
interface GameState {
  phase: string;
  split: { A: number; B: number } | null;
  votedCount: number;
  leaderId: string | null;
}
```

con:

```ts
interface GameState {
  phase: string;
  split: { A: number; B: number } | null;
  votedCount: number;
  leaderId: string | null;
  paused: boolean;
}
```

Poi aggiungi in fondo al file, dentro il nuovo `describe` già creato dal Task 3 (`'rimozione manuale di un giocatore offline (socket)'`), un secondo `it` — oppure un nuovo `describe` separato se preferisci tenerli distinti; qui li teniamo distinti per chiarezza:

```ts
describe('pausa e ripresa del gioco (socket)', () => {
  it('leader:pauseGame blocks phase advancement until leader:resumeGame', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Boss' });
    const { code } = await leaderJoinedP;

    const p2 = await connect();
    const p2JoinedP = once<JoinedPayload>(p2, 'player:joined');
    p2.emit('player:join', { code, nickname: 'P2' });
    await p2JoinedP;

    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'gruppo' });
    await introP;

    const revealP = waitForPhase(leader, 'DILEMMA_REVEAL');
    leader.emit('leader:advancePhase');
    await revealP;

    const voteP = waitForPhase(leader, 'VOTE_1');
    leader.emit('leader:advancePhase');
    await voteP;

    // Pause.
    const pausedP = new Promise<GameState>((resolve) => {
      const h = (s: GameState) => {
        if (s.paused) {
          leader.off('game:state', h);
          resolve(s);
        }
      };
      leader.on('game:state', h);
    });
    leader.emit('leader:pauseGame');
    const pausedState = await pausedP;
    expect(pausedState.phase).toBe('VOTE_1');

    // Force-advance is normally instant; while paused it must have no effect.
    const stalled = await new Promise<boolean>((resolve) => {
      const h = (s: GameState) => {
        if (s.phase === 'SPLIT_REVEAL') {
          leader.off('game:state', h);
          clearTimeout(timer);
          resolve(false); // it DID advance — the guard failed
        }
      };
      leader.on('game:state', h);
      const timer = setTimeout(() => {
        leader.off('game:state', h);
        resolve(true); // no advance within the window — the guard held
      }, 500);
    });
    leader.emit('leader:advancePhase');
    expect(stalled).toBe(true);

    // Resume, then the SAME force-advance works again.
    const resumedP = new Promise<GameState>((resolve) => {
      const h = (s: GameState) => {
        if (!s.paused) {
          leader.off('game:state', h);
          resolve(s);
        }
      };
      leader.on('game:state', h);
    });
    leader.emit('leader:resumeGame');
    await resumedP;

    const splitP = waitForPhase(leader, 'SPLIT_REVEAL');
    leader.emit('leader:advancePhase');
    await splitP; // resolves once SPLIT_REVEAL actually arrives
  }, 15000);
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca (timeout)**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/__tests__/integration.test.ts -t "leader:pauseGame"`
Expected: FAIL (timeout) — `leader:pauseGame` non esiste, nessun `game:state` con `paused: true` arriva mai.

- [ ] **Step 3: Esponi `paused` in `gameStatePayload`**

In `server/src/index.ts`, dentro `gameStatePayload()`, sostituisci (circa riga 159):

```ts
    phaseExpiresAt: room.phaseExpiresAt,
```

con:

```ts
    phaseExpiresAt: room.phaseExpiresAt,
    paused: room.paused,
```

- [ ] **Step 4: Implementa i due handler**

Subito dopo l'handler `leader:removePlayer` aggiunto nel Task 3, aggiungi:

```ts
  // The leader pauses the game: freezes the current phase's countdown
  // indefinitely. RoomStore.advancePhase/skipDilemma both refuse to run
  // while paused, so nothing advances — timer, force-advance, a completed
  // vote — until leader:resumeGame. No-op outside an active round or if
  // already paused.
  socket.on('leader:pauseGame', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (!rooms.pauseGame(code)) return;
    clearPhaseTimer(code);
    broadcastGameState(code);
  });

  // The leader resumes a paused game: restores the frozen countdown from
  // where it left off.
  socket.on('leader:resumeGame', () => {
    const code = leaderCodeFor(socket.id);
    if (!code) return;
    if (!rooms.resumeGame(code)) return;
    schedulePhase(code);
    broadcastGameState(code);
  });
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run server/src/__tests__/integration.test.ts -t "leader:pauseGame"`
Expected: PASS.

- [ ] **Step 6: Gate completo del server**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace server && npx vitest run server/src && npm run lint`
Expected: nessun errore TS/lint, tutti i test server verdi. (`lint` è un unico comando a livello di repo — `eslint .` — non c'è uno script `lint` per singolo workspace.)

- [ ] **Step 7: Commit**

```bash
git add server/src/index.ts server/src/__tests__/integration.test.ts
git commit -m "$(cat <<'EOF'
feat(pausa): leader:pauseGame/resumeGame + game:state.paused

Il leader ferma/riprende la partita dal proprio telefono. Il timer
server si ferma e riparte esattamente da dove era rimasto.
EOF
)"
```

---

## Task 7: Client — nuovi eventi socket + `GameStatePayload.paused`

**Files:**
- Modify: `client/src/shared/events.ts`

**Interfaces:**
- Consumes: nessuna (solo specchia le stringhe già decise lato server nei Task 3/6).
- Produces: `SocketEvents.LeaderRemovePlayer`, `SocketEvents.LeaderPauseGame`, `SocketEvents.LeaderResumeGame`; `GameStatePayload.paused: boolean` — consumati dai Task 9/10/11.

Nessun test dedicato: `events.ts` è puro specchio di costanti/tipi, verificato dal typecheck + dai test che li usano (Task 10).

- [ ] **Step 1: Aggiungi i tre eventi**

In `client/src/shared/events.ts`, sostituisci (circa riga 31-33):

```ts
  /** Leader adds a server-driven bot to fill a seat. */
  LeaderAddBot: 'leader:addBot',
  /** Leader removes a bot by id. */
  LeaderRemoveBot: 'leader:removeBot',
```

con:

```ts
  /** Leader adds a server-driven bot to fill a seat. */
  LeaderAddBot: 'leader:addBot',
  /** Leader removes a bot by id. */
  LeaderRemoveBot: 'leader:removeBot',
  /** Leader frees an OFFLINE human player's seat (manual override, before
   * the automatic grace period elapses). No-op if the target is online. */
  LeaderRemovePlayer: 'leader:removePlayer',
  /** Leader pauses the game: freezes the countdown indefinitely, nothing
   * advances until leader:resumeGame. */
  LeaderPauseGame: 'leader:pauseGame',
  /** Leader resumes a paused game, restoring the frozen countdown. */
  LeaderResumeGame: 'leader:resumeGame',
```

- [ ] **Step 2: Aggiungi `paused` a `GameStatePayload`**

Sostituisci (circa riga 814-815):

```ts
  /** Epoch ms when the phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
```

con:

```ts
  /** Epoch ms when the phase auto-advances; null if it has no timer. */
  phaseExpiresAt: number | null;
  /** True while the leader has paused the game; no phase advances until they
   * resume. The countdown (phaseExpiresAt) is null while paused. */
  paused: boolean;
```

- [ ] **Step 3: Typecheck del client**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace client`
Expected: PASS. Nessun file client costruisce un `GameStatePayload` come literal tipato (`PlayerApp.tsx`/`HostApp.tsx` lo ricevono via socket in uno `useState<GameStatePayload | null>(null)`, senza mai assemblarne uno a mano); i test lo passano a `serverEmit(event: string, payload: unknown)`, non tipizzato. Il nuovo campo obbligatorio `paused` non ha quindi nessun sito di costruzione esistente da aggiornare.

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/events.ts
git commit -m "$(cat <<'EOF'
feat(pausa): eventi client leader:pauseGame/resumeGame/removePlayer

Specchia lato client i tre eventi socket aggiunti server-side, piu'
GameStatePayload.paused.
EOF
)"
```

---

## Task 8: `PauseOverlay` — componente condiviso host + telefono

**Files:**
- Create: `client/src/shared/ui/PauseOverlay.tsx`
- Create: `client/src/shared/ui/PauseOverlay.module.css`
- Modify: `client/src/shared/ui/index.ts` (barrel export)

**Interfaces:**
- Consumes: `Button`, `Card` (già in `client/src/shared/ui/`).
- Produces: `PauseOverlay({ onResume?: () => void })` — un div fisso a schermo intero. Consumato dai Task 10 (telefono, con `onResume` solo per il leader) e 11 (host, sempre senza `onResume`).

Nessun test dedicato (componente puramente presentazionale, stesso trattamento di `RoomCodeChip` che non ha un file di test — la logica di "chi vede il bottone" è testata a livello di `PlayerApp.test.tsx` nel Task 10).

- [ ] **Step 1: Crea il componente**

`client/src/shared/ui/PauseOverlay.tsx`:

```tsx
import { Button } from './Button';
import { Card } from './Card';
import styles from './PauseOverlay.module.css';

// Full-screen cover shown on /host and every phone while the leader has
// paused the game (menu ⋮ "Metti in pausa"). Sockets stay connected — this
// is a game-state overlay, not a disconnection. Only the leader gets the
// resume control; everyone else just waits.
export function PauseOverlay({ onResume }: { onResume?: () => void }) {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <Card glow="accent" className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          ⏸
        </span>
        <h2 className={styles.title}>Partita in pausa</h2>
        <p className={styles.hint}>
          {onResume ? 'Riprendi quando siete pronti.' : 'Riprende a breve — resta connesso.'}
        </p>
        {onResume && (
          <Button type="button" variant="primary" onClick={onResume}>
            ▶ Riprendi
          </Button>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Crea lo stile**

`client/src/shared/ui/PauseOverlay.module.css`:

```css
/* Full-screen cover for an explicit game pause — sits above the phase view
   and the room-code chip, below the ⋮ menu (still reachable while paused). */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(8, 12, 24, 0.82);
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  max-width: 22rem;
}
.icon {
  font-size: 2.5rem;
  line-height: 1;
}
.title {
  margin: 0;
  font-family: var(--font-serif);
  letter-spacing: var(--tracking-serif);
  font-size: 1.6rem;
}
.hint {
  margin: 0;
  opacity: 0.75;
  font-size: 1rem;
}
```

- [ ] **Step 3: Esporta dal barrel**

In `client/src/shared/ui/index.ts`, aggiungi in fondo:

```ts
export { PauseOverlay } from './PauseOverlay';
```

- [ ] **Step 4: Typecheck + lint del client**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace client && npm run lint`
Expected: nessun errore.

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/ui/PauseOverlay.tsx client/src/shared/ui/PauseOverlay.module.css client/src/shared/ui/index.ts
git commit -m "$(cat <<'EOF'
feat(pausa): componente PauseOverlay condiviso host + telefono

Overlay a schermo intero, col bottone di ripresa solo quando il
chiamante passa onResume (il leader).
EOF
)"
```

---

## Task 9: `LeaveGameMenu.tsx` — pausa + rimozione offline nel menu ⋮

**Files:**
- Modify: `client/src/player/LeaveGameMenu.tsx`

**Interfaces:**
- Consumes: nessuna dipendenza esterna nuova (solo props).
- Produces: nuove prop `onPause?`, `offlinePlayers?`, `onRemovePlayer?` — consumate dal Task 10.

Nessun test in questo task: il comportamento del menu è testato end-to-end dentro `PlayerApp.test.tsx` nel Task 10 (stesso pattern già usato per `onAddBot`, che non ha un test dedicato a `LeaveGameMenu.tsx` da solo).

- [ ] **Step 1: Riscrivi il componente con le nuove prop e la vista "rimuovi assenti"**

Sostituisci l'intero contenuto di `client/src/player/LeaveGameMenu.tsx`:

```tsx
import { useState, type CSSProperties } from 'react';

// A deliberately hard-to-reach exit for use DURING a game: a small, low-opacity ⋮
// fixed top-right that opens a sheet, behind a two-tap confirm. Three deliberate
// actions (open menu → tap exit → confirm) so a stray tap never drops a player out.
// The actual leave is the parent's job (`onLeave`); this only gates it behind intent.
// The leader ALSO gets a one-tap "aggiungi bot" here at a round boundary (3.5, to
// reintegrate a drop-out) — low-risk and reversible, so no confirm step needed.
// Two more leader-only entries (pausa, rimozione di un assente) follow the same
// low-risk/reversible logic: no confirm step, they only ever apply to an offline
// player or freeze the round, never eject someone who is actually playing.
export default function LeaveGameMenu({
  onLeave,
  onAddBot,
  onPause,
  offlinePlayers,
  onRemovePlayer,
}: {
  onLeave: () => void;
  /** Present only when the leader may add a bot right now (a round boundary). */
  onAddBot?: () => void;
  /** Present only for the leader, only when the game has started and isn't
   * already paused (resuming happens on the full-screen PauseOverlay instead). */
  onPause?: () => void;
  /** Offline human players the leader may remove; present only for the
   * leader. An empty/undefined list hides the "rimuovi" entry entirely. */
  offlinePlayers?: { id: string; nickname: string }[];
  onRemovePlayer?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirming(false);
    setRemoving(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Menu della partita"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        style={triggerStyle}
      >
        ⋮
      </button>

      {open && (
        <>
          {/* tap-outside backdrop: closes the sheet without leaving */}
          <div aria-hidden="true" onClick={close} style={backdropStyle} />
          <div role="menu" style={sheetStyle}>
            {removing ? (
              <>
                {(offlinePlayers ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onRemovePlayer?.(p.id);
                      setRemoving(false);
                    }}
                    style={cancelStyle}
                  >
                    ✕ {p.nickname}
                  </button>
                ))}
                <button type="button" onClick={() => setRemoving(false)} style={cancelStyle}>
                  ← Indietro
                </button>
              </>
            ) : (
              <>
                {onPause && (
                  <button
                    type="button"
                    onClick={() => {
                      onPause();
                      close();
                    }}
                    style={cancelStyle}
                  >
                    ⏸ Metti in pausa
                  </button>
                )}
                {onRemovePlayer && offlinePlayers && offlinePlayers.length > 0 && (
                  <button type="button" onClick={() => setRemoving(true)} style={cancelStyle}>
                    🔌 Rimuovi chi è assente
                  </button>
                )}
                {onAddBot && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddBot();
                      close();
                    }}
                    style={cancelStyle}
                  >
                    🤖 Aggiungi bot
                  </button>
                )}
                {confirming ? (
                  <button
                    type="button"
                    onClick={() => {
                      onLeave();
                      close();
                    }}
                    style={exitStyle}
                  >
                    Esci davvero
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirming(true)} style={exitStyle}>
                    Esci dalla partita
                  </button>
                )}
                <button type="button" onClick={close} style={cancelStyle}>
                  Annulla
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

const triggerStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + var(--space-2))',
  right: 'calc(env(safe-area-inset-right, 0px) + var(--space-2))',
  zIndex: 50,
  width: '2.25rem',
  height: '2.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  opacity: 0.4,
  fontSize: '1.4rem',
  lineHeight: 1,
  cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 49,
  background: 'transparent',
};

const sheetStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + var(--space-7))',
  right: 'calc(env(safe-area-inset-right, 0px) + var(--space-2))',
  zIndex: 51,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3)',
  minWidth: '12rem',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
};

const exitStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--terracotta, inherit)',
  fontSize: '0.95rem',
  fontWeight: 700,
  textAlign: 'center',
  padding: 'var(--space-1) 0',
  cursor: 'pointer',
};

const cancelStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  textAlign: 'center',
  padding: 'var(--space-1) 0',
  cursor: 'pointer',
};
```

- [ ] **Step 2: Typecheck + lint del client**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace client && npm run lint`
Expected: nessun errore (le nuove prop sono tutte opzionali, quindi ogni chiamante esistente — se ce ne fossero altri oltre a `PlayerApp.tsx` — resta valido).

- [ ] **Step 3: Commit**

```bash
git add client/src/player/LeaveGameMenu.tsx
git commit -m "$(cat <<'EOF'
feat(pausa): menu ⋮ — metti in pausa + rimuovi chi è assente

Due nuove voci leader-only, stesso spirito basso-rischio di
"aggiungi bot": nessuna doppia conferma, perché si applicano solo a
un assente o congelano il round (mai un'espulsione di chi gioca).
EOF
)"
```

---

## Task 10: `PlayerApp.tsx` — wiring completo (emit, overlay, menu) + test

**Files:**
- Modify: `client/src/player/PlayerApp.tsx`
- Test: `client/src/player/PlayerApp.test.tsx` (nuovi `it` in fondo al `describe('PlayerApp', ...)`)

**Interfaces:**
- Consumes: `SocketEvents.LeaderPauseGame/LeaderResumeGame/LeaderRemovePlayer` (Task 7), `GameStatePayload.paused` (Task 7), `PauseOverlay` (Task 8), `LeaveGameMenu`'s nuove prop (Task 9).
- Produces: comportamento visibile end-to-end sul telefono — nessun altro task lo consuma.

- [ ] **Step 1: Scrivi i test (falliranno: il wiring non esiste ancora)**

Aggiungi dentro `describe('PlayerApp', ...)` in `client/src/player/PlayerApp.test.tsx`, per esempio subito dopo il test `'does not offer "aggiungi bot" in the ⋮ menu to a non-leader at PHASE_RESULTS'` (circa riga 2586):

```ts
  it('shows the pause overlay to everyone when the game is paused, without a resume button for a non-leader', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        paused: true,
        leaderId: 'p2', // NOT me
      });
    });
    expect(screen.getByText('Partita in pausa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /riprendi/i })).toBeNull();
  });

  it('lets the leader resume a paused game from the overlay', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        paused: true,
        leaderId: 'p1', // I'm the leader
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /riprendi/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:resumeGame');
  });

  it('lets the leader pause the game via the ⋮ menu', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        paused: false,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    fireEvent.click(screen.getByRole('button', { name: /metti in pausa/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:pauseGame');
  });

  it('does not offer "metti in pausa" in the ⋮ menu to a non-leader', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        paused: false,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p2', // NOT me
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    expect(screen.queryByRole('button', { name: /metti in pausa/i })).toBeNull();
  });

  it('lets the leader remove an offline player from the ⋮ menu', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea', connected: false },
        ],
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        paused: false,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    fireEvent.click(screen.getByRole('button', { name: /rimuovi chi è assente/i }));
    fireEvent.click(screen.getByRole('button', { name: /bea/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:removePlayer', { id: 'p2' });
  });

  it('does not offer "rimuovi chi è assente" in the ⋮ menu when nobody is offline', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
        ],
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        paused: false,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    expect(screen.queryByRole('button', { name: /rimuovi chi è assente/i })).toBeNull();
  });
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: le 6 nuove `it(...)` aggiunte allo Step 1 falliscono (nessuna trova "Partita in pausa" nel DOM, nessun bottone "Metti in pausa"/"Rimuovi chi è assente" nel menu); tutti gli altri test del file (quelli già esistenti prima di questo task) restano verdi.

- [ ] **Step 3: Aggiungi l'import di `PauseOverlay`**

In `client/src/player/PlayerApp.tsx`, sostituisci (riga 59):

```ts
import { Card, JoinQr, Button, Field, TextInput, Alert, ShareInviteButton } from '../shared/ui';
```

con:

```ts
import { Card, JoinQr, Button, Field, TextInput, Alert, ShareInviteButton, PauseOverlay } from '../shared/ui';
```

- [ ] **Step 4: Aggiungi i tre emit accanto a `removeBot`/`advance`/`rematch`**

Sostituisci (circa riga 795-798):

```ts
  const addBot = () => getSocket().emit(SocketEvents.LeaderAddBot);
  const removeBot = (id: string) => getSocket().emit(SocketEvents.LeaderRemoveBot, { id });
  const advance = () => getSocket().emit(SocketEvents.LeaderAdvancePhase);
  const rematch = () => getSocket().emit(SocketEvents.LeaderRematch);
```

con:

```ts
  const addBot = () => getSocket().emit(SocketEvents.LeaderAddBot);
  const removeBot = (id: string) => getSocket().emit(SocketEvents.LeaderRemoveBot, { id });
  const advance = () => getSocket().emit(SocketEvents.LeaderAdvancePhase);
  const rematch = () => getSocket().emit(SocketEvents.LeaderRematch);
  const pauseGame = () => getSocket().emit(SocketEvents.LeaderPauseGame);
  const resumeGame = () => getSocket().emit(SocketEvents.LeaderResumeGame);
  const removePlayer = (id: string) => getSocket().emit(SocketEvents.LeaderRemovePlayer, { id });
```

- [ ] **Step 5: Calcola la lista dei giocatori offline**

Subito dopo la riga `const isLeader = game?.leaderId != null && game.leaderId === playerId;` (riga 719), aggiungi:

```ts
  // Offline human players the leader may manually remove (menu ⋮). Bots are
  // never flagged offline (no socket to lose), so this is humans-only already.
  const offlineHumans = players.filter((p) => !p.isBot && p.connected === false);
```

- [ ] **Step 6: Aggiorna `withLeaveMenu`**

Sostituisci (circa riga 902-928):

```tsx
  const withLeaveMenu = (node: ReactNode) => (
    <>
      {node}
      {dilemmaSkippedToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + var(--space-3))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface, rgba(20, 30, 55, 0.95))',
            border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
            borderRadius: 'var(--radius-md, 12px)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: '0.95rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            zIndex: 30,
          }}
        >
          🗑️ Il capitano ha scartato il dilemma
        </div>
      )}
      <LeaveGameMenu onLeave={leaveRoom} onAddBot={isLeader && phase === 'PHASE_RESULTS' ? addBot : undefined} />
    </>
  );
```

con:

```tsx
  const withLeaveMenu = (node: ReactNode) => (
    <>
      {node}
      {dilemmaSkippedToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + var(--space-3))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface, rgba(20, 30, 55, 0.95))',
            border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
            borderRadius: 'var(--radius-md, 12px)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: '0.95rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            zIndex: 30,
          }}
        >
          🗑️ Il capitano ha scartato il dilemma
        </div>
      )}
      {game?.paused && <PauseOverlay onResume={isLeader ? resumeGame : undefined} />}
      <LeaveGameMenu
        onLeave={leaveRoom}
        onAddBot={isLeader && phase === 'PHASE_RESULTS' ? addBot : undefined}
        onPause={
          isLeader && !game?.paused && phase !== 'LOBBY' && phase !== 'FINAL_AWARDS'
            ? pauseGame
            : undefined
        }
        offlinePlayers={isLeader ? offlineHumans : undefined}
        onRemovePlayer={isLeader ? removePlayer : undefined}
      />
    </>
  );
```

- [ ] **Step 7: Esegui i test e verifica che passino**

Run: `cd /Users/gazz/gioco-dibattiti && npx vitest run client/src/player/PlayerApp.test.tsx`
Expected: PASS su tutti i test del file (nuovi + esistenti — nessuna regressione).

- [ ] **Step 8: Gate completo del client**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace client && npm run lint && npm run build --workspace client`
Expected: nessun errore, build verde.

- [ ] **Step 9: Commit**

```bash
git add client/src/player/PlayerApp.tsx client/src/player/PlayerApp.test.tsx
git commit -m "$(cat <<'EOF'
feat(pausa): PlayerApp — overlay di pausa + wiring del menu ⋮

Il leader mette in pausa/riprende e rimuove un giocatore offline dal
proprio telefono; l'overlay a schermo intero appare per tutti mentre
il gioco e' fermo.
EOF
)"
```

---

## Task 11: `HostApp.tsx` — overlay di pausa sulla vista TV

**Files:**
- Modify: `client/src/host/HostApp.tsx`

**Interfaces:**
- Consumes: `PauseOverlay` (Task 8), `GameStatePayload.paused` (Task 7).
- Produces: nessun consumer a valle — ultimo pezzo della UI.

Nessun test dedicato: `HostApp.tsx` non ha un file di test nel progetto (nessun precedente da seguire); verificato da typecheck/lint/build + controllo manuale.

- [ ] **Step 1: Aggiungi `PauseOverlay` all'import**

In `client/src/host/HostApp.tsx`, sostituisci (riga 22):

```ts
import { Card, CardGrid, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, NamedMomentsPanel, PodiumPanel, Logo, Swing, Button, TextInput, Alert, Celebration, RoomCodeChip, leanFromSplit } from '../shared/ui';
```

con:

```ts
import { Card, CardGrid, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, NamedMomentsPanel, PodiumPanel, Logo, Swing, Button, TextInput, Alert, Celebration, RoomCodeChip, leanFromSplit, PauseOverlay } from '../shared/ui';
```

- [ ] **Step 2: Renderizza l'overlay (read-only, nessun `onResume`: l'host è una vista passiva)**

Sostituisci (circa riga 216-220):

```tsx
    return (
      <main style={screen}>
        <ReactionSwarm />
        {/* Latecomers can still join mid-game: keep the code + QR in the corner. */}
        {code && <RoomCodeChip code={code} />}
```

con:

```tsx
    return (
      <main style={screen}>
        <ReactionSwarm />
        {game.paused && <PauseOverlay />}
        {/* Latecomers can still join mid-game: keep the code + QR in the corner. */}
        {code && <RoomCodeChip code={code} />}
```

- [ ] **Step 3: Gate completo del client**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck --workspace client && npm run lint && npm run build --workspace client`
Expected: nessun errore, build verde.

- [ ] **Step 4: Verifica manuale in dev**

Run: `cd /Users/gazz/gioco-dibattiti && npm run dev`

Apri `/host` in una scheda e crea/entra in una partita da un'altra scheda (`/`); avvia la partita, poi dal telefono-leader apri il menu ⋮ e tocca "⏸ Metti in pausa": verifica che l'overlay "Partita in pausa" appaia SIA su `/host` SIA sul telefono, che sul telefono del leader compaia "▶ Riprendi" e su un secondo telefono (non-leader) no, e che toccando "Riprendi" il countdown riprenda esattamente da dove si era fermato. Poi disconnetti (chiudi scheda) un secondo giocatore, apri il menu ⋮ dal leader, verifica che compaia "🔌 Rimuovi chi è assente" con il suo nome, e che rimuoverlo lo tolga dal roster su host e telefoni.

- [ ] **Step 5: Commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "$(cat <<'EOF'
feat(pausa): overlay di pausa sulla vista TV /host

Stesso PauseOverlay del telefono, senza bottone di ripresa (la vista
host resta passiva: tutti i controlli restano sul telefono del
leader).
EOF
)"
```

---

## Task 12: Gate finale end-to-end

**Files:** nessuno (solo verifica).

- [ ] **Step 1: Gate completo**

Run: `cd /Users/gazz/gioco-dibattiti && npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti e quattro verdi, zero errori/warning nuovi.

- [ ] **Step 2: Riepilogo dei file toccati**

Run: `cd /Users/gazz/gioco-dibattiti && git log --oneline main..HEAD`
Expected: gli 11 commit dei Task 1-11, nell'ordine.

- [ ] **Step 3: Push**

Segui la regola fissa del progetto (CLAUDE.md utente): a fine lavoro, push del branch corrente.

```bash
git push
```

Se il push viene rifiutato (remoto avanzato), NON forzare: segnalalo e fermati.

---

## Riepilogo dei file toccati

- `server/src/index.ts` — costanti di grazia/abbandono, 3 nuovi handler `leader:*`, `gameStatePayload.paused`, guard implicito via `advanceAndBroadcast` → `rooms.advancePhase`.
- `server/src/game/rooms.ts` — `Room.paused`/`pausedRemainingMs`, `removeIfOffline`, `pauseGame`/`resumeGame`, guard in `advancePhase`/`skipDilemma`, commento di `restore()` aggiornato.
- `server/src/game/__tests__/rooms.test.ts` — 4 nuovi `describe` (TDD).
- `server/src/__tests__/integration.test.ts` — `GameState.paused`, 2 nuovi `describe` socket-level.
- `client/src/shared/events.ts` — 3 nuovi `SocketEvents`, `GameStatePayload.paused`.
- `client/src/shared/ui/PauseOverlay.tsx` + `.module.css` + barrel export.
- `client/src/player/LeaveGameMenu.tsx` — riscritto con le nuove voci leader-only.
- `client/src/player/PlayerApp.tsx` — wiring emit/overlay/menu.
- `client/src/player/PlayerApp.test.tsx` — 6 nuovi test.
- `client/src/host/HostApp.tsx` — overlay read-only sulla vista TV.
