# Design — Difese auto-paced + interventi a mano alzata

Data: 2026-06-22 · Modalità: **gruppo** (Percorso eredita; Duello fuori scope)

> Sostituisce [2026-06-22-dibattito-mano-alzata-design.md](2026-06-22-dibattito-mano-alzata-design.md)
> (design diverso, mai implementato). Tema: la difesa non ha più un tempo fisso —
> chi parla ha un **minimo garantito** e poi **chiude quando vuole**; gli altri
> possono **alzare la mano per intervenire** dopo. Le emoji restano puro colore.

## Contesto / problema

Oggi **DEFENSE** ha 1 difensore auto-scelto per lato (0–2 totali), ognuno con un turno a
**tempo fisso 60s** che taglia a metà frase. Le emoji di reazione esistono già ma sono
animate **solo sull'host**. Vogliamo:

1. Turni di difesa **auto-paced**: minimo garantito, poi chi parla decide quando ha finito,
   **dal proprio telefono** — con una rete di sicurezza (tetto massimo + override leader).
2. Una funzione vera **"alza la mano per intervenire"**: durante la difesa gli altri si
   mettono in coda; **dopo** la difesa ciascuno riceve un breve mini-turno per intervenire.
3. Le **emoji** restano una reazione **puramente estetica**, ma ora scorrono dal basso
   verso l'alto su **tutti gli schermi** (host **e** ogni telefono), non solo sull'host.
   Sono un sistema **separato** dalla mano alzata.

## Decisioni prese in brainstorming

- **Flusso per ciascun difensore assegnato** (non una sola volta a fine difese):
  `DEFENSE(difensore)` → `INTERVENTI(difensore)` (se c'è almeno una mano) → difensore
  successivo → … → `VOTE_2`.
- **Tempo minimo**: difesa **30s**, intervento **15s**. Sotto il minimo "Ho finito" è
  bloccato (server + UI).
- **Tetto massimo (rete di sicurezza)**: difesa **180s** (3 min), intervento **90s**; oltre
  il tetto il turno auto-avanza. Il **leader** ha sempre **"Avanti ▶"** (`leader:advancePhase`,
  esistente). I **bot** (niente telefono) e i turni senza umano usano un timer **fisso 60s**.
- **Chi alza la mano**: **chiunque sia presente e umano**, tranne chi sta parlando in quel
  momento. (Non è ristretto al proprio lato.) Toggle (alza/abbassa) finché non viene chiamato.
- **Coda FIFO**, raccolta **solo durante il turno del difensore**. Durante i mini-turni di
  intervento **non** si raccolgono nuove mani (così il round resta limitato).
- **Visibilità**: durante la difesa l'host mostra **solo il conteggio** ("✋ 3"); i **nomi**
  (coda ordinata + chi interviene ora) compaiono **solo da INTERVENTI** in poi. Coerente con
  la filosofia "solo aggregati" del gioco.
- **Emoji = solo estetica, separate**: animate su tutti gli schermi durante DEFENSE e
  INTERVENTI; non influenzano la coda mani.
- **Persuasione / "miglior oratore" restano sui soli difensori** — gli interventi sono
  ingaggio/colore, non cambiano l'attribuzione dei voti.

### Decisione aperta (da confermare in review)

- **Award "Beniamino"**: oggi le emoji accumulano `reactionsReceived` per chi parla e
  alimentano l'award di fine partita "Beniamino" (`awards.ts`). L'utente ha chiesto reazioni
  "senza vera funzione". **Default di questo spec: l'award resta** (scelta non distruttiva;
  le emoji restano visivamente decorative ma continuano a contare in sordina). Se si vuole
  che siano davvero prive di funzione → rimuovere `reactionsReceived` (in `react()` e
  `PlayerStats`) e l'award "Beniamino" (`awards.ts`). **Confermare in fase di review.**

## Macchina degli stati

Nuova fase **`INTERVENTI`** (lingua del dominio, come `ACCUSE`/`TAPPA_INTRO`), **intrecciata
in `advancePhase`** tra i turni dei difensori — **non** nella sequenza pura `nextPhase`
(che resta `… PREDICT → DEFENSE → VOTE_2 → SPEAKER_VOTE → PHASE_RESULTS`).

```
… PREDICT → DEFENSE(dif.0) → [INTERVENTI(dif.0)]? → DEFENSE(dif.1) → [INTERVENTI(dif.1)]? → VOTE_2 → …
```

In [`advancePhase`](../../../server/src/game/rooms.ts) (oggi righe ~1052-1060), alla fine di un turno:

- **fine turno difensore** (`phase === 'DEFENSE'`):
  - se la coda mani del difensore corrente è **non vuota** → `phase = 'INTERVENTI'`, congela
    `interventiQueue = [...raisedHands]`, `interventiIndex = 0`, arma i timer (min 15s / tetto 90s).
    `defenseTurnIndex` **resta** sul difensore corrente.
  - altrimenti → se restano difensori `defenseTurnIndex++` (resta `DEFENSE`, arma timer difesa),
    altrimenti cade nella transizione normale verso `VOTE_2`.
- **fine mini-turno** (`phase === 'INTERVENTI'`):
  - `interventiIndex++`; se restano interventi → resta `INTERVENTI` (riarma i timer);
  - se esauriti → torna a `DEFENSE` sul difensore successivo (`defenseTurnIndex++`) se esiste,
    altrimenti cade nella transizione normale verso `VOTE_2`.

`SPEAKER_VOTE` con < 2 difensori resta skippato come oggi.

## Stato (server — `Room`, nuovi campi)

- `raisedHands: string[]` — coda FIFO di playerId per il **turno-difensore corrente** (toggle).
  Azzerata a ogni nuovo turno di difensore e su `DILEMMA_REVEAL`.
- `interventiQueue: string[]` — snapshot congelato delle mani al passaggio in `INTERVENTI`.
- `interventiIndex: number` — quale intervento è in corso (0-based).
- `turnMinEndsAt: number | null` — istante in cui scade il **minimo** del turno corrente
  (sotto = "Ho finito" rifiutato). `null` per turni bot/senza umano (nessun blocco).

`phaseExpiresAt` (esistente) per DEFENSE/INTERVENTI = **tetto massimo** (`now + max`), gestito
dal timer già presente in `index.ts` (auto-advance). Tutto il resto (`defenders`,
`defenseTurnIndex`, votes/stats) invariato.

## Durate / costanti (`phases.ts`)

- `PHASE_DURATIONS_MS.DEFENSE = 180_000` · `PHASE_DURATIONS_MS.INTERVENTI = 90_000` (= tetti).
- Nuove costanti: `DEFENSE_MIN_MS = 30_000`, `INTERVENTO_MIN_MS = 15_000`, `TURN_BOT_MS = 60_000`.
- `INTERVENTI` aggiunta a `GamePhase`; **non** in `DILEMMA_SEQUENCE` (weaving in `advancePhase`).
- Helper: `isInterventiPhase(phase)`; le reazioni sono valide in DEFENSE **e** INTERVENTI.

## Logica (store in `rooms.ts`)

- **Ingresso DEFENSE** (esistente, esteso): `selectDefenders` invariato; `defenseTurnIndex = 0`;
  `raisedHands = []`. Imposta i timer del turno (vedi sotto).
- **Timer di un turno** (helper `armTurn(room, kind)`): se lo speaker corrente è un **umano**
  → `turnMinEndsAt = now + MIN`, `phaseExpiresAt = now + MAX`. Se **bot o nessuno speaker**
  → `turnMinEndsAt = null`, `phaseExpiresAt = now + TURN_BOT_MS`.
- `raiseHand(code, playerId)` → toggle: solo se `phase === 'DEFENSE'`, umano presente, **non**
  è lo speaker corrente. Se già in coda → rimuove (abbassa); altrimenti → append (FIFO).
  Ritorna ok/err.
- `finishTurn(code, playerId)` → ok solo se `playerId === currentSpeakerId(room)` **e**
  (`turnMinEndsAt == null` || `now >= turnMinEndsAt`) → `advancePhase`. Errori:
  `NOT_SPEAKER`, `TOO_EARLY`, `NOT_FINISHING_PHASE`.
- `currentSpeakerId(room)` (esteso): in `INTERVENTI` ritorna `interventiQueue[interventiIndex]`;
  in `DEFENSE` come oggi (`defenders[defenseTurnIndex]?.id`).
- `react()` (esteso): accetta anche `phase === 'INTERVENTI'` (attribuzione all'intervenente
  corrente, identica a oggi).
- `publicDefense()` (esteso, gated a DEFENSE **o** INTERVENTI). Nuovo `DefenseState`:
  - `kind: 'defense' | 'intervento'`
  - `speaker` (difensore in DEFENSE; `{id, nickname, side}` dell'intervenente in INTERVENTI)
  - `turn` / `totalTurns` (come oggi per la difesa; per gli interventi: indice/coda)
  - `raisedCount: number` — **sempre** esposto durante DEFENSE (conteggio mani)
  - `queue: { id, nickname }[] | null` — **nomi** ordinati, solo da INTERVENTI in poi (null in DEFENSE)
  - `minEndsAt: number | null` · `canFinish: boolean` (per il telefono dello speaker)
  - `argument` / `spunti` come oggi (spunti solo per la difesa).
- **Reset** su `DILEMMA_REVEAL`: `raisedHands=[]`, `interventiQueue=[]`, `interventiIndex=0`,
  `turnMinEndsAt=null`. **Prune** su `leave`: togliere il leaver da `raisedHands`/`interventiQueue`;
  se era lo speaker corrente in INTERVENTI, avanzare (non bloccare).

## Eventi (mirror `events.ts` + handler `index.ts`)

Nuovi: `player:raiseHand`, `player:finishTurn` (+ `player:finishTurnError`). `leader:advancePhase`
(esistente) copre "Avanti ▶". `room:reaction` invariato. In `index.ts`:

- `player:raiseHand` → `rooms.raiseHand` → `broadcastGameState` (il conteggio è nello snapshot;
  N ≤ 8, costo trascurabile, come fanno i voti).
- `player:finishTurn` → `rooms.finishTurn`; se ok → `advanceAndBroadcast`, altrimenti emette l'errore.

Nessun voto individuale esce mai; durante DEFENSE escono solo i conteggi.

## Client

- **`shared/events.ts`**: aggiungere `INTERVENTI` al mirror `GamePhase`, gli event-name nuovi,
  e i nuovi campi di `DefenseState`.
- **`host/HostApp.tsx`**:
  - DEFENSE → difensore (nome+lato), badge **"✋ N"** live, countdown del **tetto** + indicatore
    "minimo… poi *può chiudere*". `ReactionSwarm` già presente.
  - INTERVENTI → titolo "Interventi", **coda di nomi** ordinata con evidenza su chi parla ora.
- **`host/ReactionSwarm.tsx`**: già autonomo (ascolta `room:reaction`); riusabile così com'è.
- **`player/PlayerApp.tsx`**:
  - Se sei lo **speaker** (difensore o intervenente) → grande **"Ho finito ▶"**, disabilitato
    con countdown fino al minimo ("puoi finire tra Ns"), poi attivo; mostra anche il tetto sottile.
  - Se **non** sei speaker durante **DEFENSE** → toggle **"✋ Alza la mano" / "Abbassa la mano"**
    + barra emoji.
  - Durante **INTERVENTI** da non-speaker → barra emoji (e, se sei in coda, la tua posizione).
  - **Render di `ReactionSwarm` anche sul telefono** durante DEFENSE/INTERVENTI: le emoji
    scorrono dal basso verso l'alto su ogni schermo (riusare il componente host o estrarne uno
    condiviso in `shared/`).
  - Riusare [`useCountdown`](../../../client/src/shared/useCountdown.ts) per i countdown.

## Si incastra con l'esistente

- **Emoji**: separate dalla mano alzata; ora su tutti gli schermi. Funzione di gioco: vedi
  *Decisione aperta* (Beniamino).
- **SPEAKER_VOTE / persuasione**: candidati e attribuzione = **solo difensori**, invariati.
- **PREDICT**: invariato, resta prima della difesa.
- **Percorso**: eredita la feature (stessa sequenza per-dilemma).
- **Duello** (`DUEL_ARGUE`): **fuori scope**, invariato.
- **Voti senza timer**: **fuori scope** in questo spec (era un extra del design superato).

## Verifica (TDD)

Test puri/store in `rooms.test.ts` / `phases.test.ts`:

- **Minimo**: `finishTurn` rifiutato prima di `turnMinEndsAt` (`TOO_EARLY`); accettato dopo;
  solo lo speaker corrente (`NOT_SPEAKER`).
- **Tetto**: `phaseExpiresAt` = `now + MAX` in DEFENSE/INTERVENTI; turni bot/senza-umano usano
  `TURN_BOT_MS` e `turnMinEndsAt = null`.
- **Mano alzata**: toggle add/remove, ordine **FIFO** preservato; lo speaker non può alzarla;
  solo umani presenti; durante INTERVENTI `raiseHand` rifiutato.
- **Weaving**: difensore con coda non vuota → `INTERVENTI`; cammino sui mini-turni
  (`interventiIndex`); a fine coda → difensore successivo o `VOTE_2`. Interventi **per-difensore**.
- **Coda vuota** → salta INTERVENTI (difensore successivo / `VOTE_2`).
- **Visibilità**: `publicDefense` espone `raisedCount` ma `queue = null` in DEFENSE; `queue`
  con nomi solo in INTERVENTI.
- **Reazioni** valide anche in INTERVENTI (attribuite all'intervenente corrente).
- **Reset/prune**: campi azzerati su `DILEMMA_REVEAL`; il leaver esce da code; se era lo speaker
  in INTERVENTI il turno avanza, non si blocca.
- **0 difensori / difensore-bot**: fallback a timer, nessun "Ho finito" atteso.

Gate progetto: `npm run typecheck` · `lint` · `test` · `build` verdi.
End-to-end con `npm run dev`: leader crea, più telefoni; il difensore preme "Ho finito" dopo
30s, altri alzano la mano (host mostra solo il conteggio), poi gli interventi sfilano uno alla
volta; le emoji scorrono su tutti i telefoni; "Avanti ▶" del leader come override.

## Default scelti (rivedibili)

- Difesa **min 30s / tetto 180s** · intervento **min 15s / tetto 90s** · turno bot **60s**.
- Mano alzata **aperta a tutti** (non solo al proprio lato).
- Coda raccolta **solo durante la difesa**; nessuna nuova mano durante gli interventi.
- Award **"Beniamino" mantenuto** di default (vedi *Decisione aperta*).
