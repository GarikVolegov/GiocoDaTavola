# Voto auto-paced (niente timer) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le fasi di voto (VOTE_1, VOTE_2, PREDICT, SPEAKER_VOTE) non hanno più un timer fisso: avanzano da sole appena **tutti i presenti** (connessi) hanno agito; VOTE_2 richiede una **conferma esplicita**.

**Architecture:** Si azzera la durata (`null`) di queste fasi in `PHASE_DURATIONS_MS` così il server non arma alcun auto-advance; si mantiene/aggiunge l'early-advance "tutti hanno agito". VOTE_2 oggi parte pre-riempito (tutti risulterebbero votati): si introduce un set `confirmedVote2` riempito solo da un'azione esplicita (conferma o cambio voto); i bot vi entrano all'ingresso fase. Il tasto "Salta ▶" del leader (`leader:advancePhase`, esistente) resta la rete per AFK.

**Tech Stack:** Node + Express + Socket.IO, TypeScript CommonJS (server); React + Vite + TS ESM (client); Vitest.

## Global Constraints

- Voti **segreti**: solo conteggi aggregati lasciano il server — mai chi ha votato cosa (CLAUDE.md).
- Timer **server-authoritative** (qui: assenza di timer + early-advance server-side).
- Niente `any` (lint error); prefissare con `_` var/arg intenzionalmente inutilizzati.
- Server CJS / client ESM separati.
- Gate: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` devono restare verdi.
- TDD: test prima della logica pura/store. Commit frequenti.
- Modalità **gruppo** (il duello `DUEL_PICK`/`DUEL_REPICK` resta col suo comportamento attuale — fuori scope).

## File Structure

- `server/src/game/phases.ts` — `PHASE_DURATIONS_MS`: VOTE_1/VOTE_2/PREDICT/SPEAKER_VOTE → `null`.
- `server/src/game/rooms.ts` — nuovo stato `confirmedVote2` + metodi `confirmVote` / `allConfirmed`; vote() in VOTE_2 conta come conferma; auto-conferma bot all'ingresso VOTE_2; prune/clear.
- `server/src/index.ts` — handler `player:confirmVote`; early-advance VOTE_2 su `allConfirmed`; espone `confirmedVote2` size in `game:state`.
- `server/src/game/__tests__/rooms.test.ts` — aggiorna il test durate; nuovi test confirm/allConfirmed.
- `client/src/shared/events.ts` — `SocketEvents.PlayerConfirmVote`; campo `confirmedCount` (+ `iConfirmed`) in `GameStatePayload`.
- `client/src/player/PlayerApp.tsx` — VOTE_2: pulsante "Confermo"; stato confermato.
- `client/src/host/HostApp.tsx` — VOTE_2: "Confermati X/N".

> Nota: i numeri di riga non sono indicati perché il loop Ralph modifica il branch; usare gli **ancoraggi per nome** (funzione/identificatore) indicati in ogni task.

---

### Task 1: Togliere il timer a VOTE_1, PREDICT, SPEAKER_VOTE (già early-advance)

Queste tre fasi hanno già l'early-advance "tutti hanno agito" (`allVoted` / `allPredicted` / `allSpeakerVoted` negli handler di `index.ts`). Basta azzerarne la durata.

**Files:**
- Modify: `server/src/game/phases.ts` (`PHASE_DURATIONS_MS`)
- Test: `server/src/game/__tests__/rooms.test.ts` (test `PHASE_DURATIONS_MS`)

**Interfaces:**
- Consumes: niente.
- Produces: `PHASE_DURATIONS_MS.VOTE_1 === null`, `.PREDICT === null`, `.SPEAKER_VOTE === null`.

- [ ] **Step 1: Aggiorna il test delle durate (RED)** — in `rooms.test.ts`, dentro `describe('PHASE_DURATIONS_MS', …)`, sposta VOTE_1/PREDICT/SPEAKER_VOTE tra le fasi senza timer:

```typescript
  it('has no timer for LOBBY/FINAL_AWARDS and the self-paced vote phases', () => {
    expect(PHASE_DURATIONS_MS.LOBBY).toBeNull();
    expect(PHASE_DURATIONS_MS.FINAL_AWARDS).toBeNull();
    // Self-paced: advance on "everyone acted", not on a timer.
    expect(PHASE_DURATIONS_MS.VOTE_1).toBeNull();
    expect(PHASE_DURATIONS_MS.PREDICT).toBeNull();
    expect(PHASE_DURATIONS_MS.SPEAKER_VOTE).toBeNull();
    const timed: GamePhase[] = ['PHASE_INTRO', 'DILEMMA_REVEAL', 'SPLIT_REVEAL', 'DEFENSE', 'PHASE_RESULTS'];
    for (const phase of timed) {
      expect(PHASE_DURATIONS_MS[phase]).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Esegui il test → deve fallire**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "PHASE_DURATIONS_MS"`
Expected: FAIL (VOTE_1/PREDICT/SPEAKER_VOTE sono ancora `20_000`/`12_000`).

- [ ] **Step 3: Azzera le durate in `phases.ts`**

In `PHASE_DURATIONS_MS` imposta:
```typescript
  VOTE_1: null,
  PREDICT: null,
  SPEAKER_VOTE: null,
```
(lasciando per ora `VOTE_2: 20_000`, gestita nel Task 3).

- [ ] **Step 4: Esegui il test → deve passare, poi tutta la suite**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "PHASE_DURATIONS_MS"` → PASS
Run: `npm test` → verde. Se qualche test asserisce `phaseExpiresAt` per VOTE_1/PREDICT/SPEAKER_VOTE, aggiornalo a `toBeNull()` (questi test guidano la fase con `advancePhase` manuale, quindi raramente dipendono dal timer).

- [ ] **Step 5: Commit**

```bash
git add server/src/game/phases.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(voto): no timer on VOTE_1/PREDICT/SPEAKER_VOTE (advance on all-done)"
```

---

### Task 2: Stato `confirmedVote2` + `confirmVote` + `allConfirmed` (store, TDD)

**Files:**
- Modify: `server/src/game/rooms.ts` (interface `Room`, `create`, `advancePhase` ingresso VOTE_2, `vote`, `leave`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `Room.votes` (voti correnti), `isVoteChoice`, `applyBotSecondVotes`.
- Produces:
  - `Room.confirmedVote2: Set<string>`
  - `RoomStore.confirmVote(code: string, playerId: string): { ok: true } | { ok: false; error: 'ROOM_NOT_FOUND' | 'NOT_VOTE2_PHASE' | 'NOT_IN_ROOM' }`
  - `RoomStore.confirmedCount(code: string): number`
  - `RoomStore.allConfirmed(code: string): boolean`

- [ ] **Step 1: Test (RED)** — aggiungi in `rooms.test.ts` un `describe('RoomStore VOTE_2 confirm (auto-paced)', …)`. Usa l'helper `vote2Room` esistente (porta a VOTE_2 con split noto `['A','B','B']`); se non disponibile nello scope, replica il pattern: avanza fino a `phase === 'VOTE_2'`.

```typescript
describe('RoomStore VOTE_2 confirm (auto-paced)', () => {
  function toVote2(store: RoomStore, sides: VoteChoice[] = ['A', 'B', 'B']): string {
    const { code } = store.create();
    for (let i = 0; i < sides.length; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 12) store.advancePhase(code);
    sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 12) store.advancePhase(code);
    return code;
  }

  it('starts VOTE_2 with nobody confirmed even though votes are pre-filled', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.get(code)?.phase).toBe('VOTE_2');
    expect(store.voteCount(code)).toBe(3);        // pre-filled defaults present
    expect(store.confirmedCount(code)).toBe(0);   // but nobody confirmed yet
    expect(store.allConfirmed(code)).toBe(false);
  });

  it('confirmVote marks a player confirmed; allConfirmed when all present did', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.confirmVote(code, 'sock-0').ok).toBe(true);
    expect(store.confirmVote(code, 'sock-1').ok).toBe(true);
    expect(store.allConfirmed(code)).toBe(false);
    store.confirmVote(code, 'sock-2');
    expect(store.allConfirmed(code)).toBe(true);
    expect(store.confirmedCount(code)).toBe(3);
  });

  it('changing the vote in VOTE_2 also counts as a confirmation', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.vote(code, 'sock-0', 'B'); // change -> confirms
    expect(store.confirmedCount(code)).toBe(1);
  });

  it('rejects confirmVote outside VOTE_2, unknown room, and intruders', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    expect(store.confirmVote('ZZZZ', 'sock-0')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    expect(store.confirmVote(code, 'ghost')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    store.advancePhase(code); // leave VOTE_2
    expect(store.confirmVote(code, 'sock-0')).toEqual({ ok: false, error: 'NOT_VOTE2_PHASE' });
  });

  it('a leaving player does not block all-confirmed', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.confirmVote(code, 'sock-0');
    store.confirmVote(code, 'sock-1');
    expect(store.allConfirmed(code)).toBe(false);
    store.leave(code, 'sock-2'); // the only unconfirmed present player leaves
    expect(store.allConfirmed(code)).toBe(true);
  });

  it('bots are auto-confirmed on entry to VOTE_2', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    store.join(code, 'sock-0', 'H0');
    store.addBot(code);
    store.addBot(code);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)?.phase !== 'VOTE_1' && g++ < 12) store.advancePhase(code);
    store.vote(code, 'sock-0', 'A');
    g = 0;
    while (store.get(code)?.phase !== 'VOTE_2' && g++ < 12) store.advancePhase(code);
    // 2 bots already confirmed; only the human is pending.
    expect(store.confirmedCount(code)).toBe(2);
    store.confirmVote(code, 'sock-0');
    expect(store.allConfirmed(code)).toBe(true);
  });

  it('clears confirmations for the next dilemma', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const code = toVote2(store);
    store.confirmVote(code, 'sock-0');
    let g = 0;
    while (store.get(code)?.dilemmaIndex !== 2 && g++ < 30) store.advancePhase(code);
    expect(store.get(code)?.phase).toBe('DILEMMA_REVEAL');
    expect(store.confirmedCount(code)).toBe(0);
  });
});
```

- [ ] **Step 2: Esegui i test → falliscono**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "VOTE_2 confirm"`
Expected: FAIL (`confirmVote`/`confirmedCount`/`allConfirmed` non esistono).

- [ ] **Step 3: Implementa lo stato + metodi in `rooms.ts`**

Nell'interface `Room`, accanto a `votes1`, aggiungi:
```typescript
  /**
   * Players who have EXPLICITLY confirmed (or changed) their second vote during
   * VOTE_2. The second vote starts pre-filled with the first, so "has a vote" is
   * not "has confirmed"; this set drives the auto-advance. Bots are added on entry
   * to VOTE_2. Cleared on DILEMMA_REVEAL; pruned on leave.
   */
  confirmedVote2: Set<string>;
```

In `create()`, accanto a `votes1: new Map()`:
```typescript
      confirmedVote2: new Set(),
```

In `advancePhase`, nel blocco di ingresso a VOTE_2 (dove c'è `room.votes1 = new Map(room.votes); this.applyBotSecondVotes(room);`), aggiungi DOPO l'applicazione dei bot:
```typescript
    if (transition.phase === 'VOTE_2') {
      room.votes1 = new Map(room.votes);
      this.applyBotSecondVotes(room);
      // Fresh round of confirmations; bots have already "decided", so confirm them.
      room.confirmedVote2 = new Set();
      for (const p of room.players.values()) if (p.isBot) room.confirmedVote2.add(p.id);
    }
```

In `vote()`, prima del `return { ok: true, room }` finale, aggiungi: un voto durante VOTE_2 vale come conferma:
```typescript
    room.votes.set(playerId, choice);
    if (room.phase === 'VOTE_2') room.confirmedVote2.add(playerId);
    return { ok: true, room };
```

Aggiungi i nuovi metodi (vicino a `allVoted`):
```typescript
  /** Mark a player's second vote as explicitly confirmed (VOTE_2 only). */
  confirmVote(code: string, playerId: string): { ok: true; room: Room } | { ok: false; error: 'ROOM_NOT_FOUND' | 'NOT_VOTE2_PHASE' | 'NOT_IN_ROOM' } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.phase !== 'VOTE_2') return { ok: false, error: 'NOT_VOTE2_PHASE' };
    if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
    room.confirmedVote2.add(playerId);
    return { ok: true, room };
  }

  /** How many players have confirmed their second vote (aggregate only). */
  confirmedCount(code: string): number {
    return this.rooms.get(code)?.confirmedVote2.size ?? 0;
  }

  /**
   * True once every CONNECTED player has confirmed their second vote (and at least
   * one is present). Disconnected players (grace period) are ignored so a locked
   * phone doesn't block; bots are pre-confirmed on entry.
   */
  allConfirmed(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const present = [...room.players.values()].filter((p) => p.connected !== false);
    if (present.length === 0) return false;
    return present.every((p) => room.confirmedVote2.has(p.id));
  }
```

In `leave()`, accanto a `room.votes.delete(playerId)`:
```typescript
    room.confirmedVote2.delete(playerId);
```

- [ ] **Step 4: Esegui i test → passano, poi tutta la suite**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "VOTE_2 confirm"` → PASS
Run: `npm test` → verde.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(voto): confirmedVote2 state + confirmVote/allConfirmed (store, TDD)"
```

---

### Task 3: VOTE_2 senza timer + early-advance su conferma (wiring socket)

**Files:**
- Modify: `server/src/game/phases.ts` (`VOTE_2 → null`)
- Modify: `server/src/index.ts` (`player:confirmVote` handler; early-advance VOTE_2 in `player:vote`; `refreshAfterRosterChange`; `confirmedCount` in `gameStatePayload`)
- Modify: `client/src/shared/events.ts` (`PlayerConfirmVote`, `confirmedCount`)
- Test: `server/src/game/__tests__/rooms.test.ts` (durate)

**Interfaces:**
- Consumes: `rooms.confirmVote`, `rooms.allConfirmed`, `rooms.confirmedCount` (Task 2).
- Produces: evento socket `player:confirmVote`; `gameStatePayload(...).confirmedCount: number`.

- [ ] **Step 1: Test durata VOTE_2 (RED)** — estendi il test del Task 1 aggiungendo:

```typescript
    expect(PHASE_DURATIONS_MS.VOTE_2).toBeNull();
```
(e rimuovi `VOTE_2` da eventuali liste "timed").

- [ ] **Step 2: Esegui → fallisce**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "PHASE_DURATIONS_MS"` → FAIL.

- [ ] **Step 3: `VOTE_2 → null` in `phases.ts`**

```typescript
  VOTE_2: null,
```

- [ ] **Step 4: Mirror evento + payload nel client `events.ts`**

In `SocketEvents` aggiungi:
```typescript
  /** Player explicitly confirms their (pre-filled) second vote (VOTE_2). */
  PlayerConfirmVote: 'player:confirmVote',
```
In `GameStatePayload`, accanto a `votedCount`:
```typescript
  /** How many players have confirmed their second vote (VOTE_2). Aggregate only. */
  confirmedCount: number;
```

- [ ] **Step 5: Server `index.ts` — payload + handler + early-advance**

In `gameStatePayload`, accanto a `votedCount: room.votes.size,`:
```typescript
    confirmedCount: rooms.confirmedCount(room.code),
```

Nell'handler `socket.on('player:vote', …)`, l'early-advance attuale copre VOTE_1/DUEL_PICK; aggiungi il caso VOTE_2-confermato. Sostituisci il blocco:
```typescript
    const phase = result.room.phase;
    if ((phase === 'VOTE_1' || phase === 'DUEL_PICK') && rooms.allVoted(code)) {
      advanceAndBroadcast(code);
    } else {
      broadcastGameState(code);
    }
```
con:
```typescript
    const phase = result.room.phase;
    if ((phase === 'VOTE_1' || phase === 'DUEL_PICK') && rooms.allVoted(code)) {
      advanceAndBroadcast(code);
    } else if (phase === 'VOTE_2' && rooms.allConfirmed(code)) {
      advanceAndBroadcast(code); // changing the vote confirmed it; all done -> advance
    } else {
      broadcastGameState(code);
    }
```

Aggiungi il nuovo handler (vicino a `player:vote`):
```typescript
  // A player confirms their pre-filled second vote (VOTE_2). Like a vote it never
  // leaves the server individually; we broadcast only the aggregate confirmed count,
  // and auto-advance once every present player has confirmed.
  socket.on('player:confirmVote', () => {
    const session = sessions.get(socket.id);
    if (!session) return;
    const { code } = session;
    const result = rooms.confirmVote(code, session.playerId);
    if (!result.ok) return;
    if (rooms.allConfirmed(code)) advanceAndBroadcast(code);
    else broadcastGameState(code);
  });
```

In `refreshAfterRosterChange`, estendi così un leaver in VOTE_2 non blocchi:
```typescript
  if ((room.phase === 'VOTE_1' || room.phase === 'DUEL_PICK') && rooms.allVoted(code)) {
    advanceAndBroadcast(code);
  } else if (room.phase === 'VOTE_2' && rooms.allConfirmed(code)) {
    advanceAndBroadcast(code);
  } else {
    broadcastGameState(code);
  }
```

- [ ] **Step 6: Verifica suite + typecheck**

Run: `npm test` → verde (aggiorna eventuali test che asserivano un timer su VOTE_2).
Run: `npm run typecheck` → verde (il client `GameStatePayload` ora richiede `confirmedCount`; lo aggiungeremo all'uso nel Task 4 — il tipo compila comunque perché è prodotto dal server e consumato opzionalmente).

- [ ] **Step 7: Commit**

```bash
git add server/src/game/phases.ts server/src/index.ts client/src/shared/events.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(voto): VOTE_2 no timer, advance on explicit confirm (socket wiring)"
```

---

### Task 4: Client — UI conferma VOTE_2 + conteggi al posto del countdown

**Files:**
- Modify: `client/src/player/PlayerApp.tsx` (ramo VOTE_2)
- Modify: `client/src/host/HostApp.tsx` (ramo VOTE_2)

**Interfaces:**
- Consumes: `SocketEvents.PlayerConfirmVote`, `game.confirmedCount`, `game.votedCount`, `game.dilemma`.
- Produces: nessuna (UI).

- [ ] **Step 1: Telefono — pulsante "Confermo" in VOTE_2**

Nel `PlayerApp.tsx`, il ramo che gestisce i voti A/B copre `VOTE_1 | VOTE_2 | DUEL_PICK | DUEL_REPICK`. Aggiungi, sotto i due pulsanti A/B, una sezione mostrata **solo in VOTE_2** che permette di confermare la scelta pre-riempita senza cambiarla. Subito prima della chiusura `</main>` di quel ramo:

```tsx
{phase === 'VOTE_2' && (
  <button
    type="button"
    onClick={() => getSocket().emit(SocketEvents.PlayerConfirmVote)}
    style={{
      marginTop: '0.25rem',
      fontSize: '1.05rem',
      fontWeight: 700,
      padding: '0.7rem 1.6rem',
      borderRadius: '0.7rem',
      cursor: 'pointer',
    }}
  >
    Confermo ✓
  </button>
)}
{phase === 'VOTE_2' && (
  <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
    Confermati {game?.confirmedCount ?? 0}/{players.length} · si va avanti quando tutti hanno confermato
  </p>
)}
```

Nota: anche toccare di nuovo A o B (cambiando o ribadendo) conta come conferma lato server (Task 2/3); il pulsante "Confermo ✓" serve a chi vuole tenere la prima scelta senza ri-toccarla.

- [ ] **Step 2: Schermo host — "Confermati X/N" invece del countdown**

Nel `HostApp.tsx`, ramo `phase === 'VOTE_2'`, sostituisci/integra il testo statico con il conteggio:

```tsx
{phase === 'VOTE_2' && (
  <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, maxWidth: '40rem' }}>
    Confermate il voto dal telefono ✓ · {game.confirmedCount}/{players.length}
  </p>
)}
```

(Il countdown grande sparisce da solo: con `phaseExpiresAt = null`, `useCountdown` ritorna `null` e il blocco countdown è già guardato da `remaining != null`.)

- [ ] **Step 3: Verifica build + lint**

Run: `npm run typecheck && npm run lint && npm run build` → tutto verde.

- [ ] **Step 4: Verifica manuale (dev)**

Run: `npm run dev`. Apri `/host?code=…` (spettatore) + 2 telefoni su `/join`.
- VOTE_1/PREDICT/SPEAKER_VOTE: niente countdown; si avanza appena tutti hanno agito.
- VOTE_2: la prima scelta è pre-selezionata; finché non si tocca "Confermo" (o si cambia) NON si avanza; appena **tutti** i presenti confermano → si passa ai risultati. Il leader può sempre "Salta ▶".
- Disconnetti un telefono in VOTE_2 (chiudi la tab): dopo il grace, non deve bloccare l'avanzamento.

- [ ] **Step 5: Commit**

```bash
git add client/src/player/PlayerApp.tsx client/src/host/HostApp.tsx
git commit -m "feat(voto): VOTE_2 confirm UI + present-count instead of countdown"
```

---

## Self-Review

**Spec coverage:**
- "phaseExpiresAt=null su VOTE_1/VOTE_2/PREDICT/SPEAKER_VOTE" → Task 1 (3 fasi) + Task 3 (VOTE_2). ✓
- "VOTE_1 already allVoted; remove timer" → Task 1. ✓
- "VOTE_2 conferma esplicita, set confirmedVote2, bot pre-confermati, avanza a tutti-confermati" → Task 2 (store) + Task 3 (wiring) + Task 4 (UI). ✓
- "PREDICT/SPEAKER_VOTE remove timer" → Task 1 (early-advance già esistente). ✓
- "presenti = connessi; disconnessi non bloccano; bot non bloccano" → `allConfirmed` (Task 2) + leaver test + bot test. ✓
- "override leader come rete" → riusa `leader:advancePhase` esistente (nessuna modifica necessaria); verificato in Task 4 Step 4. ✓
- "solo conteggi aggregati" → `confirmedCount` espone solo un numero; nessun voto individuale. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step ha codice reale o comando con output atteso.

**Type consistency:** `confirmVote`/`confirmedCount`/`allConfirmed` (rooms.ts) usati identici in index.ts; `confirmedVote2: Set<string>`; `SocketEvents.PlayerConfirmVote='player:confirmVote'`; `GameStatePayload.confirmedCount: number` prodotto in `gameStatePayload` e consumato in PlayerApp/HostApp.

## Note di esecuzione (coordinamento)

- Il loop **Ralph** committa in autonomia su questo branch: prima di eseguire, metterlo in pausa per evitare conflitti su `phases.ts`/`rooms.ts`/`index.ts`.
- Il **deploy** in produzione è separato e ancora da sbloccare dalla dashboard Railway — non bloccante per questa implementazione.
- Slice successiva (separata): **dibattito a mano alzata** (stessa spec), che avrà il suo piano.
