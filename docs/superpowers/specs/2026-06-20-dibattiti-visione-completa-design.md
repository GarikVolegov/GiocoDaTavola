# Dibattiti tra amici — Visione di gioco completa (design)

> Spec di game design + UX per l'intera esperienza. Fa da cornice alle user story
> tecniche in `prd.json`: non le sostituisce, le inquadra e le estende.
> Data: 2026-06-20 · Stato: approvato in brainstorming, in attesa di review utente.

## 1. Contesto e stato attuale

Party game di conversazione stile Jackbox per **3–8 amici dal vivo**, su **business e
crescita personale**. Schermo comune (`/host`) + telefoni (`/`). Server autoritativo,
stato **in memoria**, **no DB, no account**. Esperienza social, **niente vincitore**,
premi simpatici a fine partita.

Già costruito (US-001→005): scaffolding monorepo TS, lobby con codice 4 lettere + QR,
ingresso da telefono con lobby realtime, avvio partita con 3/4/5 dilemmi, **state-machine
di fase + timer autoritativi lato server**. In corso (Ralph, autonomo): US-006 deck dei
dilemmi, poi US-007→015.

Loop già definito della fase "Dilemma di gruppo":
`DILEMMA_REVEAL → VOTE_1 → SPLIT_REVEAL → DEFENSE → VOTE_2 → PHASE_RESULTS → loop → FINAL_AWARDS`.

## 2. Decisioni di design (la bussola)

| Leva | Scelta |
|---|---|
| Obiettivo | Visione di gioco completa |
| Tono | Equilibrio risate + spunti veri |
| Pubblico | Due registri configurabili: **Vita** / **Business pro** (+ Misto) |
| Struttura | Modulare **"a menu"**: l'host compone la serata |
| Coinvolgimento | **Mix** di round "tutti attivi" e "spotlight", bilanciati dal menu |
| Approccio architetturale | **B — Portfolio di archetipi** su spina dorsale comune, costruito a stadi |
| Deploy | **A — Client su Vercel + server realtime su host always-on** (Render/Railway/Fly) |

## 3. Stella polare (north star)

> In **20–40 minuti**, un gruppo di **3–8 amici** dibatte e si prende in giro su scelte di
> **business e di vita**. Si esce con **qualche risata e qualche spunto vero**. Nessun
> vincitore, ma tutti collezionano **premi simpatici**.

## 4. L'arco della serata — 5 momenti

1. **Lobby** *(già costruito)* — host mostra codice + QR; gli amici entrano dal telefono con un nickname.
2. **Composizione del menù** *(nuovo)* — l'host sceglie registro, durata e quali round; default a un tocco.
3. **Riscaldamento** *(micro, opzionale)* — domanda leggera mentre si aspettano i ritardatari e si verificano i telefoni.
4. **I round** *(il cuore)* — la scaletta scelta; ogni round è un "atto" medio-breve con UI e ritmo familiari.
5. **Cerimonia dei premi** *(evoluzione US-014)* — premi calcolati + almeno uno votato; schermo celebrativo, "nessuno perde".

## 5. I 5 sistemi unificanti (spina dorsale condivisa da tutti i round)

| Sistema | Cosa fa | Stato |
|---|---|---|
| **Registri di contenuto** | Ogni contenuto è taggato Vita o Business pro; il registro filtra il pool ("Misto" alterna) | nuovo |
| **Voti segreti** | Solo aggregati lasciano il server (regola ferma del progetto) | già fatto |
| **Timer autoritativi** | Il server è la verità sul "quando"; i client disegnano il countdown | già fatto |
| **Monete sociali** | Niente punteggio unico: si collezionano gettoni tematici | nuovo (estende lo scoring del Dilemma) |
| **Premi finali** | Alcuni calcolati dai gettoni, almeno uno votato → "tutti vincono qualcosa" | già previsto |

Idea-chiave dello scoring: **tante piccole "valute" invece di una classifica unica**. Niente
vincitore, ma a fine serata ognuno è "il più X" di qualcosa.

## 6. Il guscio "Menù della serata" (pezzo modulare nuovo)

Schermo host **"Componi la serata"** (dopo la lobby, prima del primo round):
- **Registro** — 3 bottoni grandi: `Vita` · `Business pro` · `Misto`.
- **Formato** — preset + personalizza:
  - 🥄 **Assaggio** (~15', 3 round) · 🍽️ **Classica** (~30', 5 round) · 🍷 **Maratona** (~45', 7–8 round) · ⚙️ **Personalizza**
- **Personalizza** — i round-types come *carte* che l'host accoda in scaletta; ogni carta mostra
  durata stimata e icona **🎤 spotlight / ⚡ tutti attivi**. Un indicatore di **ritmo** avvisa se
  si accatastano troppi spotlight di fila.
- **Default a un tocco** — premendo **Inizia** senza toccare niente → `Misto` + `Classica`. Zero attrito.

Telefoni durante la composizione: schermata d'attesa con la domanda di riscaldamento ("L'host sta
preparando il menù… intanto rispondi: …").

Conseguenze tecniche (vedi §12): nuova fase **`SETUP`/`MENU`** prima di `PHASE_INTRO`; nuovo
concetto di **Sessione = sequenza ordinata di round**. Lo state-machine attuale (loop per-Dilemma)
diventa il **sotto-loop di un round**; un orchestratore di sessione gestisce "round successivo →
fine → premi". Riusa al 100% il pattern timer/broadcast esistente.

## 7. La grammatica comune dei round

Ogni round, per quanto diverso, segue la stessa ossatura (familiarità + riuso del motore):

`Regole brevi → Prompt (dal registro) → Input segreto dai telefoni → Reveal (solo aggregati) → Twist opzionale → Gettoni`

**Dettaglio UX trasversale** che risolve il problema dei gruppi da 8: durante ogni momento
"spotlight" (qualcuno parla a voce), i telefoni degli altri mostrano **reazioni rapide**
(👏 🔥 🤔 😂) che galleggiano sullo schermo host in tempo reale. Chi guarda partecipa comunque.

> Nota di astrazione (YAGNI): la grammatica è una **linea guida concettuale**, non un motore
> generico da costruire ora. La si estrae in codice condiviso solo dopo che 2–3 round mostrano
> davvero cosa hanno in comune (evita l'over-engineering dell'approccio C).

## 8. Il portfolio dei round-types

| # | Round | Tipo | Durata | Gettoni | Anima |
|---|---|---|---|---|---|
| 1 | **Dilemma di gruppo** | 🎤+⚡ mix | ~4–5' | 🗣️ Convinzione, 😏 Provocazione | dibattito + cambio d'idea |
| 2 | **In Altre Parole** | ⚡ tutti attivi | ~3–4' | ✍️ Genio, 😂 Comico | scrittura + voto |
| 3 | **La Mente del Gruppo** | ⚡ tutti attivi | ~3' | 🔮 Intuito, 🧩 Pecora nera, 👯 Anima gemella | conoscersi |
| 4 | **Difenditi!** | 🎤 spotlight | ~3–4' | 🎭 Faccia di bronzo, 😂 Comico | sfogo comico |

Mix attivo↔spotlight bilanciato: 2 round "tutti attivi", 1 misto, 1 spotlight. Il menù alterna.

### 1 · Dilemma di gruppo *(già in costruzione — US-006→013)*
Loop: voto segreto A/B → split (conteggi) → 1 difensore per lato difende a tempo → ri-voto → swing.
- **3↔8**: parlano sempre solo 2 persone → resta corto anche in 8; gli altri votano e reagiscono.
- **Vita**: *"Un amico in difficoltà ti chiede un prestito importante: glielo fai?"*
- **Business pro**: *"Un socio bravissimo ma inaffidabile sui tempi: lo tieni o lo mandi via?"*
- Ride con le difese; riflette vedendo quanti cambiano idea.

### 2 · In Altre Parole *(scrivi & vota — il round "tutti attivi" per eccellenza)*
Loop: stesso prompt per tutti → ognuno scrive una frase breve (~60s) → risposte **anonime** sull'host → tutti votano la preferita (e la più assurda).
- **3↔8**: tutti scrivono in parallelo → zero attesa, ideale coi gruppi grandi.
- **Vita**: *"La tua filosofia di vita in uno slogan da maglietta."*
- **Business pro**: *"Vendi in una frase l'oggetto più inutile sulla tua scrivania."*
- Ride con le risposte; riflette su come ragionano gli altri.

### 3 · La Mente del Gruppo *(lo specchio sociale)*
Loop: una domanda dove devi **predire la maggioranza** (o cosa risponderà una persona) *e* rispondere per te → reveal mostra chi "legge" il gruppo e chi è fuori sintonia.
- **3↔8**: tutti rispondono in segreto → tutti attivi; più siete, più è rivelatore.
- **Vita**: *"Soldi o tempo libero: cosa sceglie la maggioranza del tavolo?"*
- **Business pro**: *"La maggioranza licenzierebbe l'amico-dipendente che rende poco?"*
- Ride scoprendo "la pecora nera" e le "anime gemelle"; riflette su quanto siete simili.

### 4 · Difenditi! *(l'avvocato del diavolo — il round-sfogo comico)*
Loop: a turno, a un giocatore tocca difendere ~40s una **tesi volutamente assurda** assegnata a caso → gli altri votano se è stato convincente *nonostante tutto* e reagiscono.
- **3↔8**: a rotazione, dando il palco prima a chi ha parlato meno; in 8 si fanno 2–3 turni.
- **Vita**: *"Difendi: «svegliarsi alle 5 è sopravvalutato»."*
- **Business pro**: *"Difendi: «le riunioni dovrebbero durare tre ore»."*
- Ride tantissimo; riflette poco — è la valvola di sfogo che il menù bilancia.

## 9. Monete sociali + cerimonia dei premi

Catalogo gettoni (ogni round conia valute diverse):

| Gettone | Round | Si guadagna… |
|---|---|---|
| 🗣️ **Convinzione** | Dilemma | difendendo un lato e guadagnando voti |
| 😏 **Provocazione** | Dilemma | difendendo la minoranza e ribaltandola |
| ✍️ **Genio** | In Altre Parole | con la risposta più votata |
| 😂 **Comico** | In Altre Parole / Difenditi! | con la risposta più "assurda/divertente" |
| 🔮 **Intuito** | La Mente del Gruppo | prevedendo bene il gruppo |
| 🧩 **Pecora nera** | La Mente del Gruppo | stando spesso in minoranza |
| 🎭 **Faccia di bronzo** | Difenditi! | convincendo sull'indifendibile |
| 👯 **Anima gemella** *(coppia)* | La Mente del Gruppo | rispondendo identico a qualcuno |

Cerimonia (`FINAL_AWARDS`, evoluzione US-014):
- **Premi calcolati** — per ogni valuta, il leader prende il titolo. Pareggi → ex-aequo mostrati insieme.
- **Premio votato live** — ogni telefono vota un amico per un premio "a sorpresa" pescato a caso
  ("Il più assurdo", "Quello da portarsi in una startup", "Il guru da LinkedIn"). Chiusura partecipata.
- **Garanzia "tutti vincono qualcosa"** — se qualcuno è a secco, scatta un premio-jolly assicurato
  (es. "L'Equilibrista"). Nessuno esce a mani vuote: è il cuore del "niente vincitore".
- **Schermo celebrativo** con coriandoli; i telefoni mostrano "Hai vinto: …". Nessun numero, nessuna classifica.

## 10. Deploy & onboarding (scelta A)

**Topologia**
- **Client** React/Vite → **Vercel** (es. `dibattiti.vercel.app` o dominio custom). È l'URL che aprono host e amici.
- **Server** Node + Socket.IO in-memory → host **always-on** (Render/Railway/Fly free tier), es. `api-dibattiti.onrender.com`.
- **Collegamento** — il client punta al server via `VITE_SOCKET_URL` (env su Vercel); il server abilita
  **CORS** sull'origine Vercel. In dev tutto resta su localhost col proxy attuale.

> Motivazione: Vercel è serverless e **non ospita un server Socket.IO persistente**. La scelta A dà il
> dominio Vercel richiesto senza riscrivere il motore in-memory e senza violare "no DB / no account".

**Onboarding amici ("collegarsi semplici")**
1. Host apre il dominio su `/host` → stanza con **QR grande + codice 4 lettere**.
2. L'amico inquadra il QR → web-app col codice **già inserito** → scrive il nickname → dentro. *Niente app, niente account.*
3. Chi non scansiona digita dominio + codice. Codice **senza caratteri ambigui** (escludere O/0/I/1 dal set).
- Si gioca **via internet**, non più solo stessa WiFi. Tocchi di cura: **icona PWA**, **preview social** del
  link, **schermo host che non va in sleep** durante la partita.

## 11. Dettagli UX trasversali

- **Reazioni dal telefono** (👏🔥🤔😂) durante ogni spotlight → nessuno spettatore passivo.
- **Rispetto dei timidi** — il grosso dei round è voto/scrittura anonimi; "Difenditi!" dà il palco a chi
  ha parlato meno, con timer breve e "passo" leggero.
- **Tono** — voce italiana calda e ironica, mai cinica; "Business pro" credibile ma leggero. Lo spec include
  la mini "bibbia di tono" qui sotto.
- **Edge cases** — min 3 giocatori; disconnessione → il server ricalcola gli aggregati; riconnessione (US-015)
  preserva i gettoni.
- **Ritmo/timer** — durate per-fase server-side; il menù stima la durata totale.

**Mini bibbia di tono (per chi scrive i contenuti)**
- Caldo, complice, da gruppo di amici — non da quiz né da corso di formazione.
- Ironico ma mai cinico o umiliante; si ride *con*, non *contro*.
- "Business pro" credibile e concreto, ma giocato leggero (mai gergo per il gergo).
- Prompt brevi, leggibili a voce alta e da lontano sullo schermo host.
- Italiano, registro informale (tu), niente anglicismi inutili.

## 12. Mappatura sul costruito + ordine di build incrementale

**Resta valido**: US-001→005 (scaffold, lobby, state-machine, timer). US-006→013 → diventano il
**Round 1 (Dilemma)**. US-014 → evolve nella cerimonia a monete sociali. US-015 (riconnessione).

**Nuovo lavoro, a stadi:**
1. **Deploy split** (Vercel client + server always-on + env/CORS) — presto: sblocca il "giocare davvero con gli amici".
2. **Guscio Sessione + Menù** (fase `SETUP`, sessione = sequenza di round, preset, registri Vita/Business pro) — incapsula il loop Dilemma come "un round".
3. **Monete sociali + cerimonia inclusiva**.
4. **Round 2 → 3 → 4**, uno per volta, ciascuno come nuovo round-type sul guscio.
5. *(solo dopo 2–3 round)* estrarre la grammatica comune condivisa in codice.

## 13. Non-obiettivi (YAGNI)

- Niente **motore di round generico** ora (si estrae dopo 2–3 round).
- Niente **DB**, niente **account/login**, niente persistenza tra sessioni.
- Niente **multi-lingua** adesso (solo italiano).
- Niente **versione fisica/print-and-play** (formato digitale).

## 14. Criteri di successo

- Un gruppo da 3 e uno da 8 giocano una serata senza tempi morti né confusione su "cosa devo fare ora".
- Amici nuovi entrano dal telefono in < 30s senza spiegazioni (QR → nickname → dentro), via internet.
- A fine partita **ognuno ha ricevuto almeno un premio**; il tavolo ride e cita qualche spunto.
- L'host compone una serata in pochi tocchi (o parte col default senza pensarci).
- Le regole di progetto restano rispettate: voti segreti, timer server-side, no DB, no account.

## 15. Rischi & mitigazioni

| Rischio | Mitigazione |
|---|---|
| Gruppi da 8 con spettatori passivi | Reazioni dal telefono durante gli spotlight; 2 round su 4 "tutti attivi" |
| Contenuti "Business pro" troppo di nicchia | Registro **Misto** di default; bibbia di tono; pool **Vita** sempre accessibile |
| Over-engineering del "menu"/grammatica | Costruzione a stadi; default a un tocco; estrazione della grammatica solo dopo 2–3 round |
| Free tier del server va in sleep | Server leggero, riconnessione (US-015), eventuale keep-alive; documentare i limiti del tier |
| "Difenditi!" mette a disagio i timidi | Palco a rotazione con priorità a chi ha parlato meno, timer breve, "passo" |

## 16. Domande aperte

Nessuna bloccante. Da decidere in fase di piano: nome di dominio definitivo, scelta finale dell'host
realtime (Render vs Railway vs Fly), e quante carte di contenuto servono per il lancio di ogni round.
