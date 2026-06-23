# Timer in salita per chi parla + suono d'attesa — Design

Data: 2026-06-22 · Worktree: `timer-salita-audio` (da `ralph/skeleton-dilemma` @ abd74d5)

## Obiettivo

Due cambi di esperienza durante la fase di difesa e le schermate di attesa:

1. **Cronometro in salita.** Mentre qualcuno parla (DEFENSE/INTERVENTI) il numero
   visibile conta **in su da 0** invece di essere un conto alla rovescia. Lo stop
   "a 30s decide chi parla" **esiste già** (vedi sotto): questo intervento cambia
   solo il *display* del tempo (host + telefono di chi parla).
2. **Suono d'attesa.** Un **sottofondo in loop** distintivo che suona **solo sullo
   schermo `/host`** durante le schermate di attesa.

## Cosa esiste GIÀ (verificato nel codice, non da rifare)

La meccanica floor/cap/finish/raise/INTERVENTI è già implementata end-to-end su
`ralph/skeleton-dilemma`:

- `server/src/game/phases.ts`: `DEFENSE_MIN_MS = 30_000` (floor), `INTERVENTO_MIN_MS = 15_000`,
  `DEFENSE_MAX_MS = 180_000` / `INTERVENTI_MAX_MS = 90_000` (cap), `TURN_BOT_MS = 60_000`.
- `server/src/game/rooms.ts`:
  - `armTurn(room)` imposta `room.turnMinEndsAt` (floor) e `room.phaseExpiresAt` (cap)
    per ogni turno; bot/assente non ha floor (solo `TURN_BOT_MS`).
  - `finishTurn(...)` valida (solo lo speaker, solo dopo il floor → `TOO_EARLY`).
  - `raiseHand(...)`, `interventiQueue`/`interventiIndex`, fase INTERVENTI.
  - `publicDefense(...)` ritorna `DefenseState` con `speakerId`, `minEndsAt`,
    `canFinish`, `queue`, `raisedCount`, ecc.
- `server/src/index.ts`: handler socket `player:finishTurn` (avanza il turno) e
  `player:raiseHand` (toggle) **già cablati**.
- Client `client/src/player/PlayerApp.tsx`: blocco DEFENSE/INTERVENTI completo —
  bottone **"Ho finito"** bloccato fino al floor (`minRemaining` → "Ho finito tra Xs"
  → "Ho finito ▶", gating su `game.defense.canFinish`/`minEndsAt`), mano alzata,
  posizione in coda. Lo speaker oggi vede solo il bottone + una riga "max {remaining}s".

Quello che **manca** ed è oggetto di questo spec: il numero mostrato è un **conto
alla rovescia** del cap, non un conteggio in salita; e non c'è **nessun audio** nel
client.

## Fuori scope

- Qualsiasi modifica alla meccanica finish/raise/INTERVENTI (già fatta).
- Audio su telefoni o caso "phone-only senza host": sorgente **solo host** per scelta.
- Infrastruttura di test DOM/React per il client (vitest oggi gira solo `server/**`
  in env node): testeremo logica **pura** estratta, non i componenti React.

## Architettura

### 1. Server — esporre l'inizio turno

- **Nuovo campo room** `turnStartedAt: number | null`. Impostato in `armTurn` a `now`
  per i turni DEFENSE/INTERVENTI (umani **e** bot); `null` fuori da quelle fasi
  (azzerato dove oggi `armTurn` non si applica / all'uscita dalle fasi di difesa).
- **`DefenseState`**: aggiungere `startedAt: number | null`; `publicDefense` lo
  popola da `room.turnStartedAt`. `phaseExpiresAt` (cap) e `minEndsAt` (floor)
  restano invariati.
- Nessun nuovo dato segreto lascia il server: è un timestamp di turno, non un voto.

### 2. Client — cronometro in salita

- **Modulo puro** `client/src/shared/time.ts`:
  - `elapsedSeconds(startedAt: number | null, now: number): number | null` —
    `startedAt == null ? null : max(0, floor((now − startedAt)/1000))`.
  - `formatMSS(totalSeconds: number): string` — `M:SS` con secondi a 2 cifre
    (`0` → `"0:00"`, `42` → `"0:42"`, `65` → `"1:05"`, `180` → `"3:00"`).
- **Hook** `client/src/shared/useElapsed.ts`: mirror di `useCountdown` ma in salita;
  usa `elapsedSeconds(startedAt, Date.now())`, tick 250ms, `null` se `startedAt` null.
- **Tipo evento** `client/src/shared/events.ts`: aggiungere `startedAt: number | null`
  all'interfaccia `DefenseState` (mirror del server).
- **Host** `client/src/host/HostApp.tsx`: il blocco timer grande (oggi `{remaining}s`
  da `phaseExpiresAt`, ~riga 553) mostra **count-up** `formatMSS(elapsed)` quando
  `phase ∈ {DEFENSE, INTERVENTI}` e `game.defense.startedAt != null`; altrimenti
  resta il countdown `{remaining}s` (le altre fasi non cambiano).
- **Telefono di chi parla** `client/src/player/PlayerApp.tsx` (ramo `myTurn`):
  aggiungere il cronometro grande in salita (`useElapsed(game.defense.startedAt)` +
  `formatMSS`) sopra il `finishButton`. Il gating del bottone resta invariato.
  Gli ascoltatori non vedono il cronometro (per scelta: host + telefono speaker).

### 3. Audio — sottofondo in loop sull'host

- **Modulo** `client/src/host/ambient.ts`: incapsula un loop ambient generato via
  **Web Audio API** (es. pad morbido: 2–3 oscillatori in accordo a volume basso con
  un LFO lento sul gain). API: `ensureAudio()` (crea/risolve l'`AudioContext`),
  `start()`, `stop()`. Nessun asset binario. Drop-in futuro: un `.mp3` in
  `client/public` se si vorrà un suono curato.
- **Hook/integrazione** in `HostApp.tsx`: `useAmbientLoop(active)` che chiama
  `start()`/`stop()` in base ad `active = isWaitingPhase(phase) && audioUnlocked`.
- **Sblocco autoplay**: l'`AudioContext` parte sospeso; lo si fa `resume()` al primo
  gesto utente dell'host. Gesto naturale: il submit del form **"Collega TV"**
  ([HostApp.tsx:154](client/src/host/HostApp.tsx#L154)); in più un listener one-shot
  `click`/`keydown` sul documento come fallback. Finché non è sbloccato: niente audio,
  nessun errore.
- **`isWaitingPhase(phase)`** (in `client/src/shared/time.ts` o un piccolo helper host):
  `true` per `LOBBY`, `PHASE_INTRO`, `VOTE_1`, `PREDICT`, `DEFENSE`, `INTERVENTI`,
  `VOTE_2`, `SPEAKER_VOTE`, `ACCUSE`, `TAPPA_RECAP`, `DUEL_PICK`, `DUEL_REPICK`,
  `DUEL_ARGUE`. `false` per le card-reveal brevi auto-avanzanti (`DILEMMA_REVEAL`,
  `SPLIT_REVEAL`, `PHASE_RESULTS`, `TAPPA_INTRO`, `DUEL_REVEAL`, `DUEL_RESULT`) e per
  `FINAL_AWARDS` / `FINAL_DUEL`.

## Flusso dati

```
armTurn(room): room.turnStartedAt = now (+ turnMinEndsAt floor, phaseExpiresAt cap — già esistenti)
   │
   └─ publicDefense → DefenseState { …, speakerId, minEndsAt, canFinish, startedAt }
        ├─ host:   phase∈{DEFENSE,INTERVENTI} → formatMSS(useElapsed(startedAt)) ; useAmbientLoop(isWaitingPhase(phase))
        └─ phone (myTurn): formatMSS(useElapsed(startedAt)) + finishButton (gating invariato)
```

## Gestione errori / casi limite

- **Bot/assente speaker**: `startedAt` impostato comunque → l'host conta in su fino
  all'auto-advance (`TURN_BOT_MS`); nessun bottone (nessun floor). OK.
- **Reload host a metà turno**: `startedAt` arriva dallo snapshot → il count-up
  riprende dal valore corretto (timestamp autorevole lato server).
- **Audio non sbloccato** (host che non interagisce): nessun suono, nessun errore.
- **`/host` assente** (phone-only): nessun audio, per scelta.
- **`startedAt == null`** fuori DEFENSE/INTERVENTI: `useElapsed` ritorna `null`,
  l'host ricade sul countdown normale.

## Testing (TDD)

**Server** (`server/src/game/__tests__/rooms.test.ts`):
- `armTurn` imposta `turnStartedAt` (umano e bot) sulle fasi di difesa.
- `publicDefense` espone `startedAt` allineato a `turnStartedAt`; `null` quando
  appropriato.

**Client — logica pura** (`client/src/shared/time.test.ts`, sotto vitest node env):
- `elapsedSeconds`: `null` se `startedAt` null; `0` all'avvio; cresce nel tempo;
  mai negativo (clamp a 0 se `now < startedAt`).
- `formatMSS`: `0→"0:00"`, `5→"0:05"`, `42→"0:42"`, `65→"1:05"`, `180→"3:00"`.
- `isWaitingPhase`: vero/falso sui casi rappresentativi sopra.
- Richiede di estendere `vitest.config.ts` `include` per coprire
  `client/src/**/*.{test,spec}.ts` (env node, solo funzioni pure — niente React/DOM).

Gli hook React (`useElapsed`) e i componenti restano coperti indirettamente dalle
funzioni pure (come `useCountdown`, oggi senza test).

**Gate verde obbligatorio**: `npm run typecheck · npm run lint · npm test · npm run build`.

> Nota verifica visiva: una memoria segnala che la build vite può servire un bundle
> *stale* dentro i worktree `.claude/worktrees/`. Il gate (typecheck/lint/test/build)
> resta valido; la verifica visiva finale (count-up che sale, audio che parte) andrà
> eventualmente rifatta nel repo principale dopo il merge.

## Note d'implementazione

- Server CJS / client ESM restano separati: le costanti di floor/cap non vengono
  importate dal client; il client usa solo i timestamp dello snapshot.
- I voti restano segreti: l'unico campo aggiunto è `startedAt` (timestamp di turno).
