# Phone-first + spunti + punti ciechi (design)

**Data:** 2026-06-21
**Stato:** approvato il flusso (in attesa di review della spec scritta)
**Tipo:** evoluzione architetturale (server + client) + due aggiunte di contenuto/scoring

## Contesto e obiettivo

Oggi il gioco assume uno **schermo condiviso obbligatorio**: il route `/host` crea
la stanza, mostra il codice, configura la partita e disegna tutti i contenuti
pubblici (dilemma, split dei voti, difese, risultati, premi). I telefoni (`/join`)
votano e poco altro: **non** vedono il dilemma né il resto.

Tre obiettivi, in un unico design coerente "phone-first":

1. **Schermo condiviso opzionale.** La partita deve funzionare **solo con i
   telefoni**; la TV (`/host`) resta una scelta per chi vuole proiettare, come
   vista passiva.
2. **Spunti per ogni dibattito.** Ogni dilemma offre argomenti pronti, mostrati a
   chi deve difendere quel lato, per rendere le difese più ricche.
3. **Punti ciechi nei premi.** Oltre ai premi-superlativi pubblici, ogni giocatore
   riceve in privato sul proprio telefono un consiglio di miglioramento dedotto
   dalle sue statistiche di voto.

Fatto abilitante: i telefoni **già ricevono** lo stato pubblico completo via
`game:state` (dilemma, split, difese, swing, premi) — semplicemente oggi non lo
disegnano. Il grosso del lavoro phone-first è quindi UI client + il cambio nel
flusso di creazione stanza.

## Vincoli invariati

- **Voti segreti:** mai inviare voti individuali; solo conteggi aggregati. Gli
  spunti riguardano il *lato* del difensore (già pubblico mentre parla) e i punti
  ciechi sono **per-socket privati**: nessuna violazione.
- **Timer server-authoritative:** le fasi avanzano già da sole; il client rende
  solo il countdown. Il leader può solo *saltare* il countdown.
- Server CJS / client ESM separati; niente `any`; niente DB, stato in memoria.

---

## Parte 1 — Architettura phone-first (TV opzionale)

### Ruoli

- **Leader-giocatore:** chi crea la stanza dal telefono. È un giocatore a tutti gli
  effetti *e* possiede i controlli (avvia, salta fase, aggiungi/rimuovi bot).
  Identificato dal `playerId` stabile, così sopravvive ai reconnect.
- **Giocatori:** entrano con codice + nickname (flusso attuale invariato).
- **TV / spettatore (opzionale):** `/host` diventa una vista **passiva** agganciata
  a una stanza esistente tramite codice. Nessun controllo, nessun posto-giocatore.

### Flusso di creazione (cambia)

- Oggi `/host` crea la stanza senza essere un giocatore.
- Diventa: dalla schermata telefono un giocatore tocca **"Crea stanza"** (inserisce
  nickname) → il server crea la stanza, lo iscrive come giocatore, lo segna
  `leaderId`, risponde con `player:joined` (+ token reconnect) e il codice da
  dettare agli altri.
- La TV (se usata) apre `/host`, inserisce il codice (o `/host?code=WXYZ`) e diventa
  spettatore in sola lettura.

### Server (`server/src/game/rooms.ts` + `server/src/index.ts`)

- `Room` guadagna `leaderId: string | null` (il `playerId` del leader).
- Nuovo evento **`player:createRoom { nickname }`**: genera codice, crea la stanza,
  iscrive il creatore come `Player`, imposta `leaderId`, `socket.join(code)`,
  emette `player:joined` (+ token) e il codice. Sostituisce l'uso di
  `host:createRoom` per la creazione "vera".
- Gli eventi di controllo diventano **gated dal leader** e vengono rinominati
  `leader:*` per chiarezza:
  - `leader:startGame` (ex `host:startGame`)
  - `leader:advancePhase` (ex `host:advancePhase`)
  - `leader:addBot` / `leader:removeBot` (ex `host:addBot` / `host:removeBot`)
  - Gate: il `playerId` associato al socket richiedente deve essere uguale a
    `room.leaderId`; altrimenti l'azione è ignorata.
- Nuovo evento **`spectator:join { code }`** per la TV: `socket.join(code)` + invio
  immediato di `lobby:update` e `game:state`; nessun posto-giocatore creato.
- I broadcast `lobby:update` e `game:state` restano `io.to(code)` → arrivano già a
  leader, giocatori e TV senza modifiche.
- La mappa `hostRooms` (oggi `socket.id → code` per l'host) viene rimpiazzata dal
  concetto di leader-per-`playerId`. Lo spettatore non possiede la stanza.
- **Leader disconnesso:** essendo `leaderId` un `playerId`, il leader che si
  riconnette resta leader. Se abbandona davvero **prima dell'avvio**, la leadership
  passa al giocatore **umano** entrato per primo tra i rimanenti (evita la stanza
  bloccata senza pulsante "Avvia"). A partita avviata non serve un leader perché i
  timer avanzano da soli.

### Client

- **`PlayerApp` (`/join`, ingresso telefono):**
  - Schermate iniziali "Crea stanza" / "Entra con codice".
  - In gioco, **rende lo stato pubblico** che oggi è solo sulla TV: card dilemma,
    barra split, fase difese, risultati/swing, premi — in versione telefono.
  - Se sei leader: vedi anche il codice e i controlli (avvia / salta / bot).
- **`/host` (TV):** da creatore di stanza a **spettatore**; riusa il layout grande
  attuale ma in sola lettura, agganciato via codice.
- **Componenti condivisi:** le viste pubbliche (card dilemma, barra split, lista
  difese, pannello premi) vengono estratte in componenti riusabili sotto
  `client/src/shared/ui`, così telefono e TV mostrano lo stesso contenuto senza
  duplicare la logica di presentazione.

### Non-goal Parte 1

- QR per agganciare la TV (la TV digita il codice; il QR è un'estensione futura).
- Riprogettare la modalità Duello: eredita lo stesso rendering phone-first, **senza
  nuove regole**.

---

## Parte 2 — Spunti per lato, a chi difende

### Dati (`server/data/dilemmas.json` + `server/src/game/deck.ts`)

Ogni dilemma guadagna due liste di spunti (2–3 voci per lato):

```json
{
  "id": "d01",
  "text": "Hai un'idea geniale ma rischiosa. Cosa fai?",
  "optionA": "Mollo tutto e ci punto al 100%",
  "optionB": "La porto avanti la sera, tenendo il lavoro sicuro",
  "register": "vita",
  "spuntiA": [
    "Il costo di non provarci è il rimpianto",
    "Sul campo impari più in fretta",
    "La finestra giusta non torna sempre"
  ],
  "spuntiB": [
    "Riduci il rischio, non il sogno",
    "Un reddito sicuro ti dà lucidità",
    "Validare prima costa meno"
  ]
}
```

- L'interfaccia `Dilemma` in `deck.ts` aggiunge `spuntiA: string[]` e
  `spuntiB: string[]`.
- Tutti i 60 dilemmi vengono completati con spunti coerenti col tono esistente.

### Visibilità (regola di segretezza)

- Gli spunti del **lato A** vanno solo a chi difende A; quelli del **lato B** solo a
  chi difende B. Il lato del difensore è **già pubblico** mentre parla, quindi
  nessun voto segreto viene rivelato.
- Compaiono nella fase **DEFENSE**, sul telefono del difensore di turno. La TV
  mostra gli spunti del lato di chi sta parlando.
- Gli altri telefoni (non di turno) vedono chi parla ma **non** gli spunti: sono un
  aiuto per chi argomenta, non un suggeritore per tutti.

### Flusso server

- `DefenseState` (in `rooms.ts`, con mirror in `client/src/shared/events.ts`)
  guadagna `spunti: string[] | null` = gli spunti del lato dello speaker corrente,
  selezionati in base a `speaker.side` quando si costruisce lo stato di DEFENSE;
  `null` fuori dalla difesa o senza speaker.
- Nessun nuovo evento: viaggiano dentro `game:state.defense`, che i telefoni già
  ricevono.

### Client

- Telefono del difensore di turno: sotto "Tocca a te — difendi il lato X" mostra la
  lista spunti.
- TV: stessa lista accanto al nome di chi parla.

---

## Parte 3 — Punti ciechi (consigli privati, da regole)

### Modulo nuovo `server/src/game/blindspots.ts`

Gemello puro di `awards.ts`, testabile in TDD. Niente AI: solo regole
deterministiche sulle statistiche già accumulate.

```ts
export interface BlindSpot { id: string; title: string; advice: string }
export function computeBlindSpot(stats: PlayerStats): BlindSpot
```

`PlayerStats` (in `awards.ts`) guadagna **`defendedCount`** (round in cui il
giocatore è stato difensore), così il consiglio sulle difese distingue "non ha mai
difeso" da "ha difeso senza spostare voti". `defendedCount` viene incrementato dove
`rooms.ts` ripiega i round nelle statistiche, ovunque vengano scelti i difensori.

### Catalogo regole

Valutate in ordine di priorità; vince la **prima** che scatta → ogni giocatore
riceve **un** punto cieco principale. Soglie esatte e ordine fine si fissano in TDD;
questo è lo schema.

1. **Volubile** — cambia idea in gran parte dei round (`changedCount/rounds` alto):
   *"Cambi idea spesso. Bello restare aperti, ma assicurati che ti abbiano convinto
   gli argomenti, non solo la maggioranza: prova a difendere di più la tua prima
   scelta."*
2. **Rigido** — non ha mai cambiato idea (`changedCount === 0`, ≥2 round):
   *"Non hai mai cambiato idea. La prossima volta prova ad ascoltare il 'perché' di
   chi la pensa diversamente e a lasciarti convincere almeno una volta."*
3. **Conformista** — quasi sempre con la maggioranza (`majorityCount/rounds` alto):
   *"Finisci quasi sempre con il gruppo. Fidati di più del tuo istinto quando vai
   controcorrente: a volte la minoranza ha ragione."*
4. **Contrarian** — quasi sempre in minoranza (`minorityCount/rounds` alto):
   *"Resti spesso in minoranza. Avere idee proprie è un pregio, ma chiediti se a
   volte la maggioranza ha colto qualcosa che ti sfugge."*
5. **Difese poco incisive** — ha difeso ma non ha spostato voti
   (`defendedCount >= 1 && persuasion <= 0`):
   *"Quando hai difeso, il gruppo non si è spostato verso di te. Prova ad
   argomentare con esempi concreti più che con principi."*
6. **Fallback equilibrato / pochi round** — nessuna soglia scattata o
   partecipazione minima: messaggio gentile e propositivo, es.
   *"Bell'equilibrio tra ascolto e convinzione: il prossimo passo è far cambiare
   idea agli altri con esempi concreti."*

### Privacy / flusso

- I premi-superlativi pubblici **restano invariati** in `game:state.awards`.
- Il punto cieco è **privato**: non può viaggiare nel `game:state` (broadcast a
  tutta la stanza). All'ingresso in `FINAL_AWARDS` il server emette un evento
  **per-socket** `player:blindSpot { id, title, advice }` al telefono di ciascun
  giocatore **umano** (mapping socket→`playerId` già esistente in `index.ts`).
  Ri-emesso a chi si riconnette mentre la fase è `FINAL_AWARDS`. I bot vengono
  saltati.
- **Client `PlayerApp`:** al `FINAL_AWARDS` mostra i premi pubblici (già ricevuti)
  **+** una card privata "🔭 Il tuo punto cieco" col contenuto di `player:blindSpot`.
- **TV / spettatore:** mostra solo i premi pubblici; nessun punto cieco.

---

## Test

- **Puro / TDD:** `blindspots.ts` (mappatura statistiche → punto cieco, con casi di
  confine e fallback) e l'integrità degli spunti per-lato nei dati (ogni dilemma ha
  `spuntiA`/`spuntiB` non vuoti), accanto agli esistenti `awards.test.ts` /
  `deck.test.ts`.
- **Stato stanza:** la creazione via `player:createRoom` imposta `leaderId`; il gate
  leader sui controlli; la riassegnazione di leadership pre-avvio; la selezione
  degli spunti per lato in `DefenseState`.
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` verdi a ogni
  lotto.

## Suddivisione in lotti (per il piano)

Tre lotti indipendenti, in quest'ordine:

1. **Architettura phone-first + TV-spettatore** (`player:createRoom`, leadership,
   `leader:*`, `spectator:join`, rendering pubblico su `PlayerApp`, `/host`
   passivo, componenti condivisi).
2. **Spunti per lato** (dati + `Dilemma`/`DefenseState` + UI difensore/TV).
3. **Punti ciechi** (`blindspots.ts`, `defendedCount`, `player:blindSpot`, card
   privata).

## Non-goal complessivi

- Generazione AI di spunti o consigli (resta Fase C, spenta di default).
- QR / deep-link per agganciare la TV.
- Nuove regole per la modalità Duello (eredita solo il rendering phone-first).
- Persistenza: tutto resta in memoria, per-processo.
