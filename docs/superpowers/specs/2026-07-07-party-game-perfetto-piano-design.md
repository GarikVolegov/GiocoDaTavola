# SCHIERATI → il party game perfetto — analisi e piano di lavoro a step

> Reverse engineering del "party game perfetto per passare tempo di qualità tra amici"
> (curioso, intrattenente, mai noioso/banale/troppo serio, giocabile in qualsiasi numero,
> tante modalità) → gap analysis dell'intero sistema di gioco → piano a fasi.
> Data: 2026-07-07 · Metodo: 18 analisi parallele (8 lettori sul codebase, 5 lenti di
> design, 5 valutazioni per pilastro) + sintesi. · Stato: in attesa di review utente.

## 1. Il metodo: reverse engineering in 5 pilastri

Dai migliori party game dal vivo (Jackbox Quiplash/Fibbage/Trivia Murder Party, Gartic
Phone, Wavelength, Codenames, Werewolf/Two Rooms, Spyfall) sono stati derivati i principi
che rendono una serata "tempo di qualità". I 5 pilastri, con i principi più vincolanti:

**🥁 Ritmo ed energia** — nessun giocatore passivo >30s; input in parallelo, mai in serie;
skip-ahead quando tutti hanno agito, timer come *tetto* (mai come durata); **comprimi
l'input, dilata il reveal** (il reveal è il prodotto: va a beat umani, non ad auto-scroll);
prima azione entro 90s dall'apertura stanza; il ciclo vincente è *partita corta × ripetuta*
(picco → premi → rematch in <90s).

**😂 Umorismo e leggerezza strutturale** — la risata la produce la *meccanica*, non il
contenuto né il talento comico dei giocatori: incongruenza forzata (difendere ciò che non
pensi), anonimato temporaneo con attribuzione differita ("SEI STATO TU?!"), reveal come
numero teatrale, **il fallimento è il contenuto** (chi perde deve ridere più forte di chi
vince), vincoli assurdi che livellano verso il basso e danno l'alibi del ruolo; voto come
applauso, mai come verdetto sulla persona.

**🫂 Dinamiche sociali e momenti memorabili** — spotlight garantito e schedulato per tutti
(anche i timidi, con impalcatura prima del palco); commit privato simultaneo → reveal
aggregato; le domande sono *sulle persone*, non sul mondo; **il gioco deve accorgersi dei
propri momenti e dargli un nome** (è così che nascono gli inside joke); zero eliminazione;
nessuno esce a mani vuote.

**📶 Scalabilità e accessibilità** — separare *produttori* (palco, capienza fissa 2–8) da
*giudici* (voto/scommessa/reazione, capienza illimitata): è il modello audience di Jackbox
che porta il tetto da 8 a 20+; lo spettatore passivo non deve esistere; tempo di fase O(1)
rispetto al numero di giocatori (budget palco fisso); onboarding ≤10s; entrata/uscita a
partita in corso senza rompere il gioco; nessuna attesa bloccante senza timeout.

**🎲 Varietà, curiosità e rigiocabilità** — contenuto come *seme*, mai come battuta già
scritta; il gruppo È il contenuto (UGC + contenuto combinatorio sul roster non si consumano
mai); **varietà vera = verbo diverso** (schierarsi ≠ scrivere ≠ predire ≠ dedurre — le
cornici non bastano); memoria del già-visto tra serate; selettore per *mood* in <30s;
sorpresa strutturale anche alla decima partita (twist pescati a caso).

## 2. Dove sta SCHIERATI oggi (voti per pilastro)

| Pilastro | Voto | Diagnosi in una riga |
|---|---|---|
| 🥁 Ritmo | **6/10** | Ingegneria anti-attesa sopra la media, ma il reveal è strozzato (8s fissi), niente rematch, fasi self-paced senza tetto = ostaggio dell'ultimo distratto. |
| 😂 Umorismo | **4.5/10** | L'impianto (anonimato, premi-superlativo) è pronto, ma **il motore comico non esiste**: 316/316 dilemmi seri, difesa = interrogazione di retorica, fallimento muto. |
| 🫂 Social | **7/10** | Nucleo da manuale (voto segreto → reveal → ribaltone), ma i momenti migliori non vengono cerimoniati né nominati, e non c'è garanzia di spotlight/premio per tutti. |
| 📶 Scala | **6/10** | Onboarding da benchmark, ma il gioco reale copre solo 3–8: il 9° amico riceve ROOM_FULL, in 2 c'è solo il Duello (monco senza TV), palco che cresce linearmente con N. |
| 🎲 Varietà | **6/10** | Ciclo di curiosità eccellente, ma Classica/Percorso/Storie condividono la stessa identica sequenza (verbo unico: "schierati e difendi"), zero memoria tra serate. |

**Punti di forza da non toccare**: voti segreti aggregati (commit→reveal è il cuore giusto),
early-advance reale, difese self-paced con floor/cap e "Ho finito", rotazione equa dei
difensori, onboarding QR ~10s con riconnessione token, twist innestati nel dispatcher
(Diavolo/Quanto-mi-conosci/Infiltrato), escalation di complessità come arco drammatico,
design system e audio ben ingegnerizzati.

**La sintesi in una frase**: il gioco ha costruito benissimo *l'input e la profondità*, ma
sottofinanzia *il payoff e la leggerezza* — paga tutto il costo della suspense (5 fasi di
attesa) e poi taglia il momento in cui il gruppo ride (reveal 8s, nessun rematch, nessun
nome ai momenti), con un solo verbo di gioco e un solo tono (serio).

## 3. Approcci considerati

1. **Fun-first a strati (SCELTO)** — prima incassare il divertimento già costruito
   (anti-stallo + reveal teatrale + rematch), poi aggiungere leggerezza, scala, secondo
   verbo, memoria. Ogni fase è spendibile da sola e verificata con un playtest dal vivo.
   *Pro*: valore immediato a ogni step, rischio basso, rispetta il costruito. *Contro*:
   la "novità grossa" (nuovi round-type) arriva solo in fase 4.
2. **Mode-expansion-first** — costruire subito i round-type mancanti della visione (In
   Altre Parole, Mente del Gruppo). *Pro*: varietà percepita subito. *Contro*: nuovi round
   montati su un payoff strozzato ereditano gli stessi difetti (reveal tagliato, stalli);
   si moltiplica il lavoro di rifinitura.
3. **Tone-rewrite-first** — rifare i contenuti in chiave comica. *Pro*: attacca il voto
   più basso (4.5). *Contro*: da solo non basta (il problema è strutturale, non solo di
   contenuto) e rischia di snaturare l'identità "risate + spunti veri" che è il
   differenziatore di SCHIERATI rispetto ai clone-Jackbox.

**Principio guida del piano**: SCHIERATI non deve *diventare* Quiplash. La profondità è il
suo differenziatore. Deve però smettere di essere *solo* profondo: la leggerezza diventa
una **scelta di mood del gruppo** (registro leggero, sorbetti nel pacing, twist comici) e
una **proprietà strutturale** (fallimento-payoff, vincoli assurdi, reveal teatrali), mai
un obbligo. "Si ride *con*, non *contro*" resta legge.

## 4. Piano di lavoro a step

Ogni fase: TDD sul server, gate completo (`typecheck`+`lint`+`test`+`build`) prima di ogni
commit, push a fine lavoro, **playtest dal vivo come criterio di uscita** (il divertimento
non si verifica coi test unitari). Ogni fase riceverà il suo piano di implementazione
dettagliato (writing-plans) prima di toccare codice.

### FASE 0 — Il gioco non si ferma mai (anti-stallo) · ~1–2 giorni · 🥁📶

Elimina ogni modo in cui la serata si congela. Tutti interventi piccoli e chirurgici.

| # | Step | Dove |
|---|---|---|
| 0.1 | **Soft-timeout sulle fasi self-paced**: quando ~70% ha agito parte un countdown visibile 45–60s; allo scadere auto-default (VOTE_2 = conferma voto esistente, PREDICT = pronostico sul lato in testa + "regge", SPEAKER_VOTE = astensione). L'early-advance resta il percorso normale. | `phases.ts:66-98`, `index.ts` |
| 0.2 | **Mostrare CHI manca** ("Aspettiamo Marco e Giulia…") al posto del solo X/Y — solo dove l'aver-agito non rivela il lato. | `VoteView/PredictView` |
| 0.3 | **Difensore disconnesso mai sul palco**: filtro `connected` in `selectDefenders` + turno trattato come bot/skip in `armTurn`. | `defenseSetup.ts:22,41` |
| 0.4 | **Turni bot 60s→20s** e **"Ho finito ▶" nel Duello** (floor 15s, riuso `defenseTurns`). | `phases.ts:58,94` |
| 0.5 | **Leadership migra anche su disconnessione** (a grace scaduta, non solo su leave). | `rooms.ts:1793` |
| 0.6 | **Cap coda INTERVENTI** (max 3 per difesa; gli altri: "coda piena — reagisci!"). | `rooms.ts:1062` |
| 0.7 | **"Salta ▶" con conferma a 2 tap** sulle fasi di voto segreto in corso. | `PlayerApp.tsx:580` |
| 0.8 | Unificare la condizione di avanzamento del know-round (doppio gate ambiguo). | `index.ts:740,759` |

*Criterio di uscita*: partita da 8 con un telefono "morto" a ogni fase → nessuno stallo
oltre 60s, mai palco vuoto.

### FASE 1 — Incassare il divertimento: reveal teatrale + rematch · ~2–3 giorni · 🥁😂🫂

Il payoff smette di essere tagliato. È la fase col miglior rapporto valore/costo del piano.

| # | Step | Dove |
|---|---|---|
| 1.1 | **Rematch a un tap**: "Giocate ancora ▶" a FINAL_AWARDS → stanza torna in LOBBY con stesso roster/codice/setup, deck che esclude i dilemmi appena giocati. Cerimonia premi chiusa in ≤90s col prompt già a schermo. | `rooms.ts`, `StatusView.tsx:251` |
| 1.2 | **Reveal a beat umani**: countdown collettivo 3-2-1 prima di SPLIT_REVEAL; PHASE_RESULTS in 2–3 beat leader-paced con floor (1: swing che si anima lentamente con suspense · 2: attribuzione "le difese di X hanno spostato N voti" + confetti · 3: esiti privati) e fallback timer se il leader dorme. Confetti anche sui telefoni. | `phases.ts:79`, `PublicViews.tsx` |
| 1.3 | **Il ribaltone ha un nome**: quando il lead si capovolge o switched≥2, titolo a schermo intero "IL RIBALTONE DI MARCO" + SFX dedicato. | `publicSwing`, UI |
| 1.4 | **Applausometro di fine difesa**: "Marco: 👏×8 🔥×5" per 3s su host e telefoni (dati già raccolti per il Beniamino). | `reactions.ts`, UI |
| 1.5 | **Reveal dell'autore** del dilemma scritto in lobby a PHASE_RESULTS ("Indovinate chi l'ha scritto… ✍️ SARA!"). | `roundStats.ts:83`, UI |
| 1.6 | **Vista pubblico ricca durante DEFENSE**: dilemma + lato difeso sempre visibili sul telefono di chi ascolta. | `DefenseView.tsx:140` |
| 1.7 | **Vibrazione countdown** ultimi 5s di ogni timer su tutti i telefoni. | client (ha già `phaseExpiresAt`) |

*Criterio di uscita (playtest)*: al reveal tutte le teste si alzano; il gruppo commenta il
ribaltone prima che la schermata cambi; a fine partita si riparte senza ri-scansionare QR.

### FASE 2 — Il permesso di ridere (leggerezza strutturale) · ~3–5 giorni · 😂

Attacca il voto più basso. La leggerezza come scelta di mood + struttura, non un reskin.

| # | Step | Dove |
|---|---|---|
| 2.1 | **Deck "sorbetto"**: 60–80 micro-dilemmi leggeri/assurdi a posta bassa e frizione alta (ananas sulla pizza; il resuscitato paga gli arretrati di Netflix?) con tier sotto "alto". **Regole di pacing**: round 1 sempre leggero, mai due max/power consecutivi, power mai primo né ultimo senza scelta esplicita. | `dilemmas.json`, `dilemmaPlan.ts` |
| 2.2 | **Selettore per mood**: "Serata leggera / Mista / Profonda" nel setup (3 bottoni, default Mista) + flag "tema delicato" sui power più pesanti (eutanasia, lutto) con opt-in. | `LeaderSetup.tsx`, `deck.ts` |
| 2.3 | **Vincoli assurdi di difesa** (1 round su ~3, estratto a caso): "Difendila come un venditore di materassi", "senza mai dire la parola soldi". Livella verso il basso, alibi del ruolo: il timido produce il momento memorabile. | `defenseSetup.ts`, viste |
| 2.4 | **Il fallimento diventa contenuto**: beat "gli ingenui del round" con fanfara ironica (trombone-wah); titoli autoironici sul telefono di chi perde la scommessa ("Visionario del passato 🔮💥") invece del ❌ muto. | `predictions.ts`, UI, audio |
| 2.5 | **Nessuno a mani vuote**: pool di premi-jolly calcolati dalle stats già raccolte ("Il Fulmine: primo a votare 4 volte", "La Sfinge: mai cambiato idea") per chi chiude a zero. | `awards.ts:99-154` |
| 2.6 | **SPEAKER_VOTE riformulato da verdetto ad applauso** ("chi ti ha strappato l'applauso?") + skip del tap forzato quando il difensore ha un solo target possibile. | `speakerVote.ts`, UI |

*Criterio di uscita (playtest)*: almeno 3 risate di gruppo *prodotte dalla struttura* (non
dal talento di qualcuno) in una partita Classica da 5 round; il round 1 scalda invece di
zavorrare.

### FASE 3 — Qualsiasi numero di amici (2→20) · ~4–6 giorni · 📶

Dal range rigido 3–8 al "chiunque sia in stanza gioca".

| # | Step | Dove |
|---|---|---|
| 3.1 | **Ruolo Pubblico 🎟️** (dal 9° in poi, stesso QR): vota (mostrato accanto a quello dei giocatori), scommette sul ribaltone, reagisce, vota l'oratore — non difende mai. Produttori cappati, giudici illimitati: tetto effettivo 20+. | `rooms.ts:73,1762`, viste |
| 3.2 | **Late-join di prima classe**: chi entra a partita in corso è Pubblico nel round corrente e viene promosso a giocatore al confine del round successivo; mai dentro i gate `allVoted` del round in corso; guard sul Duello. | `rooms.ts:1748`, `duel.ts` |
| 3.3 | **Budget palco O(1)**: default difesa 90s (180 come opzione "serata lunga"), interventi già cappati (0.6); con 7+ giocatori difese a coppie (opzione squadre come spugna di scala). | `phases.ts:54`, `defenseSetup.ts` |
| 3.4 | **In 2 si gioca davvero**: Duello completato phone-first (viste telefono per DUEL_REVEAL/RESULT/FINAL_DUEL — oggi dicono "guarda lo schermo") + hint automatico "Siete in 2: Duello?" + preset "2 umani + 2 bot" con difese AI attive e turni bot corti. | `StatusView.tsx:337`, `aiDefense.ts` |
| 3.5 | **addBot a partita iniziata** (al confine del round) per reintegrare i drop-out. | `rooms.ts:1809` |
| 3.6 | **Modulo unico "regole per N"** (durate, difensori, tetti, soglie promozione pubblico) testato agli estremi: 1+bot, 2, 3, 5, 8, 12, 20. | nuovo modulo in `game/` |

*Criterio di uscita*: il 9° amico entra e partecipa in <10s; una partita in 12 tiene round
sotto i 7 minuti; il primo contatto in 2 ("proviamolo io e te") è un gioco vero.

### FASE 4 — Varietà vera: un secondo verbo + sorpresa perpetua · ~5–8 giorni · 🎲😂

Il catalogo smette di essere lo stesso gioco con tre cornici. Recupera la visione originale §8.

| # | Step | Dove |
|---|---|---|
| 4.1 | **Round "tutti attivi" #1 — La Mente del Gruppo**: ogni 2–3 dilemmi un round breve dove TUTTI predicono in parallelo (la risposta della maggioranza, o di un bersaglio) → reveal aggregato. Azzera il downtime dei gruppi grandi, riusa commit→reveal. | nuovo round-type |
| 4.2 | **Round "scrittura" #2 — In Altre Parole / Fibbage-sul-gruppo**: tutti scrivono in parallelo (lo slogan del lato opposto; o "come risponderebbe Anna?" con risposte esca) → voto anonimo → reveal in due tempi. Il secondo verbo (scrivere) + motore Quiplash. | nuovo round-type |
| 4.3 | **Pool di twist a sorpresa** (modello Trivia Murder Party): 4–6 twist iniettabili in qualsiasi round — "difesa in 30s netti", "voto pesato: i cambiati valgono doppio", "difendi con una parola sola", "scegli per il tuo vicino" — con dial "caos" nel setup; Diavolo ripetibile, 1–2 twist anche in Assaggio. | dispatcher `rooms.ts` |
| 4.4 | **Selettore pulito**: Duello di primo livello, mood (2.2) in prima riga, fine del doppio "Classica", pill Storie coi generi reali, avviso quando un format scarta i dilemmi dei giocatori. | `LeaderSetup.tsx` |
| 4.5 | **Infiltrato col merito**: 1 strumento attivo per round (es. spunto-esca seminato tra i suggerimenti del difensore avversario), flip contati solo se ha agito, smascheramento in 2 atti (processo a voce 60–90s → voto → reveal con replay delle sue mosse). | `infiltrato.ts`, `roundStats.ts:61` |

*Criterio di uscita (playtest)*: alla seconda partita consecutiva dello stesso gruppo
succede almeno una cosa mai vista nella prima; i nuovi round-type vengono richiesti ("ancora
quello dove si scrive!").

### FASE 5 — Rigiocabilità e memoria del gruppo · ~3–5 giorni · 🎲🫂

Il gioco ricorda, il gruppo colleziona.

| # | Step | Dove |
|---|---|---|
| 5.1 | **Memoria del già-visto**: subito `excludeIds` da localStorage del leader; poi server-side per gruppo ricorrente (fingerprint roster / token Clerk, su Neon già esistente). | `deck.ts`, `db.ts` |
| 5.2 | **UGC di prima classe**: dilemmi dei giocatori distribuiti lungo la partita (non bruciati in testa), mai scartati in silenzio, premio "Spacca la stanza" per il dilemma più vicino al 50/50 (sposta l'incentivo su "controverso e divertente"). | `dilemmaPlan.ts:36`, `awards.ts` |
| 5.3 | **Contenuto combinatorio sul roster**: dilemmi-template coi nomi dei giocatori ("Marco eredita 50k: cosa ci fa?", "a chi del gruppo affideresti…") — contenuto che non si consuma mai. | nuovo tipo in `dilemmas.json` |
| 5.4 | **Igiene del pool**: tag "famiglia" sui quasi-duplicati (max 1 per famiglia a partita), campo bilanciamento atteso A/B contro i dilemmi unanimi che uccidono il round. | `dilemmas.json`, `deck.ts` |
| 5.5 | **Momenti nominati + recap**: rilevatore server-side (plebiscito, 50/50, ribaltone del lead, tripla persuasione) → titolo+suono quando accadono → "I momenti della serata" prima dei premi + una riga per OGNI giocatore. Artefatto condivisibile (il motore di passaparola). | `roundStats.ts`, `awards.ts`, UI |
| 5.6 | **Contenuti in ampiezza**: 2–3 Storie brevi (20–30 min) leggere/avventurose; carriera 12→40+; escalation vera per business. | `stories.json`, `dilemmas.json` |

*Criterio di uscita*: seconda serata dello stesso gruppo senza un solo déjà-vu; a fine
partita il gruppo rilegge/condivide il recap.

### FASE 6 — Energia collettiva (audio distribuito + tre atti) · ~2–4 giorni · 🥁😂

| # | Step | Dove |
|---|---|---|
| 6.1 | **Audio su tutti i telefoni**: broadcast dei cue via socket (tick finali, stinger reveal, fanfara-fallimento) riprodotti dal motore Web Audio già esistente; musichetta resta sul solo leader (no cacofonia). | `host/audio/`, socket |
| 6.2 | **Struttura a 3 atti**: round finale speciale (posta doppia sulle scommesse, o Diavolo sempre penultimo) così l'energia sale per design e non solo per contenuto. | `dilemmaPlan.ts`, dispatcher |
| 6.3 | **Fallback narratore** per Storie/Percorso: indicatore di progresso per gli altri + ripresa da nuovo leader senza perdere il beat. | `phases.ts:86`, `rooms.ts` |

## 5. Ordine, misure e traguardi

**Perché quest'ordine**: 0 e 1 moltiplicano il valore di tutto il resto (ogni round di ogni
modalità passa dal reveal e dal non-stallo) e costano poco; 2 sblocca il pubblico "voglio
solo ridere"; 3 apre il gioco a qualsiasi gruppo reale; 4–5 comprano la decima serata; 6
rifinisce l'energia. Dopo la Fase 2 il gioco è già "mai noioso, mai troppo serio"; dopo la
3 è "per qualsiasi numero"; dopo la 4–5 ha "tante modalità e ampia scelta" vere.

**Misure per pilastro** (target dopo Fase 5): Ritmo 6→9 · Umorismo 4.5→8 · Social 7→9 ·
Scala 6→9 · Varietà 6→8.5. Metriche osservabili nei playtest: nessun giocatore passivo
>60s; ≥3 risate strutturali a partita; 100% giocatori con ≥1 premio/menzione; round ≤7 min
anche in 12; rematch avviato in <90s dal finale.

**Regole ferme che il piano NON tocca**: voti segreti (solo aggregati fuori dal server),
timer computati server-side, niente `any`, CJS/ESM separati, niente `git add -A`, gate
verde prima di ogni commit, push a fine lavoro.

**Non-obiettivi (YAGNI)**: nessun motore di round generico "in anticipo" (si estrae solo
dopo il secondo round-type funzionante), niente multi-lingua, niente moderazione automatica
UGC, niente ranking/classifiche competitive, niente app native.

## 6. Domande aperte (non bloccanti per Fase 0–1)

1. **Quanto spingere la comicità** (Fase 2): i "sorbetti" assurdi convivono col brand
   "elevated night" come *mood selezionabile* — ok, o preferisci un sotto-brand visivo per
   la serata leggera?
2. **Chi scrive i contenuti leggeri**: 60–80 sorbetti + storie brevi posso generarli io
   seguendo la bibbia di tono (§11 della visione), con tua review editoriale finale.
3. **Range giocatori target**: il piano assume 2–20 (Pubblico oltre l'8°). Confermi che
   20 basta (feste), o serve pensare a 30+ (eventi)?
4. **Registro carriera** (ponte NorthStar): l'espansione 12→40 è in Fase 5.6 con priorità
   media — se il funnel marketing preme, si può anticipare senza toccare il resto.
