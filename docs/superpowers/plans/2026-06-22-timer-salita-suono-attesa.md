# Timer in salita per chi parla + suono d'attesa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far salire il cronometro da 0 mentre qualcuno parla (DEFENSE/INTERVENTI) su `/host` e sul telefono di chi parla, e aggiungere un sottofondo ambient in loop su `/host` durante le schermate di attesa.

**Architecture:** Il server espone già floor (`minEndsAt`)/cap (`phaseExpiresAt`) e tutta la meccanica finish/raise/INTERVENTI. Aggiungiamo un solo campo `turnStartedAt` (impostato in `armTurn`) esposto come `DefenseState.startedAt`; il client lo rende come conteggio in salita (`useElapsed` + `formatMSS`). L'audio è un loop Web Audio generato (nessun asset) sull'host, sbloccato al primo gesto utente.

**Tech Stack:** Server Node + TS CommonJS (vitest, env node). Client React + Vite TS ESM. Web Audio API. Test solo su logica pura (no DOM runner).

## Global Constraints

- **Gate verde prima di ogni commit**: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` devono restare tutti verdi (eseguiti dalla root del worktree).
- **Niente `any`** (errore di lint). Prefissare con `_` variabili/argomenti intenzionalmente inutilizzati.
- **Server CJS / client ESM separati**: il client **non** importa le costanti di floor/cap del server; usa solo i timestamp dello snapshot.
- **Voti segreti**: l'unico campo nuovo che lascia il server è `startedAt` (timestamp di turno, non un voto).
- **Timer server-authoritative** (epoch ms): il client rende soltanto.
- Worktree: `timer-salita-audio` (da `ralph/skeleton-dilemma` @ abd74d5). Non lavorare nel repo principale (Ralph è attivo lì).
- Riferimenti di codice verificati: `armTurn` [rooms.ts:662]; init room `turnMinEndsAt: null` [rooms.ts:971]; `DefenseState` [rooms.ts:165-192]; `publicDefense` [rooms.ts:1846]; tipo client `DefenseState` [events.ts:400-424]; timer host [HostApp.tsx:553]; ramo speaker [PlayerApp.tsx:712-757]; submit "Collega TV" [HostApp.tsx:154].

---

### Task 1: Server — `turnStartedAt` + `DefenseState.startedAt`

**Files:**
- Modify: `server/src/game/rooms.ts` (Room interface ~316; init ~971; `DefenseState` ~189; `armTurn` ~666; `publicDefense` due rami ~1846)
- Test: `server/src/game/__tests__/rooms.test.ts` (aggiornare 3 `toEqual` esistenti; estendere il describe `armTurn on DEFENSE entry`)

**Interfaces:**
- Produces: `Room.turnStartedAt: number | null`; `DefenseState.startedAt: number | null` (= `room.turnStartedAt`, popolato in `armTurn` su entrambi i rami umano/bot).

- [ ] **Step 1: Aggiorna i test esistenti `publicDefense` (toEqual) + aggiungi le asserzioni nuove (failing)**

In `server/src/game/__tests__/rooms.test.ts`, nei tre oggetti attesi di `publicDefense` aggiungi `startedAt: 0` (il `now` iniettato è `() => 0`):
- nell'oggetto a riga ~653 (primo turno DEFENSE), dopo `canFinish: false,` aggiungi `startedAt: 0,`
- nell'oggetto a riga ~668 (secondo turno), dopo `canFinish: false,` aggiungi `startedAt: 0,`
- nell'oggetto a riga ~716 (no-defenders), dopo `canFinish: true,` aggiungi `startedAt: 0,`

Poi estendi il describe `armTurn on DEFENSE entry` (~2254) con un nuovo test:

```ts
  it('records the turn start (turnStartedAt) and exposes it as defense.startedAt', () => {
    const now = 7_000;
    const store = new RoomStore(generateRoomCode, () => now, makeFixtureDeck, () => 0);
    const code = defenseRoom(store, ['A', 'B', 'B']);
    expect(store.get(code)!.turnStartedAt).toBe(now);
    expect(store.publicDefense(code)!.startedAt).toBe(now);
  });
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npm test -- rooms`
Expected: FAIL — il nuovo test non trova `turnStartedAt`/`startedAt`; i tre `toEqual` falliscono perché l'oggetto reale non ha ancora `startedAt`.

- [ ] **Step 3: Implementa il campo nel modello**

In `server/src/game/rooms.ts`:

1. Nell'interfaccia `Room`, subito dopo `turnMinEndsAt: number | null;` (~316) aggiungi:
```ts
  /** When the current DEFENSE/INTERVENTI turn started (epoch ms); for the count-up timer. null outside a speaking turn. */
  turnStartedAt: number | null;
```
2. Nell'inizializzazione della room, dopo `turnMinEndsAt: null,` (~971) aggiungi:
```ts
      turnStartedAt: null,
```
3. Nell'interfaccia `DefenseState`, dopo `minEndsAt: number | null;` (~189) aggiungi:
```ts
  /** When the current turn started (epoch ms); the client renders the count-up from here. */
  startedAt: number | null;
```
4. In `armTurn`, subito dopo `const now = this.now();` (~666, prima dell'`if`) aggiungi:
```ts
    room.turnStartedAt = now;
```
5. In `publicDefense`, aggiungi `startedAt: room.turnStartedAt,` accanto a `canFinish` in **entrambi** gli oggetti restituiti (ramo `'intervento'` ~ dopo `canFinish,` e ramo `'defense'` ~ dopo `canFinish,`).

- [ ] **Step 4: Esegui i test per vederli passare**

Run: `npm test -- rooms`
Expected: PASS (189+1 test del file rooms verdi).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difese): turnStartedAt + DefenseState.startedAt per il count-up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Client — logica pura del tempo (`time.ts`) + test runner

**Files:**
- Create: `client/src/shared/time.ts`
- Test: `client/src/shared/time.test.ts`
- Modify: `vitest.config.ts` (allargare `include`)
- Modify: `client/tsconfig.json` (escludere i test dal typecheck, come fa il server)

**Interfaces:**
- Produces:
  - `elapsedSeconds(startedAt: number | null, now: number): number | null`
  - `formatMSS(totalSeconds: number): string`
  - `isWaitingPhase(phase: GamePhase): boolean`

- [ ] **Step 1: Scrivi il test (failing) + abilita il runner client**

Crea `client/src/shared/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { elapsedSeconds, formatMSS, isWaitingPhase } from './time';

describe('elapsedSeconds', () => {
  it('is null when there is no start', () => {
    expect(elapsedSeconds(null, 1000)).toBeNull();
  });
  it('is 0 at the start and grows over time', () => {
    expect(elapsedSeconds(1000, 1000)).toBe(0);
    expect(elapsedSeconds(1000, 1999)).toBe(0);
    expect(elapsedSeconds(1000, 2000)).toBe(1);
    expect(elapsedSeconds(1000, 31_500)).toBe(30);
  });
  it('never goes negative if now precedes the start', () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
  });
});

describe('formatMSS', () => {
  it('formats seconds as M:SS with zero-padded seconds', () => {
    expect(formatMSS(0)).toBe('0:00');
    expect(formatMSS(5)).toBe('0:05');
    expect(formatMSS(42)).toBe('0:42');
    expect(formatMSS(65)).toBe('1:05');
    expect(formatMSS(180)).toBe('3:00');
  });
});

describe('isWaitingPhase', () => {
  it('is true for idle/listening phases', () => {
    expect(isWaitingPhase('DEFENSE')).toBe(true);
    expect(isWaitingPhase('INTERVENTI')).toBe(true);
    expect(isWaitingPhase('VOTE_1')).toBe(true);
    expect(isWaitingPhase('LOBBY')).toBe(true);
  });
  it('is false for short auto-advancing reveals and the finale', () => {
    expect(isWaitingPhase('DILEMMA_REVEAL')).toBe(false);
    expect(isWaitingPhase('PHASE_RESULTS')).toBe(false);
    expect(isWaitingPhase('FINAL_AWARDS')).toBe(false);
  });
});
```

In `vitest.config.ts`, cambia `include` in:
```ts
    include: ['server/**/*.{test,spec}.ts', 'client/src/**/*.{test,spec}.ts'],
```

In `client/tsconfig.json`, aggiungi (dopo `"include": ["src"]`) una `exclude` per non far type-checkare i test (coerente con `server/tsconfig.json`):
```json
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
```

- [ ] **Step 2: Esegui il test per vederlo fallire**

Run: `npm test -- time`
Expected: FAIL — `Cannot find module './time'`.

- [ ] **Step 3: Implementa `time.ts`**

Crea `client/src/shared/time.ts`:

```ts
import type { GamePhase } from './events';

// Whole seconds elapsed since `startedAt` (epoch ms). null when there is no active
// turn; never negative (clamps if the clock is behind the server timestamp). Mirror
// of useCountdown's math, in the opposite direction.
export function elapsedSeconds(startedAt: number | null, now: number): number | null {
  if (startedAt == null) return null;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

// Format a whole-second count as "M:SS" (seconds zero-padded). Used for the count-up
// timer, which can exceed 60s (cap up to 180s).
export function formatMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

// Phases where the host shows a "waiting" screen and the ambient loop should play:
// idle waits for input plus listening to a speaker. Excludes the short, auto-advancing
// reveal/result cards and the finale.
const WAITING_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'LOBBY',
  'PHASE_INTRO',
  'VOTE_1',
  'PREDICT',
  'DEFENSE',
  'INTERVENTI',
  'VOTE_2',
  'SPEAKER_VOTE',
  'ACCUSE',
  'TAPPA_RECAP',
  'DUEL_PICK',
  'DUEL_REPICK',
  'DUEL_ARGUE',
]);

export function isWaitingPhase(phase: GamePhase): boolean {
  return WAITING_PHASES.has(phase);
}
```

- [ ] **Step 4: Esegui il test per vederlo passare**

Run: `npm test -- time`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tutto PASS (typecheck client verde grazie all'`exclude`).

```bash
git add client/src/shared/time.ts client/src/shared/time.test.ts vitest.config.ts client/tsconfig.json
git commit -m "feat(client): time.ts (elapsedSeconds/formatMSS/isWaitingPhase) + test client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Client — `useElapsed` + tipo `startedAt` + display count-up (host + telefono speaker)

**Files:**
- Modify: `client/src/shared/events.ts` (`DefenseState` ~422)
- Create: `client/src/shared/useElapsed.ts`
- Modify: `client/src/host/HostApp.tsx` (calcolo ~121; blocco timer ~553)
- Modify: `client/src/player/PlayerApp.tsx` (calcolo ~330; ramo `myTurn` ~712-757)

**Interfaces:**
- Consumes (Task 1/2): `DefenseState.startedAt`, `elapsedSeconds`, `formatMSS`.
- Produces: `useElapsed(startedAt: number | null): number | null` (hook).

**Verifica:** non esiste runner DOM/React (come `useCountdown`, senza test): questo task si verifica con `typecheck` + `lint` + `build` verdi e con verifica visiva. La logica numerica è già coperta da Task 2.

- [ ] **Step 1: Aggiungi `startedAt` al tipo client `DefenseState`**

In `client/src/shared/events.ts`, nell'interfaccia `DefenseState`, dopo `minEndsAt: number | null;` (~422) aggiungi:
```ts
  /** When the current turn started (epoch ms); source for the count-up timer. */
  startedAt: number | null;
```

- [ ] **Step 2: Crea l'hook `useElapsed`**

Crea `client/src/shared/useElapsed.ts`:
```ts
import { useEffect, useState } from 'react';
import { elapsedSeconds } from './time';

// Live count-UP from a server-computed turn-start timestamp (epoch ms). Mirror of
// useCountdown: the server is authoritative about WHEN the turn started; the client
// only renders the whole seconds elapsed. Returns null when there is no active turn.
export function useElapsed(startedAt: number | null): number | null {
  const [elapsed, setElapsed] = useState<number | null>(() => elapsedSeconds(startedAt, Date.now()));

  useEffect(() => {
    if (startedAt == null) {
      setElapsed(null);
      return;
    }
    const tick = () => setElapsed(elapsedSeconds(startedAt, Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}
```

- [ ] **Step 3: Host — mostra il count-up durante DEFENSE/INTERVENTI**

In `client/src/host/HostApp.tsx`:

1. In cima al file aggiungi gli import:
```ts
import { useElapsed } from '../shared/useElapsed';
import { formatMSS } from '../shared/time';
```
2. Vicino a `const remaining = useCountdown(game?.phaseExpiresAt ?? null);` (~121) aggiungi:
```ts
  const elapsed = useElapsed(game?.defense?.startedAt ?? null);
  const speaking = phase === 'DEFENSE' || phase === 'INTERVENTI';
```
(`phase` è già derivato nel componente; se non lo è in questo scope, usa `game?.phase`.)
3. Sostituisci il blocco timer (~553):
```tsx
{remaining != null && (
  <div
    aria-label="Tempo rimanente"
    style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
  >
    {remaining}s
  </div>
)}
```
con:
```tsx
{speaking && game?.defense?.startedAt != null ? (
  <div
    aria-label="Tempo trascorso"
    style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
  >
    {formatMSS(elapsed ?? 0)}
  </div>
) : remaining != null ? (
  <div
    aria-label="Tempo rimanente"
    style={{ fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
  >
    {remaining}s
  </div>
) : null}
```

- [ ] **Step 4: Telefono dello speaker — cronometro grande in salita**

In `client/src/player/PlayerApp.tsx`:

1. Aggiungi gli import in cima:
```ts
import { useElapsed } from '../shared/useElapsed';
import { formatMSS } from '../shared/time';
```
2. Vicino a `const remaining = useCountdown(game?.phaseExpiresAt ?? null);` (~330) aggiungi:
```ts
  const speakerElapsed = useElapsed(game?.defense?.startedAt ?? null);
```
3. Nel ramo `myTurn`, subito prima di `{finishButton}` (~757) inserisci:
```tsx
            {game?.defense?.startedAt != null && (
              <div
                aria-label="Tempo trascorso"
                style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatMSS(speakerElapsed ?? 0)}
              </div>
            )}
```
(Il `finishButton` mantiene già "Ho finito tra Xs" → "Ho finito ▶" e la riga "max {remaining}s": gating invariato.)

- [ ] **Step 5: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto PASS (la build vite completa; vedi nota worktree per la verifica visiva).

```bash
git add client/src/shared/events.ts client/src/shared/useElapsed.ts client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx
git commit -m "feat(client): cronometro in salita su host + telefono di chi parla

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Audio — sottofondo ambient in loop su `/host`

**Files:**
- Create: `client/src/host/ambient.ts`
- Modify: `client/src/host/HostApp.tsx` (sblocco al primo gesto + start/stop su `isWaitingPhase`)

**Interfaces:**
- Consumes (Task 2): `isWaitingPhase`.
- Produces: `unlockAmbient()`, `startAmbient()`, `stopAmbient()`.

**Verifica:** Web Audio non è unit-testabile in env node; questo task si verifica con `typecheck` + `lint` + `build` verdi e con verifica uditiva (si sente il loop nelle attese, parte dopo il primo click).

- [ ] **Step 1: Crea il modulo audio**

Crea `client/src/host/ambient.ts`:
```ts
// A soft, distinctive ambient bed for the host's waiting screens, generated with the
// Web Audio API — no binary asset. A quiet low chord under a slow tremolo (LFO on the
// gain) gives a gentle, recognizable loop. Host-only; safe no-ops when audio is
// unavailable. Drop-in alternative: swap for an <audio loop> on a file in public/.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices: { osc: OscillatorNode; lfo: OscillatorNode }[] = [];
let running = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.06; // low — a bed under the room, not a foreground sound
    master.connect(ctx.destination);
  }
  return ctx;
}

// Resume the AudioContext after a user gesture (browser autoplay policy).
export function unlockAmbient(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

export function startAmbient(): void {
  const c = getCtx();
  if (!c || !master || running) return;
  void c.resume();
  const freqs = [110, 164.81, 220]; // A2 · E3 · A3
  voices = freqs.map((f) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 1 / freqs.length;
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15; // slow swell
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(master as GainNode);
    osc.start();
    lfo.start();
    return { osc, lfo };
  });
  running = true;
}

export function stopAmbient(): void {
  for (const v of voices) {
    try {
      v.osc.stop();
      v.lfo.stop();
    } catch {
      /* already stopped */
    }
  }
  voices = [];
  running = false;
}
```

- [ ] **Step 2: Integra nell'host (sblocco + start/stop)**

In `client/src/host/HostApp.tsx`:

1. Aggiungi gli import:
```ts
import { useRef } from 'react'; // se non già importato (assicurati che useState/useEffect ci siano)
import { startAmbient, stopAmbient, unlockAmbient } from './ambient';
import { isWaitingPhase } from '../shared/time';
```
2. Dentro il componente aggiungi lo stato di "audio pronto" e gli effetti:
```ts
  const [audioReady, setAudioReady] = useState(false);

  // Unlock audio on the first user gesture on the host (the "Collega TV" submit is a
  // pointerdown, so it counts) — required by the browser autoplay policy.
  useEffect(() => {
    const onGesture = () => {
      unlockAmbient();
      setAudioReady(true);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  // Play the ambient loop during waiting phases (once audio is unlocked); stop otherwise.
  useEffect(() => {
    if (audioReady && isWaitingPhase(phase)) startAmbient();
    else stopAmbient();
  }, [audioReady, phase]);

  // Stop the loop when the host screen unmounts.
  useEffect(() => () => stopAmbient(), []);
```
(`phase`, `useState`, `useEffect` sono già usati in HostApp; riusa quelli esistenti — non duplicare import.)

- [ ] **Step 3: Gate + commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto PASS.

```bash
git add client/src/host/ambient.ts client/src/host/HostApp.tsx
git commit -m "feat(host): sottofondo ambient in loop nelle schermate di attesa

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verifica finale

- [ ] **Gate completo** dalla root del worktree:

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti verdi.

- [ ] **Verifica visiva/uditiva** (vedi nota): avvia l'app, entra in una partita fino a DEFENSE.
  - Su `/host`: il timer grande **sale** da `0:00` durante DEFENSE/INTERVENTI; nelle altre fasi a timer resta il countdown `Ns`.
  - Sul telefono di chi parla: cronometro grande che sale; "Ho finito" bloccato fino a 0:30, poi "Ho finito ▶".
  - Su `/host`: si sente il sottofondo in loop nelle attese, parte dopo il primo click ("Collega TV"), si ferma nelle card-reveal brevi e a fine partita.

> **Nota worktree (memoria `build-vite-stale`)**: la build vite può servire un bundle *stale* dentro `.claude/worktrees/`. Il gate (typecheck/lint/test/build) resta valido qui; se la verifica visiva mostra un bundle vecchio, rifarla nel repo principale dopo il merge (con Ralph in pausa) o pulendo la cache vite.

## Self-review del piano

- **Copertura spec**: (1) count-up display → Task 1 (dato) + Task 2 (formato) + Task 3 (render host+phone); (2) audio loop host nelle attese → Task 2 (`isWaitingPhase`) + Task 4. ✔
- **Niente placeholder**: ogni step ha codice o comando reale. ✔
- **Coerenza tipi**: `turnStartedAt`/`startedAt` coerenti server↔client; `elapsedSeconds`/`formatMSS`/`isWaitingPhase`/`useElapsed` usati con le firme dichiarate. ✔
