# Roadmap modalità nuove — SCHIERATI

**Data:** 2026-06-21 · **Base:** `ralph/skeleton-dilemma` (`e3466df`, dopo Avvocato del
Diavolo + Ribaltone) · **Stato:** introduzioni precise; ordinate per urgenza.

Criterio di **urgenza** = valore per il gioco × quanto serve presto × basso rischio di
spedizione. Ogni modalità ha una meccanica precisa nel framework di fasi esistente, le
decisioni risolte (default consigliati), i premi, lo sforzo e **l'unico bivio** che
richiede una scelta dell'utente prima di codificare.

---

## #1 — Dilemmi dai giocatori ✍️ (LA PIÙ URGENTE)

**Perché urgente:** il mazzo è finito (60 dilemmi); il gioco si gioca a ripetizione
con gli stessi amici → l'esaurimento dei contenuti è la prima minaccia alla
rigiocabilità. Risolve longevità **e** personalizzazione (dilemmi sul gruppo reale),
con il rischio di design più basso e riuso totale del flusso di round esistente
(nessuna fase nuova: solo iniezione di contenuti nel `Deck`).

**Meccanica (precisa):**
- In **LOBBY**, ogni umano connesso può inviare 1–2 dilemmi (`testo`, `opzioneA`,
  `opzioneB`). Il leader vede un conteggio "N dilemmi aggiunti dal gruppo".
- A `startGame`, i dilemmi inviati vengono **mescolati nel mazzo** del registro scelto
  (augment, non replace) e pescati senza ripetizione come i nativi.
- Toggle del leader: **"Misto col mazzo ufficiale"** (default) vs **"Solo i nostri"**.

**Server:** `Room.submittedDilemmas: Dilemma[]`; evento `player:submitDilemma`
(gated LOBBY, validazione: testo non vuoto, A≠B, cap lunghezza, max 2/persona, sanitizza
trim). `startGame` costruisce il `Deck` da nativi (filtrati per registro) + inviati.
Nota privacy: con difese AI attive il testo del dilemma va a Haiku — accettabile per
contenuti scritti dal gruppo, ma da documentare.

**Client:** mini-form in lobby ("Aggiungi un dilemma"), conteggio, toggle del leader.

**Premio:** ✍️ **L'Autore** — il cui dilemma ha prodotto il ribaltone più grande.

**Sforzo:** medio. **Non-goal:** moderazione automatica, immagini, persistenza tra partite.

**Bivio aperto:** raccolta in **LOBBY** (semplice) vs **fase dedicata** a inizio
partita; e augment vs replace (default: lobby + augment).

---

## #2 — L'Infiltrato 🕵️ (massima differenziazione)

**Perché:** aggiunge uno strato di **social deduction** sopra la persuasione — la cosa
che rende un party game memorabile e diverso da tutti gli altri. Non è "urgente" come i
contenuti perché è la più complessa e ambigua, ma è il singolo maggiore fattore di
unicità.

**Meccanica (precisa, da confermare il bivio):**
- Solo `gruppo`, ≥4 giocatori, opt-in del leader. A inizio partita un umano a caso
  diventa **segretamente l'Infiltrato** (mai trasmesso in pubblico).
- Missione (default proposto): **far vincere il lato di minoranza** — ogni round in cui
  il lato in minoranza al primo voto diventa maggioranza al secondo, l'Infiltrato segna.
- A `FINAL`, tutti votano **"chi era l'Infiltrato?"** (riusa il pattern di
  `speakerVote`). Reveal finale.

**Server:** `Room.infiltratorId` (segreto), risoluzione missione per round, voto-accusa
finale, punteggio. **Client:** card privata "sei l'Infiltrato", UI accusa, schermata
reveal. **Esito:** schermata dedicata (chi era + ha vinto?).

**Sforzo:** alto. **Bivio aperto (serve scelta):** condizione di vittoria —
(a) solo missione, (b) solo non-farsi-scoprire, (c) entrambe; e missione per-round vs
per-partita.

---

## #3 — Quanto mi conosci 🔮

**Perché:** vira il gioco su "quanto vi conoscete davvero" — fortissimo a tavola, molto
distinto. Medio sforzo.

**Meccanica (precisa):** dopo VOTE_1 (ognuno vota la propria opinione in segreto), uno
strato di indovinello: a ogni giocatore viene mostrato **un amico-bersaglio** e indovina
come ha votato (A/B). Reveal + punti. Come **round-twist** (1 round) per non sostituire
il cuore-persuasione, oppure come **modalità** intera (gioco diverso, meno persuasione).

**Server:** assegnazione bersagli, mappa guess, scoring, reveal (espone i voti
individuali — eccezione consensuale alla segretezza, intrinseca a questa modalità).
**Client:** schermata "come ha votato {amico}?", reveal. **Premio:** 🔮 **Il Telepate**.

**Sforzo:** medio. **Bivio aperto:** round-twist vs modalità intera; e accettare
l'eccezione alla segretezza dei voti (necessaria qui).

---

## #4 — Squadre / Fazioni 🔵🟠

**Perché:** competizione a squadre per convertire gli indecisi; bello per gruppi grandi.
Lo metto ultimo perché ha il **disallineamento concettuale** più delicato: le facce A/B
sono per-dilemma, non colori di squadra.

**Meccanica (precisa, da confermare il bivio):** squadre Blu/Arancio assegnate a inizio
partita (fisse). Mapping consigliato: ogni round il "lato" di una squadra = il lato
votato dalla maggioranza dei suoi membri a VOTE_1; la squadra segna in base al net-swing
verso quel lato. In alternativa: punteggio di squadra = somma della `persuasion` dei
membri.

**Server:** assegnazione squadre, scoring di squadra. **Client:** colori squadra nel
roster, tabellone. **Sforzo:** medio-alto. **Bivio aperto (serve scelta):** il mapping
squadra↔lato (maggioranza-di-team per round vs somma-persuasione aggregata).

---

## Ordine di costruzione consigliato
1. **Dilemmi dai giocatori** (subito: longevità, basso rischio).
2. **Quanto mi conosci** (alto divertimento, medio sforzo).
3. **L'Infiltrato** (massimo wow, alto sforzo — dopo aver deciso la win-condition).
4. **Squadre** (dopo aver deciso il mapping squadra↔lato).

Ciascuna seguirà il proprio ciclo: design → TDD server → wiring → UI → gate → commit,
in un worktree isolato (vedi [[avvocato-diavolo-ribaltone]] per il pattern).
