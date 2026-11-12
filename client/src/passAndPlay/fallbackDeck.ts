// Offline-safe fallback deck for Pass & Play ("Passa il Telefono").
// Used when the network is unavailable or the server is unreachable.

export type PassMode = 'flash' | 'infiltrato' | 'assurdo' | 'coppie' | 'classico';

export interface PassFlashCard {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  spuntiA?: string[];
  spuntiB?: string[];
  penalty?: string;
}

export interface PassInfiltratoCard {
  id: string;
  groupQuestion: string;
  impostorQuestion: string;
  category?: string;
}

export interface PassCoppieCard {
  id: string;
  cardType: 'allineamento' | 'verita' | 'obbligo';
  intensity: 'complicita' | 'piccante';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
}

export interface PassAssurdoCard {
  id: string;
  cardType: 'gogna' | 'dignita';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  sentenza?: string;
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
  ],
  classico: [
    {
      id: 'fb_cl1',
      text: 'Un tuo amico ti chiede un parere sincero sul suo nuovo progetto, ma sai che è destinato a fallire. Che fai?',
      optionA: 'Glielo dico senza filtri',
      optionB: 'Lo incoraggio lo stesso',
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
      spuntiA: ['La coscienza pulita vale più di 500€', 'Al barista o al proprietario tornerà indietro'],
      spuntiB: ['Senza documenti non hai garanzia che arrivi al vero proprietario', 'La fortuna ogni tanto bussa'],
    },
  ],
};
