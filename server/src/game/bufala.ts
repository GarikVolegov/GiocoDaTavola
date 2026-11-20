// "Vero o Bufala?": inspired by Avanti un Altro / QI.
// An unbelievable fact or urban myth — 2 crisp buttons (È Vero vs È una Bufala) + explanation.

export interface BufalaQuestion {
  id: string;
  statement: string;
  isTrue: boolean;
  explanation: string;
  category: string;
}

export interface BufalaRoundState {
  question: BufalaQuestion;
  votes: Map<string, boolean>;
}

export interface BufalaResultEntry {
  playerId: string;
  nickname: string;
  vote: boolean;
  correct: boolean;
  pointsAwarded: number;
}

export interface PublicBufalaState {
  questionId: string;
  statement: string;
  category: string;
  submittedCount: number;
  totalPlayers: number;
  missingNicknames: string[];
  isTrue?: boolean;
  explanation?: string;
  trueCount?: number;
  falseCount?: number;
  results?: BufalaResultEntry[];
}

export const BUFALA_QUESTIONS: readonly BufalaQuestion[] = [
  {
    id: 'bf01',
    statement: 'L’Università di Oxford è stata fondata prima della nascita dell’Impero Azteco.',
    isTrue: true,
    explanation: 'VERO! L’insegnamento a Oxford risale almeno al 1096, mentre Tenochtitlan (Impero Azteco) fu fondata intorno al 1325.',
    category: 'Storia',
  },
  {
    id: 'bf02',
    statement: 'In media ingoiamo 8 ragni vivi all’anno mentre dormiamo.',
    isTrue: false,
    explanation: 'BUFALA! I ragni evitano le vibrazioni di respiro e battito cardiaco umano: è un falso mito inventato negli anni ’90.',
    category: 'Miti',
  },
  {
    id: 'bf03',
    statement: 'Gli squali esistono sul pianeta Terra da più tempo rispetto agli alberi.',
    isTrue: true,
    explanation: 'VERO! I primi squali comparvero negli oceani circa 400 milioni di anni fa; i primi alberi solo ~350 milioni di anni fa.',
    category: 'Natura',
  },
  {
    id: 'bf04',
    statement: 'La Grande Muraglia Cinese è l’unica opera umana ben visibile a occhio nudo dalla Luna.',
    isTrue: false,
    explanation: 'BUFALA! È larga pochi metri: dalla Luna o anche dall’orbita bassa senza lenti non si distingue dal terreno.',
    category: 'Spazio',
  },
  {
    id: 'bf05',
    statement: 'Un polpo possiede tre cuori e nove cervelli (uno centrale e uno per ogni tentacolo).',
    isTrue: true,
    explanation: 'VERO! Due cuori pompano sangue alle branchie, uno al corpo, e ogni braccio ha un proprio ganglio nervoso autonomo.',
    category: 'Natura',
  },
  {
    id: 'bf06',
    statement: 'Un fulmine non può mai colpire esattamente lo stesso punto due volte.',
    isTrue: false,
    explanation: 'BUFALA! L’Empire State Building, ad esempio, viene colpito dai fulmini oltre 20 volte ogni anno.',
    category: 'Scienza',
  },
  {
    id: 'bf07',
    statement: 'Le banane sono botanicamente classificate come bacche, mentre le fragole no.',
    isTrue: true,
    explanation: 'VERO! In botanica la banana nasce da un singolo ovario (è una bacca), al contrario di fragole e lamponi.',
    category: 'Cibo',
  },
  {
    id: 'bf08',
    statement: 'Il pesce rosso dimentica qualunque cosa dopo soli 3 secondi.',
    isTrue: false,
    explanation: 'BUFALA! Studi scientifici dimostrano che i pesci rossi ricordano percorsi e segnali anche per diversi mesi.',
    category: 'Natura',
  },
  {
    id: 'bf09',
    statement: 'L’animale nazionale ufficiale della Scozia è l’unicorno.',
    isTrue: true,
    explanation: 'VERO! Dal Trecento in Scozia l’unicorno simboleggia purezza, coraggio e fierezza nello stemma reale.',
    category: 'Cultura',
  },
  {
    id: 'bf10',
    statement: 'Napoleone Bonaparte era bassissimo per gli standard francesi della sua epoca.',
    isTrue: false,
    explanation: 'BUFALA! Misurava circa 1,69 m — leggermente sopra la media maschile francese dell’inizio Ottocento.',
    category: 'Storia',
  },
  {
    id: 'bf11',
    statement: 'Le impronte digitali dei koala sono così simili alle nostre da poter confondere persino la polizia scientifica al microscopio.',
    isTrue: true,
    explanation: 'VERO! Le creste papillari dei koala hanno anse e vortici quasi indistinguibili dalle impronte umane.',
    category: 'Natura',
  },
  {
    id: 'bf12',
    statement: 'Usiamo normalmente solo il 10% del nostro cervello.',
    isTrue: false,
    explanation: 'BUFALA! Le risonanze magnetiche mostrano che quasi tutto il cervello è attivo anche durante azioni semplici o nel sonno.',
    category: 'Scienza',
  },
  {
    id: 'bf13',
    statement: 'Su Venere un singolo giorno (rotazione su sé stesso) dura più di un intero anno venereano.',
    isTrue: true,
    explanation: 'VERO! Venere ruota lentissimamente: impiega 243 giorni terrestri per un giro su sé stesso e 225 attorno al Sole.',
    category: 'Spazio',
  },
  {
    id: 'bf14',
    statement: 'I tori vanno su tutte le furie proprio perché detestano il colore rosso.',
    isTrue: false,
    explanation: 'BUFALA! I bovini sono dicromatici e non distinguono bene il rosso: reagiscono al movimento del drappo, non al colore.',
    category: 'Miti',
  },
  {
    id: 'bf15',
    statement: 'La Nintendo fu fondata nel 1889 a Kyoto come azienda di carte da gioco fatte a mano.',
    isTrue: true,
    explanation: 'VERO! Produceva carte tradizionali Hanafuda oltre 80 anni prima di lanciare le prime console.',
    category: 'Pop',
  },
  {
    id: 'bf16',
    statement: 'La moneta da 1 euro ha sempre la stessa identica faccia su entrambi i lati in tutta Europa.',
    isTrue: false,
    explanation: 'BUFALA! Il lato comune ha la mappa europea, mentre l’altro lato cambia per ciascuno Stato membro (es. l’Uomo Vitruviano in Italia).',
    category: 'Vita quotidiana',
  },
  {
    id: 'bf17',
    statement: 'Il miele sigillato ermeticamente può conservarsi commestibile per oltre tremila anni senza andare a male.',
    isTrue: true,
    explanation: 'VERO! Grazie alla bassissima umidità e all’acidità naturale, nelle tombe egizie fu trovato miele millenario ancora intatto.',
    category: 'Cibo',
  },
  {
    id: 'bf18',
    statement: 'Lo spazio tra la Terra e la Luna è abbastanza grande da poterci incastrare appena un altro pianeta come Marte.',
    isTrue: false,
    explanation: 'BUFALA! I ~384.400 km tra Terra e Luna sono così vasti che ci starebbero in fila TUTTI gli altri 7 pianeti del Sistema Solare!',
    category: 'Spazio',
  },
  {
    id: 'bf19',
    statement: 'La Francia condivide il suo confine terrestre più lungo in assoluto con il Brasile.',
    isTrue: true,
    explanation: 'VERO! Merito della Guyana Francese in Sudamerica: oltre 730 km di frontiera diretta con il Brasile.',
    category: 'Geografia',
  },
  {
    id: 'bf20',
    statement: 'Svegliare bruscamente un sonnambulo provoca sempre un infarto fatale.',
    isTrue: false,
    explanation: 'BUFALA! Può spaventarsi e risultare disorientato (meglio riaccompagnarlo a letto con calma), ma non causa infarti.',
    category: 'Salute',
  },
  {
    id: 'bf21',
    statement: 'La Torre Eiffel d’estate cresce fino a 15 centimetri in più rispetto all’inverno.',
    isTrue: true,
    explanation: 'VERO! Per effetto della dilatazione termica del ferro sotto il sole caldo estivo, la struttura si allunga sensibilmente.',
    category: 'Scienza',
  },
  {
    id: 'bf22',
    statement: 'Albert Einstein è stato bocciato in matematica alle scuole elementari e medie.',
    isTrue: false,
    explanation: 'BUFALA! In Svizzera i voti andavano da 1 a 6 (dove 6 era il massimo) e un cambio di scala fece credere a tutti l’opposto.',
    category: 'Storia',
  },
  {
    id: 'bf23',
    statement: 'Cleopatra è vissuta più vicina nel tempo all’invenzione dell’iPhone che alla costruzione della Grande Piramide di Giza.',
    isTrue: true,
    explanation: 'VERO! La Piramide fu costruita ~2560 a.C., Cleopatra visse ~30 a.C. (2.530 anni dopo), l’iPhone arrivò nel 2007 (~2.037 anni dopo).',
    category: 'Storia',
  },
  {
    id: 'bf24',
    statement: 'Bere caffè disidrata sempre più di quanto idrati l’acqua contenuta nella tazza.',
    isTrue: false,
    explanation: 'BUFALA! Un consumo normale di caffè contribuisce comunque all’idratazione quotidiana perché è composto quasi al 98% d’acqua.',
    category: 'Cibo',
  },
];

export function drawBufalaQuestion(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): BufalaQuestion {
  const fresh = BUFALA_QUESTIONS.filter((q) => !usedIds.has(q.id));
  const pool = fresh.length > 0 ? fresh : [...BUFALA_QUESTIONS];
  return pool[Math.floor(rng() * pool.length)];
}

export function initBufalaRound(question: BufalaQuestion): BufalaRoundState {
  return {
    question,
    votes: new Map(),
  };
}

export function submitBufalaVote(
  state: BufalaRoundState,
  playerId: string,
  vote: boolean,
): { ok: true; vote: boolean } {
  state.votes.set(playerId, Boolean(vote));
  return { ok: true, vote: Boolean(vote) };
}

export function fillBotBufalaVotes(
  state: BufalaRoundState,
  bots: Array<{ id: string }>,
  rng: () => number = Math.random,
): void {
  for (const bot of bots) {
    if (state.votes.has(bot.id)) continue;
    const accurate = rng() < 0.55;
    const vote = accurate ? state.question.isTrue : !state.question.isTrue;
    state.votes.set(bot.id, vote);
  }
}

export function resolveBufalaResults(
  state: BufalaRoundState,
  nameOf: (playerId: string) => string,
): BufalaResultEntry[] {
  const results: BufalaResultEntry[] = [];
  for (const [playerId, vote] of state.votes.entries()) {
    const correct = vote === state.question.isTrue;
    results.push({
      playerId,
      nickname: nameOf(playerId),
      vote,
      correct,
      pointsAwarded: correct ? 100 : 0,
    });
  }
  results.sort((a, b) => Number(b.correct) - Number(a.correct));
  return results;
}

export function serializeBufalaState(
  state: BufalaRoundState,
  activePlayers: Array<{ id: string; nickname: string }>,
  nameOf: (playerId: string) => string,
  reveal: boolean,
): PublicBufalaState {
  const missingNicknames = activePlayers
    .filter((p) => !state.votes.has(p.id))
    .map((p) => p.nickname);

  const base: PublicBufalaState = {
    questionId: state.question.id,
    statement: state.question.statement,
    category: state.question.category,
    submittedCount: state.votes.size,
    totalPlayers: activePlayers.length,
    missingNicknames,
  };

  if (reveal) {
    let trueCount = 0;
    let falseCount = 0;
    for (const v of state.votes.values()) {
      if (v) trueCount++;
      else falseCount++;
    }
    base.isTrue = state.question.isTrue;
    base.explanation = state.question.explanation;
    base.trueCount = trueCount;
    base.falseCount = falseCount;
    base.results = resolveBufalaResults(state, nameOf);
  }
  return base;
}
