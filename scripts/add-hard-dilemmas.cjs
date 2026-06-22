// Append a batch of HARD, rarely-discussed dilemmas to server/data/dilemmas.json.
// Each has a best-fit `tappa` (weighted to the deep ones) AND a `register`, so it
// enriches BOTH the Percorso ascent and the Classic 3/5/7 pools. Idempotent:
// drops any previously-added h-series first, then re-appends.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server', 'data', 'dilemmas.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

/** @type {{id:string,tappa:number,register:'vita'|'business',text:string,optionA:string,optionB:string,spuntiA:string[],spuntiB:string[]}[]} */
const HARD = [
  // ---------------- Tappa 2 — I Bivi (carriera, soldi, libertà) ----------------
  {
    id: 'h01', tappa: 2, register: 'business',
    text: 'Puoi salvare l’azienda e 50 posti di lavoro solo licenziando il collega che ti ha formato e che non se lo aspetta.',
    optionA: 'Lo licenzio: il bene dei tanti viene prima',
    optionB: 'Mi rifiuto: tradire chi mi ha fatto crescere mi snatura',
    spuntiA: ['Cinquanta famiglie pesano più di una', 'La gratitudine non può condannare tutti gli altri', 'Guidare a volte significa sporcarsi le mani'],
    spuntiB: ['Chi tradisce il maestro tradirà chiunque', 'Un’azienda salvata col tradimento è già marcia', 'La lealtà conta proprio quando costa'],
  },
  {
    id: 'h02', tappa: 2, register: 'business',
    text: 'Il prodotto che vendi è perfettamente legale, ma sai che rovina lentamente chi lo compra.',
    optionA: 'Continuo: se è legale, la scelta è loro',
    optionB: 'Smetto: sapere e vendere comunque è complicità',
    spuntiA: ['Gli adulti sono liberi di scegliere', 'Se non lo vendo io, lo vende un altro', 'Non posso fare da balia al mondo intero'],
    spuntiB: ['Sapere e tacere è diventare complice', 'Il legale non coincide col giusto', 'Quel denaro sporca tutto il resto'],
  },
  {
    id: 'h03', tappa: 2, register: 'vita',
    text: 'Per garantire un futuro sicuro ai tuoi figli, faresti per vent’anni un lavoro che disprezzi?',
    optionA: 'Sì: il loro futuro vale il mio sacrificio',
    optionB: 'No: un genitore spento non è un regalo per nessuno',
    spuntiA: ['Amare è anche sacrificarsi in silenzio', 'La sicurezza dei figli non ha prezzo', 'Vent’anni passano, una vita stabile resta'],
    spuntiB: ['I figli imparano da chi vive, non da chi si spegne', 'Un padre infelice pesa più di un reddito basso', 'Insegnare il coraggio vale più della sicurezza'],
  },
  {
    id: 'h04', tappa: 2, register: 'vita',
    text: 'Ottieni tutto ciò che vuoi, ma solo grazie a una raccomandazione che ha escluso qualcuno più bravo di te.',
    optionA: 'Accetto: il mondo funziona così',
    optionB: 'Rifiuto: un successo rubato non è successo',
    spuntiA: ['Nessuno arriva in alto con le mani pulite', 'Rifiutare non ridà il posto all’altro', 'Il merito puro è un’illusione consolatoria'],
    spuntiB: ['Vivere su un furto avvelena ogni vittoria', 'Mi guarderei allo specchio sapendo la verità', 'Il rispetto di me vale più del posto'],
  },
  {
    id: 'h05', tappa: 2, register: 'vita',
    text: 'Diventeresti straordinariamente ricco, ma solo trasferendoti lontano e tagliando i ponti con chi ami.',
    optionA: 'Sì: le occasioni così non tornano',
    optionB: 'No: una ricchezza senza i miei affetti è povertà',
    spuntiA: ['I legami si ricostruiscono, l’occasione no', 'Il denaro apre porte che l’amore non apre', 'Chi ti ama ti vuole bene anche lontano'],
    spuntiB: ['Da ricchi e soli si muore comunque soli', 'I ponti tagliati raramente si ricostruiscono', 'Nessuna cifra ricompra una domenica insieme'],
  },
  {
    id: 'h06', tappa: 2, register: 'business',
    text: 'Un tuo dipendente ruba dalla cassa per pagare le cure al figlio malato.',
    optionA: 'Lo denuncio: la regola vale per tutti o non vale',
    optionB: 'Chiudo un occhio: davanti a un figlio malato la regola tace',
    spuntiA: ['Le eccezioni distruggono ogni regola', 'Oggi è il figlio, domani sarà una scusa qualsiasi', 'La pietà non può diventare ingiustizia verso gli altri'],
    spuntiB: ['Nessuna regola vale più della vita di un bambino', 'La giustizia senza pietà è crudeltà', 'Al suo posto avrei rubato anch’io'],
  },
  {
    id: 'h34', tappa: 2, register: 'business',
    text: 'Puoi denunciare un illecito grave della tua azienda: salvi molte persone fuori, ma travolgi i colleghi onesti che ci lavorano.',
    optionA: 'Denuncio: l’illecito va fermato, costi quel che costi',
    optionB: 'Taccio: non distruggo innocenti per colpire pochi colpevoli',
    spuntiA: ['Il silenzio fa di me un complice', 'Chi subisce l’illecito conta più dei colleghi', 'Tacere oggi costa di più domani'],
    spuntiB: ['Centinaia di innocenti pagherebbero per pochi', 'La giustizia non può fare macerie a caso', 'Esistono modi più mirati di un’esplosione'],
  },
  {
    id: 'h35', tappa: 2, register: 'vita',
    text: 'Per avere libertà totale rinunceresti a ogni sicurezza e radice, vivendo senza un posto da chiamare casa?',
    optionA: 'Sì: la libertà vale più di ogni certezza',
    optionB: 'No: senza radici la libertà è solo solitudine',
    spuntiA: ['Le radici spesso sono catene travestite', 'Si vive una volta: la voglio libera', 'La sicurezza è la scusa di chi ha paura'],
    spuntiB: ['Senza un porto, ogni viaggio è fuga', 'Le radici danno la forza di osare', 'La libertà senza legami è solo vuoto'],
  },

  // ---------------- Tappa 3 — I Legami (lealtà, famiglia, intimità) ----------------
  {
    id: 'h07', tappa: 3, register: 'vita',
    text: 'Tuo figlio adulto ha commesso un reato grave e viene da te per nascondersi.',
    optionA: 'Lo proteggo: prima di tutto è mio figlio',
    optionB: 'Lo convinco a costituirsi: amare non è coprire',
    spuntiA: ['Un genitore non abbandona, mai', 'La legge punisce, un padre protegge', 'Chi, se non io, starà dalla sua parte?'],
    spuntiB: ['Coprirlo lo condanna a non crescere mai', 'Anche le vittime hanno una famiglia', 'Amare è volere che diventi migliore'],
  },
  {
    id: 'h08', tappa: 3, register: 'vita',
    text: 'Scopri che il tuo partner ti è stato fedele solo perché non ne ha mai avuta l’occasione.',
    optionA: 'Conta lo stesso: contano i fatti',
    optionB: 'Non vale niente: la fedeltà è resistere alla tentazione',
    spuntiA: ['Conta ciò che ha fatto, non ciò che immagina', 'Nessuno controlla del tutto i propri desideri', 'Una vita intera fedele è una vita fedele'],
    spuntiB: ['La virtù mai messa alla prova non è virtù', 'Mi ha amato o solo non ha potuto?', 'La fedeltà è una scelta, non una mancanza d’occasioni'],
  },
  {
    id: 'h09', tappa: 3, register: 'vita',
    text: 'Il tuo migliore amico ti chiede di mentire in tribunale per salvarlo dal carcere. Sai che è colpevole.',
    optionA: 'Mento: l’amicizia vera si misura proprio qui',
    optionB: 'Dico la verità: non posso ingannare la giustizia',
    spuntiA: ['Un amico nei guai si aiuta, non si giudica', 'Il carcere lo distruggerebbe', 'La lealtà che si tira indietro non è lealtà'],
    spuntiB: ['Mentire mi rende complice del suo male', 'C’è chi ha subìto ciò che ha fatto', 'L’amicizia non può chiedermi di tradire me stesso'],
  },
  {
    id: 'h10', tappa: 3, register: 'vita',
    text: 'Tuo fratello ti confessa di tradire la moglie, che è anche la tua più cara amica.',
    optionA: 'Glielo dico: merita la verità più del silenzio',
    optionB: 'Taccio: non tocca a me spaccare la loro coppia',
    spuntiA: ['L’amicizia vera non lascia vivere nell’inganno', 'Tacere mi rende complice del tradimento', 'Vorrei che qualcuno lo dicesse a me'],
    spuntiB: ['Non sono affari miei distruggere un matrimonio', 'La verità detta da me rovina due legami', 'Sono cose che devono dirsi tra loro'],
  },
  {
    id: 'h11', tappa: 3, register: 'vita',
    text: 'Tuo padre, in fin di vita, ti chiede perdono per il male che ti ha fatto. Non te la senti.',
    optionA: 'Lo perdono a parole: lascialo morire in pace',
    optionB: 'Sono sincero: un perdono falso non serve a nessuno',
    spuntiA: ['A volte una bugia è l’ultimo atto d’amore', 'La pace di un morente vale più del mio orgoglio', 'Un perdono detto può diventare vero col tempo'],
    spuntiB: ['Un perdono finto è un’altra ferita, non una cura', 'Merito di essere onesto sul mio dolore', 'Mentire ora svilisce tutto ciò che ho sofferto'],
  },
  {
    id: 'h12', tappa: 3, register: 'vita',
    text: 'Il tuo partner diventa gravemente disabile e la relazione che conoscevi non tornerà più.',
    optionA: 'Resto per sempre: l’amore è anche nella malattia',
    optionB: 'Ho il diritto di rifarmi una vita',
    spuntiA: ['L’amore vero non scappa davanti al dolore', 'L’ho promesso, e le promesse contano', 'Andarmene ora sarebbe abbandono'],
    spuntiB: ['Sacrificare due vite non ne salva nessuna', 'Restare per dovere è prigione, non amore', 'Anche io ho una sola vita da vivere'],
  },
  {
    id: 'h13', tappa: 3, register: 'vita',
    text: 'Puoi salvare la vita di tuo figlio o quella del tuo partner, non di entrambi.',
    optionA: 'Mio figlio: i figli vengono prima',
    optionB: 'Il mio partner: la persona con cui ho scelto la vita',
    spuntiA: ['Un figlio ha tutta la vita davanti', 'L’istinto di un genitore non si discute', 'Chi protegge i figli protegge il futuro'],
    spuntiB: ['Il partner l’ho scelto: il legame è un patto', 'Un figlio non dovrebbe crescere su questa colpa', 'Senza chi amo non saprei crescerlo comunque'],
  },
  {
    id: 'h14', tappa: 3, register: 'vita',
    text: 'Scopri che il figlio che cresci da dieci anni non è biologicamente tuo, per uno scambio in ospedale.',
    optionA: 'Non cambia nulla: è mio figlio, punto',
    optionB: 'Voglio conoscere e riavvicinare il mio figlio biologico',
    spuntiA: ['Padre è chi cresce, non chi dona il DNA', 'Dieci anni d’amore battono il sangue', 'Il legame non si cancella con un esame'],
    spuntiB: ['Anche l’altro bambino è mio e non lo conosco', 'Il sangue chiama, è giusto ascoltarlo', 'Posso amare di più, non per forza di meno'],
  },
  {
    id: 'h15', tappa: 3, register: 'vita',
    text: 'Un amico ti confida un segreto che, se taci, lascerà un’altra persona sposare un bugiardo.',
    optionA: 'Parlo: una vita ne uscirebbe rovinata',
    optionB: 'Taccio: un segreto è un segreto',
    spuntiA: ['Un segreto non vale più di una vita ingannata', 'Tacere mi rende complice dell’inganno', 'La fiducia non copre il diritto di mentire ad altri'],
    spuntiB: ['Se tradisco lui, che amico sono?', 'Non tocca a me decidere per gli altri', 'Chi confida deve potersi fidare sempre'],
  },
  {
    id: 'h16', tappa: 3, register: 'vita',
    text: 'I tuoi genitori anziani non si bastano più. Li accogli stravolgendo la tua famiglia, o scegli una struttura?',
    optionA: 'In casa: si sono presi cura di me, ora tocca a me',
    optionB: 'In struttura: lì stanno meglio e la mia famiglia regge',
    spuntiA: ['Non si parcheggia chi ti ha cresciuto', 'I figli imparano la cura guardandoti', 'La famiglia si allarga, non si stravolge'],
    spuntiB: ['Sacrificare moglie e figli non è amore', 'Dei professionisti li curano meglio di me', 'Logorarmi non aiuta nessuno dei due'],
  },
  {
    id: 'h17', tappa: 3, register: 'vita',
    text: 'Tuo figlio ti dice che non vuole più vederti e non capisci perché.',
    optionA: 'Insisto a cercarlo: un genitore non molla',
    optionB: 'Lo lascio andare: rispetto la sua scelta',
    spuntiA: ['L’amore non si arrende al primo no', 'Forse aspetta proprio che io non molli', 'Sparire confermerebbe le sue paure'],
    spuntiB: ['Inseguire chi fugge lo allontana di più', 'Il rispetto è anche accettare un no', 'A volte il dono d’amore è il silenzio'],
  },
  {
    id: 'h18', tappa: 3, register: 'vita',
    text: 'Sai una verità che renderebbe libero te ma distruggerebbe per sempre la serenità di chi ami.',
    optionA: 'Taccio: la sua pace vale più della mia',
    optionB: 'Parlo: un legame vero non regge sul non detto',
    spuntiA: ['L’amore a volte è portare un peso da soli', 'Non ogni verità serve a qualcosa', 'Risparmiarle il dolore è un atto d’amore'],
    spuntiB: ['Un legame fondato su un segreto è già crepato', 'Decidere per lei è toglierle dignità', 'I non detti marciscono e tornano peggio'],
  },
  {
    id: 'h19', tappa: 3, register: 'vita',
    text: 'Puoi adottare un bambino che nessuno vuole, sapendo che le sue ferite renderanno la tua vita durissima.',
    optionA: 'Sì: proprio chi non ha nessuno merita qualcuno',
    optionB: 'No: non prometto ciò che forse non reggo',
    spuntiA: ['Un amore facile non cambia una vita', 'Se non io, chi?', 'Le ferite si curano solo con qualcuno accanto'],
    spuntiB: ['Promettere e non reggere ferisce di più', 'Devo essere onesto sui miei limiti', 'Un fallimento lo distruggerebbe due volte'],
  },

  // ---------------- Tappa 4 — I Bilanci (mortalità, senso, tabù) ----------------
  {
    id: 'h20', tappa: 4, register: 'vita',
    text: 'Una persona che ami soffre senza speranza e ti supplica di aiutarla a morire.',
    optionA: 'La sua volontà: ha diritto di andarsene con dignità',
    optionB: 'La vita: finché c’è, va custodita',
    spuntiA: ['Costringere a soffrire non è amore', 'La sua vita appartiene a lei, non a me', 'La dignità conta quanto il respiro'],
    spuntiB: ['Finché c’è vita, può cambiare tutto', 'È una porta che non si richiude', 'Il mio compito è restare, non lasciare andare'],
  },
  {
    id: 'h21', tappa: 4, register: 'vita',
    text: 'Puoi cancellare per sempre un ricordo doloroso, ma perdi anche ciò che ti ha insegnato.',
    optionA: 'Lo cancello: certi dolori non meritano di restare',
    optionB: 'Lo tengo: anche le ferite mi hanno fatto',
    spuntiA: ['Non tutto il dolore insegna qualcosa', 'Liberarsi del peso è un diritto', 'Vivere meglio vale più di una lezione'],
    spuntiB: ['Senza quelle ferite non sarei io', 'Le cicatrici sono mappe, non catene', 'Cancellare il dolore cancella chi mi ha reso forte'],
  },
  {
    id: 'h22', tappa: 4, register: 'vita',
    text: 'La tua serenità dipende dalla sofferenza nascosta di uno sconosciuto che non incontrerai mai.',
    optionA: 'Accetto: non posso salvarli tutti, vivo la mia vita',
    optionB: 'Rifiuto: una felicità a quel prezzo non è felicità',
    spuntiA: ['Ogni nostra comodità ha un costo nascosto', 'Rinunciare non salverebbe quello sconosciuto', 'Il senso di colpa eterno non è virtù'],
    spuntiB: ['Sapere e godere è essere complice', 'La pace comprata col dolore altrui è marcia', 'Preferisco una vita scomoda ma pulita'],
  },
  {
    id: 'h23', tappa: 4, register: 'vita',
    text: 'Potresti sapere in anticipo come finirà ogni tua relazione importante, prima ancora di iniziarla.',
    optionA: 'Voglio saperlo: eviterei di sprecare il cuore',
    optionB: 'Non voglio: vivrei tutto col timore della fine',
    spuntiA: ['Si eviterebbero anni buttati', 'Sapere protegge dal male inutile', 'Meglio scegliere con gli occhi aperti'],
    spuntiB: ['Conoscere la fine ucciderebbe l’inizio', 'Si ama proprio perché non si sa', 'Il rischio è il sale di ogni legame'],
  },
  {
    id: 'h24', tappa: 4, register: 'vita',
    text: 'Per restare fedele agli ideali in cui credi, sacrificheresti il benessere della tua famiglia?',
    optionA: 'Sì: senza i miei ideali non sarei nessuno',
    optionB: 'No: gli ideali non si abbracciano la notte',
    spuntiA: ['Chi tradisce ciò in cui crede è già morto dentro', 'Certi principi valgono una vita', 'I figli erediteranno il mio coraggio, non la mia resa'],
    spuntiB: ['Nessuna idea vale più di chi amo', 'Gli ideali non piangono al tuo funerale', 'Proteggere i miei è il primo dovere'],
  },
  {
    id: 'h25', tappa: 4, register: 'vita',
    text: 'Potresti rivivere la tua vita rifacendo tutto diversamente, ma diventando una persona che oggi non riconosceresti.',
    optionA: 'Sì: cambierei le cose che mi pesano',
    optionB: 'No: preferisco essere me, errori compresi',
    spuntiA: ['Certi rimpianti meritano una seconda occasione', 'Crescere significa diventare altro', 'Meglio felice e diverso che fedele e infelice'],
    spuntiB: ['Perdere chi sono è una morte mascherata', 'I miei errori sono parte di me', 'Non voglio una felicità che non mi appartiene'],
  },
  {
    id: 'h26', tappa: 4, register: 'vita',
    text: 'Puoi perdonare chi ti ha ferito in modo imperdonabile, ma solo rinunciando alla rabbia che ti ha tenuto in piedi.',
    optionA: 'Perdono: liberarmi vale più della vendetta',
    optionB: 'Non perdono: quella rabbia è giustizia che mi devo',
    spuntiA: ['Il perdono libera chi lo dà, non chi lo riceve', 'La rabbia mi incatena al mio carnefice', 'Vivere oltre è la vittoria più grande'],
    spuntiB: ['Perdonare l’imperdonabile è tradire me stesso', 'La rabbia mi ha tenuto vivo, non la rinnego', 'Certe cose non vanno assolte, vanno ricordate'],
  },
  {
    id: 'h27', tappa: 4, register: 'vita',
    text: 'Potresti regalare dieci anni della tua vita per aggiungerli a quella di una persona che ami.',
    optionA: 'Sì: dieci anni miei per i suoi, senza dubbio',
    optionB: 'No: la mia vita è anche mia, non solo sua',
    spuntiA: ['Amare è dare anche il proprio tempo', 'Cosa sono dieci anni di fronte a chi amo?', 'Lo rifarei mille volte'],
    spuntiB: ['Non posso vivere come moneta di scambio', 'Anche io ho chi ha bisogno di me', 'Sacrificarsi non sempre è amore: a volte è fuga'],
  },
  {
    id: 'h28', tappa: 4, register: 'vita',
    text: 'Una pillola ti renderebbe felice per sempre, ma in modo artificiale e senza più emozioni vere.',
    optionA: 'La prendo: la felicità è felicità, da dove venga',
    optionB: 'La rifiuto: preferisco soffrire ma sentire davvero',
    spuntiA: ['Chi sceglie di soffrire è un illuso', 'La felicità è il fine di tutto', 'Le emozioni vere fanno anche male: chi le rimpiange?'],
    spuntiB: ['Una felicità finta è una gabbia dorata', 'Senza dolore non c’è gioia vera', 'Sentire, anche male, è essere vivi'],
  },
  {
    id: 'h29', tappa: 4, register: 'vita',
    text: 'Dire una verità scomoda a tutto il tuo gruppo ti farebbe perdere ogni amico.',
    optionA: 'La dico comunque: la verità vale più dell’approvazione',
    optionB: 'Taccio: certe verità non valgono la solitudine',
    spuntiA: ['Amici che ti vogliono muto non sono amici', 'Vivere nella finzione è già perderli', 'La verità detta col cuore prima o poi torna'],
    spuntiB: ['Avere ragione da soli non scalda nessuno', 'Non ogni verità va sbattuta in faccia', 'A volte il silenzio salva ciò che conta'],
  },
  {
    id: 'h30', tappa: 4, register: 'vita',
    text: 'Potresti conoscere la verità definitiva sul senso della vita, ma scoprire che non ce n’è alcuno.',
    optionA: 'Voglio saperlo: meglio la verità di una bella illusione',
    optionB: 'Non voglio: meglio cercare un senso che sapere che non c’è',
    spuntiA: ['Vivere nella verità è l’unica vita degna', 'Se nessun senso è dato, lo creo io', 'L’illusione è una prigione comoda'],
    spuntiB: ['La speranza di un senso muove tutto', 'Certe verità tolgono la voglia di alzarsi', 'Cercare è già un senso'],
  },
  {
    id: 'h31', tappa: 4, register: 'vita',
    text: 'Scopri che la causa nobile a cui hai dedicato la vita era fondata su una menzogna, ma fa comunque del bene reale.',
    optionA: 'Continuo a difenderla: conta il bene che fa oggi',
    optionB: 'La smaschero: una causa fondata sul falso va fermata',
    spuntiA: ['Conta il bene che produce, non come è nata', 'Smontarla farebbe più male che bene', 'Le persone hanno bisogno di crederci'],
    spuntiB: ['Il bene costruito sul falso è una bomba a tempo', 'Ho il dovere di non ingannare più nessuno', 'La verità vale anche quando fa male'],
  },
  {
    id: 'h32', tappa: 4, register: 'vita',
    text: 'Per crescere tuo figlio nella verità gli racconteresti anche le cose peggiori di te, rischiando il suo amore.',
    optionA: 'Sì: merita di conoscermi davvero',
    optionB: 'No: certe cose è giusto custodirle',
    spuntiA: ['Un amore basato su una maschera è fragile', 'Imparerà che sbagliare è umano', 'Merita la verità su chi è suo padre'],
    spuntiB: ['Non ogni verità è un dono', 'Certi pesi non vanno scaricati sui figli', 'Proteggerlo è anche tacere'],
  },
  {
    id: 'h33', tappa: 4, register: 'vita',
    text: 'Potresti non provare mai più dolore, ma non sapresti più amare con la stessa intensità.',
    optionA: 'Accetto: il dolore mi ha tolto più di quanto l’amore mi abbia dato',
    optionB: 'Rifiuto: amare intensamente vale ogni dolore',
    spuntiA: ['Una vita senza dolore è un sollievo, non una perdita', 'Ho amato abbastanza da sapere quanto costa', 'La pace interiore vale più dell’intensità'],
    spuntiB: ['Amare a metà è non vivere', 'Il dolore è il prezzo onesto dell’amore', 'Spegnere il dolore spegne anche me'],
  },
];

// Drop any previously-added hard dilemmas, then re-append (idempotent).
const base = data.filter((d) => !/^h\d+$/.test(d.id));
const appended = HARD.map((d) => ({
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
console.log('total:', result.length, '| nuovi hard:', appended.length, '| per tappa:', perTappa, '| per registro:', perReg);
