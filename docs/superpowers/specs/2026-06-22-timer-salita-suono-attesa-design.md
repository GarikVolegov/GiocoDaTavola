# Timer in salita per chi parla + suono d'attesa — Design

Data: 2026-06-22 · Branch: `ralph/skeleton-dilemma`

## Obiettivo

Due cambi di esperienza durante la fase di difesa e le schermate di attesa:

1. **Cronometro in salita.** Mentre qualcuno parla (DEFENSE e, quando ci si arriva,
   INTERVENTI) il tempo conta **in su da 0** invece che alla rovescia. A **30s**
   (il floor minimo già esistente) il conteggio **continua a salire**, ma da quel
   momento è **chi parla** a decidere quando fermarsi con un bottone "Ho finito".
   Un **cap di sicurezza** invisibile (già esistente) avanza comunque il turno se
   nessuno conclude.
2. **Suono d'attesa.** Un **sottofondo in loop** distintivo che suona **solo sullo
   schermo `/host`** durante le schermate di attesa.

## Contesto attuale (cosa esiste già)

- `server/src/game/phases.ts`: `DEFENSE_MIN_MS = 30_000` (floor), `INTERVENTO_MIN_MS = 15_000`,
  `DEFENSE_MAX_MS = 180_000` / `INTERVENTI_MAX_MS = 90_000` (cap), `TURN_BOT_MS = 60_000`.
- `server/src/game/rooms.ts`:
  - `armTurn(room)` imposta `room.turnMinEndsAt` (floor) e `room.phaseExpiresAt` (cap)
    per ogni turno; il bot/assente non ha floor (solo `TURN_BOT_MS`).
  - `finishTurn(code, playerId)` valida: solo lo speaker, e solo dopo il floor
    (`TOO_EARLY` prima). **Esiste ma non è cablato** ai socket né alla UI.
  - `raiseHand(...)` e la fase INTERVENTI esistono nel modello ma **non** hanno UI.
- `server/src/index.ts`: lo snapshot manda `phaseExpiresAt` (il cap). Non manda né
  l'inizio turno né il floor.
- Client: `useCountdown(expiresAt)` rende il countdown; host e telefono mostrano
  `{remaining}s` da `phaseExpiresAt`. **Nessun audio** in tutto il client.

Conclusione: la logica di floor/cap/finish è già nel modello con i suoi test; manca
il cablaggio socket→UI del finish, il display in salita e l'audio.

## Fuori scope

- UI di `raiseHand` / fase INTERVENTI (non richiesta ora). Il timer è phase-agnostic,
  quindi funzionerà da sé quando quella UI arriverà.
- Audio su telefoni o caso "phone-only senza host": sorgente **solo host** per scelta.

## Architettura

### 1. Server — esporre l'inizio turno + cablare finish

- **Nuovo campo room** `turnStartedAt: number | null`. Impostato in `armTurn` a `now`
  per i turni DEFENSE/INTERVENTI (umani e bot); `null` fuori da quelle fasi.
- **Snapshot per-telefono** (`server/src/index.ts`, dove oggi manda `phaseExpiresAt`):
  aggiungere `turnStartedAt` e `turnMinEndsAt`. `phaseExpiresAt` resta invariato come
  cap di sicurezza, ma non è più il numero mostrato durante DEFENSE.
- **Nuovo socket event** `finish_turn` (handler in `index.ts`):
  - chiama `rooms.finishTurn(code, playerId)`;
  - se `ok`: avanza il turno con lo stesso percorso del timer (riusa la logica di
    `advance`/auto-advance già usata alla scadenza), poi ribroadcast dello stato;
  - se errore (`TOO_EARLY`, `NOT_SPEAKER`, `NOT_FINISHING_PHASE`, …): no-op silenzioso
    (la UI già impedisce il tap presto; nessun toast necessario).
- Aggiornare i tipi evento condivisi se presenti (`client/src/shared/events.ts`).

### 2. Client — cronometro in salita

- **Nuovo hook** `useElapsed(startedAt: number | null): number | null` in
  `client/src/shared/` (mirror di `useCountdown`): ritorna i secondi trascorsi
  `floor((now − startedAt)/1000)`, tick 250ms, `null` se `startedAt` è null.
- **Formato** `M:SS` (es. `0:42`, `1:05`) — un piccolo helper `formatMSS(seconds)`,
  perché il count-up può superare i 60s (cap fino a 180s). Riusato da host e telefono.
- **Host** (`client/src/host/HostApp.tsx`): nella schermata DEFENSE mostra il
  cronometro grande in salita da `game.turnStartedAt` (al posto del `remaining` da
  `phaseExpiresAt` in quella schermata). Le altre fasi col countdown restano invariate.
- **Telefono di chi parla** (`client/src/player/PlayerApp.tsx`, ramo `myTurn`):
  - cronometro in salita (stesso `useElapsed` + `formatMSS`);
  - bottone **"Ho finito"** che emette `finish_turn`:
    - **prima del floor** (`now < turnMinEndsAt`): disabilitato, label tipo
      "Ho finito (ancora Xs)" con `X = ceil((turnMinEndsAt − now)/1000)`;
    - **dal floor in poi**: abilitato + riga "ora puoi concludere quando vuoi".
  - **bot/assente**: `turnMinEndsAt` è `null` → nessun bottone; sul telefono degli
    ascoltatori nulla cambia; l'host conta in su fino all'auto-advance.

### 3. Audio — sottofondo in loop sull'host

- **Modulo** `client/src/host/ambient.ts`: incapsula un loop ambient generato via
  **Web Audio API** (es. pad/accordo morbido con LFO lento e volume basso). API:
  `start()`, `stop()`, e una `unlock()`/resume dell'`AudioContext`. Nessun asset
  binario (coerente con "no DB / no asset pipeline"). Opzione drop-in futura: un
  `.mp3` in `client/public` se si vorrà un suono curato.
- **Hook** `useAmbientLoop(active: boolean)` (solo host): avvia/ferma il loop in base
  ad `active`. L'`AudioContext` parte sospeso e va sbloccato al **primo gesto**
  dell'host (il click su "Avvia partita" è il gesto naturale); finché non è sbloccato,
  niente audio (policy autoplay del browser).
- **Quali fasi = "attesa"** (`isWaitingPhase(phase)`), set proposto e confermato:
  `LOBBY` (dopo l'avvio/sblocco), `PHASE_INTRO`, `VOTE_1`, `PREDICT`, `DEFENSE`,
  `INTERVENTI`, `VOTE_2`, `SPEAKER_VOTE`, `ACCUSE`, `TAPPA_RECAP`, più le fasi duello
  d'attesa (`DUEL_PICK`, `DUEL_REPICK`, `DUEL_ARGUE`). Escluse le card-reveal brevi che
  si auto-avanzano (`DILEMMA_REVEAL`, `SPLIT_REVEAL`, `PHASE_RESULTS`, `TAPPA_INTRO`,
  `DUEL_REVEAL`, `DUEL_RESULT`) e `FINAL_AWARDS` / `FINAL_DUEL`.

## Flusso dati

```
armTurn(room): room.turnStartedAt = now; room.turnMinEndsAt = now + FLOOR; room.phaseExpiresAt = now + CAP
   │
   └─ snapshot → { …, turnStartedAt, turnMinEndsAt, phaseExpiresAt }
        ├─ host:   useElapsed(turnStartedAt) → "M:SS" grande; useAmbientLoop(isWaitingPhase(phase))
        └─ phone (myTurn): useElapsed(turnStartedAt) + bottone "Ho finito"
              ├─ now < turnMinEndsAt → disabilitato "ancora Xs"
              └─ now ≥ turnMinEndsAt → abilitato → emit finish_turn → server advance
```

## Gestione errori / casi limite

- **Tap "Ho finito" troppo presto**: impedito in UI (bottone disabilitato); se arriva
  comunque, `finishTurn` ritorna `TOO_EARLY` e l'handler è no-op.
- **Tap da non-speaker**: `NOT_SPEAKER` → no-op.
- **Bot/assente speaker**: nessun floor → nessun bottone; auto-advance a `TURN_BOT_MS`
  come oggi; il count-up sull'host arriva fino all'auto-advance.
- **Audio non sbloccabile** (host che non interagisce): semplicemente nessun suono,
  nessun errore; si sblocca al primo click.
- **`/host` assente** (gioco phone-only): nessun audio, per scelta (sorgente solo host).
- **Reload host a metà turno**: `turnStartedAt` arriva dallo snapshot, il count-up
  riprende dal valore corretto (timestamp autorevole lato server).

## Testing (TDD)

**Server** (`server/src/game/__tests__/rooms.test.ts`):
- `armTurn` imposta `turnStartedAt` (umano e bot) e lo azzera fuori da DEFENSE/INTERVENTI.
- `finishTurn` resta `TOO_EARLY` prima del floor e `ok` dopo (caso già coperto: estendere
  per assicurare l'avanzamento turno via l'handler `finish_turn`).
- lo snapshot espone `turnStartedAt` + `turnMinEndsAt`.

**Client**:
- `useElapsed`: conta in su da `startedAt`; `null` se input null; `formatMSS` formatta
  `0:00`, `0:42`, `1:05`, `3:00`.
- Gating bottone "Ho finito": disabilitato con "ancora Xs" prima del floor, abilitato dopo
  (test sul componente o sulla pura funzione di gating).

**Gate verde obbligatorio**: `npm run typecheck · npm run lint · npm test · npm run build`.

## Note d'implementazione

- Server CJS / client ESM restano separati (l'helper `formatMSS` e `useElapsed` vivono
  nel client; le costanti di floor/cap restano lato server e non vengono importate dal
  client — il client usa i timestamp dello snapshot).
- I voti restano segreti: nessun dato individuale nuovo lascia il server (i campi
  aggiunti sono timestamp di turno, non voti).
