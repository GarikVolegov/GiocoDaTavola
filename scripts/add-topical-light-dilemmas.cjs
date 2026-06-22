// Append a balanced batch of CONTEMPORARY ("attuali") and LIGHT table ("leggeri")
// dilemmas to server/data/dilemmas.json. Each carries a best-fit `tappa` and a
// `register`, so it enriches BOTH the Percorso ascent and the Classic pools.
// Idempotent: drops any previously-added a-/l-series first, then re-appends.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server', 'data', 'dilemmas.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

/** @type {{id:string,tappa:number,register:'vita'|'business',text:string,optionA:string,optionB:string,spuntiA:string[],spuntiB:string[]}[]} */
const NEW = [
  // ===================== ATTUALI (contemporanei) =====================
  // -- Tappa 1: vita digitale quotidiana --
  {
    id: 'a01', tappa: 1, register: 'vita',
    text: 'Disattiveresti per sempre tutti i social, anche a costo di tagliarti fuori da qualche amicizia e occasione?',
    optionA: 'Sì: mi riprendo la testa',
    optionB: 'No: oggi tagliarsi fuori è isolarsi',
    spuntiA: ['La pace mentale vale più dei like', 'Le amicizie vere reggono senza app', 'Riavrei tempo e attenzione'],
    spuntiB: ['Oggi i social sono la piazza', 'Sparire chiude porte di lavoro', 'Si possono usare senza esserne schiavi'],
  },
  {
    id: 'a02', tappa: 1, register: 'vita',
    text: 'Terresti un archivio totale della tua vita (ogni messaggio, ricerca, spostamento) da rivedere, sapendo che qualcuno potrebbe vederlo?',
    optionA: 'Sì: la mia memoria totale vale il rischio',
    optionB: 'No: certe cose è meglio dimenticarle',
    spuntiA: ['Ricordare tutto è un superpotere', 'I ricordi sfumano, i dati no', 'Chi non nasconde nulla non teme'],
    spuntiB: ['Dimenticare è una forma di libertà', 'Una vita registrata è ricattabile', 'Nessun archivio resta davvero privato'],
  },
  {
    id: 'a03', tappa: 1, register: 'vita',
    text: 'Metteresti in casa un assistente smart che ti semplifica la vita ma ti ascolta sempre?',
    optionA: 'Sì: la comodità batte la paranoia',
    optionB: 'No: casa è l’ultimo posto senza orecchie',
    spuntiA: ['Mi semplifica davvero le giornate', 'Tanto siamo già ascoltati ovunque', 'Niente da nascondere tra le mura di casa'],
    spuntiB: ['Casa deve restare un rifugio', 'Ci si abitua a essere spiati', 'Nessuna comodità vale il microfono fisso'],
  },
  // -- Tappa 2: AI, lavoro, tecnologia --
  {
    id: 'a04', tappa: 2, register: 'business',
    text: 'Useresti l’intelligenza artificiale per fare il lavoro creativo per cui ti pagano, spacciandolo per tuo?',
    optionA: 'Sì: conta il risultato, non lo strumento',
    optionB: 'No: è un inganno verso chi mi paga',
    spuntiA: ['Lo strumento non toglie valore al risultato', 'Chi non si adatta resta indietro', 'Anche la calcolatrice un tempo era “barare”'],
    spuntiB: ['Spacciarlo per mio è una bugia', 'Mi pagano per la mia mente, non per copiarla', 'Così svaluto chi crea davvero'],
  },
  {
    id: 'a05', tappa: 2, register: 'business',
    text: 'Un’azienda ti paga il 30% in più ma ti traccia tutto il giorno: schermo, tempi, persino il tono.',
    optionA: 'Accetto: controllo in cambio di stipendio',
    optionB: 'Rifiuto: nessuna cifra compra la mia libertà',
    spuntiA: ['Lavoro bene, non ho nulla da temere', 'Il 30% in più cambia la vita', 'Il controllo c’è già ovunque'],
    spuntiB: ['Essere tracciati spegne le persone', 'La fiducia non si compra a percentuale', 'Oggi il tono, domani i pensieri'],
  },
  {
    id: 'a06', tappa: 2, register: 'business',
    text: 'Sai che l’AI renderà inutile il tuo mestiere in pochi anni.',
    optionA: 'Mi reinvento ora, anche se fa paura',
    optionB: 'Spremo il mio mestiere finché rende',
    spuntiA: ['Chi anticipa il cambiamento lo cavalca', 'Aspettare è arrivare ultimi', 'Meglio reinventarsi da forti che da disperati'],
    spuntiB: ['Anni di certezze non si buttano', 'Inseguire ogni novità logora', 'Il mio mestiere ha ancora valore oggi'],
  },
  {
    id: 'a07', tappa: 2, register: 'vita',
    text: 'Affideresti a un algoritmo le tue scelte importanti, sapendo che decide meglio ma non capisci come?',
    optionA: 'Sì: i risultati parlano da soli',
    optionB: 'No: non mi fido di una scatola nera',
    spuntiA: ['I numeri non hanno emozioni che sbagliano', 'Capire ogni cosa è un lusso che costa', 'I dati battono il mio istinto'],
    spuntiB: ['Non affido ciò che non capisco', 'Una scatola nera non risponde degli errori', 'Certe scelte devono restare mie'],
  },
  {
    id: 'a08', tappa: 2, register: 'vita',
    text: 'Lavoreresti per sempre da remoto, comodissimo, senza vedere mai i colleghi di persona?',
    optionA: 'Sì: libertà e tempo guadagnato',
    optionB: 'No: il lavoro è anche le persone',
    spuntiA: ['Niente pendolarismo è una vita migliore', 'Si può legare anche a distanza', 'La libertà di luogo non ha prezzo'],
    spuntiB: ['Da uno schermo non nasce una squadra', 'L’isolamento logora più della comodità', 'Le idee migliori nascono di persona'],
  },
  // -- Tappa 3: genitori, relazioni online --
  {
    id: 'a09', tappa: 3, register: 'vita',
    text: 'Pubblicheresti online foto e momenti dei tuoi figli, prima che possano dire la loro?',
    optionA: 'Sì: è la mia famiglia e i miei ricordi',
    optionB: 'No: la loro impronta digitale è una scelta loro',
    spuntiA: ['Condividere la gioia è naturale', 'Sono i miei ricordi da custodire', 'Cresceranno e capiranno l’affetto'],
    spuntiB: ['La loro vita online non è mia da decidere', 'Quelle foto resteranno per sempre', 'Il consenso vale anche per i figli'],
  },
  {
    id: 'a10', tappa: 3, register: 'vita',
    text: 'Un amico viene “cancellato” online per qualcosa che ha detto anni fa.',
    optionA: 'Lo difendo: nessuno è la sua frase peggiore',
    optionB: 'Non mi espongo: non sta a me',
    spuntiA: ['Le persone cambiano, il branco no', 'Un amico si difende quando è solo', 'Il giudizio di massa raramente è giusto'],
    spuntiB: ['Espormi non lo aiuta, mi travolge', 'Non conosco tutta la storia', 'Certe battaglie non sono le mie'],
  },
  {
    id: 'a11', tappa: 3, register: 'vita',
    text: 'Controlleresti il telefono del tuo partner se fossi certo di non venire mai scoperto?',
    optionA: 'Sì: meglio sapere che vivere nel dubbio',
    optionB: 'No: nel momento in cui controllo, la fiducia è già morta',
    spuntiA: ['La verità vale più della mia tranquillità', 'Se non nasconde nulla, nulla cambia', 'Il dubbio avvelena più della verità'],
    spuntiB: ['Controllare è aver già perso la fiducia', 'La privacy esiste anche in coppia', 'Cercare prove dice più di me che di lui'],
  },
  {
    id: 'a12', tappa: 3, register: 'vita',
    text: 'A che età daresti lo smartphone a tuo figlio?',
    optionA: 'Presto, come tutti: escluderlo lo penalizza',
    optionB: 'Il più tardi possibile: prima la protezione',
    spuntiA: ['Restare fuori dal gruppo isola più del telefono', 'Lo userà comunque: meglio guidarlo', 'La tecnologia è il loro mondo'],
    spuntiB: ['L’infanzia non ha bisogno di uno schermo', 'Più tardi arriva, più sano cresce', 'Proteggere viene prima di accontentare'],
  },
  // -- Tappa 4: società, futuro, eredità digitale --
  {
    id: 'a13', tappa: 4, register: 'vita',
    text: 'Faresti un figlio sapendo le condizioni del mondo che gli lasceresti?',
    optionA: 'Sì: la vita merita comunque di essere data',
    optionB: 'No: non è giusto scegliere per chi non c’è ancora',
    spuntiA: ['Ogni generazione ha temuto la fine', 'La vita trova sempre una strada', 'Crescere figli buoni è migliorare il mondo'],
    spuntiB: ['Non posso imporre un mondo che peggiora', 'Un figlio lo si vuole anche per sé', 'Amare è non far nascere nella sofferenza'],
  },
  {
    id: 'a14', tappa: 4, register: 'vita',
    text: 'Vorresti che la tua identità digitale (chat, foto, voce) restasse “viva” dopo la tua morte, per chi ti ama?',
    optionA: 'Sì: sarei ancora un po’ con loro',
    optionB: 'No: lasciatemi andare davvero',
    spuntiA: ['Un conforto per chi resta non fa male', 'La memoria è un dono ai vivi', 'Sopravvivere un po’ è umano'],
    spuntiB: ['Un fantasma digitale impedisce il lutto', 'Voglio essere ricordato, non simulato', 'Morire è anche lasciare spazio'],
  },
  {
    id: 'a15', tappa: 4, register: 'vita',
    text: 'Vivresti fino a 150 anni se significasse veder morire prima tutte le persone che ami?',
    optionA: 'Sì: il tempo è il dono più grande',
    optionB: 'No: sopravvivere a tutti è una condanna',
    spuntiA: ['Avrei tempo per mille vite', 'Conoscerei figli e nipoti lontani', 'La vita è sempre meglio della fine'],
    spuntiB: ['Restare solo non è vivere', 'Seppellire tutti è una pena infinita', 'La vita ha senso perché finisce'],
  },

  // ===================== LEGGERI (da tavola, non banali) =====================
  {
    id: 'l01', tappa: 1, register: 'vita',
    text: 'Preferiresti avere sempre ragione ma perdere ogni discussione, o vincere sempre pur avendo torto?',
    optionA: 'Aver ragione, anche se non me la riconoscono',
    optionB: 'Vincere: la percezione è tutto',
    spuntiA: ['La verità conta più dell’applauso', 'So io come stanno le cose', 'Vincere col torto è vuoto'],
    spuntiB: ['Nel mondo conta come appari', 'Aver ragione e perdere è frustrante', 'La percezione muove tutto'],
  },
  {
    id: 'l02', tappa: 1, register: 'vita',
    text: 'Se potessi, leggeresti il finale di una storia prima di iniziarla?',
    optionA: 'Sì: mi godo il viaggio senza ansia',
    optionB: 'No: la sorpresa è metà del piacere',
    spuntiA: ['Senza ansia gusto i dettagli', 'Una bella storia resta bella, spoiler o no', 'Controllare il finale è rilassante'],
    spuntiB: ['La sorpresa è il sale del racconto', 'Sapere prima rovina la tensione', 'Vivere senza spoiler è vivere meglio'],
  },
  {
    id: 'l03', tappa: 1, register: 'vita',
    text: 'Preferiresti capire sempre quando qualcuno ti mente, o non riuscire mai a mentire tu?',
    optionA: 'Voglio fiutare ogni bugia',
    optionB: 'Preferisco essere sempre sincero',
    spuntiA: ['Sapere chi mente mi protegge', 'La verità altrui è potere', 'Meglio disilluso che ingenuo'],
    spuntiB: ['Una bugia a volte salva la serata', 'Non poter mentire mi rende libero', 'Smascherare tutti rovina i rapporti'],
  },
  {
    id: 'l04', tappa: 1, register: 'vita',
    text: 'Un lavoro noioso coi colleghi migliori del mondo, o il lavoro dei sogni ma in totale solitudine?',
    optionA: 'Colleghi top, anche se mi annoio',
    optionB: 'Lavoro dei sogni, anche da solo',
    spuntiA: ['Le persone fanno la giornata', 'Si ride anche nel lavoro più piatto', 'Da soli anche il sogno stanca'],
    spuntiB: ['Fare ciò che amo mi riempie', 'I colleghi vanno e vengono, la passione resta', 'Il talento ha bisogno del suo spazio'],
  },
  {
    id: 'l05', tappa: 1, register: 'vita',
    text: 'Rivivresti all’infinito lo stesso anno bellissimo, o una vita normale che non si ripete mai?',
    optionA: 'L’anno perfetto, per sempre',
    optionB: 'La vita vera, imperfetta e unica',
    spuntiA: ['La perfezione vale la ripetizione', 'Niente dolore, solo il meglio', 'Chi rifiuterebbe il paradiso?'],
    spuntiB: ['Ripetersi non è vivere', 'L’imprevisto dà sapore', 'Anche il bello stanca, se eterno'],
  },
  {
    id: 'l06', tappa: 1, register: 'vita',
    text: 'Resteresti giovane nel corpo con una mente che invecchia, o giovane di mente in un corpo che cede?',
    optionA: 'Corpo giovane, mente che matura',
    optionB: 'Mente giovane, corpo che invecchia',
    spuntiA: ['Il corpo è ciò che vivo ogni giorno', 'Energia e salute battono tutto', 'Una mente saggia in un corpo sano è il sogno'],
    spuntiB: ['La curiosità giovane tiene vivi', 'La mente fa chi sei', 'Un corpo stanco ma una testa accesa vince'],
  },
  {
    id: 'l07', tappa: 1, register: 'vita',
    text: 'Diresti sempre la tua vera età a tutti, o terresti tutti nel dubbio per sempre?',
    optionA: 'Sempre la verità: l’età è un numero',
    optionB: 'Nel dubbio: è più divertente',
    spuntiA: ['Niente da nascondere, niente da temere', 'L’età non mi definisce', 'La sincerità è riposante'],
    spuntiB: ['Un po’ di mistero è simpatico', 'Ti trattano come ti vedono', 'Il dubbio è un gioco innocuo'],
  },
  {
    id: 'l09', tappa: 1, register: 'vita',
    text: 'Conosceresti la risposta a qualsiasi domanda, ma senza poterla mai condividere con nessuno?',
    optionA: 'Sì: sapere mi basta',
    optionB: 'No: il sapere ha senso solo se condiviso',
    spuntiA: ['Conoscere è già un privilegio', 'Mi guiderebbe in ogni scelta', 'Il sapere è un piacere anche privato'],
    spuntiB: ['Sapere e tacere è una prigione', 'La conoscenza serve se illumina altri', 'Che gusto avere ragione da soli e zitti?'],
  },
  {
    id: 'l10', tappa: 1, register: 'vita',
    text: 'Potresti dimenticare a comando qualsiasi cosa, o non dimenticare mai più nulla?',
    optionA: 'Dimenticare ciò che voglio',
    optionB: 'Ricordare tutto per sempre',
    spuntiA: ['Cancellare il dolore a comando è pace', 'Si vive meglio leggeri', 'L’oblio è un dono sottovalutato'],
    spuntiB: ['Ogni ricordo è un pezzo di me', 'Non perderei più nomi e volti', 'Ricordare tutto è non perdere nulla'],
  },
  {
    id: 'l11', tappa: 1, register: 'vita',
    text: 'A parità di prezzo: casa piccola nel cuore della vita, o casa enorme isolata nella natura?',
    optionA: 'Piccola, ma al centro di tutto',
    optionB: 'Grande, ma lontano dal caos',
    spuntiA: ['La vita succede fuori, non in salotto', 'Tutto a portata di passo', 'Lo spazio non riempie le serate'],
    spuntiB: ['Spazio e silenzio sono il vero lusso', 'La natura cura più di una piazza', 'In centro paghi il caos a caro prezzo'],
  },
  {
    id: 'l12', tappa: 2, register: 'vita',
    text: 'Lavoreresti 3 giorni a settimana per metà stipendio, o 6 giorni per il doppio?',
    optionA: '3 giorni: il tempo è la vera ricchezza',
    optionB: '6 giorni: ora costruisco, poi godo',
    spuntiA: ['Il tempo libero non si ricompra', 'Vivo adesso, non da pensionato', 'Meno soldi, più vita'],
    spuntiB: ['C’è una stagione per spingere', 'Il doppio oggi è libertà domani', 'Il lavoro dà anche uno scopo'],
  },
  {
    id: 'l13', tappa: 1, register: 'vita',
    text: 'Vorresti che tutti ti dicessero sempre ciò che pensano davvero di te, o non saperlo mai?',
    optionA: 'Voglio sapere tutto, anche se fa male',
    optionB: 'Meglio non sapere e vivere sereno',
    spuntiA: ['Solo così posso migliorare', 'Le verità scomode sono utili', 'Preferisco il vero al comodo'],
    spuntiB: ['Certi giudizi rovinano i rapporti', 'Non tutto ciò che pensano è giusto', 'A volte ignorare è serenità'],
  },
  {
    id: 'l15', tappa: 1, register: 'vita',
    text: 'Un amico fidato ma di una sincerità brutale, o un amico dolcissimo che ti dice sempre ciò che vuoi sentire?',
    optionA: 'Brutale, ma vero',
    optionB: 'Dolce, anche se mi indora la pillola',
    spuntiA: ['Un amico vero ti dice ciò che serve', 'Le verità scomode fanno crescere', 'Le carezze non risolvono nulla'],
    spuntiB: ['A volte serve solo conforto', 'La gentilezza vale più della cruda verità', 'Un amico dolce scalda le giornate'],
  },
];

// Drop any previously-added a-/l-series, then re-append (idempotent).
const base = data.filter((d) => !/^[al]\d+$/.test(d.id));
const appended = NEW.map((d) => ({
  id: d.id,
  text: d.text,
  optionA: d.optionA,
  optionB: d.optionB,
  register: d.register,
  tappa: d.tappa,
  spuntiA: d.spuntiA,
  spuntiB: d.spuntiB,
}));
const result = [...base, ...appended];

fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', 'utf-8');

const perTappa = { 1: 0, 2: 0, 3: 0, 4: 0 };
const perReg = {};
for (const d of result) {
  if (d.tappa) perTappa[d.tappa]++;
  perReg[d.register] = (perReg[d.register] ?? 0) + 1;
}
console.log('total:', result.length, '| nuovi:', appended.length, '| per tappa:', perTappa, '| per registro:', perReg);
