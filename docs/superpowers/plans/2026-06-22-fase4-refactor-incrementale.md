# Fase 4 — Refactor god-file (incrementale) — Implementation Plan

**Approccio:** una fetta coesa per volta, ognuna coperta da test e mergeabile da
sola, invece di un big-bang. Stop per review dopo ogni fetta.

## Fetta 1 — Estrazione `VoteView` da PlayerApp ✅
- Nuovo `client/src/player/views/layout.ts`: stile condiviso `wrap` (spostato da
  PlayerApp, ora importato dalle ~15 viste che lo usavano).
- Nuovo `client/src/player/views/VoteView.tsx`: la schermata di voto
  (VOTE_1/VOTE_2/DUEL_PICK/DUEL_REPICK), purely presentational — il padre possiede
  lo stato voto e gli emit socket (callback `onVote`/`onConfirm`).
- `PlayerApp.tsx`: blocco voto inline (~105 righe) → `<VoteView .../>`. Da 1789 a 1693 righe.
- Copertura: render-test VOTE_1 + VOTE_2 in `PlayerApp.test.tsx` (verificano il
  wiring PlayerApp→VoteView, non il componente isolato → provano che il refactor
  preserva il comportamento). 345 test, gate verdi.

## Fetta 2 — Estrazione `SpeakerVoteView` da PlayerApp ✅
- Nuovo `client/src/player/views/SpeakerVoteView.tsx`: schermata "chi è stato più
  convincente?" (SPEAKER_VOTE), presentational (callback `onVote`). Il parent filtra
  i candidati (esclude sé stesso) e passa la lista.
- `PlayerApp.tsx`: blocco inline (~60 righe) → `<SpeakerVoteView .../>`. Da 1693 a 1645 righe.
- Copertura: render-test SPEAKER_VOTE in `PlayerApp.test.tsx` (candidati elencati,
  sé stesso escluso). 346 test, gate verdi.

## Fetta 3 — Estrazione `AccuseView` da PlayerApp ✅
- Nuovo `client/src/player/views/AccuseView.tsx`: schermata "chi è l'Infiltrato?"
  (ACCUSE), presentational (callback `onAccuse`). Il parent filtra i `players`.
- `PlayerApp.tsx`: blocco inline (~55 righe) → `<AccuseView .../>`. Da 1645 a 1602 righe.
- Copertura: render-test ACCUSE. Aggiunto `afterEach(cleanup)` in `PlayerApp.test.tsx`
  (senza globals RTL non fa auto-cleanup → il DOM dei test precedenti restava e i
  bottoni collidevano). 347 test, gate verdi.

## Fetta 4 — Estrazione `DefenseView` (+ `ReactionBar`) da PlayerApp ✅
- `client/src/player/views/ReactionBar.tsx`: estratto il componente locale (usato
  anche da DUEL_ARGUE, ora importato).
- `client/src/player/views/DefenseView.tsx`: schermata DEFENSE/INTERVENTI (turno
  proprio vs spettatore: difendi/spunti/timer/"Ho finito" · "sta parlando"/mano
  alzata/coda/ReactionBar). Computa i derivati internamente dai prop grezzi.
- `PlayerApp.tsx`: blocco inline (~145 righe) → `<DefenseView .../>`; rimossi gli
  import diventati orfani (`formatMSS`, `ReactionSwarm`, `REACTIONS`). Da 1602 a 1445 righe.
- Copertura: render-test DEFENSE spettatore (sta parlando + alza la mano) e turno
  proprio (tocca a te + Ho finito). 352 test, gate verdi.

## Fetta 5 — Estrazione `PredictView` da PlayerApp ✅
- Nuovo `client/src/player/views/PredictView.tsx`: schermata PREDICT a due varianti
  (pronostico post-difese + scommessa ribaltone · oppure "quanto mi conosci" se il
  giocatore ha un'assegnazione). Branch interno su `knowPair`.
- `PlayerApp.tsx`: blocco inline (~170 righe) → `<PredictView .../>`. Da 1445 a 1291 righe.
- Copertura: render-test PREDICT pronostico+scommessa e variante know-pair. 354 test, gate verdi.

## Fette 6-9 — Completata la decomposizione di PlayerApp ✅
- Fetta 6: `DuelArgueView` (DUEL_ARGUE) → 1291→1257.
- Fetta 7: `StatusView` (display in-game: TAPPA/PHASE_INTRO/REVEAL/RESULTS/FINAL_AWARDS/FINAL_DUEL) → 1257→1091.
- Fetta 8: `SubmitDilemmaCard` (card "aggiungi dilemma" della lobby) → 1091→1047.
- Fetta 9: `LeaderSetup` (pannello setup-leader della lobby) → 1047→871.
- Ognuna con render-test; import orfani rimossi a ogni passo.

**Stato finale PlayerApp: 1789 → 871 righe (-918, -51%) in 9 fette. 359 test verdi.**
Cartella `client/src/player/views/`: VoteView, SpeakerVoteView, AccuseView, DefenseView,
PredictView, DuelArgueView, StatusView, SubmitDilemmaCard, LeaderSetup, ReactionBar, layout.
Residuo in PlayerApp = container (stato + wiring socket + handlers + roster/how-to + join screen).

## Track server — `RoomStore` decomposto per dominio ✅ (in corso)
Pattern: funzioni pure su `Room` in moduli dedicati; `RoomStore` fa lookup + delega.
Import type-only da rooms.ts → nessun ciclo runtime. Rete: 327 unit + integrazione.
**rooms.ts: 2273 → 1883 righe** (-390, -17%), logica spostata in **11 moduli** testabili:
- `voteCount.ts` — fondazionale: `tally` + `isVoteChoice`/`isSwingBet`.
- `voting.ts` — core: vote/confirm/tally/split/swing.
- `predictions.ts` — pronostico + swing bet (+ leadFlipped), usa voteCount.
- `knowRound.ts` — "Quanto mi conosci".
- `infiltrato.ts` — accuse + resolve/reveal.
- `speakerVote.ts` — voto miglior oratore.
- `submittedDilemmas.ts` — dilemmi dei giocatori (+ costanti submission).
- `defenseTurns.ts` — currentSpeakerId/raiseHand/finishTurn/publicDefense.
- `reactions.ts` — react (1 ciclo call-time benigno per le costanti reaction).
- `devilAdvocate.ts` — isDevilRound/publicDevilRound.
- `roundStats.ts` — scoring di fine round (recordRoundStats).
Ognuno: gate verdi → commit → push. 361 test verdi.

### Rimane (engine centrale, NON estratto — più rischioso)
La macchina a stati (`advancePhase` ~170 righe, `startGame` ~120, `advanceDuelPhase`),
`selectDefenders`/`armTurn`/`argumentForCurrentDefender` (rng-coupled), i voti-bot
(`applyBotSecondVotes`), `botDefenderContext`/`setBotDefenseArgument`, il percorso
planning. Sono il cuore che coordina l'intero flusso e muta il room su più concern:
vanno estratti con attenzione dedicata (non in loop rapido), eventualmente con un
modulo state-machine apposito. La gestione lobby (join/leave/create/bot) resta
legittimamente in RoomStore (gestisce la collezione di room, non un singolo Room).
- Estrarre le altre viste di fase di PlayerApp (DEFENSE/INTERVENTI, SPEAKER_VOTE,
  PREDICT, ACCUSE, lo switch finale TAPPA/SPLIT/RESULTS/AWARDS), aggiungendo un
  render-test per ognuna PRIMA dell'estrazione.
- Estrarre il blocco "lobby + setup leader" (grande) in una `LobbyView`.
- Lato server: scomporre `RoomStore` (rooms.ts) estraendo helper coesi per dominio
  (tally voti, rotazione difensori, predizioni/scommesse) dietro la stessa API
  pubblica usata da `index.ts`, con i 327 unit-test + l'integrazione come rete.

## Principio
Ogni fetta: (1) render/unit-test della parte da estrarre, (2) estrazione, (3) gate
verdi, (4) commit+push, (5) review. Niente diff monstre.
