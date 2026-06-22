> ⚠️ **SUPERATO** (2026-06-22) da
> [2026-06-22-difese-interventi-mano-alzata-design.md](2026-06-22-difese-interventi-mano-alzata-design.md).
> Mai implementato. Conservato per storia: descrive un design diverso (dibattito continuo
> alternato A→B con coda per lato, niente tetto, voti senza timer) che NON è quello scelto.

# Design — Round auto-paced: Dibattito a mano alzata + voto senza timer

Data: 2026-06-22 · Modalità: **gruppo** (il duello mantiene il suo DUEL_ARGUE per ora)

> Tema unificante: **niente tempi fissi nel round**. Ogni fase avanza quando **tutti i
> presenti** (connessi) hanno agito; i **bot** contano subito; il **leader** ha sempre un
> override ("Salta ▶" / "Chiudi dibattito") come rete per AFK/telefono morto.

## Contesto / problema

Oggi la fase **DEFENSE** ha 1 difensore auto-scelto per lato, ognuno con un turno a
**tempo fisso (60s)**; chi non parla resta spettatore e il tempo taglia a metà frase.
Vogliamo un **vero dibattito che includa tutti**: tempo **minimo** anziché preciso (chi
ha la parola chiude quando vuole, **senza tetto**), e dopo ogni intervento gli altri
**dello stesso lato** possono **alzare la mano** per aggiungere qualcosa.

Decisioni prese in brainstorming:
- **Coda automatica FIFO** (nessuna moderazione manuale di chi parla).
- **Botta e risposta alternato** A → B → A → B…, pescando dalle code dei due lati.
- **Fine = doppio "passo" di fila** (entrambi i lati senza mani) **+ "Chiudi dibattito" del leader**.
- **Minimo 20s** (apertura 25s) poi stop libero. **Persuasione accreditata a tutti gli oratori del lato**.

## Mecanica (autorevole)

1. **Apertura garantita.** All'ingresso in DEFENSE il server auto-sceglie un
   apri-dibattito per lato (come oggi, tra i votanti di quel lato). Primo turno =
   apertura A, secondo = apertura B. Un lato senza votanti non ha apertura → passa.
2. **Alza la mano (coda FIFO per lato).** Durante tutta la fase, un giocatore che ha
   votato il lato X può `raiseHand` → entra in fondo a `queues[X]`; `lowerHand` per
   uscire. Vincoli: solo chi ha un voto in `room.votes` (il proprio lato), non chi sta
   già parlando, niente duplicati. **Alzare la mano rende pubblico il proprio lato**
   (coerente: già oggi chi parla si scopre — i voti restano comunque segreti come dato).
3. **Alternanza.** A fine turno si passa al lato **opposto** all'ultimo che ha parlato:
   se l'apertura di quel lato non è ancora avvenuta → parla l'apri-dibattito; altrimenti
   si fa `shift()` dalla sua coda FIFO; se non c'è nessuno → quel lato **passa**.
4. **Tempo minimo + stop libero.** Ogni turno fissa `turnMinAt = now + MIN` (MIN: 25s
   apertura, 20s gli altri). **`phaseExpiresAt = null`** in DEFENSE: niente auto-advance.
   `doneSpeaking` (da chi parla) è valido **solo** se `now >= turnMinAt` → chiude il turno.
   Nessun limite massimo.
5. **Fine fase.** Due "passo" consecutivi (`passStreak >= 2`) → avanza a VOTE_2. Il
   leader ha sempre **`closeDebate`** (fine immediata) e **`skipTurn`** (taglia chi parla
   / telefono morto) come fallback necessari (niente tetto di tempo).

## Stato (server — `Room`, nuovi campi DEFENSE)

- `debateSpeaker: Defender | null` — chi parla ora (id, nickname, side).
- `debateTurnMinAt: number | null` — quando scade il minimo (poi è chiudibile).
- `debateQueues: { A: string[]; B: string[] }` — playerId in coda FIFO per lato.
- `debateOpened: { A: boolean; B: boolean }` — apertura di lato già avvenuta.
- `debateLastSide: VoteChoice | null` — per alternare.
- `debatePassStreak: number` — passi consecutivi (2 → fine).
- `debateSpokenBySide: { A: Set<string>; B: Set<string> }` — chi ha parlato per ciascun
  lato (per persuasione + candidati "miglior oratore").

`phaseExpiresAt` resta `null` per DEFENSE (override del comportamento a timer). Tutto il
resto (votes/votes1/defenders openers/stats) invariato. I campi si azzerano su
DILEMMA_REVEAL accanto agli altri reset di round.

## Logica (metodi puri/store in `rooms.ts`)

- `enterDebate(room)`: openers via `selectDefenders` (esistente); primo speaker = opener A
  (o B se A vuoto; se entrambi vuoti → nessun speaker, fase passa subito).
- `raiseHand(code, playerId)` / `lowerHand(code, playerId)`: validazioni sopra; ritorna
  ok/err. Lato = `room.votes.get(playerId)`.
- `doneSpeaking(code, playerId)`: ok solo se `playerId === debateSpeaker?.id` e
  `now >= turnMinAt` → `advanceDebateTurn`.
- `advanceDebateTurn(room)`: registra lo speaker corrente in `debateSpokenBySide`; calcola
  il prossimo lato (alternato); sceglie opener-o-coda; se vuoto → `passStreak++` e prova
  l'altro lato; se `passStreak >= 2` → segnala fine fase (transizione a VOTE_2). Quando
  qualcuno parla davvero → `passStreak = 0`, `turnMinAt` re-armato.
- `closeDebate(code)` (leader) → fine fase. `skipTurn(code)` (leader) → come `doneSpeaking`
  ma senza il vincolo del minimo.
- **Persuasione**: in `recordRoundStats`, lo `netSwing[side] > 0` va sommato a
  `persuasion` di **ogni** id in `debateSpokenBySide[side]` (non solo l'opener).
- **Candidati "miglior oratore"** (SPEAKER_VOTE): unione di `debateSpokenBySide.A/B`
  (con nickname+side) invece dei soli 2 openers.

## Eventi (mirror `events.ts` + handler `index.ts`)

Nuovi: `player:raiseHand`, `player:lowerHand`, `player:doneSpeaking`,
`leader:closeDebate`, `leader:skipTurn` (+ eventuali `*Error`). `game:state` guadagna una
vista `debate` gated a DEFENSE: speaker, `turnMinAt`, `canCloseNow` (per il telefono di
chi parla), `queues` (nomi+conteggi per lo schermo), `myHand` (in coda? posizione?),
`canRaise` (il mio lato, non in coda, non sto parlando). Niente voti individuali esce.

## Client

- **Schermo (spettatore `HostApp`)**: speaker grande (nome+lato), le **due code** con 🙋 e
  nomi in attesa, indicatore "minimo… poi *può chiudere*", stati *passa* / *chiuso*. Le
  reazioni 👏🔥 continuano a fluttuare (invariate).
- **Telefono (`PlayerApp`)**: se è il mio turno → "Tocca a te 🎤" + spunti (esistenti) +
  dopo il minimo **"Ho finito ▶"**. Altrimenti, se ho votato → **"🙋 Alza la mano"** /
  "Abbassa la mano (sei N° in coda)". Leader → **"Salta turno"** + **"Chiudi dibattito"**.
  Non-oratori → barra reazioni (esistente).

## Voto auto-paced (niente timer)

Tutte le fasi a input segreto avanzano **solo** quando ogni presente ha agito —
`phaseExpiresAt = null` su VOTE_1, VOTE_2, PREDICT, SPEAKER_VOTE (niente auto-advance a
tempo). "Presente" = connesso: i disconnessi (grace period) **non** bloccano; i **bot**
agiscono all'ingresso della fase quindi contano subito.

- **VOTE_1**: già esiste `allVoted` (esclude i disconnessi). Si rimuove solo il timer e si
  mantiene l'early-advance: appena tutti i presenti hanno votato → avanza.
- **VOTE_2 — conferma esplicita.** Oggi parte pre-riempito col primo voto, quindi
  risulterebbe "tutto votato" all'istante. Si introduce un set `confirmedVote2:
  Set<playerId>`: la prima scelta resta pre-selezionata, ma il voto conta solo quando il
  giocatore **tocca "Confermo"** (o cambia lato, che conferma implicitamente). Avanza
  quando **tutti i presenti** sono in `confirmedVote2`. I **bot** vi entrano all'ingresso
  (dopo `applyBotSecondVotes`). `phaseExpiresAt = null`.
- **PREDICT / SPEAKER_VOTE**: già hanno `allPredicted` / `allSpeakerVoted` (solo umani
  connessi; i bot non vi partecipano). Si rimuove solo il timer.
- **Override leader.** Senza tetto, un presente-connesso ma AFK bloccherebbe la fase: il
  tasto **"Salta ▶"** del leader (`leader:advancePhase`, esistente) resta la rete per
  forzare l'avanzamento. Se anche il leader è assente la fase attende — tradeoff accettato.

Server: `confirmedVote2` su `Room` (clear su DILEMMA_REVEAL; prune su `leave`). Nuovo
evento `player:confirmVote` (o riuso di `player:vote` con un flag `confirm`). `game:state`
espone `confirmedCount` + (per il proprio telefono) `iConfirmed`. Le aggregazioni restano
solo conteggi — nessun voto individuale esce.

## Si incastra con l'esistente

- **Reazioni**: invariate, durante ogni intervento.
- **Voto "miglior oratore"** (SPEAKER_VOTE): candidati = tutti gli oratori, estensione
  naturale.
- **Pronostico** (PREDICT): invariato, resta prima del dibattito.
- **Duello**: fuori scope (mantiene DUEL_ARGUE); il modello a mano alzata potrà essere
  esteso in seguito.

## Verifica (TDD)

Test puri/store in `rooms.test.ts`:
- openers scelti; ordine di alternanza A/B; FIFO `shift` corretto.
- `raiseHand`: solo il proprio lato, niente duplicati, solo votanti, non chi parla.
- `doneSpeaking`: rifiutato prima del minimo, accettato dopo; solo lo speaker.
- `skipTurn`/`closeDebate` (leader).
- doppio "passo" → fine fase; un lato senza votanti passa sempre.
- persuasione spalmata su **tutti** gli oratori del lato; candidati miglior-oratore = tutti.

Voto auto-paced:
- VOTE_1/PREDICT/SPEAKER_VOTE hanno `phaseExpiresAt = null` (nessun auto-advance a tempo);
  avanzano su tutti-presenti-fatto; un disconnesso non blocca; i bot non bloccano.
- VOTE_2: `confirmedVote2` parte vuoto (umani); il pre-riempimento NON conta come votato;
  `confirmVote` aggiunge al set; avanza solo a tutti-i-presenti-confermati; i bot
  pre-confermati all'ingresso; cambiare lato conferma; clear su nuovo dilemma, prune su leave.

Gate progetto: `typecheck`/`lint`/`test`/`build` verdi.
End-to-end con `npm run dev`: leader crea, più telefoni alzano la mano, il pavimento
alterna, "Ho finito" dopo il minimo, doppio passo / "Chiudi dibattito" chiude.

## Default scelti (rivedibili)

- **Minimo 20s / apertura 25s** — costante unica in `PHASE_*`/config.
- **Persuasione a tutti gli oratori del lato** (premia la partecipazione) anziché al solo
  apri-dibattito.
