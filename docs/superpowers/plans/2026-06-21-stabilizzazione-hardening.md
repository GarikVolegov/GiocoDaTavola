# Stabilizzazione SCHIERATI — baseline, verifica, hardening runtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare al gioco una base solida — working tree pulito, flusso verificato dal vivo, e i leak di ciclo-vita delle stanze (mai rimosse dalla memoria, timer di fase che gira a vuoto) chiusi con primitive unit-testabili.

**Architecture:** La logica di gioco è già server-authoritative e ben testata in `RoomStore` (`server/src/game/rooms.ts`); i gap sono nel wiring runtime di `server/src/index.ts`. Aggiungiamo a `RoomStore` tre primitive pure e unit-testabili (`delete`, `connectedHumanCount`, `abandonedRooms`) e le cabliamo in `index.ts` per: (a) rimuovere una stanza appena svuotata, (b) potare periodicamente le stanze abbandonate, (c) evitare un doppio avanzamento timer-vs-manuale.

**Tech Stack:** Node + Express + Socket.IO (TypeScript CommonJS, tsx/tsc), Vitest. Client React + Vite (non toccato qui salvo i file WIP già pronti).

## Global Constraints

- Eseguire tutti i comandi dalla **root del repo**.
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` devono restare **tutti verdi** prima di ogni commit.
- Niente `any` (errore di lint). Prefissare gli unused con `_`.
- Voti e pronostici **segreti**: mai inviare scelte/identità individuali, solo conteggi aggregati.
- Timer calcolati server-side; i client renderizzano solo countdown.
- Server CJS / client ESM separati.
- I messaggi di commit terminano con: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Baseline pulita — committa il WIP verde

Le due feature non committate (reazioni live + fase PREDICT) sono complete, cablate e verdi, ma intrecciate sugli stessi file: si committano come un'unica unità coerente. NON committare `.claude/` (config locale) né `scripts/` (verificarne il contenuto a parte).

**Files:**
- Modify (stage): `client/src/host/HostApp.tsx`, `client/src/player/PlayerApp.tsx`, `client/src/shared/events.ts`, `server/data/dilemmas.json`, `server/src/game/__tests__/rooms.test.ts`, `server/src/game/awards.ts`, `server/src/game/phases.ts`, `server/src/game/rooms.ts`, `server/src/index.ts`
- Create (stage): `client/src/host/ReactionSwarm.tsx`, `client/src/host/ReactionSwarm.module.css`

- [ ] **Step 1: Verifica che tutto sia verde**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti e quattro passano (169+ test verdi).

- [ ] **Step 2: Stage esplicito dei soli file feature**

```bash
git add client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx \
  client/src/shared/events.ts server/data/dilemmas.json \
  server/src/game/__tests__/rooms.test.ts server/src/game/awards.ts \
  server/src/game/phases.ts server/src/game/rooms.ts server/src/index.ts \
  client/src/host/ReactionSwarm.tsx client/src/host/ReactionSwarm.module.css
git status   # conferma che .claude/ e scripts/ restano NON staged
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(engagement): live reactions swarm + PREDICT phase

Reazioni live (player:react / room:reaction, award beniamino) e fase
PREDICT (pronostico segreto post-difesa, award oracolo). Tutto coperto
da test in rooms.test.ts; baseline verde.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: working tree pulito a parte `.claude/` e `scripts/` untracked.

---

### Task 2: Verifica end-to-end (smoke manuale) — checkpoint

Eseguito **inline nella sessione corrente** (non un subagent): avvia l'app, gioca un round completo, registra i problemi reali. Questo task non produce codice: produce una **lista di difetti** che, se non vuota, diventa un task TDD inserito PRIMA del Task 7.

- [ ] **Step 1: Avvia l'app**

Usa la skill `run` (o `npm run dev` dalla root). Apri il telefono creatore (`/`), 1-2 altri telefoni, e opzionalmente la TV spettatore.

- [ ] **Step 2: Gioca il flusso completo**

Percorri: crea stanza → altri si uniscono → avvia (3 giocatori o 1 umano + 2 bot) → `VOTE_1` → `SPLIT_REVEAL` → `PREDICT` (pronostica) → `DEFENSE` (manda reazioni) → `VOTE_2` → `PHASE_RESULTS` (controlla l'esito del pronostico) → loop → `FINAL_AWARDS`.

- [ ] **Step 3: Prova le disconnessioni**

A metà partita: blocca/ricarica un telefono e verifica che riprenda la stessa sessione; fai uscire il leader e verifica che la leadership passi a un altro umano.

- [ ] **Step 4: Registra i difetti**

Annota ogni anomalia (schermata bloccata, conteggio errato, errore in console) come elenco puntato in `progress.txt` sotto `## Stabilizzazione — findings`. Conferma esplicitamente che la validazione input lato server regge (scelte/emoji non valide rifiutate senza crash — già coperta dai test, ma verifica dal vivo lo spam di reazioni). Per ogni difetto concreto, aggiungi un task TDD (test rosso → fix → verde) prima del Task 7.

---

### Task 3: `RoomStore.delete(code)` — rimuovi una stanza dalla memoria

Oggi `RoomStore` non ha modo di rimuovere una stanza: le stanze si accumulano per sempre (leak). Aggiungi il metodo mancante.

**Files:**
- Modify: `server/src/game/rooms.ts` (classe `RoomStore`, accanto a `has`/`get`/`size` intorno a `:1124-1134`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `RoomStore.delete(code: string): boolean` — true se una stanza è stata rimossa, false per un codice sconosciuto.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in `server/src/game/__tests__/rooms.test.ts` (in fondo al file):

```ts
describe('RoomStore.delete (lifecycle)', () => {
  it('removes a room from memory and reports it; false for unknown codes', () => {
    const store = new RoomStore();
    const { code } = store.create();
    expect(store.has(code)).toBe(true);
    expect(store.size).toBe(1);

    expect(store.delete(code)).toBe(true);
    expect(store.has(code)).toBe(false);
    expect(store.get(code)).toBeUndefined();
    expect(store.size).toBe(0);

    expect(store.delete('ZZZZ')).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- rooms.test.ts -t "removes a room from memory"`
Expected: FAIL — `store.delete is not a function`.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, dentro la classe `RoomStore`, subito dopo `has(code)`:

```ts
  /** Remove a room from the store entirely. Returns whether one was removed. */
  delete(code: string): boolean {
    return this.rooms.delete(code);
  }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- rooms.test.ts -t "removes a room from memory"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(rooms): RoomStore.delete to remove a room from memory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `RoomStore.connectedHumanCount(code)` — quanti umani connessi

Primitiva per decidere se una stanza è viva. Conta gli umani con `connected !== false`, ignorando i bot.

**Files:**
- Modify: `server/src/game/rooms.ts` (classe `RoomStore`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `Player.isBot?`, `Player.connected?` (già esistenti).
- Produces: `RoomStore.connectedHumanCount(code: string): number` — 0 per stanza sconosciuta.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi al `describe('RoomStore.delete (lifecycle)')` un nuovo blocco subito sotto:

```ts
describe('RoomStore.connectedHumanCount (lifecycle)', () => {
  it('counts connected humans only, ignoring bots and disconnected players', () => {
    const store = new RoomStore();
    const { code } = store.create();
    store.join(code, 'h1', 'Ann');
    store.join(code, 'h2', 'Bob');
    store.addBot(code, 'roccione'); // bots never count
    expect(store.connectedHumanCount(code)).toBe(2);

    store.setConnected(code, 'h2', false); // mid-grace -> not connected
    expect(store.connectedHumanCount(code)).toBe(1);

    store.setConnected(code, 'h1', false);
    expect(store.connectedHumanCount(code)).toBe(0); // bot remains, but no humans

    expect(store.connectedHumanCount('ZZZZ')).toBe(0); // unknown room
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- rooms.test.ts -t "counts connected humans only"`
Expected: FAIL — `store.connectedHumanCount is not a function`.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, dentro `RoomStore`, dopo `delete`:

```ts
  /** How many human players are currently connected (bots and mid-grace
   * absentees excluded). Used to decide whether a room is still alive. */
  connectedHumanCount(code: string): number {
    const room = this.rooms.get(code);
    if (!room) return 0;
    let n = 0;
    for (const p of room.players.values()) {
      if (!p.isBot && p.connected !== false) n++;
    }
    return n;
  }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- rooms.test.ts -t "counts connected humans only"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(rooms): connectedHumanCount lifecycle primitive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `RoomStore.abandonedRooms(maxIdleMs)` — potatura di sicurezza

Lista dei codici stanza senza umani connessi più vecchi di `maxIdleMs` (rispetto a `createdAt`). È una **query pura** (non cancella): il chiamante in `index.ts` filtra ed elimina, così resta unit-testabile e il chiamante può saltare stanze con una grace pendente. Usa il `now` iniettabile (2° arg del costruttore) per i test.

**Files:**
- Modify: `server/src/game/rooms.ts` (classe `RoomStore`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `connectedHumanCount` (Task 4), `Room.createdAt`, `this.now()`.
- Produces: `RoomStore.abandonedRooms(maxIdleMs: number): string[]`.

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi un nuovo blocco sotto quello del Task 4:

```ts
describe('RoomStore.abandonedRooms (lifecycle)', () => {
  it('lists rooms with no connected humans older than maxIdleMs; keeps the rest', () => {
    let t = 0;
    const store = new RoomStore(generateRoomCode, () => t);

    const alive = store.create().code;   // createdAt = 0
    store.join(alive, 'h1', 'Ann');      // a connected human -> never abandoned

    const dead = store.create().code;    // createdAt = 0
    store.join(dead, 'h2', 'Bob');
    store.setConnected(dead, 'h2', false); // no connected humans

    const fresh = store.create().code;   // createdAt = 0, momentarily empty

    t = 60_000; // 60s later
    const reaped = store.abandonedRooms(30_000);
    expect(reaped).toContain(dead);      // empty + older than 30s
    expect(reaped).not.toContain(alive); // has a connected human
    // `fresh` is empty too, but it was never joined and is older than 30s -> also abandoned:
    expect(reaped).toContain(fresh);
  });

  it('does not list an empty room younger than maxIdleMs', () => {
    let t = 0;
    const store = new RoomStore(generateRoomCode, () => t);
    const code = store.create().code;
    t = 10_000; // only 10s old
    expect(store.abandonedRooms(30_000)).not.toContain(code);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- rooms.test.ts -t "abandonedRooms"`
Expected: FAIL — `store.abandonedRooms is not a function`.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, dentro `RoomStore`, dopo `connectedHumanCount`:

```ts
  /** Codes of rooms with no connected humans and older than `maxIdleMs`
   * (a safety-net sweep for abandoned rooms). Pure query — the caller deletes,
   * so it can skip rooms whose players are still within their reconnect grace. */
  abandonedRooms(maxIdleMs: number): string[] {
    const now = this.now();
    const codes: string[] = [];
    for (const [code, room] of this.rooms) {
      if (this.connectedHumanCount(code) === 0 && now - room.createdAt > maxIdleMs) {
        codes.push(code);
      }
    }
    return codes;
  }
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- rooms.test.ts -t "abandonedRooms"`
Expected: PASS (entrambi).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(rooms): abandonedRooms sweep query for dead rooms

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Cabla il reaping in `index.ts` (cleanup immediato + sweep + guardia timer)

Wiring sottile in `server/src/index.ts`. Tre interventi: (a) alla scadenza della grace, se la stanza è rimasta **senza nessun giocatore** la elimina e ferma il timer; (b) uno sweep periodico elimina le stanze abbandonate (umani 0) saltando quelle con una grace pendente; (c) `schedulePhase` ignora un timer scaduto già sostituito da un avanzamento manuale (anti doppio-advance). Verificato dallo smoke (Task 2 ripetuto), non da unit test: la logica decisionale vive nelle primitive già testate (Task 3-5).

**Files:**
- Modify: `server/src/index.ts` — `schedulePhase` (`:142-152`), il callback di grace nel `disconnect` handler (`:443-453`), e una nuova `setInterval` di sweep vicino alle costanti di sessione (`:46-52`).

**Interfaces:**
- Consumes: `RoomStore.delete`, `RoomStore.connectedHumanCount`, `RoomStore.abandonedRooms` (Task 3-5); le mappe esistenti `phaseTimers`, `graceTimers`, `tokens`, `playerSocket`; `clearPhaseTimer`.

- [ ] **Step 1: Guardia anti doppio-advance in `schedulePhase`**

In `server/src/index.ts`, sostituisci il corpo di `schedulePhase` (`:142-152`):

```ts
function schedulePhase(code: string): void {
  clearPhaseTimer(code);
  const room = rooms.get(code);
  if (!room || room.phaseExpiresAt == null) return;
  const delay = Math.max(0, room.phaseExpiresAt - Date.now());
  const timer = setTimeout(() => {
    // If a manual advance (host/leader) already replaced this timer, this stale
    // callback must not advance the phase a second time.
    if (phaseTimers.get(code) !== timer) return;
    phaseTimers.delete(code);
    advanceAndBroadcast(code);
  }, delay);
  phaseTimers.set(code, timer);
}
```

- [ ] **Step 2: Helper per potare i token di una stanza eliminata**

In `server/src/index.ts`, accanto a `clearPhaseTimer` (`:145`), aggiungi:

```ts
// Drop a deleted room's leftover reconnect tokens so they don't accumulate.
function pruneTokensForRoom(code: string): void {
  for (const [tok, v] of tokens) {
    if (v.code === code) tokens.delete(tok);
  }
}

// Reap a dead room: stop its phase timer, drop its tokens, remove it from memory.
function reapRoom(code: string): void {
  clearPhaseTimer(code);
  pruneTokensForRoom(code);
  rooms.delete(code);
  console.log('[server] reaped abandoned room', code);
}
```

- [ ] **Step 3: Cleanup immediato alla scadenza della grace**

In `server/src/index.ts`, nel callback `setTimeout` del `disconnect` handler (`:445-452`), dopo `rooms.leave(code, playerId);` e i suoi broadcast, aggiungi la riga di reap quando la stanza è del tutto vuota:

```ts
      graceTimers.delete(playerId);
      const tok = [...tokens].find(([, v]) => v.playerId === playerId)?.[0];
      if (tok) tokens.delete(tok);
      rooms.leave(code, playerId);
      // Last one out: reap the now-empty room (no slots left to reconnect to).
      if (rooms.get(code) && rooms.get(code)!.players.size === 0) {
        reapRoom(code);
      }
      broadcastLobby(code);
      if (rooms.get(code) && isVotingPhase(rooms.get(code)!.phase)) refreshAfterRosterChange(code);
```

(`broadcastLobby`/`refreshAfterRosterChange` su una stanza già eliminata sono no-op: entrambi fanno `rooms.get(code)` → undefined e ritornano.)

- [ ] **Step 4: Sweep periodico di sicurezza**

In `server/src/index.ts`, dopo la definizione di `RECONNECT_GRACE_MS` (`:52`), aggiungi:

```ts
// Safety-net sweep: reap rooms abandoned (no connected humans) for well over the
// reconnect grace window, in case a per-player grace path missed one (e.g. a
// bots-only leftover). Skips rooms that still have a pending grace (reconnectable).
const ABANDONED_ROOM_MAX_IDLE_MS = 5 * 60_000; // 5 min, >> RECONNECT_GRACE_MS
const ABANDONED_SWEEP_INTERVAL_MS = 60_000;

function hasPendingGrace(code: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  for (const id of room.players.keys()) {
    if (graceTimers.has(id)) return true;
  }
  return false;
}

setInterval(() => {
  for (const code of rooms.abandonedRooms(ABANDONED_ROOM_MAX_IDLE_MS)) {
    if (!hasPendingGrace(code)) reapRoom(code);
  }
}, ABANDONED_SWEEP_INTERVAL_MS).unref(); // .unref so the timer never blocks exit
```

- [ ] **Step 5: Verifica statica + smoke**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti verdi.

Poi riavvia l'app (skill `run`) e ripeti lo smoke del Task 2 mirato al reaping:
- Avvia una partita, poi chiudi TUTTI i telefoni. Dopo ~45s (grace) verifica nel log del server la riga `reaped abandoned room <CODE>` e che i log dell'auto-advance per quella stanza si fermino.
- Riconnetti un telefono ENTRO la grace e verifica che la stanza NON venga eliminata (riprende la sessione).

- [ ] **Step 6: Commit**

```bash
git add server/src/index.ts
git commit -m "fix(server): reap abandoned rooms + guard double phase-advance

Empty-room cleanup on grace expiry, periodic abandoned-room sweep (skips
rooms still within reconnect grace), token pruning, and a stale-timer guard
so a manual advance can't be followed by a timer double-advance.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Verifica finale + chiusura del ramo

- [ ] **Step 1: Suite completa verde**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti e quattro verdi.

- [ ] **Step 2: Smoke finale**

Ripeti un round completo (Task 2) per confermare che il flusso end-to-end resta integro dopo gli interventi.

- [ ] **Step 3: Aggiorna progress.txt**

Annota in `progress.txt` cosa è stato irrobustito (delete/connectedHumanCount/abandonedRooms + reaping + guardia timer) e l'esito dello smoke.

- [ ] **Step 4: Handoff Fase 3**

La Fase 3 (snapshot/ripristino su Postgres) ha un **piano separato**, da scrivere ORA che il ciclo-vita stanza è definitivo: invoca `superpowers:writing-plans` con lo spec (`docs/superpowers/specs/2026-06-21-stabilizzazione-design.md`, sezione "Fase 3"). La serializzazione dovrà coprire tutte le `Map` del `Room` (votes, votes1, predictions, speakerVotes, stats, lastReactionAt, duelScore) e i campi di leadership.

- [ ] **Step 5: Finitura del ramo**

Invoca `superpowers:finishing-a-development-branch` per decidere merge/PR di `ralph/skeleton-dilemma`.

---

## Self-Review

**Spec coverage (vs `2026-06-21-stabilizzazione-design.md`):**
- Fase 0 (baseline pulita) → Task 1. ✓
- Fase 1 (verifica e2e) → Task 2 (+ findings che generano task TDD). ✓
- Fase 2 (hardening): stanza svuotata/cleanup + leak timer → Task 3-6; input lato server → confermato già coperto in Task 2; timer-vs-advance → Task 6 step 1; host/leader disconnect → la riassegnazione di leadership è già testata (rooms.test.ts:1542) e il reaping copre la stanza orfana; riconnessione durante PREDICT/reazioni → già coperta dai test di reconnection esistenti, ri-verificata nello smoke; bot + fasi nuove → `allPredicted`/`allSpeakerVoted` ignorano i bot (già testato). ✓
- Fase 3 (snapshot/ripristino) → **piano separato** (Task 7 step 4), per dipendenza dal ciclo-vita finale. ✓
- Testing trasversale (test per ogni fix, 4 check verdi pre-commit) → in ogni task. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step di codice mostra il codice; ogni comando ha l'output atteso.

**Type consistency:** `delete(code: string): boolean`, `connectedHumanCount(code: string): number`, `abandonedRooms(maxIdleMs: number): string[]` usati in modo coerente tra rooms.ts e il wiring di index.ts (`reapRoom`, sweep). `reapRoom`/`pruneTokensForRoom`/`hasPendingGrace` definiti prima dell'uso.
