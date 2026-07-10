# Percorso in 2 — redesign della modalità 1vs1 (Duello)

**Data:** 2026-07-10 · **Stato:** approvato dall'utente (brainstorm in sessione)
**Sostituisce:** il flusso Duello del 2026-06-20 (`docs/superpowers/specs/2026-06-20-1v1-duel-mode-design.md`)

## Perché

Il Duello attuale è una fetta congelata al 20 giugno, cresciuta su binari paralleli
(`DUEL_*`/`FINAL_DUEL`) che il resto del gioco ha abbandonato:

- Se i due giocatori sono d'accordo al primo pick, il round finisce senza dibattito:
  per due amici che la pensano uguale il gioco degenera in un loop di votazioni.
- Nessun premio, nessun vincitore, nessuna persistenza: `computeAwards` e il
  salvataggio scattano solo su `FINAL_AWARDS`, che il Duello non raggiunge mai.
- I dilemmi scritti dai giocatori vengono scartati in silenzio (il Duello pesca dal
  mazzo grezzo invece dei `plannedDilemmas`), mentre la lobby promette il contrario.
- Momenti nominati, statistiche round, twist, escalation: tutto gated su `gruppo`.
- Il piano master 2026-07-07 lo definisce già "monco senza TV" (fase 3.4).

Verdetto dell'utente: il concetto "convinci l'altro" da solo non regge in 2, il loop
è piatto, e quando si è d'accordo non c'è gioco. Da rifare, senza uscire dal contesto
del gioco (dilemmi A/B, schierarsi, arringhe).

## Cosa (esperienza)

Un "percorso in 2": tre atti fissi a drammaturgia crescente + finale "ritratto di
coppia" con un vincitore leggero dentro. Phone-first: l'esperienza completa vive sui
2 telefoni; la TV `/host` resta spettatore opzionale. La chiave interna resta
`duello` (meno churn di wire); cambiano label e copy ("Percorso in 2 · in coppia").

Un mazzo unico costruito con `buildClassicPlan` (dilemmi dei giocatori inclusi +
escalation di complessità → l'Atto III riceve i più spinosi). Taglie legate al
formato sessione: 3/5/7 → totale 4/7/10 dilemmi, split Sintonia/Invertite/Schierati
= 2/1/1 · 3/2/2 · 4/3/3. Frontiere d'atto marcate da `DUO_ACT_INTRO` (7s, come
`TAPPA_INTRO` nel percorso).

### Atto I — Sintonia (riscaldamento)

Per dilemma: `DUO_PICK_PREDICT` (30s) — ognuno sceglie in segreto il proprio lato
**e** prevede il lato dell'altro (una vista, due selezioni; early-advance quando
entrambi confermano) → `DUO_SYNC_REVEAL` (8s) — reveal di pick e previsioni.
L'accordo alimenta la "sintonia %"; ogni previsione giusta vale +1 "ti conosco".
L'accordo qui è dato di gioco, non un buco: funziona proprio quando si è d'accordo.

### Atto II — A parti invertite (dibattito garantito)

Per dilemma: `DUO_SIDE_PICK` (12s, pick vero segreto) → il server assegna lati
opposti preferendo il lato NON scelto da ciascuno; se i pick coincidono, il
giocatore designato dall'alternanza di fairness difende il lato opposto →
`DUO_ARGUE` — un'arringa a tempo a testa (floor 15s, cap 45s, "Ho finito", riusa
la macchina di DEFENSE) → `DUO_WAVER` (15s) — ognuno valuta in segreto l'arringa
dell'altro: "Ti ha fatto vacillare?" 😐/🤔/🤯 = 0/1/2 punti "vacillare" all'oratore
→ `DUO_ROUND_RESULT` (8s). Tono teatrale: è l'Avvocato del Diavolo in salsa 1vs1.

### Atto III — Schierati (il duello vero, dilemmi più spinosi)

`DUO_PICK` (20s) → `DUO_REVEAL` (6s):

- **Disaccordo** → `DUO_ARGUE` (ognuno difende il proprio lato) → `DUO_REPICK`
  (20s, early-advance quando entrambi confermano) → `DUO_ROUND_RESULT`: far
  cambiare idea all'altro = +2 "persuasione".
- **Accordo** → twist avvocato del diavolo: un giocatore (alternanza fairness)
  difende il lato opposto in un turno solo → l'altro fa `DUO_REPICK`: se cambia
  idea = +2 "ribaltone" all'avvocato, altrimenti valuta il vacillare 0/1.

### Finale — `DUO_PORTRAIT` (ritratto di coppia, terminale)

- **Sintonia %**: accordi al primo pick / dilemmi con pick vero (Atti I e III).
- **Chi conosce meglio l'altro**: conteggio previsioni giuste.
- **Momento della serata**: heuristica duo con priorità ribaltone > 🤯 > persuasione.
- **Micro-verdetto giocoso**: "Stasera l'ha spuntata X, 7-5"; pareggio =
  "pareggio — sintonia totale". Niente pathos competitivo.
- **2 titoli a testa** da un pool duo (Il Persuasore, L'Avvocato del Diavolo,
  Il Telepate, L'Incantatore, …) con fallback per garantirne sempre 2.
- Rematch → LOBBY (macchina esistente). **Qui scatta la persistenza** (fix del
  ramo morto: il salvataggio si estende da `FINAL_AWARDS` a `DUO_PORTRAIT`).

## Come (architettura)

- **Fasi nuove** (sostituiscono in toto `DUEL_*` e `FINAL_DUEL`): `DUO_ACT_INTRO`,
  `DUO_PICK_PREDICT`, `DUO_SYNC_REVEAL`, `DUO_SIDE_PICK`, `DUO_ARGUE`, `DUO_WAVER`,
  `DUO_ROUND_RESULT`, `DUO_PICK`, `DUO_REVEAL`, `DUO_REPICK`, `DUO_PORTRAIT`.
- **Ogni fase di input ha timer vero + early-advance server-side.** Si evita
  `maybeArmSoftTimeout` (la sua soglia di quorum non arma mai con 2 giocatori) e
  si risolve il freeze storico di `DUEL_REPICK` senza toccare quel modulo.
- `nextDuoPhase(current, dilemmaIndex, plannedActs, {advocacy, flipped})` pura in
  `phases.ts` (stile `nextPercorsoPhase`); `advanceDuoPhase` stateful in `rooms.ts`
  consuma `room.plannedDilemmas` in ordine (fix dilemmi dei giocatori).
- Nuovo modulo puro `server/src/game/duo.ts` (sostituisce `duel.ts`): act plan,
  assegnazioni + contatore fairness, scoring waver, ritratto, awards duo (non in
  `awards.ts`: `computeAwards` è group-shaped). `duelPlayers` → `duoPlayers`.
- **Niente roundStats/namedMoments nel duo** (sono tally-of-many, senza senso a
  N=2): i momenti duo si accumulano in `duo.ts` (`duoMoments`) e affiorano solo
  nel ritratto.
- **Segretezza** (regola di progetto): previsioni segrete fino a `DUO_SYNC_REVEAL`;
  rating waver segreti fino a `DUO_ROUND_RESULT`; pick individuali visibili solo
  nelle fasi di reveal.
- **Eventi socket**: nuovi `player:duoSync {own, predict}` e `player:duoWaver
  {rating}` (pattern GROUP_MIND); pick/repick riusano `player:vote` /
  `player:confirmVote` (gate esteso a `DUO_REPICK`); arringhe `player:finishTurn`;
  reazioni `player:react`.
- **Stato Room** (tutto Map/array/plain — niente `Set`: il round-trip dello
  snapshot non li rianima): `duoPlannedActs`, `duoPredictions`, `duoAssignedSides`,
  `duoSpeakers`, `duoTurnIndex`, `duoWaverRatings`, `duoFairness`, `duoAdvocacy`,
  `duoRepickFlipped`, `duoScore` (per-player {tiConosco, vacillare, persuasione,
  ribaltone}), `duoTruePicks`, `duoFirstPickAgreements`, `duoMoments`.
- **TV /host**: rendering duo inline in `HostApp.tsx` (coerente con l'esistente).
  Audio cues: `DUO_SYNC_REVEAL`/`DUO_REVEAL` → reveal, `DUO_ROUND_RESULT` con punti
  → win, `DUO_PORTRAIT` → awards.

## Fuori scope

- Backward compat di partite duello in corso durante il deploy (snapshot con fasi
  `DUEL_*` orfane restano no-op: accettato).
- Il bug latente pre-esistente dei `Set` della Room che non sopravvivono al
  round-trip dello snapshot (riguarda campi gruppo; segnalato a parte).
- Bot nel duello (resta 2 umani esatti).

## Piano di implementazione

Vedi il piano approvato (13 task TDD in ordine di dipendenza, gate
`npm run typecheck && npm run lint && npm test && npm run build` per ogni task).
