# Modalità 1v1 — "Duello" (design)

**Data:** 2026-06-20
**Stato:** approvato il flusso (in attesa di review della spec scritta)
**Tipo:** nuova modalità di gioco (server + client), tema invariato (business / crescita personale / valori di vita / scopo)

## Contesto e obiettivo

Il gioco esistente ("Dilemma di gruppo", 3–8 giocatori) ruota su: voto segreto →
split → difese → secondo voto → swing. Con **2 giocatori** questo loop non regge
(lo split segreto è banale, le difese una-per-lato perdono senso). La modalità
**1v1 "Duello"** porta lo stesso cuore — *vota, argomenta, cambia idea?* — in un
formato pensato per due, aggiungendo un angolo "quanto la pensiamo uguale".

Fa parte di una visione multi-modalità (Singolo / 1v1 / Gruppo). Questa spec copre
**solo il 1v1**. Il "selettore modalità" completo sulla landing è una slice
separata; qui includiamo solo il minimo per **avviare e testare** un 1v1.

## Flusso di un round (approvato)

Per ogni dilemma:

1. **Dilemma** mostrato sullo schermo condiviso (testo + opzioni A/B).
2. **Scelta segreta:** entrambi i giocatori scelgono A o B (posizione sincera),
   dal proprio dispositivo. Timer.
3. **Rivelazione:** si mostrano le due scelte.
   - **Stessa scelta → "Siete d'accordo!"** 🤝 — punto-connessione, round chiuso
     veloce (salta duello e ri-scelta).
   - **Scelte diverse → duello.**
4. **Duello a turni** (timer per turno, default 45s ciascuno): ogni giocatore ha
   un turno per argomentare il proprio lato e provare a far cambiare idea all'altro
   (parla a voce; lo schermo mostra di chi è il turno + il lato).
5. **Ri-scelta segreta:** entrambi ri-scelgono A/B. Timer.
6. **Esito del round:**
   - Un giocatore ha cambiato lato → **chi l'ha convinto segna +1 "persuasione"**
     ("Hai convinto {nome}! 🎯").
   - Nessuno cambia → **"Teste dure!" 🪨** (nessun punto persuasione).
   - (Se erano d'accordo al passo 3 → **+1 "accordo"**, niente duello.)
7. Si ripete per N dilemmi (riusa i preset durata: Assaggio/Classica/Maratona).

**Finale:** riepilogo a due — persuasioni riuscite per ciascuno, quante volte
eravate d'accordo, e un paio di "titoli" simpatici (es. "Il Persuasore", "Anime
gemelle" se molto allineati, "Teste dure" se nessuno ha mai ceduto).

Nota: "chi ha convinto chi" è **oggettivo** (deriva dalla ri-scelta vs scelta
iniziale, come lo swing del gioco di gruppo) — nessun giudizio soggettivo.

## Architettura

### Modalità sulla Room

La `Room` guadagna `mode: GameMode` (`'gruppo' | 'duello'`; il Singolo resta
`'gruppo'` con 1 umano + bot). Default `'gruppo'` per non cambiare il
comportamento esistente. `startGame` riceve la modalità (oltre a durata/registro).

### Macchina a stati del 1v1

La macchina a stati di gruppo (`nextPhase` + `DILEMMA_SEQUENCE` in
`server/src/game/rooms.ts`) resta intatta per `'gruppo'`. Per `'duello'` si
introduce una **sequenza separata** (il dispatch su `mode` avviene in `advancePhase`,
mantenendo `nextPhase` puro per ciascuna modalità — niente if-sparsi nel resto):

```
PHASE_INTRO
  → DUEL_PICK        (entrambi scelgono in segreto; timer)
  → DUEL_REVEAL      (rivela le due scelte; calcola agree/differ)
      • se agree → DUEL_RESULT
      • se differ → DUEL_ARGUE
  → DUEL_ARGUE       (un turno timed per giocatore, 2 turni; come DEFENSE)
  → DUEL_REPICK      (entrambi ri-scelgono; timer)
  → DUEL_RESULT      (esito + aggiorna punteggio)
  → (loop al DUEL_PICK del dilemma successivo finché restano dilemmi)
  → FINAL_DUEL       (riepilogo a due, terminale)
```

I turni intra-fase di `DUEL_ARGUE` riusano il pattern esistente di `DEFENSE`
(bump del turno + ri-arma del timer in `advancePhase`, due turni totali).

### Identità e segretezza

Con 2 giocatori, le scelte si rivelano entrambe a `DUEL_REVEAL` (è il punto del
gioco: confronto diretto). Durante `DUEL_PICK`/`DUEL_REPICK` la scelta resta
**privata** finché non si rivela (il server non la diffonde prima). Il server
resta autoritativo; i client renderizzano solo ciò che ricevono.

### Punteggio

La Room tiene, per `'duello'`, un punteggio a due: `persuasions` per giocatore
(quante volte ha fatto cambiare idea all'altro) + `agreements` (quanti round
d'accordo). Calcolati in `DUEL_RESULT` confrontando la ri-scelta con la scelta
iniziale (riusa la logica di confronto di `computeSwing`, adattata a due).
Esposti **solo** in `DUEL_RESULT` (per-round) e `FINAL_DUEL` (totali) tramite
reader phase-gated, come gli aggregati esistenti.

### Eventi (events.ts) — aggiunte

- `GameMode` + costanti/label.
- Nuove `GamePhase`: `DUEL_PICK | DUEL_REVEAL | DUEL_ARGUE | DUEL_REPICK | DUEL_RESULT | FINAL_DUEL` (in entrambi server e client, come da convenzione duplicata).
- `startGame` payload guadagna `mode`.
- `GameStatePayload` guadagna i campi gated del duello: `duelReveal` (le due
  scelte, solo in DUEL_REVEAL), `duelTurn` (chi argomenta, solo in DUEL_ARGUE),
  `duelResult` (esito round, solo in DUEL_RESULT), `duelScore` (totali, solo in
  FINAL_DUEL). Voto: si **riusa** `player:vote` / `player:voted` per PICK e REPICK.

### Client

- **Host (schermo condiviso):** rende le nuove fasi — scelta in corso (conteggio
  "2/2 ha scelto"), rivelazione (le due scelte fianco a fianco + accordo/duello),
  turno di duello (di chi è + lato, come DEFENSE), esito (chi ha convinto / teste
  dure), riepilogo finale a due.
- **Telefono (PlayerApp):** durante DUEL_PICK/DUEL_REPICK mostra i pulsanti A/B
  (riusa il flusso voto esistente); in DUEL_ARGUE mostra "Tocca a te, difendi
  {lato}" / "Sta parlando {altro}".
- **Avvio (minimo, per testare):** un toggle modalità nella lobby host ("Gruppo /
  1v1") accanto a "Componi la serata". 1v1 richiede **esattamente 2 partecipanti**.
  Il selettore completo sulla landing è la slice separata.

### Regole partecipanti

- `'duello'`: esattamente **2 giocatori umani** (per ora). 1-umano-vs-bot è una
  possibile estensione futura (riuserebbe i bot del Singolo) — **fuori scope qui**.
- `'gruppo'`: invariato (3–8, con solo = 1 umano + bot).

## Riuso vs nuovo

- **Riusa:** deck dilemmi, voto A/B (`player:vote`), timer server + `useCountdown`,
  pattern turni di `DEFENSE`, logica di confronto scelte (`computeSwing`),
  design system, "Gioca anche tu" (l'host può essere uno dei due).
- **Nuovo:** `mode` sulla Room, sequenza di fasi `DUEL_*`, punteggio a due, reader
  gated del duello, rendering delle nuove fasi su host + telefono, toggle modalità.

## Non-obiettivi / deferiti

- Selettore modalità completo sulla landing (slice separata).
- Bot-avversario nel 1v1 (estensione futura).
- Persistenza/DB, deploy (fuori scope, come da vincoli progetto).

## Testing

- **Server (TDD):** la nuova macchina a stati `'duello'` è pura e va testata in
  `server/src/game/__tests__/` — sequenza DUEL_*, ramo agree vs differ (salto del
  duello), due turni di DUEL_ARGUE, calcolo persuasioni/accordi, totali finali,
  enforcement "esattamente 2". Mantenere `nextPhase` di gruppo intatto (i test
  esistenti restano verdi).
- **Client:** nessun test runner client (convenzione progetto) → verifica via
  typecheck/lint/build + check manuale.
- Gate completo verde: `npm run typecheck && npm run lint && npm test && npm run build`.

## Dipendenze / coordinamento

- Tocca il **core** (`rooms.ts`, `index.ts`, `events.ts`, entrambi i client) — la
  stessa area che altri agenti riscrivono. Da costruire con **un solo costruttore
  attivo** (ambiente pulito, niente altre sessioni Claude sul repo).
- Si appoggia a "Gioca anche tu" (già fatto) per giocare il 1v1 anche su un solo
  dispositivo + un telefono.
