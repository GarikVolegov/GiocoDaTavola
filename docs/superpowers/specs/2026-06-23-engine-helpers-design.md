# Design — Estrazione degli helper dell'engine da RoomStore

**Data:** 2026-06-23 · **Branch:** `ralph/skeleton-dilemma` · **Approccio:** B (estrai gli helper, i coordinatori restano)

## Contesto

Ultimo tratto del refactor god-class `RoomStore` (`server/src/game/rooms.ts`, ~1883
righe). I domini "foglia" sono già in 11 moduli. Resta l'**engine**: la macchina a
stati `advancePhase` + `startGame` + `advanceDuelPhase` e i loro helper privati, che
mutano il `room` usando le dipendenze iniettate nel costruttore (`rng`, `now`,
`makeDeck`). Obiettivo: estrarre gli **helper coesi** in funzioni pure testabili,
lasciando i **coordinatori** in `RoomStore`. **Zero cambi di comportamento**;
i 361 test esistenti sono la rete.

## Principio sulle dipendenze

Niente oggetto-bundle di dipendenze. Ogni funzione estratta riceve **solo** la
dipendenza che usa davvero, come parametro esplicito: `rng: () => number`,
`now: () => number`, o un `Deck`. Coerente col pattern dei moduli già estratti
(funzioni pure su `Room`) e auto-documentante.

## Confini dei moduli

### Nuovi
- `botVotes.ts` — `castBotFirstVotes(room, rng)`, `applyBotSecondVotes(room, rng)`.
  Voti casuali dei bot a VOTE_1 e swing per-persona a VOTE_2 (usa `voteCount.tally`).
- `defenseSetup.ts` — `selectDefenders(room, rng)`, `armTurn(room, now)`,
  `argumentForCurrentDefender(room, rng)`. Selezione equa dei difensori (devil-aware,
  via `devilAdvocate.isDevilRound` + `defenseTurns.currentSpeakerId`), arming del
  timer di turno, e l'argomento templato del bot difensore (`botDefenseArgument`).
- `dilemmaPlan.ts` — `buildClassicPlan(deck, submitted, count, rng)` e
  `buildPercorsoPlan(...)`. Costruzione della sequenza di dilemmi (shuffle + draw +
  ordinamento per complessità). Usa `Deck`.

### Fold-in nei domini esistenti
- `knowRound.ts` — aggiunge `assignKnowTargets(room)` (pura, nessuna dep) e
  `pickKnowRound(dilemmaCount, devilRound, rng)`.
- `devilAdvocate.ts` — aggiunge `pickDevilRound(dilemmaCount, rng)`.

### Restano in RoomStore (coordinatori)
`advancePhase`, `startGame`, `advanceDuelPhase`: orchestrano la sequenza (calcola
fase successiva → esegue i side-effect d'ingresso → arma il timer), chiamando gli
helper con `this.rng`/`this.now`/il deck. La gestione della *collezione* di room
(join/leave/create/delete/bot) resta in RoomStore per definizione.

## Dipendenze / cicli

Tutti i nuovi moduli importano i tipi da `rooms.ts` **type-only** (erasi) → nessun
ciclo runtime. I runtime import vanno verso moduli indipendenti già esistenti
(`voteCount`, `deck`, `botDefense`, `devilAdvocate`, `defenseTurns`). I coordinatori
in `rooms.ts` importano i nuovi moduli (una direzione).

## Testing
- **Rete di regressione:** i 361 test esistenti (rooms.test.ts guida l'engine
  end-to-end) restano verdi a ogni fetta → garantiscono comportamento invariato.
- **Nuovi unit-test diretti:** una volta pure, gli helper si testano in isolamento
  con rng deterministico (`() => 0`): es. `applyBotSecondVotes` per ogni persona,
  `selectDefenders` per l'equità/devil, `buildClassicPlan` per l'ordine di complessità.

## Slicing (un commit per fetta, gate verdi → commit → push)
1. `botVotes.ts` (castBotFirstVotes + applyBotSecondVotes)
2. `defenseSetup.ts` (selectDefenders + armTurn + argumentForCurrentDefender)
3. `dilemmaPlan.ts` (buildClassicPlan + buildPercorsoPlan)
4. fold-in: assignKnowTargets + pickKnowRound → knowRound.ts; pickDevilRound → devilAdvocate.ts

## Non in scope (YAGNI)
- Nessuna riscrittura di advancePhase/startGame/advanceDuelPhase (restano coordinatori).
- Nessun cambio di comportamento, timer, o regole di gioco.
- Nessun oggetto-context/DI framework: solo parametri espliciti.
