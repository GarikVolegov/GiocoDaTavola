// Offline-safe fallback deck for Pass & Play ("Passa il Telefono").
// Used when the network is unavailable or the server is unreachable.

export type PassMode =
  | 'flash'
  | 'infiltrato'
  | 'assurdo'
  | 'coppie'
  | 'cruciverba'
  | 'tribunale'
  | 'preferiresti'
  | 'classico'
  | 'percorso'
  | 'storia'
  | 'mix';

export type PassFamiliarita = 'vecchi_amici' | 'nuove_conoscenze' | 'tutti';

export type PassCardOriginMode = Exclude<PassMode, 'mix'>;

export interface PassStorySceneMeta {
  storyId: string;
  title: string;
  protagonist: string;
  premessa?: string;
  actTitle: string;
  sceneNarration: string;
  consequenceA: string;
  consequenceB: string;
  epiloghi?: Array<{ minA: number; maxA: number; text: string }>;
}

export interface PassFlashCard {
  id: string;
  cardMode?: PassCardOriginMode;
  text: string;
  optionA: string;
  optionB: string;
  spuntiA?: string[];
  spuntiB?: string[];
  penalty?: string;
  domandaRilancio?: string;
  lezioneReale?: string;
  tappa?: number;
  tappaNome?: string;
  storyScene?: PassStorySceneMeta;
  familiarita?: PassFamiliarita;
}

export interface PassInfiltratoCard {
  id: string;
  cardMode?: PassCardOriginMode;
  groupQuestion: string;
  impostorQuestion: string;
  category?: string;
  familiarita?: PassFamiliarita;
}

export interface PassCoppieCard {
  id: string;
  cardMode?: PassCardOriginMode;
  cardType: 'allineamento' | 'verita' | 'obbligo';
  intensity: 'complicita' | 'piccante' | 'profondo';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  familiarita?: PassFamiliarita;
}

export interface PassAssurdoCard {
  id: string;
  cardMode?: PassCardOriginMode;
  cardType: 'gogna' | 'dignita';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  sentenza?: string;
  familiarita?: PassFamiliarita;
}

export interface PassCruciverbaWord {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  word: string;
  clue: string;
}

export interface PassCruciverbaCard {
  id: string;
  cardMode?: PassCardOriginMode;
  theme: string;
  rows: number;
  cols: number;
  words: PassCruciverbaWord[];
  familiarita?: PassFamiliarita;
}

export interface PassTribunaleCard {
  id: string;
  cardMode?: PassCardOriginMode;
  title: string;
  scenario: string;
  accusaRole: string;
  difesaRole: string;
  penalty: string;
  familiarita?: PassFamiliarita;
}

export interface PassPreferirestiCard {
  id: string;
  cardMode?: PassCardOriginMode;
  prompt: string;
  options: string[];
  penalty?: string;
  familiarita?: PassFamiliarita;
}

export type PassCard =
  | PassFlashCard
  | PassInfiltratoCard
  | PassCoppieCard
  | PassAssurdoCard
  | PassCruciverbaCard
  | PassTribunaleCard
  | PassPreferirestiCard;

export const FALLBACK_DECKS: Record<PassMode, PassCard[]> = {
  flash: [
    {
      id: 'fb_fl1',
      text: 'Controllare il telefono del partner mentre dorme: legittima difesa o psicopatia?',
      optionA: 'Legittima difesa',
      optionB: 'Psicopatia pura',
      spuntiA: ['Se non hai nulla da nascondere non hai paura', 'Meglio scoprire subito che perdere anni'],
      spuntiB: ['Senza fiducia la relazione è già morta', 'Violare la privacy è la vera red flag'],
    },
    {
      id: 'fb_fl2',
      text: 'Uscire con l’ex del tuo migliore amico dopo 2 anni: accettabile o tradimento?',
      optionA: 'Dopo 2 anni ci sta',
      optionB: 'Tradimento a vita',
      spuntiA: ['Dopo due anni ognuno si rifà una vita', 'L’ex non è proprietà privata'],
      spuntiB: ['Il codice tra amici non ha scadenza', 'Con milioni di persone proprio quella?'],
    },
    {
      id: 'fb_fl3',
      text: 'Ghostare qualcuno dopo 3 uscite andate male: diritto legittimo o mossa da infami?',
      optionA: 'Ci sta, zero sbatti',
      optionB: 'Da vigliacchi totali',
      spuntiA: ['Il silenzio è già una risposta chiarissima', 'Meglio sparire che scrivere scuse finte'],
      spuntiB: ['Bastano due righe di educazione', 'Fai impazzire l’altra persona per pigrizia'],
    },
    {
      id: 'fb_fl4',
      text: 'Scopri che il partner del tuo amico lo tradisce: glielo dici o stai zitto?',
      optionA: 'Glielo dico subito',
      optionB: 'Fatti miei, taccio',
      spuntiA: ['Se non glielo dici sei complice', 'Preferirei saperlo domani che tra due anni'],
      spuntiB: ['Alla fine fanno pace e odiano te', 'Non sai mai i reali accordi tra loro'],
    },
    {
      id: 'fb_fl5',
      text: 'Condividere la posizione GPS h24 col partner: dolcezza o controllo tossico?',
      optionA: 'Comodo e trasparente',
      optionB: 'Tossicità pura',
      spuntiA: ['Serve per sicurezza quando si torna tardi', 'Se non hai niente da nascondere che cambia?'],
      spuntiB: ['Non sono un pacco da tracciare', 'Ammazza ogni briciolo di mistero'],
    },
    {
      id: 'fb_fl6',
      text: 'Un amico del gruppo sparisce ogni volta che si fidanza: quando torna lo riaccogli o glielo fai pesare?',
      optionA: 'Lo riaccoglio subito',
      optionB: 'Glielo faccio pesare',
      familiarita: 'vecchi_amici',
      spuntiA: ['In amore si perde la testa, capita a tutti', 'Tenere il broncio rovina solo il gruppo'],
      spuntiB: ['Non siamo un parcheggio tra una storia e l’altra', 'Un confine chiaro insegna rispetto'],
    },
    {
      id: 'fb_fl7',
      text: 'Nel gruppo c’è una verità scomoda che tutti sanno su uno di noi ma nessuno dice: protezione o ipocrisia?',
      optionA: 'Protezione affettuosa',
      optionB: 'Ipocrisia comoda',
      familiarita: 'vecchi_amici',
      spuntiA: ['Non tutto va detto per forza se ferisce', 'Il silenzio a volte tiene unito il gruppo'],
      spuntiB: ['I veri amici non ti lasciano vivere in una bugia', 'Parlarne alle spalle è peggio'],
    },
    {
      id: 'fb_fl8',
      text: 'Al ristorante qualcuno prende solo un’insalata e acqua, gli altri antipasti, vino e dolce: si divide comunque alla romana?',
      optionA: 'Sempre alla romana',
      optionB: 'Ognuno paga il suo',
      spuntiA: ['Fare i conti con la calcolatrice rovina la serata', 'Oggi tocca a te, domani a me'],
      spuntiB: ['Chi beve tre cocktail non può far pagare chi ha speso 12€', 'Equità batte pigrizia'],
    },
    {
      id: 'fb_fl9',
      text: 'Scopri che un collega prende il 30% in più di te facendo esattamente lo stesso lavoro: affronti il capo subito o cerchi altro in silenzio?',
      optionA: 'Affronto il capo',
      optionB: 'Cerco altro e poi saluto',
      familiarita: 'nuove_conoscenze',
      spuntiA: ['Se non chiedi, non ottieni mai nulla', 'Chiarire i numeri mette rispetto'],
      spuntiB: ['Un’offerta esterna in mano vale più di mille lamentele', 'Se ti hanno sottopagato finora, lo rifaranno'],
    },
  ],
  infiltrato: [
    {
      id: 'fb_inf1',
      groupQuestion: 'Qual è la scusa peggiore che hai usato per bidonare un’uscita all’ultimo?',
      impostorQuestion: 'Qual è la bugia più stupida che hai raccontato ai tuoi genitori?',
      category: 'scuse',
    },
    {
      id: 'fb_inf2',
      groupQuestion: 'Qual è il posto più strano in cui hai fatto serata?',
      impostorQuestion: 'Qual è il posto più strano in cui hai dormito?',
      category: 'serate',
    },
    {
      id: 'fb_inf3',
      groupQuestion: 'Qual è la prima cosa che guardi in una persona che ti attrae?',
      impostorQuestion: 'Qual è il difetto che proprio non sopporti in un collega?',
      category: 'gusti',
    },
    {
      id: 'fb_inf4',
      groupQuestion: 'Quanti soldi spenderesti al massimo per un regalo di compleanno al tuo migliore amico?',
      impostorQuestion: 'Quanti soldi spenderesti al massimo per una cena fuori?',
      category: 'soldi',
    },
    {
      id: 'fb_inf5',
      groupQuestion: 'Qual è la cosa più imbarazzante che hai cercato su Google di recente?',
      impostorQuestion: 'Qual è l’ultimo acquisto inutile che hai fatto online?',
      category: 'segreti',
    },
    {
      id: 'fb_inf6',
      groupQuestion: 'Qual è il difetto che ti viene perdonato più spesso da chi ti conosce da anni?',
      impostorQuestion: 'Qual è il pregio che ti riconoscono subito al primo incontro?',
      category: 'gruppo',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_inf7',
      groupQuestion: 'Qual è l’app che apri per prima appena ti svegli la mattina?',
      impostorQuestion: 'Qual è l’app su cui passi più ore prima di dormire?',
      category: 'digitale',
    },
    {
      id: 'fb_inf8',
      groupQuestion: 'Qual è la città in cui vorresti vivere per un anno intero?',
      impostorQuestion: 'Qual è la meta di vacanza più sopravvalutata secondo te?',
      category: 'viaggi',
    },
  ],
  assurdo: [
    {
      id: 'fb_as1',
      cardType: 'gogna',
      prompt: 'Chi di voi è più probabile che mandi un vocale di 7 minuti alle 2 di notte?',
      penalty: 'Chi prende più voti deve mandare un vocale di 5 secondi con solo "Miao" al primo contatto in chat.',
    },
    {
      id: 'fb_as2',
      cardType: 'dignita',
      prompt: 'Per 500€ accetteresti di farti leggere ad alta voce gli ultimi 5 messaggi inviati al tuo ex?',
      optionA: 'Sì, dammi i 500€',
      optionB: 'Mai nella vita',
      sentenza: 'La dignità ha un prezzo, ma a quanto pare è molto più basso di quanto pensiate.',
    },
    {
      id: 'fb_as3',
      cardType: 'gogna',
      prompt: 'Chi di voi sparirebbe per primo in caso di apocalisse zombie per salvarsi da solo?',
      penalty: 'Il prescelto fa un brindisi alla propria sopravvivenza.',
    },
    {
      id: 'fb_as4',
      cardType: 'dignita',
      prompt: 'Mangeresti una pizza con ananas e ketchup davanti a uno chef stellato per vincere una vacanza gratis?',
      optionA: 'Subito, dove firmo?',
      optionB: 'Piuttosto resto a casa',
      sentenza: 'L’onore culinario è salvo... o forse no.',
    },
    {
      id: 'fb_as5',
      cardType: 'gogna',
      prompt: 'Chi di voi ha la cronologia di Instagram più imbarazzante?',
      penalty: 'Mostra il terzo reel nei "Piaciuti" oppure bevi!',
    },
    {
      id: 'fb_as6',
      cardType: 'gogna',
      prompt: 'Chi di questo gruppo dà sempre consigli saggi a tutti ma nella propria vita fa esattamente l’opposto?',
      penalty: 'Il più votato racconta l’ultima volta che ha predicato bene e razzolato male!',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_as7',
      cardType: 'dignita',
      prompt: 'Per 1.000€ lasceresti che il gruppo scelga la tua prossima foto profilo su tutti i social per un mese?',
      optionA: 'Per 1.000€ subito',
      optionB: 'La mia faccia non è in vendita',
      sentenza: 'Un mese passa in fretta, ma gli screenshot restano per sempre.',
    },
    {
      id: 'fb_as8',
      cardType: 'gogna',
      prompt: 'Chi di voi finirebbe sicuramente in prigione per prima in una serie TV poliziesca, anche solo per aver risposto male?',
      penalty: 'Il prescelto improvvisa il suo discorso di difesa davanti al giudice.',
    },
  ],
  coppie: [
    {
      id: 'fb_cp1',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Al 3 indicate chi dei due chiede scusa per primo dopo una litigata di coppia.',
    },
    {
      id: 'fb_cp2',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è una piccola abitudine quotidiana del tuo partner che ti fa impazzire (nel bene o nel male)?',
      penalty: 'Se eviti la risposta, bacio immediato!',
    },
    {
      id: 'fb_cp3',
      cardType: 'obbligo',
      intensity: 'complicita',
      prompt: 'Guardatevi negli occhi come fidanzati per 20 secondi senza ridere né parlare, poi baciatevi.',
      penalty: 'Chi ride per primo paga pegno!',
    },
    {
      id: 'fb_cp4',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Al 3 indicate chi dei due è più geloso quando qualcuno ci prova col proprio partner.',
    },
    {
      id: 'fb_cp5',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è il momento esatto del vostro primo incontro o appuntamento in cui hai capito di volerci stare insieme?',
      penalty: 'Sii sincero o penitenza romantica!',
    },
    {
      id: 'fb_cp6',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è una piccola paura sul vostro futuro da fidanzati (convivenza, lavoro, cambiamenti) che non hai ancora detto del tutto al tuo partner?',
      penalty: 'Raccontalo ora con sincerità!',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_cp7',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Se doveste partire domani per un weekend romantico senza programma, chi dei due entrerebbe nel panico per primo?',
    },
    {
      id: 'fb_cp8',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è la cosa che hai scoperto del tuo partner solo da quando state insieme e che oggi ami di più?',
      penalty: 'Rispondi con sincerità!',
    },
    {
      id: 'fb_cp9',
      cardType: 'allineamento',
      intensity: 'piccante',
      prompt: 'Al 3 indicate chi dei due ha preso l’iniziativa più spesso all’inizio della vostra storia.',
    },
    {
      id: 'fb_cp10',
      cardType: 'verita',
      intensity: 'piccante',
      prompt: 'Qual è un desiderio o una fantasia sotto le lenzuola che non hai ancora proposto al tuo partner ad alta voce?',
      penalty: 'Dillo ora o paga pegno!',
    },
    {
      id: 'fb_cp11',
      cardType: 'obbligo',
      intensity: 'piccante',
      prompt: 'Sussurra all’orecchio del tuo partner cosa ti attrae di più di lui/lei e cosa vorresti fare stasera appena restate soli.',
      penalty: 'Se arrossisci o ti tiri indietro, doppio pegno!',
    },
    {
      id: 'fb_cp12',
      cardType: 'verita',
      intensity: 'piccante',
      prompt: 'Qual è il momento intimo o folle da fidanzati che avete vissuto insieme e che ti fa sorridere appena ci ripensi?',
      penalty: 'Racconta o penitenza!',
    },
    {
      id: 'fb_cp13',
      cardType: 'allineamento',
      intensity: 'piccante',
      prompt: 'Al 3 indicate chi dei due cerca più spesso baci, carezze e contatto fisico nella vostra routine di coppia.',
    },
  ],
  classico: [
    {
      id: 'fb_cl1',
      text: 'Un tuo amico ti chiede un parere sincero sul suo nuovo progetto, ma sai che è destinato a fallire. Che fai?',
      optionA: 'Glielo dico senza filtri',
      optionB: 'Lo incoraggio lo stesso',
      familiarita: 'vecchi_amici',
      spuntiA: ['La vera amicizia si vede nella sincerità scomoda', 'Meglio un dispiacere oggi che un disastro domani'],
      spuntiB: ['Nessuno può prevedere il futuro al 100%', 'A volte serve solo qualcuno che creda in te'],
    },
    {
      id: 'fb_cl2',
      text: 'Ti offrono il lavoro dei tuoi sogni, ma richiede di trasferirti dall’altra parte del mondo lasciando tutti.',
      optionA: 'Parto subito',
      optionB: 'Resto con chi amo',
      spuntiA: ['I treni passano una volta sola', 'Chi ti vuole bene davvero capirà'],
      spuntiB: ['Il successo senza affetti con cui condividerlo è vuoto', 'Le occasioni si creano anche restando'],
    },
    {
      id: 'fb_cl3',
      text: 'Trovi un portafoglio con 500€ in contanti e nessun documento, ma sai in quale bar lo hanno perso.',
      optionA: 'Lo lascio al bar',
      optionB: 'Tengo i soldi',
      familiarita: 'nuove_conoscenze',
      spuntiA: ['La coscienza pulita vale più di 500€', 'Al barista o al proprietario tornerà indietro'],
      spuntiB: ['Senza documenti non hai garanzia che arrivi al vero proprietario', 'La fortuna ogni tanto bussa'],
    },
    {
      id: 'fb_cl4',
      text: 'Ti accorgi che con un amico storico non hai più nulla in comune: vi vedete solo per abitudine e ricordi.',
      optionA: 'Lo tengo stretto per la storia condivisa',
      optionB: 'Lascio che si spenga con onestà',
      familiarita: 'vecchi_amici',
      spuntiA: ['Chi ti conosce da prima che diventassi adulto ha un valore unico', 'Le amicizie hanno stagioni diverse'],
      spuntiB: ['La nostalgia non basta a reggere un rapporto presente', 'Crescere significa anche dividersi'],
    },
    {
      id: 'fb_cl5',
      text: 'Puoi sapere con certezza la data esatta in cui realizzerai il tuo più grande sogno, oppure vivere senza saperlo mai in anticipo.',
      optionA: 'Voglio saperla',
      optionB: 'Meglio non saperla',
      spuntiA: ['Sapere quando arriva ti dà forza nei momenti bui', 'Puoi pianificare tutto intorno a quel traguardo'],
      spuntiB: ['Se è lontana rischi di smettere di vivere oggi', 'La sorpresa è metà del viaggio'],
    },
    {
      id: 'fb_cl6',
      text: 'Un tuo caro amico sta per sposare una persona che tu sai per certo non lo rende felice: glielo dici prima delle nozze?',
      optionA: 'Parlo prima che sia troppo tardi',
      optionB: 'Taccio e gli resto vicino comunque',
      familiarita: 'vecchi_amici',
      spuntiA: ['Un amico vero rischia anche di essere odiato pur di proteggerti', 'Dopo non potresti guardarti allo specchio'],
      spuntiB: ['Nessuno conosce davvero una coppia da fuori', 'Se glielo dici rischi di perderlo per sempre'],
    },
    {
      id: 'fb_cl7',
      text: 'Ti propongono uno stipendio doppio per un lavoro che odi profondamente, ma solo per 5 anni garantiti: accetti?',
      optionA: 'Accetto e metto fieno in cascina',
      optionB: 'Rifiuto, 5 anni sono troppi',
      spuntiA: ['Con quei risparmi compri 10 anni di libertà dopo', 'Il lavoro non deve essere per forza la tua identità'],
      spuntiB: ['Cinque anni spenti ti cambiano il carattere per sempre', 'I soldi non restituiscono l’energia persa'],
    },
    {
      id: 'fb_cl8',
      text: 'Preferisci avere sempre ragione in ogni discussione ma risultare antipatico, o essere amato da tutti ma cedere spesso?',
      optionA: 'Avere ragione',
      optionB: 'Essere amato',
      spuntiA: ['La verità non si piega alla popolarità', 'Alla lunga chi ha ragione viene rispettato'],
      spuntiB: ['Le relazioni valgono più di mille dibattiti vinti', 'Essere felici è meglio che avere ragione'],
    },
  ],
  cruciverba: [
    {
      id: 'fb_cb1',
      theme: 'Spritz & Chiacchiere',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'SPRITZ', clue: 'Arancione o rosso, trasforma il "beviamo solo una cosa" in mezzanotte' },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'PIZZA', clue: 'Quella che ordini alle 23 giurando di prendere "solo metà"' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'NOTTE', clue: 'Inizia con "sto a casa a dormire" e finisce con un cornetto caldo' },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 1, word: 'AMARO', clue: 'Lo bevi "per digerire" anche dopo aver mangiato tre patatine' },
      ],
    },
    {
      id: 'fb_cb2',
      theme: 'Vacanza con gli Amici',
      rows: 6,
      cols: 8,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 1, word: 'VALIGIA', clue: 'La chiudi sedendotici sopra alle 5 del mattino prima di partire' },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'VOLO', clue: 'Partenza alle 06:15 per risparmiare 14 euro e perdere un anno di vita' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SOLARE', clue: 'Crema che dici di aver messo ma alle 14 sembri un gambero' },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'HOTEL', clue: 'Sul sito era "vista mare", ma il mare si vede solo dal bagno' },
      ],
    },
    {
      id: 'fb_cb3',
      theme: 'Smart Working & Call',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'MUTATO', clue: 'Come scopri di avere il microfono dopo un monologo su Meet' },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'CAMICIA', clue: 'Elegante sopra, mentre sotto hai i pantaloni del pigiama' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'CHAT', clue: 'Dove il collega scrive "ci sei?" senza dirti cosa vuole davvero' },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'AGENDA', clue: 'Il posto magico in cui rimandi tutto a "lunedì prossimo"' },
      ],
    },
    {
      id: 'fb_cb4',
      theme: 'Casa & Coinquilini',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'FRIGO', clue: 'Contiene il tuo yogurt col nome scritto col pennarello indelebile' },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'AFFITTO', clue: 'Svuota il tuo conto corrente ogni 1° del mese alle 08:00' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'BAGNO', clue: 'Diventa occupato per 50 minuti esatti proprio quando hai fretta' },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'OSPITE', clue: 'L’amico sul divano "solo per stasera" da ormai due settimane' },
      ],
    },
    {
      id: 'fb_cb5',
      theme: 'Notte Brava',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 4, col: 0, word: 'TAVOLO', clue: 'Lo prenotate "per fare i signori" ma dividete la spesa in dodici' },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 0, word: 'AFTER', clue: 'Quello che propone l’amico con troppe energie alle 06:00' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 5, word: 'DISCO', clue: 'Locale dove dici "non si sente niente" ma torni senza voce' },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'REMIX', clue: 'Versione velocizzata della hit anni 2000 che mette il DJ alle 3' },
      ],
    },
    {
      id: 'fb_cb6',
      theme: 'Dating & App',
      rows: 9,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 4, col: 0, word: 'TINDER', clue: 'L’app su cui giudichi la compatibilità dell’anima in 0,4 secondi' },
        { id: 'w2', number: 2, direction: 'V', row: 3, col: 0, word: 'STORIA', clue: 'Quella su Instagram con canzone triste messa per farti notare' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'CUORE', clue: 'Emoji inviata per errore al posto del pollice su' },
        { id: 'w4', number: 4, direction: 'H', row: 8, col: 0, word: 'AMICO', clue: 'Ciò che diventi subito dopo "ti vedo solo come un..."' },
      ],
    },
    {
      id: 'fb_cb7',
      theme: 'Chat di Gruppo',
      rows: 6,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'VOCALE', clue: 'Quello da 6 minuti e 40 secondi che sei costretto ad ascoltare a 2x' },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'INVITO', clue: 'Cena che organizzate da tre mesi ma poi saltano tutti' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SPAM', clue: 'I trenta link consecutivi dell’amico che piazza i biglietti' },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'ORARIO', clue: 'L’unico dato che nessuno legge mai nel messaggio fissato in alto' },
      ],
    },
    {
      id: 'fb_cb8',
      theme: 'Pizza & Consegna',
      rows: 6,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'CONTO', clue: 'Appena arriva sul tavolo tutti guardano improvvisamente lo schermo' },
        { id: 'w2', number: 2, direction: 'V', row: 1, col: 0, word: 'ACQUA', clue: 'Quella liscia che ordini insieme al fritto misto per sentirti sano' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SETE', clue: 'Quella feroce alle 3 di notte dopo una pizza piccante' },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'AVANZI', clue: 'Li porti via nel contenitore anche se sono tre patatine' },
      ],
    },
  ],
  tribunale: [
    {
      id: 'fb_tr1',
      title: 'Il Caso del Conto alla Romana',
      scenario: 'Qualcuno ha ordinato antipasto di mare, tagliata e 3 cocktail, poi propone di dividere il conto "alla pari".',
      accusaRole: 'Accusa: Ognuno paga ciò che prende',
      difesaRole: 'Difesa: Tra amici non si fa i tirchi!',
      penalty: 'Offre un amaro o caffè al vincitore al prossimo giro.',
    },
    {
      id: 'fb_tr2',
      title: 'Il Vocale da 7 Minuti',
      scenario: 'Ore 09:14 di lunedì: manda un vocale di 7 minuti con pause per bere l’acqua senza spiegare perché.',
      accusaRole: 'Accusa: I vocali lunghi sono un sequestro',
      difesaRole: 'Difesa: A scrivere non si capiva il tono!',
      penalty: 'Parla i prossimi 2 round con frasi da massimo 5 parole.',
    },
    {
      id: 'fb_tr3',
      title: 'Il Ritardatario Cronico',
      scenario: 'Appuntamento alle 21:00. Alle 21:25 scrive "sto scendendo ora" ma è ancora in accappatoio.',
      accusaRole: 'Accusa: Aspettarti al freddo è maleducazione',
      difesaRole: 'Difesa: Il mio 21:00 è sempre indicativo!',
      penalty: 'Alla prossima uscita arriva 10 minuti prima o paga pegno.',
    },
    {
      id: 'fb_tr4',
      title: 'Furto di Patatine',
      scenario: 'Dice "non ho fame, non ordino niente". Appena arriva il tuo piatto affonda la mano nelle tue patatine.',
      accusaRole: 'Accusa: Le patatine nel piatto altrui sono sacre!',
      difesaRole: 'Difesa: Assaggiare un boccone è segno d’amicizia',
      penalty: 'Cede l’ultimo snack o fetta della serata al vincitore.',
    },
    {
      id: 'fb_tr5',
      title: 'Foto Brutta nelle Storie',
      scenario: 'Pubblica una storia dove lui/lei è venuto benissimo e tu hai gli occhi mezzichiusi mentre mastichi.',
      accusaRole: 'Accusa: Serve approvazione scritta prima di postare',
      difesaRole: 'Difesa: Conta il mood vero, mica Instagram!',
      penalty: 'Scatta lui/lei tutte le foto ricordo della serata.',
    },
    {
      id: 'fb_tr6',
      title: 'Dittatura dell’Aux in Auto',
      scenario: 'Viaggio di 2 ore: prende il Bluetooth e mette solo sue tracce sperimentali vietando i classici da cantare.',
      accusaRole: 'Accusa: In auto comanda la democrazia del gruppo!',
      difesaRole: 'Difesa: Vi stavo elevando culturalmente!',
      penalty: 'Fa un brindisi epico in piedi adesso.',
    },
    {
      id: 'fb_tr7',
      title: 'Il Pacco alle 19:58',
      scenario: 'Tavolo prenotato da una settimana. Alle 19:58 scrive "raga ho un imprevisto assurdo" ma è sul divano.',
      accusaRole: 'Accusa: Il divano col plaid non è un imprevisto!',
      difesaRole: 'Difesa: Batteria sociale a zero = legittima difesa',
      penalty: 'Organizza e prenota davvero la prossima serata.',
    },
    {
      id: 'fb_tr8',
      title: 'Piatti "A Mollo"',
      scenario: 'Lascia la padella incrostata nel lavandino per quattro giorni giurando che "si ammorbidisce meglio".',
      accusaRole: 'Accusa: Quella padella ha ormai vita propria!',
      difesaRole: 'Difesa: L’ammollo lungo è chimica efficiente!',
      penalty: 'Sparecchia bicchieri o piatti del tavolo a fine partita.',
    },
  ],
  preferiresti: [
    {
      id: 'fb_pr1',
      prompt: 'Preferiresti che per il resto della vita...',
      options: [
        'Ogni tuo starnuto suonasse come una tromba da stadio',
        'Tutte le tue bugie facessero diventare le tue orecchie fluorescenti',
        'Dovessi cantare in falsetto ogni volta che ordini al ristorante',
        'Il tuo cellulare leggesse ad alta voce l’ultimo messaggio appena lo sblocchi',
      ],
      penalty: 'Chi resta in minoranza difende la propria scelta!',
      familiarita: 'tutti',
    },
    {
      id: 'fb_pr2',
      prompt: 'Preferiresti scoprire all’improvviso che...',
      options: [
        'La tua prima cotta del liceo è diventata il tuo nuovo capo',
        'I tuoi genitori hanno trovato e letto tutta la tua cronologia segreta',
        'Il tuo ex ha scritto un libro bestseller pieno di tuoi difetti',
        'Tutti i tuoi amici hanno una chat di gruppo segreta senza di te',
      ],
      penalty: 'Chi sceglie la scelta meno votata si giustifica dal vivo!',
      familiarita: 'tutti',
    },
    {
      id: 'fb_pr3',
      prompt: 'Per avere 100.000€ subito, preferiresti che...',
      options: [
        'Il tuo ex scegliesse i tuoi outfit per tutto il prossimo anno',
        'Ogni sabato sera dovessi andare a letto alle 21:30 per 2 anni',
        'Non potessi più usare nessuna app di messaggistica per 12 mesi',
        'Dovessi dire sempre e solo la verità assoluta ai tuoi colleghi per 6 mesi',
      ],
      penalty: 'Difendi la tua scelta davanti al tavolo!',
      familiarita: 'tutti',
    },
    {
      id: 'fb_pr4',
      prompt: 'Durante un primo appuntamento perfetto, preferiresti che...',
      options: [
        'Ti scappasse un rutto fragoroso nel silenzio totale del locale',
        'La persona ti chiamasse per sbaglio con il nome del suo ex tre volte',
        'Ti accorgessi a fine cena di avere la carta bloccata e zero contanti',
        'Arrivassero al tavolo accanto i tuoi genitori a salutarti entusiasti',
      ],
      penalty: 'Chi resta in minoranza spiega come ne uscirebbe vivo!',
      familiarita: 'nuove_conoscenze',
    },
    {
      id: 'fb_pr5',
      prompt: 'Se potessi avere un superpotere scomodo, preferiresti...',
      options: [
        'Leggere i pensieri degli altri, ma solo quando parlano male di te',
        'Diventare invisibile, ma solo quando trattieni completamente il respiro',
        'Viaggiare nel tempo, ma solo tornando a momenti imbarazzanti della tua vita',
        'Capire cosa dicono gli animali, ma scoprire che ti giudicano di continuo',
      ],
      penalty: 'Difendi il tuo superpotere contro gli altri!',
      familiarita: 'nuove_conoscenze',
    },
    {
      id: 'fb_pr6',
      prompt: 'In vacanza con questo gruppo per 10 giorni, preferiresti...',
      options: [
        'Dormire in una stanza senza aria condizionata con chi russa più forte',
        'Fare da tesoriere e litigare su ogni scontrino da 2 euro',
        'Seguire un itinerario militare con sveglia alle 6:00 ogni mattina',
        'Perdere la valigia il primo giorno e vestirti solo coi vestiti prestati dal gruppo',
      ],
      penalty: 'La minoranza difende la sua sopravvivenza in vacanza!',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_pr7',
      prompt: 'Preferiresti che per un anno intero...',
      options: [
        'Ogni tua storia Instagram venisse pubblicata anche su LinkedIn',
        'Tutti i tuoi vocali WhatsApp venissero trascritti in maiuscolo',
        'Partisse la tua playlist più imbarazzante a tutto volume entrando nei bar',
        'Dovessi mettere like obbligatorio a ogni post del tuo ex',
      ],
      penalty: 'Chi resta in minoranza giustifica la propria follia digitale!',
      familiarita: 'tutti',
    },
    {
      id: 'fb_pr8',
      prompt: 'Preferiresti vivere il resto della vita in un mondo dove...',
      options: [
        'La pizza esiste solo con l’ananas sopra',
        'Il caffè è stato vietato per legge in tutto il pianeta',
        'Tutte le canzoni durano esattamente 15 secondi come su TikTok',
        'Si può uscire di casa solo indossando infradito con i calzini bianchi',
      ],
      penalty: 'Difendi questo mondo distopico!',
      familiarita: 'nuove_conoscenze',
    },
    {
      id: 'fb_pr9',
      prompt: 'Al matrimonio del tuo migliore amico, preferiresti...',
      options: [
        'Inciampare e far cadere la torta nuziale davanti a 150 invitati',
        'Fare un discorso al microfono sbagliando completamente il nome dello sposo/a',
        'Presentarti vestito di bianco esattamente come la sposa',
        'Addormentarti rumorosamente durante i voti in prima fila',
      ],
      penalty: 'Chi è in minoranza spiega perché la sua figuraccia si perdona prima!',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_pr10',
      prompt: 'Preferiresti che nel tuo gruppo di amici nessuno potesse mai più...',
      options: [
        'Mandare vocali più lunghi di 20 secondi',
        'Annullare un’uscita con meno di 3 ore di preavviso',
        'Sparire quando si fidanza per poi ricomparire da single',
        'Dividere il conto alla romana quando qualcuno ha preso 4 cocktail',
      ],
      penalty: 'Convinci il tavolo che la tua legge è la più giusta!',
      familiarita: 'vecchi_amici',
    },
  ],
  percorso: [
    {
      id: 'fb_pe1',
      cardMode: 'percorso',
      tappa: 1,
      tappaNome: 'Le Basi',
      text: 'Hai appena finito gli studi: scegli il lavoro stabile ma anonimo sotto casa, oppure parti da zero in una città nuova senza certezze?',
      optionA: 'Resto sul sicuro',
      optionB: 'Parto da zero',
      spuntiA: ['Costruire basi solide riduce lo stress', 'Puoi sempre ripartire con risorse vere'],
      spuntiB: ['Il coraggio si allena quando hai meno da perdere', 'Cambiare ambiente accelera chi sei'],
      domandaRilancio: 'Qual è l’età in cui il coraggio diventa incoscienza, o vice-versa?',
      lezioneReale: 'La sicurezza comprata troppo presto può costare caro in rimpianti.',
    },
    {
      id: 'fb_pe2',
      cardMode: 'percorso',
      tappa: 2,
      tappaNome: 'I Bivi',
      text: 'Ti offrono una promozione che raddoppia lo stipendio ma ti toglie quasi tutte le sere libere: accetti per cinque anni o proteggi il tuo tempo?',
      optionA: 'Accetto per 5 anni',
      optionB: 'Proteggo il tempo',
      spuntiA: ['Cinque anni intensi comprano libertà futura', 'Le occasioni vere non aspettano'],
      spuntiB: ['Il tempo perso con chi ami non si ricompra', 'Cinque anni diventano facilmente venti'],
      domandaRilancio: 'Quanta parte della tua giornata sei disposto a vendere?',
      lezioneReale: 'Ogni sì a un sacrificio lungo cambia anche chi ti aspetta a casa.',
    },
    {
      id: 'fb_pe3',
      cardMode: 'percorso',
      tappa: 3,
      tappaNome: 'I Legami',
      text: 'Un amico fidato sta per prendere una decisione disastrosa e non te lo ha chiesto: gli dici la verità scomoda rischiando la rottura, o resti solo a supporto?',
      optionA: 'Dico la verità scomoda',
      optionB: 'Lo supporto in silenzio',
      spuntiA: ['L’amicizia vera regge il conflitto', 'Tacere per quieto vivere è complicità'],
      spuntiB: ['Ognuno deve vivere i propri errori', 'Giudicare da fuori crea distanza'],
      domandaRilancio: 'Preferisci un amico che ti applaudisca o uno che ti fermi?',
    },
  ],
  storia: [
    {
      id: 'fb_st1',
      cardMode: 'storia',
      text: 'La tua valigia di pelle è ancora sul letto e il treno delle 07:10 parte tra venti minuti: chiudi quel capitolo senza biglietto di ritorno o disdici tutto per una spiegazione faccia a faccia?',
      optionA: 'Salgo sul treno',
      optionB: 'Resto a chiarire',
      spuntiA: ['Restare riapre ferite già decise', 'La distanza dà respiro vero'],
      spuntiB: ['Fuggire lascia domande eterne', 'Guardarsi negli occhi chiude davvero'],
      storyScene: {
        storyId: 'bussola-notturna',
        title: 'La Stazione di Mezza Notte',
        protagonist: 'Luca',
        premessa: 'Dopo dieci anni nello stesso ufficio e una promessa mai mantenuta, trovi una lettera sulla scrivania: «Domani puoi cambiare vita, ma non puoi tornare indietro».',
        actTitle: 'Atto I · La Partenza',
        sceneNarration: 'Il binario 4 profuma di pioggia e caffè bruciato. Il telefono vibra in tasca: è proprio la persona da cui stai scappando.',
        consequenceA: 'Sali sull’ultimo vagone senza guardare indietro. Quando le luci della città spariscono dietro i vetri, senti per la prima volta il silenzio addosso.',
        consequenceB: 'Appoggi la valigia a terra e riapri il portone. La conversazione dura fino all’alba, ma nulla resta più nascosto.',
      },
    },
    {
      id: 'fb_st2',
      cardMode: 'storia',
      text: 'Mesi dopo ricevi l’offerta che aspettavi da una vita, ma firmarla significa compromettere il progetto di chi ti ha aiutato ad arrivare fin lì: firmi da solo o rifiuti il contratto?',
      optionA: 'Firmo e vado avanti',
      optionB: 'Rifiuto per lealtà',
      spuntiA: ['Nessuno può chiedere a te di restare fermo', 'La riconoscenza non è un ergastolo'],
      spuntiB: ['Ci sono debiti di cuore più grandi di una firma', 'Il successo senza rispetto sa di vuoto'],
      storyScene: {
        storyId: 'bussola-notturna',
        title: 'La Stazione di Mezza Notte',
        protagonist: 'Luca',
        actTitle: 'Atto II · Il Prezzo',
        sceneNarration: 'Lo studio al diciottesimo piano è silenzioso. Sulla scrivania c’è una penna d’acciaio e la mail ancora in bozza.',
        consequenceA: 'La tua firma scivola rapida sulla carta. Esci dal palazzo con un titolo nuovo e una telefonata rimandata per sempre.',
        consequenceB: 'Chiudi la cartellina e spingi indietro la sedia. Rinunci al salto più grande, ma riconosci la tua voce allo specchio.',
        epiloghi: [
          { minA: 0, maxA: 0, text: 'Epilogo · La Piazza Piena: hai scelto ogni volta le persone prima delle fughe. La strada è più lenta, ma non cammini mai da solo.' },
          { minA: 1, maxA: 1, text: 'Epilogo · Il Ponte a Metà: hai saputo sia tagliare che restare quando contava. Il passato e il futuro ora parlano la stessa lingua.' },
          { minA: 2, maxA: 2, text: 'Epilogo · L’Orizzonte Aperto: nessuna ancora ti ha trattenuto. Sei arrivato lontano, esattamente dove nessun altro avrebbe osato seguirti.' },
        ],
      },
    },
  ],
  mix: [
    {
      id: 'fb_mx1',
      cardMode: 'flash',
      text: 'Se un amico organizza una cena nel ristorante peggiore della città per il suo compleanno: vai e fingi entusiasmo o proponi di cambiare locale?',
      optionA: 'Vado e sorrido',
      optionB: 'Propongo di cambiare',
      spuntiA: ['La serata è sua, il cibo passa in secondo piano', 'Meglio una pizza scadente che rovinare l’umore'],
      spuntiB: ['Spendere 40€ per mangiare male non fa piacere a nessuno', 'Un consiglio onesto salva la serata a tutti'],
    },
    {
      id: 'fb_mx2',
      cardMode: 'infiltrato',
      groupQuestion: 'Qual è l’ultima serie TV o film che hai divorato in un solo weekend?',
      impostorQuestion: 'Qual è il film più famoso che tutti adorano ma tu non sei mai riuscito a finire?',
      category: 'intrattenimento',
    },
    {
      id: 'fb_mx3',
      cardMode: 'assurdo',
      cardType: 'gogna',
      prompt: 'Chi di voi risponde ai messaggi con tre giorni di ritardo scrivendo "Scusa ho visto ora!"?',
      penalty: 'Mostra l’ultima chat lasciata in visualizzato o bevi 1 sorso!',
    },
    {
      id: 'fb_mx4',
      cardMode: 'coppie',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'In una gita improvvisata di gruppo, chi finirebbe per fare da navigatore e litigare con chi guida?',
      optionA: 'Guido io e comando',
      optionB: 'Faccio il navigatore ansioso',
    },
    {
      id: 'fb_mx5',
      cardMode: 'flash',
      text: 'Trovi per sbaglio aperto il diario o le note segrete del tuo coinquilino: chiudi subito o leggi almeno due righe?',
      optionA: 'Chiudo all’istante',
      optionB: 'Due righe le sbircio',
      spuntiA: ['La privacy altrui è sacra, anche se tentatrice', 'Potresti leggere qualcosa che preferivi non sapere'],
      spuntiB: ['La curiosità umana davanti a uno schermo aperto è invincibile', 'Almeno sai se parla di te'],
    },
    {
      id: 'fb_mx6',
      cardMode: 'infiltrato',
      groupQuestion: 'Qual è il piatto che sai cucinare meglio quando inviti qualcuno a cena?',
      impostorQuestion: 'Qual è il cibo da asporto che ordini quando non hai voglia di fare nulla?',
      category: 'cibo',
    },
    {
      id: 'fb_mx7',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Accetteresti di cantare a squarciagola una canzone neomelodica in un bar pieno in cambio della cena pagata per tutto il tavolo?',
      optionA: 'Microfono subito!',
      optionB: 'Pago io il conto ma taccio',
      sentenza: 'L’amore per il tavolo si misura in decibel.',
    },
    {
      id: 'fb_mx8',
      cardMode: 'coppie',
      cardType: 'verita',
      intensity: 'profondo',
      prompt: 'Qual è una paura o un traguardo del prossimo anno che non hai ancora raccontato ad alta voce?',
      penalty: 'Condividilo ora o 1 sorso!',
    },
    {
      id: 'fb_mx9',
      cardMode: 'cruciverba',
      theme: 'Serata al Bar',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'SPRITZ', clue: 'Arancione o rosso, trasforma il "beviamo solo una cosa" in mezzanotte' },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'PIZZA', clue: 'Quella che ordini alle 23 giurando di prendere "solo metà"' },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'NOTTE', clue: 'Inizia con "sto a casa a dormire" e finisce con un cornetto caldo' },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 1, word: 'AMARO', clue: 'Lo bevi "per digerire" anche dopo aver mangiato tre patatine' },
      ],
    },
    {
      id: 'fb_mx10',
      cardMode: 'tribunale',
      title: 'Il Caso del Conto alla Romana',
      scenario: 'Qualcuno ha ordinato antipasto, tagliata e 3 cocktail e propone comunque di dividere il conto alla pari!',
      accusaRole: 'Accusa: Ognuno paga ciò che ha preso',
      difesaRole: 'Difesa: Tra amici non si guarda la calcolatrice!',
      penalty: 'Offre il prossimo caffè o amaro a chi ha vinto la causa.',
    },
    {
      id: 'fb_mx11',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti che il tuo telefono...',
      options: [
        'Avvisasse tutti quando fai uno screenshot di una chat',
        'Mandasse un cuore automatico a chiunque visualizzi la tua storia',
        'Mostrasse agli amici quanti minuti passi sui social ogni giorno',
        'Non potesse mai più mettere il silenzioso né la vibrazione',
      ],
      penalty: 'Difendi la tua scelta davanti al tavolo!',
    },
    {
      id: 'fb_mx12',
      cardMode: 'preferiresti',
      prompt: 'Se dovessi cambiare vita domani, preferiresti...',
      options: [
        'Aprire un chiringuito su un’isola sperduta senza Wi-Fi',
        'Diventare famoso su internet ma per un meme ridicolo',
        'Lavorare 2 ore al giorno con uno stipendio appena sufficiente',
        'Lavorare 60 ore a settimana per andare in pensione milionario a 45 anni',
      ],
      penalty: 'Chi resta in minoranza si difende!',
    },
  ],
};
