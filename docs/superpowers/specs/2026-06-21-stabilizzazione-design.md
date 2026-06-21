# Stabilizzazione SCHIERATI — design

**Data:** 2026-06-21
**Branch:** ralph/skeleton-dilemma
**Obiettivo:** dare al gioco una base solida e stabile su cui costruire — working
tree git pulito, flusso di gioco verificato dal vivo, modi di fallimento runtime
coperti da test, e una partita che sopravvive a un riavvio del server.

## Contesto / foto dello stato attuale

- **Qualità: tutto verde** — `typecheck`, 169 test, `lint`, `build` passano.
- **Robustezza già presente**: token di riconnessione, grace timer sulle
  disconnessioni, i disconnessi-in-grace ignorati nell'"hanno votato tutti" (un
  telefono bloccato non incastra la fase), supporto bot.
- **WIP non committato (~730 righe)**: due feature **complete e cablate**
  (client + server + test), verdi ma non salvate in git:
  - **Reazioni live** — `client/src/host/ReactionSwarm.tsx` + evento
    `player:react`/`room:reaction` + award `beniamino`.
  - **Fase PREDICT** — pronostico segreto della maggioranza post-difesa
    (`player:predict`/`player:predicted`/`player:predictionResult`) + award
    `oracolo`. Inserita nell'ordine `SPLIT_REVEAL → PREDICT → DEFENSE`.

Vincoli invariati (CLAUDE.md): server-authoritative, stato in-memory, voti
segreti (solo conteggi aggregati), timer calcolati lato server. Server CJS,
client ESM, niente `any`.

## Fasi (in ordine — hanno dipendenze, non vanno parallelizzate)

### Fase 0 — Baseline pulita *(meccanico)*

Committare le due feature complete e verdi in commit logici separati (reazioni
live; fase PREDICT). Nessuna riscrittura: sono già testate e verdi.

**Esito:** working tree pulito e recuperabile; le fasi successive lavorano su una
base che non si muove.

### Fase 1 — Verifica end-to-end

Avviare `npm run dev`, aprire `/host` + 2-3 telefoni (`/`), giocare un round
completo:
`join → VOTE_1 → SPLIT_REVEAL → PREDICT → DEFENSE+reazioni → VOTE_2 →
PHASE_RESULTS → FINAL_AWARDS`, incluso disconnettere/riconnettere un telefono a
metà.

**Esito:** checklist di problemi reali osservati, che diventa input concreto per
la Fase 2. (Nel piano di implementazione questa fase produce un artefatto: la
lista dei difetti trovati.)

### Fase 2 — Hardening runtime *(in TDD)*

Matrice dei modi di fallimento di un party game in presenza; ognuno → test rosso
→ fix verde. I test vanno in `server/src/game/__tests__/`.

1. **Host si disconnette** a metà partita → la stanza chiude in modo pulito? I
   telefoni ricevono uno stato sensato invece di congelarsi?
2. **Stanza si svuota** (tutti escono) → cleanup stanza + grace timer cancellati,
   nessun leak di timer/stato.
3. **Riconnessione durante PREDICT / mentre arrivano reazioni** → stato corretto
   ripristinato sul telefono che rientra.
4. **Early-advance con giocatori in grace** → "hanno predetto/votato tutti" non si
   incastra né avanza con conteggi sbagliati quando qualcuno è mid-grace.
5. **Input lato server** → `choice` invalido, emoji fuori allowlist, spam reazioni
   oltre il throttle `REACTION_MIN_INTERVAL_MS`: rifiutati senza crash, validati
   server-side (non solo client).
6. **Timer che scade vs avanzamento manuale host** → niente doppio avanzamento di
   fase / race.
7. **Bot + fasi nuove** → i bot non rompono PREDICT/reazioni: predicono in modo
   coerente o vengono ignorati senza bloccare l'early-advance.

I difetti emersi in Fase 1 si aggiungono a questa matrice.

### Fase 3 — Snapshot / ripristino

Modulo isolato `roomSnapshot` con confine netto:

- **Responsabilità unica**: serializzare/deserializzare lo stato di una stanza e
  persisterlo/caricarlo. Riusa il layer Postgres esistente (`server/src/db`).
- **Interfaccia**: `serialize(room) → JSON`, `deserialize(JSON) → room`,
  `persist(room)`, `loadActive() → room[]`.
- **Trigger**: snapshot periodico + su ogni transizione di fase delle stanze
  attive.
- **Avvio**: il server ricarica le stanze non scadute; i telefoni con token
  riprendono la loro sessione esistente.
- La logica di gioco in-memory (`rooms.ts`) resta invariata: lo snapshot la legge,
  non la riscrive. Le `Map` (es. `predictions`, voti) vanno serializzate/ricostruite
  esplicitamente.

**Test**: round-trip `serialize → deserialize` preserva lo stato (incluse le Map);
`loadActive` all'avvio ricostruisce stanze giocabili e scarta quelle scadute.

## Testing trasversale / definizione di "fatto"

- Ogni fix in Fase 2/3 arriva con un test.
- Prima di ogni commit: `typecheck`, `lint`, `test`, `build` tutti verdi.
- Voti e pronostici restano segreti: nessuna identità per-scelta broadcastata,
  nemmeno negli snapshot inviati al client (lo snapshot persistito è server-side).

## Fuori ambito (YAGNI)

- Multi-istanza / adapter Redis per Socket.IO — eccessivo per un gioco in presenza
  single-instance.
- Riscrittura della logica di gioco esistente o refactoring non legato alla
  stabilità.
