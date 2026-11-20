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
  | 'ghigliottina'
  | 'stima'
  | 'bufala'
  | 'intesa'
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
  choices?: string[];
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

export interface PassGhigliottinaCard {
  id: string;
  cardMode?: PassCardOriginMode;
  clues: string[];
  answer: string;
  choices: string[];
  connections: string[];
  familiarita?: PassFamiliarita;
}

export interface PassStimaCard {
  id: string;
  cardMode?: PassCardOriginMode;
  prompt: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  answer: number;
  funFact: string;
  familiarita?: PassFamiliarita;
}

export interface PassBufalaCard {
  id: string;
  cardMode?: PassCardOriginMode;
  statement: string;
  isTrue: boolean;
  explanation: string;
  category: string;
  familiarita?: PassFamiliarita;
}

export interface PassIntesaCard {
  id: string;
  cardMode?: PassCardOriginMode;
  word: string;
  forbidden: string[];
  category: string;
  familiarita?: PassFamiliarita;
}

export type PassCard =
  | PassFlashCard
  | PassInfiltratoCard
  | PassCoppieCard
  | PassAssurdoCard
  | PassCruciverbaCard
  | PassTribunaleCard
  | PassPreferirestiCard
  | PassGhigliottinaCard
  | PassStimaCard
  | PassBufalaCard
  | PassIntesaCard;

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
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'SPRITZ', clue: 'Arancione o rosso, trasforma il "beviamo solo una cosa" in mezzanotte', choices: ['SPRITZ', 'SPAGHI', 'CALICE', 'TONICA'] },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'PIZZA', clue: 'Quella che ordini alle 23 giurando di prendere "solo metà"', choices: ['PIZZA', 'PASTA', 'PINSA', 'OLIVE'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'NOTTE', clue: 'Inizia con "sto a casa a dormire" e finisce con un cornetto caldo', choices: ['NOTTE', 'BOTTE', 'FESTA', 'CORSO'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 1, word: 'AMARO', clue: 'Lo bevi "per digerire" anche dopo aver mangiato tre patatine', choices: ['AMARO', 'ACQUA', 'AMICI', 'BIRRA'] },
      ],
    },
    {
      id: 'fb_cb2',
      theme: 'Vacanza con gli Amici',
      rows: 6,
      cols: 8,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 1, word: 'VALIGIA', clue: 'La chiudi sedendotici sopra alle 5 del mattino prima di partire', choices: ['VALIGIA', 'VACANZA', 'VIAGGIO', 'TURISMO'] },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'VOLO', clue: 'Partenza alle 06:15 per risparmiare 14 euro e perdere un anno di vita', choices: ['VOLO', 'VANO', 'MARE', 'SOLE'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SOLARE', clue: 'Crema che dici di aver messo ma alle 14 sembri un gambero', choices: ['SOLARE', 'SALINA', 'PALUDE', 'ESTATE'] },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'HOTEL', clue: 'Sul sito era "vista mare", ma il mare si vede solo dal bagno', choices: ['HOTEL', 'MOTEL', 'MAREA', 'TENDA'] },
      ],
    },
    {
      id: 'fb_cb3',
      theme: 'Smart Working & Call',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'MUTATO', clue: 'Come scopri di avere il microfono dopo un monologo su Meet', choices: ['MUTATO', 'MINUTO', 'LAVORO', 'SCHEDA'] },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'CAMICIA', clue: 'Elegante sopra, mentre sotto hai i pantaloni del pigiama', choices: ['CAMICIA', 'DOMANDA', 'PIGIAMA', 'UFFICIO'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'CHAT', clue: 'Dove il collega scrive "ci sei?" senza dirti cosa vuole davvero', choices: ['CHAT', 'SPAM', 'MAIL', 'CALL'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'AGENDA', clue: 'Il posto magico in cui rimandi tutto a "lunedì prossimo"', choices: ['AGENDA', 'ATTESA', 'ORARIO', 'REPORT'] },
      ],
    },
    {
      id: 'fb_cb4',
      theme: 'Casa & Coinquilini',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'FRIGO', clue: 'Contiene il tuo yogurt col nome scritto col pennarello indelebile', choices: ['FRIGO', 'FORNO', 'LETTO', 'PIANO'] },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'AFFITTO', clue: 'Svuota il tuo conto corrente ogni 1° del mese alle 08:00', choices: ['AFFITTO', 'UFFICIO', 'BALCONE', 'PULIZIA'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'BAGNO', clue: 'Diventa occupato per 50 minuti esatti proprio quando hai fretta', choices: ['BAGNO', 'FUGHE', 'PORTA', 'TENDA'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'OSPITE', clue: 'L’amico sul divano "solo per stasera" da ormai due settimane', choices: ['OSPITE', 'ORDINE', 'DIVANO', 'CHIAVI'] },
      ],
    },
    {
      id: 'fb_cb5',
      theme: 'Notte Brava',
      rows: 7,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 4, col: 0, word: 'TAVOLO', clue: 'Lo prenotate "per fare i signori" ma dividete la spesa in dodici', choices: ['TAVOLO', 'TICKET', 'LOCALE', 'SERATA'] },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 0, word: 'AFTER', clue: 'Quello che propone l’amico con troppe energie alle 06:00', choices: ['AFTER', 'NOTTE', 'PISTA', 'CASSA'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 5, word: 'DISCO', clue: 'Locale dove dici "non si sente niente" ma torni senza voce', choices: ['DISCO', 'BALLO', 'LISTA', 'DRINK'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'REMIX', clue: 'Versione velocizzata della hit anni 2000 che mette il DJ alle 3', choices: ['REMIX', 'RITMO', 'VOCAL', 'SUONO'] },
      ],
    },
    {
      id: 'fb_cb6',
      theme: 'Dating & App',
      rows: 9,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 4, col: 0, word: 'TINDER', clue: 'L’app su cui giudichi la compatibilità dell’anima in 0,4 secondi', choices: ['TINDER', 'TESORO', 'COPPIA', 'AMANTI'] },
        { id: 'w2', number: 2, direction: 'V', row: 3, col: 0, word: 'STORIA', clue: 'Quella su Instagram con canzone triste messa per farti notare', choices: ['STORIA', 'STELLA', 'SOCIAL', 'PAROLA'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'CUORE', clue: 'Emoji inviata per errore al posto del pollice su', choices: ['CUORE', 'AMORE', 'MATCH', 'FIORE'] },
        { id: 'w4', number: 4, direction: 'H', row: 8, col: 0, word: 'AMICO', clue: 'Ciò che diventi subito dopo "ti vedo solo come un..."', choices: ['AMICO', 'AMATO', 'BACIO', 'SOGNO'] },
      ],
    },
    {
      id: 'fb_cb7',
      theme: 'Chat di Gruppo',
      rows: 6,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'VOCALE', clue: 'Quello da 6 minuti e 40 secondi che sei costretto ad ascoltare a 2x', choices: ['VOCALE', 'VISITA', 'GRUPPO', 'SCRIVO'] },
        { id: 'w2', number: 2, direction: 'V', row: 0, col: 0, word: 'INVITO', clue: 'Cena che organizzate da tre mesi ma poi saltano tutti', choices: ['INVITO', 'AVVISO', 'SERATA', 'USCIRE'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SPAM', clue: 'I trenta link consecutivi dell’amico che piazza i biglietti', choices: ['SPAM', 'CHAT', 'LINK', 'MEME'] },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'ORARIO', clue: 'L’unico dato che nessuno legge mai nel messaggio fissato in alto', choices: ['ORARIO', 'OPPURE', 'GIORNO', 'TAVOLA'] },
      ],
    },
    {
      id: 'fb_cb8',
      theme: 'Pizza & Consegna',
      rows: 6,
      cols: 6,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'CONTO', clue: 'Appena arriva sul tavolo tutti guardano improvvisamente lo schermo', choices: ['CONTO', 'CARTA', 'PIZZA', 'FORNO'] },
        { id: 'w2', number: 2, direction: 'V', row: 1, col: 0, word: 'ACQUA', clue: 'Quella liscia che ordini insieme al fritto misto per sentirti sano', choices: ['ACQUA', 'ACETO', 'BIRRA', 'PASTA'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SETE', clue: 'Quella feroce alle 3 di notte dopo una pizza piccante', choices: ['SETE', 'NOTE', 'FAME', 'CIBO'] },
        { id: 'w4', number: 4, direction: 'H', row: 5, col: 0, word: 'AVANZI', clue: 'Li porti via nel contenitore anche se sono tre patatine', choices: ['AVANZI', 'ARANCE', 'ORDINE', 'PIATTO'] },
      ],
    },
    {
      id: 'fb_cb9',
      theme: 'Aereo & Aeroporto',
      rows: 7,
      cols: 7,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'RITARDO', clue: 'L’unica vera costante garantita dal tabellone partenze del venerdì', choices: ['RITARDO', 'RIENTRO', 'DECOLLO', 'BAGAGLI'] },
        { id: 'w2', number: 2, direction: 'V', row: 1, col: 0, word: 'PREZZO', clue: 'Raddoppia magicamente dopo che hai ricaricato la pagina due volte', choices: ['PREZZO', 'PRONTO', 'CODICE', 'VIAGGI'] },
        { id: 'w3', number: 3, direction: 'V', row: 1, col: 3, word: 'GATE', clue: 'È sempre in fondo al corridoio più lontano del terminal sbagliato', choices: ['GATE', 'SALA', 'VOLO', 'TAXI'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'OFFERTA', clue: 'Biglietto "a 9 euro" che al pagamento diventa misteriosamente 118', choices: ['OFFERTA', 'OPZIONE', 'TARIFFA', 'IMBARCO'] },
      ],
    },
    {
      id: 'fb_cb10',
      theme: 'Divano & Serie TV',
      rows: 7,
      cols: 7,
      words: [
        { id: 'w1', number: 1, direction: 'H', row: 3, col: 0, word: 'SPOILER', clue: 'La rivelazione killer che ti rovina il finale prima di cena', choices: ['SPOILER', 'SCHERMO', 'PUNTATA', 'EPISODI'] },
        { id: 'w2', number: 2, direction: 'V', row: 1, col: 0, word: 'PISOLO', clue: 'Quello sul divano al minuto 12 urlando "non sto dormendo, ti ascolto!"', choices: ['PISOLO', 'CASINO', 'DIVANO', 'CINEMA'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 3, word: 'SERIE', clue: 'Ne inizi una da 8 stagioni giurando di guardare "solo una puntata"', choices: ['SERIE', 'AUDIO', 'TRAMA', 'VIDEO'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 0, word: 'OSCAR', clue: 'La notte in cui tutti diventano critici cinematografici professionisti', choices: ['OSCAR', 'OPERA', 'SCENA', 'REGIA'] },
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
        { id: 'w1', number: 1, direction: 'H', row: 2, col: 0, word: 'SPRITZ', clue: 'Arancione o rosso, trasforma il "beviamo solo una cosa" in mezzanotte', choices: ['SPRITZ', 'SPAGHI', 'CALICE', 'TONICA'] },
        { id: 'w2', number: 2, direction: 'V', row: 2, col: 1, word: 'PIZZA', clue: 'Quella che ordini alle 23 giurando di prendere "solo metà"', choices: ['PIZZA', 'PASTA', 'PINSA', 'OLIVE'] },
        { id: 'w3', number: 3, direction: 'V', row: 0, col: 4, word: 'NOTTE', clue: 'Inizia con "sto a casa a dormire" e finisce con un cornetto caldo', choices: ['NOTTE', 'BOTTE', 'FESTA', 'CORSO'] },
        { id: 'w4', number: 4, direction: 'H', row: 6, col: 1, word: 'AMARO', clue: 'Lo bevi "per digerire" anche dopo aver mangiato tre patatine', choices: ['AMARO', 'ACQUA', 'AMICI', 'BIRRA'] },
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
  ghigliottina: [
    {
      id: 'fb_gh1',
      cardMode: 'ghigliottina',
      clues: ['DENTE', 'SOVRANO', 'SPINE', 'ALLORO', 'MESSICO'],
      answer: 'CORONA',
      choices: ['CORONA', 'PIETRA', 'ANELLO', 'CARTA'],
      connections: [
        'La parte visibile o protesica del dente',
        'Il simbolo regale del sovrano',
        'La corona di spine',
        'La corona d’alloro dei laureati',
        'La celebre birra messicana Corona',
      ],
    },
    {
      id: 'fb_gh2',
      cardMode: 'ghigliottina',
      clues: ['NOTTE', 'CASA', 'ARMA', 'FUMATA', 'BANDIERA'],
      answer: 'BIANCA',
      choices: ['BIANCA', 'ROSSA', 'CHIARA', 'LIBERA'],
      connections: [
        'La Notte Bianca degli eventi cittadini',
        'La Casa Bianca presidenziale',
        'Un’arma bianca (lama o punta)',
        'La fumata bianca dal comignolo',
        'Alzare bandiera bianca per resa',
      ],
    },
    {
      id: 'fb_gh3',
      cardMode: 'ghigliottina',
      clues: ['SOL', 'CASA', 'PORTA', 'INGLESE', 'LETTURA'],
      answer: 'CHIAVE',
      choices: ['CHIAVE', 'NOTA', 'CODA', 'PORTA'],
      connections: [
        'La chiave di sol sul pentagramma',
        'Le chiavi di casa',
        'La chiave per aprire la porta',
        'La chiave inglese da officina',
        'La chiave di lettura di un testo',
      ],
    },
    {
      id: 'fb_gh4',
      cardMode: 'ghigliottina',
      clues: ['FEBBRE', 'ETÀ', 'MEDAGLIA', 'NOZZE', 'MINIERA'],
      answer: 'ORO',
      choices: ['ORO', 'FERRO', 'FUOCO', 'LUCE'],
      connections: [
        'La corsa / febbre dell’oro',
        'L’età dell’oro',
        'La medaglia d’oro olimpica',
        'I cinquant’anni: nozze d’oro',
        'Una miniera d’oro',
      ],
    },
    {
      id: 'fb_gh5',
      cardMode: 'ghigliottina',
      clues: ['MACCHINA', 'LINEA', 'PERDITA', 'SPAZIO', 'PASSATO'],
      answer: 'TEMPO',
      choices: ['TEMPO', 'GIRO', 'PUNTO', 'CAMPO'],
      connections: [
        'La macchina del tempo',
        'La linea del tempo storica',
        'Una perdita di tempo',
        'Il tessuto spazio-tempo',
        'Il tempo passato in grammatica',
      ],
    },
    {
      id: 'fb_gh6',
      cardMode: 'ghigliottina',
      clues: ['BATTESIMO', 'CERCHIO', 'BOCCA', 'PAGLIA', 'ARTIFICIO'],
      answer: 'FUOCO',
      choices: ['FUOCO', 'ACQUA', 'FIAMMA', 'VENTO'],
      connections: [
        'Il battesimo del fuoco',
        'Il cerchio di fuoco circense',
        'Una bocca da fuoco',
        'Un fuoco di paglia che dura poco',
        'I fuochi d’artificio',
      ],
    },
    {
      id: 'fb_gh7',
      cardMode: 'ghigliottina',
      clues: ['CADENTE', 'MARINA', 'POLARE', 'CINEMA', 'NATALE'],
      answer: 'STELLA',
      choices: ['STELLA', 'LUNA', 'PIANTA', 'ROSA'],
      connections: [
        'Una stella cadente d’agosto',
        'La stella marina sugli scogli',
        'La Stella Polare per orientarsi',
        'Una stella del cinema',
        'La stella di Natale sul balcone',
      ],
    },
    {
      id: 'fb_gh8',
      cardMode: 'ghigliottina',
      clues: ['MONDO', 'ITALIA', 'VITE', 'BOA', 'VALZER'],
      answer: 'GIRO',
      choices: ['GIRO', 'PASSO', 'SALTO', 'CORSA'],
      connections: [
        'Il giro del mondo',
        'Il Giro d’Italia in bici',
        'Un giro di vite',
        'Il giro di boa a metà percorso',
        'Un giro di valzer',
      ],
    },
    {
      id: 'fb_gh9',
      cardMode: 'ghigliottina',
      clues: ['FIUME', 'CASTELLO', 'FERRO', 'CAMERA', 'OSPEDALE'],
      answer: 'LETTO',
      choices: ['LETTO', 'PONTE', 'PIANO', 'SALA'],
      connections: [
        'Il letto in cui scorre il fiume',
        'Il letto a castello',
        'La struttura in ferro battuto',
        'La camera da letto',
        'Un letto d’ospedale',
      ],
    },
    {
      id: 'fb_gh10',
      cardMode: 'ghigliottina',
      clues: ['DATI', 'SANGUE', 'SEME', 'ITALIA', 'SVIZZERA'],
      answer: 'BANCA',
      choices: ['BANCA', 'CASA', 'CASSETTA', 'TORRE'],
      connections: [
        'Una banca dati digitale',
        'La banca del sangue per donazioni',
        'La banca del seme o dei semi',
        'La Banca d’Italia',
        'La tradizione bancaria svizzera',
      ],
    },
  ],
  stima: [
    {
      id: 'fb_st1',
      cardMode: 'stima',
      prompt: 'Quanto è lunga un’intera corsia interna della pista d’atletica regolamentare?',
      unit: 'm',
      min: 100,
      max: 1000,
      step: 50,
      answer: 400,
      funFact: 'Un giro completo nella corsia 1 misura esattamente 400 metri!',
    },
    {
      id: 'fb_st2',
      cardMode: 'stima',
      prompt: 'In che anno uscì al cinema il primo «Toy Story»?',
      unit: 'anno',
      min: 1980,
      max: 2010,
      step: 1,
      answer: 1995,
      funFact: 'Toy Story (1995) fu il primo lungometraggio nella storia realizzato interamente in animazione CGI.',
    },
    {
      id: 'fb_st3',
      cardMode: 'stima',
      prompt: 'Quante carte compongono un mazzo tradizionale italiano (napoletane o piacentine)?',
      unit: 'carte',
      min: 20,
      max: 60,
      step: 2,
      answer: 40,
      funFact: 'Quattro semi da dieci carte ciascuno (dall’asso al re): esattamente 40 carte.',
    },
    {
      id: 'fb_st4',
      cardMode: 'stima',
      prompt: 'Quanti tasti ha un pianoforte da concerto standard tra bianchi e neri?',
      unit: 'tasti',
      min: 52,
      max: 112,
      step: 2,
      answer: 88,
      funFact: 'Un pianoforte moderno ha 52 tasti bianchi e 36 tasti neri, per un totale di 88 tasti.',
    },
    {
      id: 'fb_st5',
      cardMode: 'stima',
      prompt: 'Qual è l’altezza del Monte Bianco (vetta principale tra Italia e Francia)?',
      unit: 'm',
      min: 3500,
      max: 6000,
      step: 10,
      answer: 4810,
      funFact: 'Secondo la misura topografica recente la calotta nevosa oscilla intorno ai 4.806–4.810 metri.',
    },
    {
      id: 'fb_st6',
      cardMode: 'stima',
      prompt: 'Quanti secondi impiega la luce del Sole per raggiungere la Terra?',
      unit: 'secondi',
      min: 100,
      max: 1000,
      step: 10,
      answer: 500,
      funFact: 'Circa 499 secondi (poco più di 8 minuti e 19 secondi) per percorrere 150 milioni di km!',
    },
    {
      id: 'fb_st7',
      cardMode: 'stima',
      prompt: 'Quante caselle formano in totale una scacchiera standard?',
      unit: 'caselle',
      min: 32,
      max: 128,
      step: 4,
      answer: 64,
      funFact: 'Griglia 8×8 divisa perfettamente a metà tra 32 caselle chiare e 32 scure.',
    },
    {
      id: 'fb_st8',
      cardMode: 'stima',
      prompt: 'Quanti denti permanenti ha un adulto umano inclusi i quattro del giudizio?',
      unit: 'denti',
      min: 20,
      max: 44,
      step: 1,
      answer: 32,
      funFact: 'La dentatura permanente completa conta 32 denti, sedici sull’arcata superiore e sedici su quella inferiore.',
    },
    {
      id: 'fb_st9',
      cardMode: 'stima',
      prompt: 'Quanti giorni terrestri dura un anno completo di Marte attorno al Sole?',
      unit: 'giorni',
      min: 400,
      max: 900,
      step: 1,
      answer: 687,
      funFact: 'Un anno marziano dura circa 687 giorni terrestri, quasi il doppio del nostro!',
    },
    {
      id: 'fb_st10',
      cardMode: 'stima',
      prompt: 'Quanti chilometri è lunga una maratona olimpica (arrotondata all’intero)?',
      unit: 'km',
      min: 20,
      max: 65,
      step: 1,
      answer: 42,
      funFact: 'La distanza ufficiale è 42,195 km, fissata definitivamente alle Olimpiadi di Londra del 1908.',
    },
  ],
  bufala: [
    {
      id: 'fb_bf1',
      cardMode: 'bufala',
      category: 'Curiosità',
      statement: 'Le banconote in euro non sono fatte di carta ricavata dal legno, ma di fibra di cotone.',
      isTrue: true,
      explanation: 'È vero: la carta delle banconote in euro è prodotta con fibre di cotone puro al 100%, per resistere meglio a pieghe e lavaggi.',
    },
    {
      id: 'fb_bf2',
      cardMode: 'bufala',
      category: 'Natura',
      statement: 'I pesci rossi hanno una memoria di soli 3 secondi e dimenticano subito tutto.',
      isTrue: false,
      explanation: 'È una bufala classica: numerosi studi dimostrano che i pesci rossi ricordano percorsi e segnali anche per mesi.',
    },
    {
      id: 'fb_bf3',
      cardMode: 'bufala',
      category: 'Animali',
      statement: 'Le impronte digitali di un koala sono così simili alle nostre da poter confondere perfino un esame al microscopio.',
      isTrue: true,
      explanation: 'È vero: pur essendo evolutivamente lontanissimi, i polpastrelli dei koala presentano creste quasi identiche a quelle umane.',
    },
    {
      id: 'fb_bf4',
      cardMode: 'bufala',
      category: 'Spazio',
      statement: 'La Grande Muraglia Cinese è chiaramente visibile a occhio nudo perfino dalla Luna.',
      isTrue: false,
      explanation: 'È una bufala: la muraglia è lunga ma larga pochi metri; dalla Luna non è distinguibile senza potenti telescopi.',
    },
    {
      id: 'fb_bf5',
      cardMode: 'bufala',
      category: 'Cibo',
      statement: 'Il miele naturale sigillato in un barattolo può mantenersi commestibile per migliaia di anni.',
      isTrue: true,
      explanation: 'È vero: pochissima umidità, alta acidità e presenza naturale di perossido impediscono ai batteri di proliferare.',
    },
    {
      id: 'fb_bf6',
      cardMode: 'bufala',
      category: 'Animali',
      statement: 'Tutti i pipistrelli sono completamente ciechi e si muovono solo grazie alle orecchie.',
      isTrue: false,
      explanation: 'È una bufala: i pipistrelli ci vedono benissimo (soprattutto al crepuscolo) oltre a usare l’ecolocalizzazione.',
    },
    {
      id: 'fb_bf7',
      cardMode: 'bufala',
      category: 'Spazio',
      statement: 'Sul pianeta Venere una singola rotazione su se stesso dura più di un intero anno attorno al Sole.',
      isTrue: true,
      explanation: 'È vero: Venere impiega 243 giorni terrestri a ruotare sul proprio asse e circa 225 a completare l’orbita.',
    },
    {
      id: 'fb_bf8',
      cardMode: 'bufala',
      category: 'Salute',
      statement: 'Svegliare bruscamente un sonnambulo gli provoca sempre un arresto cardiaco o danni cerebrali permanenti.',
      isTrue: false,
      explanation: 'È una bufala: può spaventarsi e risultare disorientato, ma non comporta infarti istantanei.',
    },
    {
      id: 'fb_bf9',
      cardMode: 'bufala',
      category: 'Natura',
      statement: 'Il cuore di una balenottera azzurra può pesare quasi quanto una piccola automobile utilitaria (circa 180 kg).',
      isTrue: true,
      explanation: 'È vero: è il cuore più grande del mondo animale, grande all’incirca quanto una golf cart.',
    },
    {
      id: 'fb_bf10',
      cardMode: 'bufala',
      category: 'Storia',
      statement: 'Napoleone Bonaparte era bassissimo per la sua epoca (attorno al metro e cinquanta).',
      isTrue: false,
      explanation: 'È una bufala nata dalla confusione tra piedi francesi e inglesi: era alto circa 1,68–1,69 m, perfettamente nella media dell’epoca.',
    },
    {
      id: 'fb_bf11',
      cardMode: 'bufala',
      category: 'Botanica',
      statement: 'Dal punto di vista botanico la banana è una bacca, mentre la fragola non lo è.',
      isTrue: true,
      explanation: 'È vero: le fragole sono tecnicamente falsi frutti con acheni esterni, mentre banane e avocado sono bacche.',
    },
    {
      id: 'fb_bf12',
      cardMode: 'bufala',
      category: 'Scienza',
      statement: 'Un essere umano normale utilizza soltanto il 10% del proprio cervello.',
      isTrue: false,
      explanation: 'È un mito cinematografico: le scansioni cerebrali mostrano attività diffusa in quasi tutte le aree anche mentre dormiamo.',
    },
  ],
  intesa: [
    {
      id: 'fb_in1',
      cardMode: 'intesa',
      category: 'Cucina',
      word: 'CARBONARA',
      forbidden: ['UOVA', 'GUANCIALE', 'PECORINO', 'PASTA'],
    },
    {
      id: 'fb_in2',
      cardMode: 'intesa',
      category: 'Oggetti',
      word: 'OMBRELLO',
      forbidden: ['PIOGGIA', 'BAGNATO', 'APRIRE', 'ACQUA'],
    },
    {
      id: 'fb_in3',
      cardMode: 'intesa',
      category: 'Tempo libero',
      word: 'CINEMA',
      forbidden: ['FILM', 'POPCORN', 'SCHERMO', 'SALA'],
    },
    {
      id: 'fb_in4',
      cardMode: 'intesa',
      category: 'Viaggi',
      word: 'PASSAPORTO',
      forbidden: ['AEROPORTO', 'FRONTIERA', 'DOCUMENTO', 'VISTO'],
    },
    {
      id: 'fb_in5',
      cardMode: 'intesa',
      category: 'Sport',
      word: 'RIGORE',
      forbidden: ['CALCIO', 'PORTIERE', 'DISCHETTO', 'GOL'],
    },
    {
      id: 'fb_in6',
      cardMode: 'intesa',
      category: 'Tecnologia',
      word: 'BATTERIA',
      forbidden: ['CARICA', 'CELLULARE', 'ENERGIA', 'SCARICO'],
    },
    {
      id: 'fb_in7',
      cardMode: 'intesa',
      category: 'Estate',
      word: 'CREMA SOLARE',
      forbidden: ['SPIAGGIA', 'SOLE', 'SCOTTATURA', 'MARE'],
    },
    {
      id: 'fb_in8',
      cardMode: 'intesa',
      category: 'Vita quotidiana',
      word: 'SVEGLIA',
      forbidden: ['MATTINA', 'SUONARE', 'DORMIRE', 'OROLOGIO'],
    },
    {
      id: 'fb_in9',
      cardMode: 'intesa',
      category: 'Musica',
      word: 'CHITARRA',
      forbidden: ['CORDE', 'SUONARE', 'ROCK', 'PLETTRO'],
    },
    {
      id: 'fb_in10',
      cardMode: 'intesa',
      category: 'Casa',
      word: 'ASPIRAPOLVERE',
      forbidden: ['PULIRE', 'PAVIMENTO', 'SPORCO', 'FOLLETTO'],
    },
    {
      id: 'fb_in11',
      cardMode: 'intesa',
      category: 'Città',
      word: 'SEMAFORO',
      forbidden: ['ROSSO', 'VERDE', 'INCROCIO', 'AUTO'],
    },
    {
      id: 'fb_in12',
      cardMode: 'intesa',
      category: 'Festa',
      word: 'CORIANDOLI',
      forbidden: ['CARNEVALE', 'CARTA', 'COLORATI', 'LANCIARE'],
    },
  ],
};

/** Offline-safe weird, peculiar, personal 2-choice decks exclusively for Solo (1-player) mode. */
export const SOLO_FALLBACK_DECKS: {
  flash: PassFlashCard[];
  classico: PassFlashCard[];
  preferiresti: PassPreferirestiCard[];
  assurdo: PassAssurdoCard[];
  percorso: PassFlashCard[];
} = {
  flash: [
    {
      id: 'solo_fb_fl1',
      cardMode: 'flash',
      text: 'Puoi far dimenticare a tutti una tua figuraccia epica oppure scoprire chi ti ha pensato di più oggi.',
      optionA: 'Cancello la figuraccia',
      optionB: 'Scopro chi mi ha pensato',
      spuntiA: ['Togliere un ricordo imbarazzante libera spazio mentale.', 'Senza curiosità dormi più sereno.'],
      spuntiB: ['La curiosità vince sempre sulla prudenza.', 'Potresti restare sorpreso da un nome inatteso.'],
    },
    {
      id: 'solo_fb_fl2',
      cardMode: 'flash',
      text: 'Una scatola nera registra tutti i pensieri che hai fatto sotto la doccia: la ascolti adesso o la distruggi subito?',
      optionA: 'La ascolto subito',
      optionB: 'La distruggo chiusa',
      spuntiA: ['Lì dentro ci sono le tue intuizioni più sincere.', 'Capire cosa pensi a mente libera cambia tutto.'],
      spuntiB: ['Certe discussioni immaginarie restano bene nel vapore.', 'Non tutto va rianalizzato.'],
    },
    {
      id: 'solo_fb_fl3',
      cardMode: 'flash',
      text: 'Ogni volta che menti sul tuo umore dicendo «tutto bene», le tue scarpe cambiano colore davanti a chi hai di fronte.',
      optionA: 'Accetto scarpe sincere',
      optionB: 'Tengo il mio segreto',
      spuntiA: ['Smetti di mettere maschere automatiche quando sei scarico.', 'Chi ti guarda capirebbe al volo.'],
      spuntiB: ['A volte non hai voglia di spiegare tutto al primo ciao.', 'La privacy emotiva va protetta.'],
    },
    {
      id: 'solo_fb_fl4',
      cardMode: 'flash',
      text: 'Trovi una lettera che avevi scritto a te stesso dieci anni fa: la apri oggi o la sigilli per altri dieci?',
      optionA: 'La apro adesso',
      optionB: 'La rimando di 10 anni',
      spuntiA: ['Scopri subito quali promesse hai tenuto.', 'Rimette in prospettiva i problemi di oggi.'],
      spuntiB: ['Tra dieci anni peserà il doppio.', 'Forse oggi non vuoi quel confronto.'],
    },
    {
      id: 'solo_fb_fl5',
      cardMode: 'flash',
      text: 'Puoi capire istintivamente ogni tuo sogno notturno oppure scegliere tu la trama di un sogno a settimana.',
      optionA: 'Capire ogni sogno',
      optionB: 'Scegliere la trama',
      spuntiA: ['È come aprire la porta sul tuo inconscio.', 'Scopri subito ciò che eviti di giorno.'],
      spuntiB: ['Un film privato gratuito ogni settimana.', 'Dormire diventa puro divertimento.'],
    },
    {
      id: 'solo_fb_fl6',
      cardMode: 'flash',
      text: 'Un piccolo uccello ti segue tutto il giorno e commenta ogni tua spesa superflua: lo tieni o lo mandi via?',
      optionA: 'Lo tengo per risparmiare',
      optionB: 'Via subito, spendo in pace',
      spuntiA: ['Addio acquisti impulsivi notturni.', 'Risparmio garantito a costo zero.'],
      spuntiB: ['Un caffè o uno sfizio non meritano un giudice piumato.', 'La leggerezza si compra anche così.'],
    },
    {
      id: 'solo_fb_fl7',
      cardMode: 'flash',
      text: 'Puoi sapere esattamente quante persone si sono prese una cotta segreta per te in vita tua, senza sapere i nomi.',
      optionA: 'Voglio il numero',
      optionB: 'Meglio non saperlo',
      spuntiA: ['Anche un solo numero in più strappa un sorriso.', 'Pura curiosità innocua.'],
      spuntiB: ['Il numero senza volti farebbe impazzire di ipotesi.', 'Guarda avanti senza conti.'],
    },
    {
      id: 'solo_fb_fl8',
      cardMode: 'flash',
      text: 'Preferisci una memoria fotografica su tutto ciò che leggi o poter cancellare all’istante qualsiasi spoiler?',
      optionA: 'Memoria fotografica',
      optionB: 'Cancella-spoiler',
      spuntiA: ['Impari qualsiasi materia in un decimo del tempo.', 'Superpotere pratico incredibile.'],
      spuntiB: ['Rivedi i tuoi finali preferiti come fosse la prima volta.', 'Zero rabbia da social.'],
    },
    {
      id: 'solo_fb_fl9',
      cardMode: 'flash',
      text: 'Ogni volta che compri qualcosa di inutile, una pianta in salotto sospira rumorosamente.',
      optionA: 'Accetto la pianta giudice',
      optionB: 'Pianta muta',
      spuntiA: ['Un sospiro verde prima del click salva il portafoglio.', 'Casa viva e onesta.'],
      spuntiB: ['Non voglio sensi di colpa dal basilico.', 'Ogni sfizio è sacro.'],
    },
    {
      id: 'solo_fb_fl10',
      cardMode: 'flash',
      text: 'Puoi eliminare per sempre dalla tua testa una sola emozione scomoda: togli l’invidia o il rimpianto?',
      optionA: 'Elimino l’invidia',
      optionB: 'Elimino il rimpianto',
      spuntiA: ['Gioia piena senza confronti continui.', 'Leggerezza mentale immediata.'],
      spuntiB: ['Guardi solo avanti senza ripensamenti notturni.', 'Sbagli e riparti subito.'],
    },
  ],
  classico: [
    {
      id: 'solo_fb_cl1',
      cardMode: 'classico',
      text: 'Ogni sbadiglio ti teletrasporta di 3 metri in avanti, oppure ogni starnuto ti riporta indietro di 10 secondi.',
      optionA: 'Sbadiglio teletrasporto',
      optionB: 'Starnuto rewind',
      spuntiA: ['Attraversi code e porte chiuse con un colpo di sonno.', 'Attento però a non sbadigliare su un balcone.'],
      spuntiB: ['Correggi qualsiasi frase detta male tenendo del pepe in tasca.', 'Rischieresti però loop infiniti col raffreddore.'],
      domandaRilancio: 'Usi più energie per correre avanti o per correggere ciò che hai appena detto?',
      lezioneReale: 'Controllare i riflessi quotidiani vale più di qualunque superpotere.',
    },
    {
      id: 'solo_fb_cl2',
      cardMode: 'classico',
      text: 'Puoi leggere un libro con tutto ciò che hanno detto di te alle tue spalle, oppure uno con le occasioni mancate per un soffio.',
      optionA: 'Cosa dicono di me',
      optionB: 'Occasioni mancate',
      spuntiA: ['Scopri subito chi è autentico intorno a te.', 'Ma ogni parola letta resta incisa per sempre.'],
      spuntiB: ['Impari quali segnali ti sfuggono dal vivo.', 'Vedere treni persi per 30 secondi può diventare ossessione.'],
      domandaRilancio: 'Ti pesa di più il giudizio degli altri o il dubbio di ciò che non hai provato?',
      lezioneReale: 'La curiosità sul passato serve solo se orienta la prossima mossa.',
    },
    {
      id: 'solo_fb_cl3',
      cardMode: 'classico',
      text: 'Trovi in casa una stanza dove il tempo fuori si ferma, oppure una porta che ti porta per 20 minuti in una città casuale.',
      optionA: 'Stanza senza tempo',
      optionB: 'Porta sulle città',
      spuntiA: ['Silenzio totale per riposare senza perdere minuti fuori.', 'Tornare alla corsa reale può diventare difficile.'],
      spuntiB: ['Ogni giorno venti minuti davanti a un mare nuovo.', 'Ti innamori di posti da cui devi ripartire subito.'],
      domandaRilancio: 'In questo periodo hai più bisogno di quiete ferma o di sorpresa?',
      lezioneReale: 'Tra rifugio e scoperta scegliamo sempre ciò che manca alle nostre giornate.',
    },
    {
      id: 'solo_fb_cl4',
      cardMode: 'classico',
      text: 'Puoi cancellare il ricordo più imbarazzante della tua vita, ma perderesti anche la lezione pratica che ti ha insegnato.',
      optionA: 'Cancello il ricordo',
      optionB: 'Tengo la lezione',
      spuntiA: ['Niente più flash improvvisi alle 3 di notte.', 'Senza quella cicatrice potresti rifare lo stesso errore.'],
      spuntiB: ['Quel disagio è il tuo anticorpo migliore.', 'A volte però resta solo un peso inutile.'],
      domandaRilancio: 'Quale tua figuraccia ti ha reso segretamente più sveglio?',
      lezioneReale: 'Rimuovere la memoria di un errore espone al rischio di ripeterlo.',
    },
    {
      id: 'solo_fb_cl5',
      cardMode: 'classico',
      text: 'Hai uno specchio che mostra come ti vedono gli estranei al primo sguardo, oppure chi sarai tra vent’anni continuando così.',
      optionA: 'Sguardo degli estranei',
      optionB: 'Me stesso tra 20 anni',
      spuntiA: ['Capisci che impressione dai davvero in tre secondi.', 'Rischi di vivere guardandoti da fuori.'],
      spuntiB: ['Vedi l’effetto reale delle tue abitudini silenziose.', 'Guardare troppo avanti può spaventare.'],
      domandaRilancio: 'Se vedessi il tuo futuro tra vent’anni continuando così, cosa cambieresti domani?',
      lezioneReale: 'Il futuro non arriva di colpo: lo costruiscono le piccole ripetizioni di oggi.',
    },
    {
      id: 'solo_fb_cl6',
      cardMode: 'classico',
      text: 'Puoi eliminare per sempre la noia, ma in cambio sparisce anche ogni forma di nostalgia.',
      optionA: 'Zero noia e zero nostalgia',
      optionB: 'Tengo entrambe',
      spuntiA: ['Presenza mentale pura senza incastrarti nel passato.', 'Perderesti però il filo caldo coi ricordi.'],
      spuntiB: ['La noia fa nascere idee nuove e la nostalgia custodisce ciò che ami.', 'Accetti però sere vuote e malinconie improvvise.'],
      domandaRilancio: 'Le tue idee più vere sono nate nella fretta o in un momento vuoto?',
      lezioneReale: 'La noia è lo spazio libero in cui tornano a galla i desideri reali.',
    },
    {
      id: 'solo_fb_cl7',
      cardMode: 'classico',
      text: 'Puoi creare un solo salvataggio reale della tua vita da ricaricare una volta, oppure avere tre anteprime da 24 ore su bivi diversi.',
      optionA: 'Un solo checkpoint',
      optionB: 'Tre anteprime da 24 ore',
      spuntiA: ['Provi il salto più folle con rete di sicurezza.', 'Aspetteresti tutta la vita il momento perfetto per salvare.'],
      spuntiB: ['Assaggi tre strade diverse prima di decidere.', 'Un giorno solo mostra l’adrenalina, non la routine.'],
      domandaRilancio: 'Quale bivio rimandi perché sembra definitivo anche se forse non lo è?',
      lezioneReale: 'Quasi nessuna porta nella vita è davvero chiusa a chiave per sempre.',
    },
    {
      id: 'solo_fb_cl8',
      cardMode: 'classico',
      text: 'Puoi vivere senza avere mai più paura di fare brutta figura, oppure senza avere mai più paura di restare solo.',
      optionA: 'Zero paura figuracce',
      optionB: 'Zero paura solitudine',
      spuntiA: ['Osi, chiedi, sbagli e riparti senza alcun blocco sociale.', 'Resta però la fatica di stare bene a porta chiusa.'],
      spuntiB: ['Non accetti più legami sbagliati per puro bisogno.', 'Gli sguardi esterni possono comunque frenarti.'],
      domandaRilancio: 'Quale delle due paure ha deciso più spesso al posto tuo?',
      lezioneReale: 'Quasi ogni maschera che mettiamo serve a evitare il ridicolo o il vuoto.',
    },
    {
      id: 'solo_fb_cl9',
      cardMode: 'classico',
      text: 'Ogni notte puoi visitare nei sogni una versione di te di un’altra scelta di vita, ma al risveglio il caffè sa di cenere per un’ora.',
      optionA: 'Visito vite parallele',
      optionB: 'Dormo nel mio mondo',
      spuntiA: ['Scopri che anche la strada scartata aveva i suoi problemi.', 'Rischi di svegliarti sempre con l’amaro in bocca.'],
      spuntiB: ['Tutta la tua presenza resta dentro la vita che hai scelto.', 'Rinunci però a soddisfare la curiosità sui «se».'],
      domandaRilancio: 'Quale bivio passato visiti ancora col pensiero quando non dormi?',
      lezioneReale: 'Idealizzare ciò che non hai vissuto toglie energia a ciò che hai tra le mani.',
    },
    {
      id: 'solo_fb_cl10',
      cardMode: 'classico',
      text: 'Alla fine della vita puoi rivedere solo i momenti in cui eri felice senza saperlo, oppure ogni volta che hai migliorato il giorno di uno sconosciuto.',
      optionA: 'Quando ero felice senza saperlo',
      optionB: 'Quando ho aiutato uno sconosciuto',
      spuntiA: ['Riconosci la magia nascosta delle giornate normali.', 'Scopri quante cose davi per scontate.'],
      spuntiB: ['Vedi la traccia silenziosa dei tuoi gesti gentili.', 'Resta il mistero sui tuoi giorni migliori.'],
      domandaRilancio: 'Quale momento ordinario di questa settimana ricorderai con affetto tra cinque anni?',
      lezioneReale: 'Quasi sempre chiamiamo «bei tempi» le giornate normali mentre scorrono via.',
    },
  ],
  preferiresti: [
    {
      id: 'solo_fb_pr1',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti che per il resto della vita...',
      options: [
        'Ogni tua bugia facesse partire una tromba da stadio alle tue spalle',
        'Il tuo orologio segnasse i minuti alla tua prossima figuraccia',
      ],
    },
    {
      id: 'solo_fb_pr2',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti svegliarti domani e scoprire che...',
      options: [
        'Tutti i tuoi sogni dell’ultimo anno sono salvati in video sul telefono',
        'Capisci gli animali ma scopri che ti giudicano tutto il giorno',
      ],
    },
    {
      id: 'solo_fb_pr3',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti vivere in una casa dove...',
      options: [
        'Ogni specchio ti mostra con quindici anni in più',
        'La porta di ingresso porta ogni mattina in un quartiere diverso',
      ],
    },
    {
      id: 'solo_fb_pr4',
      cardMode: 'preferiresti',
      prompt: 'Per ottenere un superpotere strano, preferiresti...',
      options: [
        'Riavvolgere qualsiasi dialogo di 30 secondi una volta al giorno',
        'Vedere un’aura verde intorno alle scelte che ti faranno stare bene',
      ],
    },
    {
      id: 'solo_fb_pr5',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti scoprire in soffitta...',
      options: [
        'Un diario scritto da te a 80 anni pieno di consigli precisi',
        'Un biglietto che prova che il tuo peggior errore era necessario',
      ],
    },
    {
      id: 'solo_fb_pr6',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti trascorrere un weekend intero...',
      options: [
        'Senza poter pronunciare neppure una parola, solo gesti',
        'Senza poter usare né soldi né telefono, solo scambi',
      ],
    },
    {
      id: 'solo_fb_pr7',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti che il tuo corpo...',
      options: [
        'Facesse un bip leggero quando ti fidi della persona sbagliata',
        'Si illuminasse quando trovi un posto dove appartieni davvero',
      ],
    },
    {
      id: 'solo_fb_pr8',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti poter cancellare subito...',
      options: [
        'Ogni tua traccia digitale prima dei 20 anni',
        'La stanchezza mentale che torna ogni domenica sera',
      ],
    },
    {
      id: 'solo_fb_pr9',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti avere sulla spalla un tasto fisico che...',
      options: [
        'Mette in pausa tutto il mondo per 10 minuti al giorno',
        'Riporta subito il tuo umore dopo una bella risata',
      ],
    },
    {
      id: 'solo_fb_pr10',
      cardMode: 'preferiresti',
      prompt: 'Preferiresti che una voce calma ogni sera...',
      options: [
        'Ti dicesse se oggi sei stato fedele a te stesso',
        'Ti avvisasse 10 minuti prima quando stai sprecando il pomeriggio',
      ],
    },
  ],
  assurdo: [
    {
      id: 'solo_fb_as1',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Per 500€ subito, accetti di farti leggere ad alta voce in un bar pieno le ultime dieci ricerche fatte su Google?',
      optionA: 'Accetto i 500€',
      optionB: 'Tengo la mia privacy',
      sentenza: 'La soglia tra mistero e cinquecento euro è sottilissima.',
    },
    {
      id: 'solo_fb_as2',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Ricevi 1.000€ netti adesso, ma per un mese ogni tua telefonata inizia con tre secondi di ululato convinto.',
      optionA: 'Ululo per 1.000€',
      optionB: 'Mai nella vita',
      sentenza: 'Con mille euro persino un ululato sembra carattere.',
    },
    {
      id: 'solo_fb_as3',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Ti pagano 400€ subito per uscire tutto il pomeriggio con due scarpe diverse e calzini spaiati.',
      optionA: 'Moda asimmetrica subito',
      optionB: 'Scarpe abbinate sempre',
      sentenza: 'Chi ti fissa le scarpe ha avuto un pomeriggio più interessante.',
    },
    {
      id: 'solo_fb_as4',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Ti danno 2.500€ subito, ma per sette giorni il tuo telefono risponde a qualsiasi chiamata in vivavoce al massimo.',
      optionA: 'Vivavoce ovunque',
      optionB: 'Segreti protetti',
      sentenza: 'Sette giorni di prudenza telefonica si pagano benissimo.',
    },
    {
      id: 'solo_fb_as5',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Per 800€ adesso mangi una pasta al pesto con tre cucchiai di marmellata di fragole davanti a un cuoco serio?',
      optionA: 'Mangio e incasso',
      optionB: 'Onore salvo',
      sentenza: 'Le papille si riprendono prima del conto corrente.',
    },
    {
      id: 'solo_fb_as6',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Per 600€ devi salutare ogni vicino sulle scale per due settimane dicendo «La missione procede!» con sguardo serio.',
      optionA: 'Agente segreto per 600€',
      optionB: 'Normale ciao',
      sentenza: 'Il condominio non dimenticherà mai quelle due settimane.',
    },
    {
      id: 'solo_fb_as7',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Per 5.000€ lasci che un generatore casuale scelga ogni tuo vestito per i prossimi sei mesi?',
      optionA: 'Stile casuale per sei mesi',
      optionB: 'Decido io l’armadio',
      sentenza: 'Uscire dagli schemi comincia anche dai colori improbabili.',
    },
    {
      id: 'solo_fb_as8',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Ti offrono 700€ subito, ma per una settimana ordini tutto al bar mimando senza dire una parola.',
      optionA: 'Mimo tutto per 700€',
      optionB: 'Ordino parlando',
      sentenza: 'Un macchiato mimato è pura arte urbana.',
    },
    {
      id: 'solo_fb_as9',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Per 4.000€ sul conto non puoi guardare nessuno specchio né riflesso di te per novanta giorni consecutivi?',
      optionA: 'Novanta giorni senza specchi',
      optionB: 'Devo vedermi ogni tanto',
      sentenza: 'Tre mesi senza specchi cambiano il rapporto con la propria immagine.',
    },
    {
      id: 'solo_fb_as10',
      cardMode: 'assurdo',
      cardType: 'dignita',
      prompt: 'Ti pagano 900€ per portare un piccolo ananas in borsa per un mese intero e presentarlo a chiunque te lo chieda.',
      optionA: 'Ananas compagno di viaggio',
      optionB: 'Zaino senza frutta',
      sentenza: 'Un ananas in borsa rompe il ghiaccio più di qualsiasi battuta.',
    },
  ],
  percorso: [
    {
      id: 'solo_fb_pe1',
      cardMode: 'percorso',
      tappa: 1,
      tappaNome: 'Le Basi',
      text: 'Ogni volta che rimandi un progetto che desideri, un oggetto in camera si rimpicciolisce di 2 cm: accetti il promemoria o lasci tutto intatto?',
      optionA: 'Accetto la sveglia fisica',
      optionB: 'Camera intatta, tempi miei',
      spuntiA: ['Appena il divano rimpicciolisce ti muovi sul serio.', 'Zero scuse davanti ai fatti.'],
      spuntiB: ['Ognuno ha ritmi diversi senza pressioni visive.', 'Anche i tempi morti maturano idee.'],
      domandaRilancio: 'Quale cosa che rimandi da mesi avrebbe già rimpicciolito metà stanza?',
      lezioneReale: 'Rimandare sembra gratuito solo perché non si vede subito il conto.',
    },
    {
      id: 'solo_fb_pe2',
      cardMode: 'percorso',
      tappa: 1,
      tappaNome: 'Le Basi',
      text: 'Trovi nel corridoio di casa una stanza dove il tempo si ferma, oppure una porta che ti porta per 20 minuti in una città casuale.',
      optionA: 'Stanza senza tempo',
      optionB: 'Porta sulle città',
      spuntiA: ['Spazio di quiete assoluto senza colpe.', 'Tornare fuori però può pesare.'],
      spuntiB: ['Finestra giornaliera sull’ignoto.', 'Venti minuti lasciano sempre fame di più.'],
      domandaRilancio: 'Oggi cerchi più silenzio fermo o aria nuova?',
    },
    {
      id: 'solo_fb_pe3',
      cardMode: 'percorso',
      tappa: 2,
      tappaNome: 'I Bivi',
      text: 'Puoi avere un solo punto di salvataggio reale nella vita da ricaricare una volta, oppure tre anteprime da 24 ore su bivi diversi.',
      optionA: 'Un solo checkpoint',
      optionB: 'Tre anteprime da 24 ore',
      spuntiA: ['Provi il salto grande con una rete reale.', 'Rischi di non usarlo mai aspettando.'],
      spuntiB: ['Assaggi tre alternative prima di scegliere.', 'Ventiquattro ore non mostrano il terzo anno.'],
      domandaRilancio: 'Cosa faresti oggi sapendo di avere un salvataggio in tasca?',
    },
    {
      id: 'solo_fb_pe4',
      cardMode: 'percorso',
      tappa: 2,
      tappaNome: 'I Bivi',
      text: 'Un semaforo invisibile ti ferma per 30 secondi ogni volta che stai per dire «sì» solo per compiacere qualcuno.',
      optionA: 'Attivo il semaforo',
      optionB: 'Tengo l’armonia veloce',
      spuntiA: ['Trenta secondi ti salvano da settimane scomode.', 'Impari a proteggere il tuo tempo.'],
      spuntiB: ['Eviti micro-attriti quotidiani.', 'Accumuli però impegni che non senti tuoi.'],
      domandaRilancio: 'Quanti dei tuoi ultimi sì erano in realtà dei no gentili mai detti?',
    },
    {
      id: 'solo_fb_pe5',
      cardMode: 'percorso',
      tappa: 3,
      tappaNome: 'I Legami',
      text: 'Puoi rendere muto il giudice interiore con cui ti critichi allo specchio, ma non riceverai mai più nemmeno un complimento esterno.',
      optionA: 'Silenzio totale dentro e fuori',
      optionB: 'Tengo critiche e complimenti',
      spuntiA: ['Pace mentale stabile senza ansia da voto.', 'Zero conferme calde dagli altri.'],
      spuntiB: ['Impari a dialogare con le tue crepe.', 'Certi giorni però quella voce pesa tantissimo.'],
      domandaRilancio: 'È più severo il mondo con te o la tua voce nei giorni storti?',
    },
    {
      id: 'solo_fb_pe6',
      cardMode: 'percorso',
      tappa: 3,
      tappaNome: 'I Legami',
      text: 'Puoi viaggiare gratis ovunque per sempre, ma dovendo partire e dormire sempre da solo senza mai condividere l’esperienza sul momento.',
      optionA: 'Mondo gratis in solitaria',
      optionB: 'Meno viaggi ma condivisi',
      spuntiA: ['Libertà pura di tempi e deviazioni.', 'Manca qualcuno cui dire «guarda lì».'],
      spuntiB: ['La gioia condivisa pesa il doppio.', 'Dipendi però dagli incastri altrui.'],
      domandaRilancio: 'Cosa conta di più in un ricordo: dove eri o con chi lo hai guardato?',
    },
    {
      id: 'solo_fb_pe7',
      cardMode: 'percorso',
      tappa: 4,
      tappaNome: 'I Bilanci',
      text: 'Puoi eliminare per sempre la noia, ma perderesti anche ogni capacità di provare nostalgia.',
      optionA: 'Zero noia e zero nostalgia',
      optionB: 'Tengo entrambe',
      spuntiA: ['Sempre leggero sul presente.', 'Si spegne il ponte emotivo col passato.'],
      spuntiB: ['Entrambe danno profondità al tempo vissuto.', 'Prezzo: sere vuote e malinconie improvvise.'],
      domandaRilancio: 'Cosa affiora quando resti venti minuti senza stimoli né telefono?',
    },
    {
      id: 'solo_fb_pe8',
      cardMode: 'percorso',
      tappa: 4,
      tappaNome: 'I Bilanci',
      text: 'In un museo immaginario sulla tua vita c’è posto per una sola sala: esponi i successi riusciti o i tentativi falliti più coraggiosi?',
      optionA: 'I miei successi',
      optionB: 'I tentativi coraggiosi',
      spuntiA: ['Celebri ciò che hai costruito e chiuso bene.', 'Nasconde però la parte più viva del rischio.'],
      spuntiB: ['Raccontano quanto hai osato davvero.', 'Mostri ferite aperte senza lieto fine.'],
      domandaRilancio: 'Di quale tuo tentativo andato male vai ancora segretamente fiero?',
    },
  ],
};
