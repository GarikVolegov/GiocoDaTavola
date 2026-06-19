# PRD: Scheletro comune + Fase "Dilemma di gruppo"

## 1. Introduction/Overview

Web app stile **Jackbox** per un gioco da tavolo digitale su **business e crescita
personale**, da giocare **dal vivo con 3–8 amici**. Uno **schermo comune** (TV / tablet /
portatile, vista `/host`) mostra tabellone, dilemmi e timer; ogni giocatore usa il
**proprio telefono** (vista `/`) per entrare nella stanza e votare.

Questo PRD copre il **primo build**: lo **scheletro comune** (lobby con codice stanza,
realtime host↔telefoni, state-machine di fase, timer lato server) e la prima fase di
gioco, **"Dilemma di gruppo"**. L'esperienza è **social e non competitiva**: niente
vincitore, ma **premi simpatici** a fine partita.

## 2. Goals

- Permettere a un host di aprire una stanza e a 3–8 giocatori di entrare dal telefono con un **codice**.
- Far girare una partita di **N dilemmi configurabile (3 / 4 / 5)** con la fase "Dilemma di gruppo".
- Per ogni dilemma: voto segreto → rivelazione conteggi → difese a tempo → ri-voto → risultati con **swing dei voti**.
- A fine partita mostrare **premi simpatici** (alcuni calcolati dai dati + 1 votato dai giocatori).
- Stack semplice, **senza account né DB**, giocabile sulla **stessa WiFi**, con **timer affidabili** gestiti dal server.

## 3. User Stories

### US-001: Scaffolding del progetto
**Description:** Come sviluppatore, voglio una base monorepo server+client avviabile, così da poter costruirci sopra.

**Acceptance Criteria:**
- [ ] Struttura `server/` (Node + Express + Socket.IO) e `client/` (React + Vite)
- [ ] Script `npm run dev` avvia server + client in sviluppo
- [ ] Il server serve il client buildato in produzione su un'unica porta
- [ ] Lint/format configurati e passano

### US-002: Creazione stanza sull'host
**Description:** Come host, apro `/host` e ottengo una stanza con un codice condivisibile.

**Acceptance Criteria:**
- [ ] Aprendo `/host` il server crea una stanza con **codice di 4 lettere** univoco
- [ ] Lo schermo host mostra il codice in grande **+ QR code** che punta all'URL di join
- [ ] Lo stato stanza è tenuto **in memoria** sul server
- [ ] Verifica in browser (tab host) che codice e QR compaiano

### US-003: Ingresso giocatore dal telefono + lobby realtime
**Description:** Come giocatore, dal telefono entro nella stanza con codice e nickname e mi vedo nella lobby.

**Acceptance Criteria:**
- [ ] La vista `/` chiede **codice stanza + nickname**
- [ ] Codice errato → messaggio d'errore chiaro; codice valido → ingresso in lobby
- [ ] L'elenco giocatori si aggiorna **in realtime** su host e su tutti i telefoni
- [ ] Limite **8 giocatori**; oltre, ingresso bloccato con messaggio
- [ ] Verifica in browser con più tab (1 host + 3 player)

### US-004: Avvio partita + configurazione numero dilemmi
**Description:** Come host, scelgo quanti dilemmi (3/4/5) e avvio quando ci sono almeno 3 giocatori.

**Acceptance Criteria:**
- [ ] Selettore **3 / 4 / 5 dilemmi** sull'host
- [ ] Pulsante "Avvia" attivo solo con **≥3 giocatori** collegati
- [ ] All'avvio la state-machine passa da `LOBBY` a `PHASE_INTRO`

### US-005: State-machine di fase + timer lato server
**Description:** Come sistema, gestisco le transizioni di fase con timer autoritativi trasmessi a tutti.

**Acceptance Criteria:**
- [ ] State-machine con stati: `LOBBY → PHASE_INTRO → DILEMMA_REVEAL → VOTE_1 → SPLIT_REVEAL → DEFENSE → VOTE_2 → PHASE_RESULTS → (loop) → FINAL_AWARDS`
- [ ] Il **countdown** è calcolato dal server e trasmesso a host + telefoni
- [ ] Allo scadere del timer la fase avanza **automaticamente**; l'host può anche forzare l'avanzamento
- [ ] **Unit test** sulle transizioni di stato

### US-006: Caricamento e pesca dei dilemmi
**Description:** Come sistema, carico il deck e pesco dilemmi senza ripetizioni in una partita.

**Acceptance Criteria:**
- [ ] Deck letto da `server/data/dilemmas.json` (≥20 dilemmi, ognuno con testo + opzione A + opzione B)
- [ ] Pesca **casuale senza ripetizioni** entro la stessa partita
- [ ] **Unit test** sulla pesca senza ripetizioni

### US-007: Rivelazione dilemma sull'host
**Description:** Come giocatore, vedo sullo schermo comune il dilemma e le due opzioni.

**Acceptance Criteria:**
- [ ] `PHASE_INTRO` mostra nome fase + regole brevi per pochi secondi
- [ ] `DILEMMA_REVEAL` mostra sull'host **testo del dilemma + opzione A / opzione B**
- [ ] Verifica in browser (tab host)

### US-008: Primo voto segreto dai telefoni
**Description:** Come giocatore, voto A o B in segreto dal telefono.

**Acceptance Criteria:**
- [ ] In `VOTE_1` ogni telefono mostra **A / B** e registra una scelta
- [ ] L'host mostra solo **quanti hanno votato** (es. "5/6"), mai chi cosa
- [ ] Timer ~20s; alla scadenza o quando tutti hanno votato si avanza
- [ ] Voto modificabile finché il timer non scade
- [ ] Verifica in browser con più tab

### US-009: Rivelazione dello split (solo conteggi)
**Description:** Come giocatore, vedo sull'host com'è divisa la stanza, senza sapere chi ha votato cosa.

**Acceptance Criteria:**
- [ ] `SPLIT_REVEAL` mostra **conteggio A vs B** sull'host (es. "A: 4 — B: 2")
- [ ] **Nessuna identità** di voto rivelata
- [ ] Verifica in browser (tab host)

### US-010: Auto-selezione difensori + turni di difesa a tempo
**Description:** Come giocatore selezionato, difendo la mia posizione a voce mentre l'app fa il timer.

**Acceptance Criteria:**
- [ ] In `DEFENSE` il server **auto-seleziona 1 difensore per lato** tra chi ha votato quel lato
- [ ] Se un lato ha 0 voti, si salta il difensore di quel lato
- [ ] Host mostra **chi parla** + countdown **60–90s** per turno; turni in sequenza (un lato poi l'altro)
- [ ] I telefoni dei non-difensori mostrano "sta parlando {nome}"
- [ ] Verifica in browser con più tab

### US-011: Secondo voto segreto + calcolo swing
**Description:** Come giocatore, dopo aver sentito le difese rivoto e posso cambiare schieramento.

**Acceptance Criteria:**
- [ ] In `VOTE_2` ogni telefono rivota A/B (default = voto precedente, modificabile)
- [ ] Il server calcola per ogni votante se ha **cambiato** lato rispetto a `VOTE_1`
- [ ] Calcolo dello **swing netto** verso ciascun lato
- [ ] **Unit test** su conteggio voti e calcolo swing

### US-012: Risultati del dilemma + punteggio difensori
**Description:** Come giocatore, vedo come sono cambiati i voti e chi ha convinto.

**Acceptance Criteria:**
- [ ] `PHASE_RESULTS` mostra sull'host **prima → dopo** (es. "A: 4→2, B: 2→4") e quanti hanno cambiato idea
- [ ] Il difensore di un lato guadagna **+1 punto "convinzione" per ogni voto guadagnato** dal suo lato dopo la difesa
- [ ] Se il difensore difendeva il lato di **minoranza** allo split e ha guadagnato voti, accumula anche punteggio **"provocatore"**
- [ ] **Unit test** sul punteggio difensori

### US-013: Loop dei dilemmi e passaggio ai premi
**Description:** Come sistema, ripeto la fase per N dilemmi poi vado ai premi finali.

**Acceptance Criteria:**
- [ ] Dopo `PHASE_RESULTS`, se restano dilemmi → nuovo `DILEMMA_REVEAL`, altrimenti → `FINAL_AWARDS`
- [ ] I punteggi (convinzione, provocatore) si **accumulano** tra i dilemmi
- [ ] **Unit test** sul loop fino a `FINAL_AWARDS`

### US-014: Premi finali (calcolati + 1 votato)
**Description:** Come gruppo, a fine partita vediamo premi simpatici e ne votiamo uno.

**Acceptance Criteria:**
- [ ] **"Il più convincente"** = giocatore con più punti convinzione (calcolato)
- [ ] **"Il più provocatore"** = giocatore con più punti provocatore (calcolato)
- [ ] **1 premio votato** dai giocatori dal volo (es. "Il più assurdo"): ogni telefono vota un giocatore, l'host mostra il vincitore
- [ ] Gestione **pareggi** definita (es. ex-aequo mostrati entrambi)
- [ ] Schermata host celebrativa con i premi; verifica in browser

### US-015: Riconnessione base
**Description:** Come giocatore che perde la connessione, rientro con lo stesso codice e mantengo identità e punti.

**Acceptance Criteria:**
- [ ] Rientrando con stesso codice + stesso nickname (o token salvato) si **riassocia** al giocatore esistente
- [ ] Punteggi e stato di voto **non si perdono** alla riconnessione
- [ ] Verifica in browser (chiudi e riapri un tab player durante la partita)

## 4. Functional Requirements

- **FR-1:** Il server crea stanze in memoria con codice di 4 lettere univoco; nessun account, nessun DB.
- **FR-2:** I giocatori entrano via `/` con codice + nickname; max 8; lista lobby in realtime via Socket.IO.
- **FR-3:** L'host configura il numero di dilemmi (3/4/5) e avvia con ≥3 giocatori.
- **FR-4:** Una state-machine autoritativa lato server gestisce le fasi e un **timer broadcast** in countdown; allo scadere avanza da sola, l'host può forzare.
- **FR-5:** I dilemmi sono caricati da `dilemmas.json` e pescati senza ripetizioni nella partita.
- **FR-6:** I voti (`VOTE_1`, `VOTE_2`) sono **segreti**; l'host vede solo conteggi/avanzamento, mai chi ha votato cosa.
- **FR-7:** In `DEFENSE` il server auto-seleziona 1 difensore per lato (saltando i lati a 0 voti) con turni a timer 60–90s.
- **FR-8:** Lo scoring: difensore +1 "convinzione" per voto guadagnato dal suo lato dopo la difesa; +"provocatore" se guadagna difendendo la minoranza.
- **FR-9:** A `FINAL_AWARDS`: "più convincente" e "più provocatore" calcolati dai punteggi; +1 premio scelto con voto rapido dei giocatori.
- **FR-10:** Riconnessione: rientro con stesso codice/nickname riassocia identità e preserva punteggi.

## 5. Non-Goals (Out of Scope)

- ❌ Fasi **1vs1** e **Pitch a turno** (PRD successivi).
- ❌ **Account, login, persistenza su DB**, storico partite.
- ❌ **Deploy online** / gioco fuori dalla stessa WiFi (fase successiva).
- ❌ Editor di contenuti o dilemmi custom dei giocatori.
- ❌ Classifica/vincitore competitivo (il gioco resta social).
- ❌ Audio/chat vocale in-app: i dibattiti avvengono **a voce nella stanza**.

## 6. Design Considerations

- Due viste molto diverse: **host** = grande, leggibile a distanza (tabellone, timer, conteggi); **player** = ottimizzata per **telefono** (pochi tap grandi).
- Tono visivo **simpatico e pulito**; rifinitura grafica con la skill `ui-ux-pro-max` in un passaggio dedicato dopo il funzionamento.
- Riuso: un unico modulo `socket` lato client condiviso tra host e player.

## 7. Technical Considerations

- **Stack:** Node.js + Express + Socket.IO (server autoritativo, stato in memoria); React + Vite (client).
- **Struttura:**
  - `server/index.js`, `server/game/rooms.js`, `server/game/stateMachine.js`, `server/game/dilemma.js`, `server/data/dilemmas.json`, `server/game/__tests__/`
  - `client/src/host/`, `client/src/player/`, `client/src/shared/socket.js`
- **Realtime:** il server è la fonte di verità; broadcast dello stato pubblico (no voti individuali) + stato privato per ciascun telefono.
- **Timer:** calcolati sul server (timestamp di scadenza), il client mostra solo il countdown.
- **Run/playtest:** `npm run dev`; host su `http://<IP-LAN>:<porta>/host`, player su `http://<IP-LAN>:<porta>/`.
- **Test:** unit test (Vitest/Jest) su `rooms`, `stateMachine`, `dilemma` (tally, swing, scoring, transizioni).

## 8. Success Metrics

- Un gruppo di 3–8 amici completa una partita intera (N dilemmi + premi) **senza intervento tecnico**.
- I **timer** e i **conteggi** restano coerenti su host e telefoni per tutta la partita.
- I voti restano **segreti** (mai rivelata l'identità del voto).
- Tempo di ingresso giocatore (scansione QR → in lobby) **< 30s**.
- Unit test verdi su tally/swing/scoring/transizioni.

## 9. Open Questions

- Durata esatta dei turni di difesa: **60s o 90s**? (default proponibile: 75s, eventualmente configurabile)
- Categoria del premio votato finale: una fissa ("Il più assurdo") o scelta tra alcune?
- Comportamento se un giocatore si disconnette **mentre è difensore** (saltare il turno?).
- Nome definitivo del gioco (ora provvisorio: "Dibattiti tra amici").
