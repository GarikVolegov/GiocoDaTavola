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

## Prossime fette (proposte, non ancora fatte)
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
