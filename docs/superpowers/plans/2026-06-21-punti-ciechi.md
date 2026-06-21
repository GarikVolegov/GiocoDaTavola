# Punti ciechi (Lotto 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fine partita, ogni giocatore riceve in privato sul proprio telefono un consiglio di miglioramento sul suo "punto cieco", dedotto con regole deterministiche dalle sue statistiche di voto. I premi-superlativi pubblici restano invariati.

**Architecture:** Un modulo puro `blindspots.ts` mappa le `PlayerStats` accumulate a un singolo consiglio. Poiché è feedback personale, NON viaggia nel `game:state` (broadcast a tutta la stanza): all'ingresso in `FINAL_AWARDS` il server emette un evento per-socket `player:blindSpot` a ciascun giocatore umano.

**Tech Stack:** TypeScript (server CJS + client ESM), Socket.IO, React, Vitest.

## Global Constraints

- **Privacy:** il punto cieco è privato — solo al socket del singolo giocatore, mai in broadcast. I bot vengono saltati.
- **Niente AI:** solo regole deterministiche sulle statistiche già esistenti (Fase C / LLM resta fuori).
- Niente `any`; prefissa con `_` gli inutilizzati.
- Server CJS / client ESM separati.
- `npm run typecheck && npm run lint && npm test && npm run build` tutti verdi prima di ogni commit.
- Questo lotto è **indipendente** dagli altri due: può essere eseguito in qualsiasi ordine.

## File Structure

- Modify `server/src/game/awards.ts` — `PlayerStats` guadagna `defendedCount`; `ensureStats` lo inizializza.
- Modify `server/src/game/rooms.ts` — incrementa `defendedCount` in `recordRoundStats`; nuovo metodo `blindSpotFor`.
- Create `server/src/game/blindspots.ts` — `computeBlindSpot(stats): BlindSpot`.
- Create `server/src/game/__tests__/blindspots.test.ts`.
- Modify `client/src/shared/events.ts` — nome evento `PlayerBlindSpot` + tipi `BlindSpot`/`BlindSpotId`.
- Modify `server/src/index.ts` — emette `player:blindSpot` a FINAL_AWARDS e su reconnect.
- Modify `client/src/player/PlayerApp.tsx` — card privata "🔭 Il tuo punto cieco" a FINAL_AWARDS.

---

### Task 1: Statistica `defendedCount`

**Files:**
- Modify: `server/src/game/awards.ts:7-18` (interface `PlayerStats`), `server/src/game/awards.ts:33-40` (`ensureStats`)
- Modify: `server/src/game/rooms.ts:375-395` (`recordRoundStats`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Produces: `PlayerStats` guadagna `defendedCount: number` (round in cui il giocatore è stato difensore).

- [ ] **Step 1: Scrivi il test (fallisce)**

In `server/src/game/__tests__/rooms.test.ts`, vicino agli altri test che usano `defenseRoom`:

```ts
it('counts a round each defender defended (defendedCount)', () => {
  const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
  const code = defenseRoom(store, ['A', 'B', 'B']); // defenders: sock-0 (A), sock-1 (B)
  let guard = 0;
  while (store.get(code)?.phase !== 'PHASE_RESULTS' && guard++ < 20) store.advancePhase(code);
  expect(store.get(code)?.stats.get('sock-0')?.defendedCount).toBe(1);
  expect(store.get(code)?.stats.get('sock-1')?.defendedCount).toBe(1);
  expect(store.get(code)?.stats.get('sock-2')?.defendedCount ?? 0).toBe(0);
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisce**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "defendedCount"`
Expected: FAIL — `defendedCount` è `undefined` (o errore di typecheck al passo successivo).

- [ ] **Step 3: Aggiungi il campo e incrementalo**

In `server/src/game/awards.ts`, l'interface `PlayerStats` guadagna:

```ts
  /** Rounds the player was a chosen defender. */
  defendedCount: number;
```

e `ensureStats` inizializza il record completo:

```ts
    s = { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0 };
```

In `server/src/game/rooms.ts`, dentro `recordRoundStats`, il loop finale sui difensori diventa:

```ts
    const netSwing: VoteTally = { A: second.A - first.A, B: second.B - first.B };
    for (const d of room.defenders) {
      const ds = ensureStats(room, d.id);
      ds.defendedCount++;
      if (netSwing[d.side] > 0) ds.persuasion += netSwing[d.side];
    }
```

- [ ] **Step 4: Esegui il test, verifica che passa**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "defendedCount"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/game/awards.ts server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(blindspots): track per-player defendedCount in stats"
```

---

### Task 2: Modulo puro `blindspots.ts`

**Files:**
- Create: `server/src/game/blindspots.ts`
- Test: `server/src/game/__tests__/blindspots.test.ts`

**Interfaces:**
- Consumes: `PlayerStats` (con `defendedCount`, Task 1) da `./awards`.
- Produces:
  - `type BlindSpotId = 'volubile' | 'rigido' | 'conformista' | 'contrarian' | 'difese-deboli' | 'equilibrato' | 'esordiente'`
  - `interface BlindSpot { id: BlindSpotId; title: string; advice: string }`
  - `function computeBlindSpot(stats: PlayerStats): BlindSpot`

- [ ] **Step 1: Scrivi i test (falliscono)**

Crea `server/src/game/__tests__/blindspots.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeBlindSpot } from '../blindspots';
import type { PlayerStats } from '../awards';

// Build a PlayerStats with sensible zeros, overriding only what each case needs.
function stats(over: Partial<PlayerStats>): PlayerStats {
  return { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0, ...over };
}

describe('computeBlindSpot', () => {
  it('flags a frequent mind-changer as "volubile"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 3, majorityCount: 2, minorityCount: 1 })).id).toBe('volubile');
  });

  it('flags someone who never changed as "rigido"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 0, majorityCount: 2, minorityCount: 1, persuasion: 1, defendedCount: 1 })).id).toBe('rigido');
  });

  it('flags a majority-follower as "conformista"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 3 })).id).toBe('conformista');
  });

  it('flags a frequent minority voter as "contrarian"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, minorityCount: 3 })).id).toBe('contrarian');
  });

  it('flags an ineffective defender as "difese-deboli"', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 1, minorityCount: 1, persuasion: 0, defendedCount: 1 })).id).toBe('difese-deboli');
  });

  it('falls back to "equilibrato" when no pattern dominates', () => {
    expect(computeBlindSpot(stats({ rounds: 3, changedCount: 1, majorityCount: 1, minorityCount: 1, persuasion: 2, defendedCount: 1 })).id).toBe('equilibrato');
  });

  it('flags too-few-rounds players as "esordiente"', () => {
    expect(computeBlindSpot(stats({ rounds: 1, changedCount: 0 })).id).toBe('esordiente');
    expect(computeBlindSpot(stats({ rounds: 0 })).id).toBe('esordiente');
  });

  it('always returns a non-empty title and advice', () => {
    const b = computeBlindSpot(stats({ rounds: 3, changedCount: 0 }));
    expect(b.title.trim()).not.toBe('');
    expect(b.advice.trim()).not.toBe('');
  });
});
```

- [ ] **Step 2: Esegui i test, verifica che falliscono**

Run: `npx vitest run server/src/game/__tests__/blindspots.test.ts`
Expected: FAIL — `Cannot find module '../blindspots'`.

- [ ] **Step 3: Implementa `blindspots.ts`**

Crea `server/src/game/blindspots.ts`:

```ts
// Per-player end-of-game "blind spot": one deterministic improvement tip derived
// from the player's accumulated vote stats (no AI). Sibling of awards.ts.

import type { PlayerStats } from './awards';

export type BlindSpotId =
  | 'volubile'
  | 'rigido'
  | 'conformista'
  | 'contrarian'
  | 'difese-deboli'
  | 'equilibrato'
  | 'esordiente';

export interface BlindSpot {
  id: BlindSpotId;
  title: string;
  advice: string;
}

/**
 * Map a player's accumulated stats to a single blind-spot tip. Rules are checked
 * in priority order — the first match wins. Behavioural rules need >= 3 rounds;
 * "rigido" needs >= 2; with < 2 rounds there's no readable pattern (esordiente).
 */
export function computeBlindSpot(s: PlayerStats): BlindSpot {
  const { rounds, changedCount, majorityCount, minorityCount, persuasion, defendedCount } = s;
  const rate = (n: number): number => (rounds > 0 ? n / rounds : 0);

  if (rounds >= 3 && rate(changedCount) >= 2 / 3) {
    return {
      id: 'volubile',
      title: 'Cambi idea spesso',
      advice:
        'Bello restare aperti, ma assicurati che a convincerti siano gli argomenti, non la maggioranza. Prova a difendere di più la tua prima scelta.',
    };
  }
  if (rounds >= 2 && changedCount === 0) {
    return {
      id: 'rigido',
      title: 'Non cambi mai idea',
      advice:
        'La prossima volta prova ad ascoltare il «perché» di chi la pensa diversamente e a lasciarti convincere almeno una volta.',
    };
  }
  if (rounds >= 3 && rate(majorityCount) >= 2 / 3) {
    return {
      id: 'conformista',
      title: 'Vai con il gruppo',
      advice:
        'Finisci quasi sempre con la maggioranza. Fidati di più del tuo istinto quando vai controcorrente: a volte la minoranza ha ragione.',
    };
  }
  if (rounds >= 3 && rate(minorityCount) >= 2 / 3) {
    return {
      id: 'contrarian',
      title: 'Spesso in minoranza',
      advice:
        'Avere idee proprie è un pregio, ma chiediti se a volte la maggioranza ha colto qualcosa che a te sfugge.',
    };
  }
  if (defendedCount >= 1 && persuasion <= 0) {
    return {
      id: 'difese-deboli',
      title: 'Difese poco incisive',
      advice:
        'Quando hai difeso, il gruppo non si è spostato verso di te. Prova ad argomentare con esempi concreti più che con principi.',
    };
  }
  if (rounds < 2) {
    return {
      id: 'esordiente',
      title: 'Poche giocate',
      advice: 'Hai giocato pochi round: difficile leggere un punto cieco. Buttati di più la prossima volta!',
    };
  }
  return {
    id: 'equilibrato',
    title: 'Bell\'equilibrio',
    advice: 'Buon equilibrio tra ascolto e convinzione: il prossimo passo è far cambiare idea agli altri con esempi concreti.',
  };
}
```

- [ ] **Step 4: Esegui i test, verifica che passano**

Run: `npx vitest run server/src/game/__tests__/blindspots.test.ts`
Expected: PASS (8 test)

- [ ] **Step 5: Commit**

```bash
git add server/src/game/blindspots.ts server/src/game/__tests__/blindspots.test.ts
git commit -m "feat(blindspots): deterministic per-player blind-spot from stats"
```

---

### Task 3: `RoomStore.blindSpotFor` (gated a FINAL_AWARDS)

**Files:**
- Modify: `server/src/game/rooms.ts` (import + nuovo metodo, vicino a `publicAwards:774`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `computeBlindSpot` + `BlindSpot` (Task 2).
- Produces: `RoomStore.blindSpotFor(code: string, playerId: string): BlindSpot | null` — il consiglio del giocatore solo a `FINAL_AWARDS`, altrimenti `null`; `null` anche per stanza/giocatore sconosciuti.

- [ ] **Step 1: Scrivi il test (fallisce)**

In `server/src/game/__tests__/rooms.test.ts`:

```ts
it('blindSpotFor returns a tip at FINAL_AWARDS and null otherwise', () => {
  const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
  const { code } = store.create();
  addPlayers(store, code, 3); // p0, p1, p2
  store.startGame(code, 3);
  expect(store.blindSpotFor(code, 'p0')).toBeNull(); // before the end
  let guard = 0;
  while (store.get(code)?.phase !== 'FINAL_AWARDS' && guard++ < 200) {
    const phase = store.get(code)!.phase;
    if (phase === 'VOTE_1' || phase === 'VOTE_2') {
      ['p0', 'p1', 'p2'].forEach((id) => store.vote(code, id, 'A'));
    }
    store.advancePhase(code);
  }
  expect(store.get(code)?.phase).toBe('FINAL_AWARDS');
  expect(store.blindSpotFor(code, 'p0')?.id).toBeTruthy();
  expect(store.blindSpotFor(code, 'nobody')).toBeNull();
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisce**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "blindSpotFor"`
Expected: FAIL — `store.blindSpotFor` non è una funzione.

- [ ] **Step 3: Implementa il metodo**

In `server/src/game/rooms.ts`, aggiungi all'import dei moduli di gioco:

```ts
import { computeBlindSpot, type BlindSpot } from './blindspots';
```

ed esponi il tipo per i consumatori (vicino al re-export di `Award`):

```ts
export type { BlindSpot, BlindSpotId } from './blindspots';
```

Aggiungi il metodo nella classe `RoomStore`, dopo `publicAwards`:

```ts
  /**
   * The player's end-of-game blind-spot tip, only at FINAL_AWARDS (null
   * otherwise). Private feedback — index.ts emits it per-socket, never broadcast.
   */
  blindSpotFor(code: string, playerId: string): BlindSpot | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'FINAL_AWARDS') return null;
    const stats = room.stats.get(playerId);
    return stats ? computeBlindSpot(stats) : null;
  }
```

- [ ] **Step 4: Esegui il test, verifica che passa**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "blindSpotFor"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(blindspots): RoomStore.blindSpotFor gated to FINAL_AWARDS"
```

---

### Task 4: Evento + emissione per-socket nel server

**Files:**
- Modify: `client/src/shared/events.ts` (nome evento + tipi mirror)
- Modify: `server/src/index.ts:162-170` (`advanceAndBroadcast`), `server/src/index.ts:269-274` (reconnect in `player:join`)

**Interfaces:**
- Consumes: `RoomStore.blindSpotFor` (Task 3), mappe `playerSocket` (esistente in `index.ts`).
- Produces: evento Socket.IO `player:blindSpot` con payload `BlindSpot`.

> Verifica via `typecheck`/`build` + prova manuale (l'event layer di `index.ts` non è coperto da Vitest).

- [ ] **Step 1: Nome evento + tipi mirror nel client**

In `client/src/shared/events.ts`, aggiungi a `SocketEvents`:

```ts
  /** Server sends each player their own private end-of-game blind-spot tip. */
  PlayerBlindSpot: 'player:blindSpot',
```

e in fondo ai tipi:

```ts
export type BlindSpotId =
  | 'volubile' | 'rigido' | 'conformista' | 'contrarian' | 'difese-deboli' | 'equilibrato' | 'esordiente';

/** Private per-player improvement tip, shown only on that player's own phone. */
export interface BlindSpot {
  id: BlindSpotId;
  title: string;
  advice: string;
}
```

- [ ] **Step 2: Emetti a FINAL_AWARDS e su reconnect (server)**

In `server/src/index.ts`, aggiungi un helper vicino a `broadcastGameState`:

```ts
// At FINAL_AWARDS, send each HUMAN player their own private blind-spot tip — to
// their socket only (never broadcast). Bots and offline players are skipped.
function emitBlindSpots(code: string): void {
  const room = rooms.get(code);
  if (!room || room.phase !== 'FINAL_AWARDS') return;
  for (const player of room.players.values()) {
    if (player.isBot) continue;
    const sid = playerSocket.get(player.id);
    if (!sid) continue;
    const tip = rooms.blindSpotFor(code, player.id);
    if (tip) io.to(sid).emit('player:blindSpot', tip);
  }
}
```

In `advanceAndBroadcast`, dopo `broadcastGameState(code);`:

```ts
  if (rooms.get(code)?.phase === 'FINAL_AWARDS') emitBlindSpots(code);
```

In `player:join`, nel blocco reconnect (dopo aver inviato `game:state` al socket), aggiungi così un telefono che si riconnette a fine partita riceve di nuovo il consiglio:

```ts
    if (room && room.phase === 'FINAL_AWARDS') {
      const tip = rooms.blindSpotFor(code, playerId);
      if (tip) socket.emit('player:blindSpot', tip);
    }
```

- [ ] **Step 3: typecheck / build**

Run: `npm run typecheck && npm run build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/events.ts server/src/index.ts
git commit -m "feat(blindspots): emit private player:blindSpot at FINAL_AWARDS"
```

---

### Task 5: Card privata sul telefono (PlayerApp)

**Files:**
- Modify: `client/src/player/PlayerApp.tsx` (listener + stato + ramo FINAL_AWARDS, ~righe 91-153 e 415-418)

**Interfaces:**
- Consumes: evento `player:blindSpot` (Task 4), `Card` da `../shared/ui`.

- [ ] **Step 1: Stato + listener**

In `client/src/player/PlayerApp.tsx`:
- importa il tipo: aggiungi `type BlindSpot,` all'import da `'../shared/events'`.
- aggiungi lo stato: `const [blindSpot, setBlindSpot] = useState<BlindSpot | null>(null);`
- nell'`useEffect` principale, registra il listener:

```ts
    const onBlindSpot = (tip: BlindSpot) => setBlindSpot(tip);
    socket.on(SocketEvents.PlayerBlindSpot, onBlindSpot);
```

e nella cleanup:

```ts
      socket.off(SocketEvents.PlayerBlindSpot, onBlindSpot);
```

- in `leaveRoom`, azzera: `setBlindSpot(null);`

- [ ] **Step 2: Rendi la card a FINAL_AWARDS**

Nel ramo generico in fondo (`if (joinedCode && phase !== 'LOBBY')`), nel caso `phase === 'FINAL_AWARDS'`, sostituisci il singolo paragrafo «🏆 Guarda i premi sullo schermo!» con il paragrafo + la card privata:

```tsx
        ) : phase === 'FINAL_AWARDS' ? (
          <>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              🏆 Guarda i premi sullo schermo!
            </p>
            {blindSpot && (
              <Card
                glow="accent"
                style={{ width: 'min(90vw, 22rem)', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}
              >
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🔭 Il tuo punto cieco</h3>
                <p style={{ margin: 0, fontWeight: 700 }}>{blindSpot.title}</p>
                <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.9 }}>{blindSpot.advice}</p>
              </Card>
            )}
          </>
        ) : phase === 'FINAL_DUEL' ? (
```

(`Card` è già importato in PlayerApp.)

- [ ] **Step 3: typecheck / lint / build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: verde.

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev`. Gioca una partita breve (formato Assaggio, 3 round) fino a FINAL_AWARDS con almeno 2 telefoni che votano in modo diverso (es. uno conferma sempre, uno cambia spesso). A fine partita:
- Ogni telefono mostra la card «🔭 Il tuo punto cieco» con titolo+consiglio DIVERSI in base al comportamento.
- La TV (`/host`) mostra solo i premi pubblici, nessun punto cieco.
- Ricaricando un telefono a fine partita, la card riappare (re-emit su reconnect).

- [ ] **Step 5: Commit**

```bash
git add client/src/player/PlayerApp.tsx
git commit -m "feat(blindspots): private blind-spot card on each phone at FINAL_AWARDS"
```

---

## Self-Review

- **Spec coverage:** regole deterministiche dalle statistiche (Task 2) ✓, `defendedCount` per difese accurate (Task 1) ✓, privato per-socket via `player:blindSpot` (Task 3/4) ✓, premi pubblici invariati (non toccati) ✓, card sul telefono a FINAL_AWARDS + re-emit reconnect (Task 4/5) ✓, bot saltati (Task 4) ✓.
- **Placeholder scan:** nessun TODO/placeholder; ogni step ha codice reale.
- **Type consistency:** `BlindSpot { id; title; advice }` identico in `blindspots.ts` (Task 2) e `events.ts` (Task 4); `BlindSpotId` con le stesse 7 varianti in entrambi; `defendedCount` aggiunto a `PlayerStats` (Task 1) e usato in `computeBlindSpot` (Task 2) e nelle fixture di test (`stats()` helper).
- **Nota di ordine:** Task 2 dipende da `defendedCount` (Task 1) perché `computeBlindSpot` lo legge; eseguire i task in ordine.
