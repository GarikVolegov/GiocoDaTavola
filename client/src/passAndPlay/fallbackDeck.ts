// Offline-safe fallback deck for Pass & Play ("Passa il Telefono").
// Used when the network is unavailable or the server is unreachable.

export type PassMode = 'flash' | 'infiltrato' | 'assurdo' | 'coppie' | 'classico';

export type PassFamiliarita = 'vecchi_amici' | 'nuove_conoscenze' | 'tutti';

export interface PassFlashCard {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  spuntiA?: string[];
  spuntiB?: string[];
  penalty?: string;
  familiarita?: PassFamiliarita;
}

export interface PassInfiltratoCard {
  id: string;
  groupQuestion: string;
  impostorQuestion: string;
  category?: string;
  familiarita?: PassFamiliarita;
}

export interface PassCoppieCard {
  id: string;
  cardType: 'allineamento' | 'verita' | 'obbligo';
  intensity: 'complicita' | 'piccante';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  familiarita?: PassFamiliarita;
}

export interface PassAssurdoCard {
  id: string;
  cardType: 'gogna' | 'dignita';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  sentenza?: string;
  familiarita?: PassFamiliarita;
}

export type PassCard = PassFlashCard | PassInfiltratoCard | PassCoppieCard | PassAssurdoCard;

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
      penalty: 'Il prescelto improvvisa il suo discorso di difesa davanti al giudice in 10 secondi.',
    },
  ],
  coppie: [
    {
      id: 'fb_cp1',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Chi dei due chiede scusa per primo dopo una lite?',
      optionA: 'Chiedo scusa io',
      optionB: 'Chiede scusa l’altro',
    },
    {
      id: 'fb_cp2',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è una piccola abitudine dell’altra persona che ti fa impazzire (nel bene o nel male)?',
      penalty: 'Se eviti la risposta, 1 sorso!',
    },
    {
      id: 'fb_cp3',
      cardType: 'obbligo',
      intensity: 'complicita',
      prompt: 'Guardatevi negli occhi per 15 secondi senza ridere né parlare.',
      penalty: 'Chi ride per primo paga pegno!',
    },
    {
      id: 'fb_cp4',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Chi dei due è più geloso, anche se fa finta di niente?',
      optionA: 'Io sono più geloso/a',
      optionB: 'L’altro è più geloso/a',
    },
    {
      id: 'fb_cp5',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è stata la prima impressione reale che hai avuto quando vi siete conosciuti?',
      penalty: 'Sii sincero o penitenza!',
    },
    {
      id: 'fb_cp6',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'C’è un lato di te che mostri a questa persona ma che gli amici di sempre non hanno ancora capito?',
      penalty: 'Raccontalo in 15 secondi o 1 sorso!',
      familiarita: 'vecchi_amici',
    },
    {
      id: 'fb_cp7',
      cardType: 'allineamento',
      intensity: 'complicita',
      prompt: 'Se doveste partire domani per un weekend senza valigia né programma, chi entrerebbe nel panico per primo?',
      optionA: 'Io andrei nel panico',
      optionB: 'L’altro andrebbe nel panico',
    },
    {
      id: 'fb_cp8',
      cardType: 'verita',
      intensity: 'complicita',
      prompt: 'Qual è la cosa più inaspettata che hai imparato stando con l’altra persona?',
      penalty: 'Rispondi con sincerità o 1 sorso!',
    },
    {
      id: 'fb_cp9',
      cardType: 'allineamento',
      intensity: 'piccante',
      prompt: 'Chi dei due ha preso l’iniziativa più spesso all’inizio tra voi?',
      optionA: 'Ho spinto più io',
      optionB: 'Ha spinto più l’altro',
    },
    {
      id: 'fb_cp10',
      cardType: 'verita',
      intensity: 'piccante',
      prompt: 'Qual è un desiderio o una fantasia di coppia che non hai ancora proposto ad alta voce?',
      penalty: 'Dillo ora o paga pegno!',
    },
    {
      id: 'fb_cp11',
      cardType: 'obbligo',
      intensity: 'piccante',
      prompt: 'Sussurra all’orecchio dell’altra persona cosa ti attrae di più di lei stasera.',
      penalty: 'Se arrossisci o ti tiri indietro, 2 sorsi!',
    },
    {
      id: 'fb_cp12',
      cardType: 'verita',
      intensity: 'piccante',
      prompt: 'Qual è il momento più imprevedibile o folle che avete vissuto insieme finora?',
      penalty: 'Racconta o penitenza!',
    },
    {
      id: 'fb_cp13',
      cardType: 'allineamento',
      intensity: 'piccante',
      prompt: 'Se il telefono dell’altro restasse sbloccato sul tavolo per 10 minuti, chi resisterebbe meno alla tentazione di sbirciare?',
      optionA: 'Io non sbircierei mai',
      optionB: 'La curiosità è troppo forte',
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
};
