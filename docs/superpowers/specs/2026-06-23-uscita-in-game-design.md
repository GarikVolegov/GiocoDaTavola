# Uscita in-game — menu ⋮ (design)

2026-06-23 · branch `ralph/skeleton-dilemma`

## Problema

Durante una partita il giocatore (telefono `/`) **non ha modo di uscire dalla stanza**:
il link "Esci dalla stanza" esiste solo nella **lobby** (`PlayerApp.tsx`, render finale).
Serve un'uscita disponibile in tutte le fasi di gioco, ma **poco raggiungibile** per
evitare tocchi indesiderati che buttino fuori un giocatore per sbaglio.

## Soluzione

Un menu discreto dietro un'icona **⋮** fissa in **alto a destra**, con conferma a due
tocchi. Tre azioni deliberate ⇒ impossibile uscire per sbaglio:

1. **⋮** fisso (`position: fixed`, alto a destra, opacità bassa) — non occupa il layout
   delle view di fase.
2. Tap su ⋮ → apre un foglietto con **"Esci dalla partita"** + **"Annulla"**.
3. Tap su "Esci dalla partita" → **arma** ("Esci davvero?" / "Annulla"); solo il
   secondo tap esegue l'uscita. Tap su "Annulla" o fuori dal foglietto = chiude, niente
   uscita.

## Architettura

- Nuovo componente isolato **`LeaveGameMenu`** in `client/src/player/LeaveGameMenu.tsx`.
  - Props: `onLeave: () => void` (l'uscita vera e propria).
  - Stato interno: `open` (foglietto aperto) + `confirming` (conferma armata). Nessuno
    stato di rete: l'uscita la fa il padre.
  - `position: fixed`, alto a destra, `z-index` alto; tap fuori chiude (overlay
    trasparente cliccabile dietro il foglietto).
- **`PlayerApp.tsx`**: riuso `leaveRoom()` (già esistente, `:313`). I 7 `return` delle
  fasi in-game (VOTE_1/2 + DUEL_PICK/REPICK, DEFENSE/INTERVENTI, DUEL_ARGUE,
  SPEAKER_VOTE, PREDICT, ACCUSE, StatusView per `phase !== 'LOBBY'`) vengono avvolti da
  un piccolo helper `withLeaveMenu(node)` che aggiunge `<LeaveGameMenu onLeave={leaveRoom} />`
  come fratello. Un punto di definizione, una riga per `return`.
- **Lobby invariata**: mantiene il suo "Esci dalla stanza" (schermata di setup, dove
  un'uscita visibile va bene). Il menu ⋮ è solo per le fasi di gioco.

## Test (TDD, in `PlayerApp.test.tsx`)

Con un giocatore in una fase di gioco (es. VOTE_1):
1. L'icona ⋮ è presente; "Esci dalla partita" **non** è visibile finché non si apre.
2. Tap su ⋮ → compare "Esci dalla partita".
3. Un tap su "Esci dalla partita" **non** esce (arma soltanto: compare "Esci davvero?").
4. Tap su "Esci davvero" → esce davvero (torna al form di join).
5. "Annulla" / tap fuori → chiude senza uscire.

## Fuori scope

- Login Clerk (gestito a parte via variabili Railway).
- Modifiche alla lobby o all'uscita su `/host`.
