// Tribunale degli Amici: lively TV-courtroom mini-game where two players face off
// for 15 seconds each (Accusa vs Difesa) over a relatable friend dispute, then
// the remaining players vote using real contender names for the verdict & penalty.

export interface TribunaleCase {
  id: string;
  title: string;
  scenario: string;
  accusaRole: string;
  difesaRole: string;
  penalty: string;
}

export interface TribunaleRoundState {
  caseData: TribunaleCase;
  accusaId: string;
  difesaId: string;
  /** 0 = Accusa arguing (15s), 1 = Difesa arguing (15s). */
  speakerIndex: 0 | 1;
  /** Votes cast by jurors (`playerId -> 'ACCUSA' | 'DIFESA'`). */
  votes: Map<string, 'ACCUSA' | 'DIFESA'>;
  /** Computed once voting finishes or closes. */
  verdict?: {
    accusaVotes: number;
    difesaVotes: number;
    winner: 'ACCUSA' | 'DIFESA' | 'TIE';
    winnerIds: string[];
    loserId: string | null;
    pointsWinner: number;
    pointsTie: number;
  };
}

export const TRIBUNALE_READ_MS = 10_000;
export const TRIBUNALE_SPEAK_MS = 15_000;
export const TRIBUNALE_VOTE_MS = 20_000;

export const TRIBUNALE_CASES: TribunaleCase[] = [
  {
    id: 'tr_conto',
    title: 'Il Caso del Conto alla Romana',
    scenario: 'Qualcuno ha ordinato antipasto di mare, tagliata e 3 cocktail, poi propone di dividere il conto "alla pari per non fare i tirchi".',
    accusaRole: 'Accusa: Chi pretende che ognuno paghi quello che mangia',
    difesaRole: 'Difesa: "Tra amici veri non si fanno i conti con la calcolatrice!"',
    penalty: 'Al prossimo giro offre un caffè o un amaro a chi ha vinto la causa.',
  },
  {
    id: 'tr_vocale',
    title: 'Il Processo al Vocale da 7 Minuti',
    scenario: 'Ore 09:14 di lunedì: arriva un messaggio vocale di 7 minuti e 12 secondi senza contesto, con pause per bere l’acqua.',
    accusaRole: 'Accusa: "I vocali sopra i 60 secondi sono un sequestro di persona"',
    difesaRole: 'Difesa: "Dovevo spiegare bene la dinamica, scrivere era impossibile"',
    penalty: 'Deve comunicare i prossimi 3 turni solo con frasi telegrafiche da max 5 parole.',
  },
  {
    id: 'tr_ritardo',
    title: 'Il Ritardatario Cronico',
    scenario: 'Appuntamento alle 21:00. Alle 21:25 scrive "sto scendendo ora" ma dalla foto sullo specchio è ancora in accappatoio.',
    accusaRole: 'Accusa: "Aspettarti sotto casa al freddo non è folklore, è maleducazione"',
    difesaRole: 'Difesa: "Il mio 21:00 è sempre stato indicativo, lo sapete da anni!"',
    penalty: 'Al prossimo ritrovo deve arrivare 10 minuti prima o pagare una penitenza.',
  },
  {
    id: 'tr_visualizza',
    title: 'Visualizzato e Mutismo',
    scenario: 'Chiede "che fate stasera?", legge la risposta 40 secondi dopo e scompare per tre giorni. Poi posta storie al mare.',
    accusaRole: 'Accusa: "Se lanci il sasso e poi sparisci meriti il ban dalla chat"',
    difesaRole: 'Difesa: "Ho aperto la chat per sbaglio mentre cucinavo!"',
    penalty: 'Deve mandare un complimento sincero al vincitore ad alta voce.',
  },
  {
    id: 'tr_spoiler',
    title: 'Strage di Spoiler',
    scenario: 'A cena racconta il finale della serie più attesa dell’anno dicendo: "Vabbè dai, è uscita già da quattro giorni!"',
    accusaRole: 'Accusa: "La prescrizione degli spoiler dura minimo tre mesi"',
    difesaRole: 'Difesa: "Se non l’hai ancora vista non puoi uscire nel mondo civile"',
    penalty: 'Per tutta la serata non può interrompere nessuno mentre parla.',
  },
  {
    id: 'tr_pacco',
    title: 'Il Pacco alle 19:58',
    scenario: 'Tavolo prenotato da una settimana per le 20:30. Alle 19:58 arriva il messaggio: "Raga ho un imprevisto assurdo, non ce la faccio".',
    accusaRole: 'Accusa: "Sappiamo benissimo che l’imprevisto è il divano col plaid"',
    difesaRole: 'Difesa: "Quando la batteria sociale è a zero, restare a casa è legittima difesa"',
    penalty: 'Deve proporre e prenotare davvero la prossima uscita del gruppo.',
  },
  {
    id: 'tr_patatine',
    title: 'Furto dal Piatto Altrui',
    scenario: 'Dice "non ho fame, non ordino niente". Appena arrivano le tue patatine, ne prende subito una manciata "solo per assaggiare".',
    accusaRole: 'Accusa: "Giù le mani dal piatto altrui, le patatine sono sacre!"',
    difesaRole: 'Difesa: "Rubare una patatina è il più alto segno di amicizia"',
    penalty: 'Cede l’ultima fetta o l’ultimo snack di stasera al vincitore.',
  },
  {
    id: 'tr_fotografo',
    title: 'Foto Brutta nelle Storie',
    scenario: 'Posta una storia dove lei/lui è venuto da copertina, mentre tu sembri appena uscito da un incidente stradale con gli occhi chiusi.',
    accusaRole: 'Accusa: "Serve l’approvazione scritta prima di pubblicare facce altrui"',
    difesaRole: 'Difesa: "L’importante è il mood della serata, mica la posa da Vogue"',
    penalty: 'Fa da fotografo ufficiale del gruppo per la foto ricordo di fine serata.',
  },
  {
    id: 'tr_aux',
    title: 'Dittatura della Playlist in Auto',
    scenario: 'Viaggio di 2 ore in macchina: prende il cavo/Bluetooth senza chiedere e mette tre ore di sue chicche sperimentali ignorando i cori.',
    accusaRole: 'Accusa: "In macchina comanda chi guida o la democrazia del gruppo!"',
    difesaRole: 'Difesa: "Stavo cercando di elevarvi culturalmente dal solito pop"',
    penalty: 'Sceglie il prossimo brindisi e fa un discorso epico di 10 secondi.',
  },
  {
    id: 'tr_prestito',
    title: 'La Felpa Mai Restituita',
    scenario: 'Presta una felpa o un caricatore "per il weekend". Sei mesi dopo lo vede addosso all’altro nelle foto di un’altra festa.',
    accusaRole: 'Accusa: "Non era un regalo di compleanno, ridammi la roba mia!"',
    difesaRole: 'Difesa: "Dopo 90 giorni senza reclamo diventa usucapione legale"',
    penalty: 'Restituisce simbolicamente l’oggetto... oppure offre da bere.',
  },
  {
    id: 'tr_vacanza',
    title: 'Il Dittatore dell’Itinerario',
    scenario: 'In vacanza insieme sveglia tutti alle 07:15 con Excel alla mano ("alle 08:10 museo, alle 09:40 altro museo") quando si voleva solo dormire.',
    accusaRole: 'Accusa: "È una vacanza con gli amici, non il servizio militare!"',
    difesaRole: 'Difesa: "Senza di me stavate ancora alle 15 a cercare un bar aperto"',
    penalty: 'Per due round non può fare commenti strategici sugli altri giocatori.',
  },
  {
    id: 'tr_ex',
    title: 'Like Strategico alle 02:30',
    scenario: 'Giura di aver chiuso col passato, poi alle 02:30 di notte parte il like "scivolato col pollice" su una foto del 2021 dell’ex.',
    accusaRole: 'Accusa: "Non ci crede nessuno allo scivolamento del pollice sul 2021"',
    difesaRole: 'Difesa: "Stavo solo cercando una foto di un ristorante in cui eravamo stati!"',
    penalty: 'Deve ammettere pubblicamente l’ultimo profilo cercato oggi (o bere).',
  },
  {
    id: 'tr_calcetto',
    title: 'L’Arbitro di Casa Propria',
    scenario: 'A calcetto/padel/giochi da tavolo contesta ogni singolo punto dubbio e invoca il VAR pure sulle rimesse laterali.',
    accusaRole: 'Accusa: "La competitività tossica rovina i mercoledì sera"',
    difesaRole: 'Difesa: "La regola è regola! Se la palla è fuori di 2 millimetri è fuori"',
    penalty: 'Accetta senza fiatare la prossima decisione del tavolo.',
  },
  {
    id: 'tr_coinquilino',
    title: 'I Piatti "A Mollo"',
    scenario: 'Lascia la padella incrostata nel lavandino per quattro giorni con la scusa universale: "La sto tenendo a mollo così si lava meglio".',
    accusaRole: 'Accusa: "Quella padella ha ormai sviluppato una civiltà autonoma"',
    difesaRole: 'Difesa: "È chimica pura, l’ammollo lungo risparmia fatica e detersivo!"',
    penalty: 'Sparecchia i bicchieri vuoti del tavolo a fine partita.',
  },
  {
    id: 'tr_consiglio',
    title: 'Consiglio Ignorato e Ritorno',
    scenario: 'Chiede consiglio a tutti per due ore ("scrivo o no?"), tutti dicono NO, poi scrive comunque e il giorno dopo si lamenta di come è andata.',
    accusaRole: 'Accusa: "Hai perso il diritto di lamentarti nel momento in cui hai premuto invia"',
    difesaRole: 'Difesa: "Gli amici servono a consolarti quando fai cavolate, non a dire te l’avevo detto!"',
    penalty: 'Dice ad alta voce: "Avevate ragione voi su tutta la linea".',
  },
  {
    id: 'tr_navigatore',
    title: 'Il Navigatore Umano Sbagliato',
    scenario: 'Dice "fidati di me, conosco una scorciatoia per evitare il traffico" e vi ritrovate in una stradina sterrata chiusa alle 23:40.',
    accusaRole: 'Accusa: "Google Maps esiste dal 2005, smettila di fare il mago delle strade"',
    difesaRole: 'Difesa: "Almeno abbiamo visto il panorama e risparmiato... prima del vicolo cieco!"',
    penalty: 'Lascia scegliere al vincitore il prossimo mini-gioco o brindisi.',
  },
  {
    id: 'tr_telefono',
    title: 'Telefono a Tavola',
    scenario: 'Uscita insieme per raccontarsi le cose, ma ogni 4 minuti sparisce a rispondere a chat infinite annuendo a caso con "sììì assurdo".',
    accusaRole: 'Accusa: "Se sei fisico qui ma mentale altrove, mettevi una sagoma di cartone"',
    difesaRole: 'Difesa: "Stavo gestendo un’emergenza epocale in tempo reale!"',
    penalty: 'Mette il telefono a faccia in giù fino alla fine del round successivo.',
  },
  {
    id: 'tr_aria',
    title: 'Guerra del Condizionatore',
    scenario: 'In macchina o in casa c’è sempre chi vuole 18 gradi polo nord e chi mette la felpa a luglio lamentandosi del "colpo d’aria".',
    accusaRole: 'Accusa: "Qui dentro stiamo ibernando i pinguini per colpa tua!"',
    difesaRole: 'Difesa: "Se hai freddo ti copri, se io ho caldo non posso togliermi la pelle!"',
    penalty: 'Cede il posto più comodo sul divano/tavolo per il resto della partita.',
  },
];

export function drawTribunaleCase(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): TribunaleCase {
  const pool = TRIBUNALE_CASES.filter((c) => !usedIds.has(c.id));
  const source = pool.length > 0 ? pool : TRIBUNALE_CASES;
  const idx = Math.floor(rng() * source.length);
  const picked = source[Math.max(0, Math.min(source.length - 1, idx))];
  usedIds.add(picked.id);
  return picked;
}

/**
 * Pick 2 distinct contenders fairly so players with fewer court appearances
 * get priority before repeating.
 */
export function pickTribunaleContenders(
  playerIds: string[],
  appearanceCounts: Map<string, number>,
  rng: () => number = Math.random,
): [string, string] | null {
  if (playerIds.length < 2) return null;
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.sort(
    (a, b) => (appearanceCounts.get(a) ?? 0) - (appearanceCounts.get(b) ?? 0),
  );
  return [shuffled[0], shuffled[1]];
}

export function initTribunaleRound(
  caseData: TribunaleCase,
  accusaId: string,
  difesaId: string,
): TribunaleRoundState {
  return {
    caseData,
    accusaId,
    difesaId,
    speakerIndex: 0,
    votes: new Map(),
  };
}

export function getTribunaleSpeakerId(state: TribunaleRoundState): string {
  return state.speakerIndex === 0 ? state.accusaId : state.difesaId;
}

export function castTribunaleVote(
  state: TribunaleRoundState,
  jurorId: string,
  choice: 'ACCUSA' | 'DIFESA',
): { ok: boolean; error?: 'CONTENDER_CANNOT_VOTE' } {
  if (jurorId === state.accusaId || jurorId === state.difesaId) {
    return { ok: false, error: 'CONTENDER_CANNOT_VOTE' };
  }
  state.votes.set(jurorId, choice);
  return { ok: true };
}

export function resolveTribunaleVerdict(state: TribunaleRoundState): NonNullable<TribunaleRoundState['verdict']> {
  let accusaVotes = 0;
  let difesaVotes = 0;
  for (const choice of state.votes.values()) {
    if (choice === 'ACCUSA') accusaVotes++;
    else difesaVotes++;
  }

  let winner: 'ACCUSA' | 'DIFESA' | 'TIE';
  let winnerIds: string[];
  let loserId: string | null;
  const margin = Math.abs(accusaVotes - difesaVotes);
  const pointsWinner = 120 + margin * 20;
  const pointsTie = 60;

  if (accusaVotes > difesaVotes) {
    winner = 'ACCUSA';
    winnerIds = [state.accusaId];
    loserId = state.difesaId;
  } else if (difesaVotes > accusaVotes) {
    winner = 'DIFESA';
    winnerIds = [state.difesaId];
    loserId = state.accusaId;
  } else {
    winner = 'TIE';
    winnerIds = [state.accusaId, state.difesaId];
    loserId = null;
  }

  const verdict = {
    accusaVotes,
    difesaVotes,
    winner,
    winnerIds,
    loserId,
    pointsWinner,
    pointsTie,
  };
  state.verdict = verdict;
  return verdict;
}
