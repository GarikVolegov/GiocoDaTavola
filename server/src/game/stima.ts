// "Quanto Vale?": inspired by OK il Prezzo e Giusto! / Wits & Wagers.
// Everyone secretly guesses a real-world number via slider; closest wins (+50 Centro Perfetto bonus!).

export interface StimaQuestion {
  id: string;
  prompt: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  answer: number;
  funFact: string;
}

export interface StimaRoundState {
  question: StimaQuestion;
  guesses: Map<string, number>;
}

export interface StimaResultEntry {
  playerId: string;
  nickname: string;
  guess: number;
  diff: number;
  isWinner: boolean;
  isExact: boolean;
  pointsAwarded: number;
}

export interface PublicStimaState {
  questionId: string;
  prompt: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  submittedCount: number;
  totalPlayers: number;
  missingNicknames: string[];
  answer?: number;
  funFact?: string;
  results?: StimaResultEntry[];
  soloPrecisionPct?: number;
}

export const STIMA_QUESTIONS: readonly StimaQuestion[] = [
  {
    id: 'st01',
    prompt: 'Quante parole contiene in media un biglietto ferroviario o scontrino termico lungo 20 cm?',
    unit: 'parole',
    min: 20,
    max: 300,
    step: 10,
    answer: 120,
    funFact: 'Tra codici IVA, norme di legge e diciture fiscali ci sono circa 120 parole in poche righe.',
  },
  {
    id: 'st02',
    prompt: 'In che anno è stato inviato il primissimo SMS della storia ("Merry Christmas")?',
    unit: 'anno',
    min: 1980,
    max: 2005,
    step: 1,
    answer: 1992,
    funFact: 'Lo inviò l’ingegnere Neil Papworth il 3 dicembre 1992 da un computer verso un telefono Vodafone.',
  },
  {
    id: 'st03',
    prompt: 'Quanti litri di acqua servono all’incirca per produrre 1 chilo di caffè tostato (impronta idrica)?',
    unit: 'litri',
    min: 1000,
    max: 25000,
    step: 500,
    answer: 18900,
    funFact: 'Dalla coltivazione della pianta alla tostatura finale servono circa 18.900 litri d’acqua per kg.',
  },
  {
    id: 'st04',
    prompt: 'Quanti gradini ha esattamente la Torre di Pisa dall’ingresso fino alla cima della cella campanaria?',
    unit: 'gradini',
    min: 100,
    max: 500,
    step: 5,
    answer: 251,
    funFact: 'Per arrivare in cima ai 56 metri della Torre pendente si salgono esattamente 251 gradini a chiocciola.',
  },
  {
    id: 'st05',
    prompt: 'Quanti chilometri di gallerie e linee comprende oggi l’intera Metropolitana di Tokyo?',
    unit: 'km',
    min: 50,
    max: 500,
    step: 10,
    answer: 304,
    funFact: 'Tra Tokyo Metro e Toei Subway si superano i 304 km con quasi 290 stazioni.',
  },
  {
    id: 'st06',
    prompt: 'Quanti minuti dura l’intero giro completo del Colosseo in una visita media con audioguida?',
    unit: 'minuti',
    min: 20,
    max: 180,
    step: 5,
    answer: 75,
    funFact: 'Un percorso classico attraverso arena, anelli superiori e musei richiede circa 75 minuti.',
  },
  {
    id: 'st07',
    prompt: 'A quanti euro è stato venduto all’asta il primo iPhone (2007) ancora sigillato nella scatola originale?',
    unit: 'mila €',
    min: 5,
    max: 250,
    step: 5,
    answer: 175,
    funFact: 'Nel 2023 un iPhone 2G da 4 GB sigillato ha superato l’equivalente di circa 175.000 euro all’asta!',
  },
  {
    id: 'st08',
    prompt: 'Quanti battiti fa in media il cuore umano in una singola giornata?',
    unit: 'mila battiti',
    min: 30,
    max: 180,
    step: 5,
    answer: 100,
    funFact: 'A circa 70 battiti al minuto, il cuore compie intorno ai 100.000 battiti ogni 24 ore.',
  },
  {
    id: 'st09',
    prompt: 'Quante isolette compongono approssimativamente la città storica di Venezia?',
    unit: 'isole',
    min: 10,
    max: 250,
    step: 2,
    answer: 118,
    funFact: 'Il centro storico veneziano poggia su circa 118 isolette unite da oltre 400 ponti.',
  },
  {
    id: 'st10',
    prompt: 'In che anno è stato registrato il primo nome a dominio su Internet (symbolics.com)?',
    unit: 'anno',
    min: 1975,
    max: 1998,
    step: 1,
    answer: 1985,
    funFact: 'Symbolics.com fu registrato il 15 marzo 1985, oltre 6 anni prima della nascita del Web pubblico.',
  },
  {
    id: 'st11',
    prompt: 'Quanti chilometri dista in linea d’aria Roma da Milano?',
    unit: 'km',
    min: 200,
    max: 800,
    step: 10,
    answer: 480,
    funFact: 'In linea d’aria Roma e Milano distano circa 480 km (su strada diventano circa 575 km).',
  },
  {
    id: 'st12',
    prompt: 'Quante volte al giorno sbadiglia in media una persona adulta?',
    unit: 'volte',
    min: 2,
    max: 40,
    step: 1,
    answer: 10,
    funFact: 'La media va da 5 a 15 sbadigli al giorno (~10), e solo leggerne il nome spesso ne scatena uno!',
  },
  {
    id: 'st13',
    prompt: 'Quanti grammi pesa esattamente una pallina regolamentare da ping pong moderna (40+ mm)?',
    unit: 'decimi di grammo (es. 27 = 2,7 g)',
    min: 10,
    max: 60,
    step: 1,
    answer: 27,
    funFact: 'Una pallina omologata ITTF pesa esattamente 2,7 grammi (27 decimi di grammo).',
  },
  {
    id: 'st14',
    prompt: 'Quanti miliardi di visualizzazioni ha raggiunto il videoclip più visto su YouTube di sempre («Baby Shark»)?',
    unit: 'miliardi',
    min: 2,
    max: 25,
    step: 1,
    answer: 15,
    funFact: 'Baby Shark ha superato i 15 miliardi di visualizzazioni, circa due volte la popolazione mondiale.',
  },
  {
    id: 'st15',
    prompt: 'Quanti secondi impiega la luce che parte dal Sole a raggiungere la Terra?',
    unit: 'secondi',
    min: 120,
    max: 900,
    step: 10,
    answer: 500,
    funFact: 'La luce impiega circa 8 minuti e 20 secondi (~500 secondi) per coprire i 150 milioni di km.',
  },
  {
    id: 'st16',
    prompt: 'Quante puntate ha avuto in totale la storica serie TV americana "Friends" in 10 stagioni?',
    unit: 'episodi',
    min: 100,
    max: 350,
    step: 2,
    answer: 236,
    funFact: 'Dal 1994 al 2004 sono andati in onda esattamente 236 episodi distribuiti in 10 stagioni.',
  },
  {
    id: 'st17',
    prompt: 'Quanti tasti bianchi e neri ha un pianoforte da concerto standard completo?',
    unit: 'tasti',
    min: 60,
    max: 110,
    step: 1,
    answer: 88,
    funFact: 'Un pianoforte standard ha esattamente 88 tasti: 52 bianchi e 36 neri.',
  },
  {
    id: 'st18',
    prompt: 'In che anno è arrivata la prima vera pizzeria moderna con pizza Margherita a Napoli secondo la tradizione?',
    unit: 'anno',
    min: 1850,
    max: 1930,
    step: 1,
    answer: 1889,
    funFact: 'Nel giugno 1889 il pizzaiolo Raffaele Esposito dedicò la tricolore alla Regina Margherita.',
  },
  {
    id: 'st19',
    prompt: 'Quanti chilometri all’ora può raggiungere in picchiata il falco pellegrino, l’animale più veloce del pianeta?',
    unit: 'km/h',
    min: 120,
    max: 450,
    step: 10,
    answer: 320,
    funFact: 'Durante l’attacco in picchiata supera facilmente i 320 km/h (con picchi cronometrati oltre 350 km/h).',
  },
  {
    id: 'st20',
    prompt: 'Quanti anni interi trascorre attivamente sognando una persona nell’arco di una vita di 80 anni?',
    unit: 'anni di sogni',
    min: 1,
    max: 25,
    step: 1,
    answer: 6,
    funFact: 'Su circa 26 anni passati dormendo, circa 6 anni interi sono trascorsi attivamente a sognare.',
  },
];

export function drawStimaQuestion(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): StimaQuestion {
  const fresh = STIMA_QUESTIONS.filter((q) => !usedIds.has(q.id));
  const pool = fresh.length > 0 ? fresh : [...STIMA_QUESTIONS];
  return pool[Math.floor(rng() * pool.length)];
}

export function initStimaRound(question: StimaQuestion): StimaRoundState {
  return {
    question,
    guesses: new Map(),
  };
}

export function submitStimaGuess(
  state: StimaRoundState,
  playerId: string,
  rawValue: number,
): { ok: true; value: number } | { ok: false; error: 'INVALID_VALUE' } {
  if (!Number.isFinite(rawValue)) return { ok: false, error: 'INVALID_VALUE' };
  const clamped = Math.max(state.question.min, Math.min(state.question.max, rawValue));
  const snapped =
    state.question.min +
    Math.round((clamped - state.question.min) / state.question.step) * state.question.step;
  const finalVal = Math.max(state.question.min, Math.min(state.question.max, snapped));
  state.guesses.set(playerId, finalVal);
  return { ok: true, value: finalVal };
}

export function fillBotStimaGuesses(
  state: StimaRoundState,
  bots: Array<{ id: string }>,
  rng: () => number = Math.random,
): void {
  const { min, max, answer } = state.question;
  const span = Math.max(1, max - min);
  for (const bot of bots) {
    if (state.guesses.has(bot.id)) continue;
    const offset = (rng() - 0.5) * 0.45 * span;
    submitStimaGuess(state, bot.id, answer + offset);
  }
}

export function computeStimaPrecisionPct(question: StimaQuestion, guess: number): number {
  const span = Math.max(1, question.max - question.min);
  const diff = Math.abs(guess - question.answer);
  return Math.max(0, Math.round(100 - (diff / span) * 100));
}

export function resolveStimaResults(
  state: StimaRoundState,
  nameOf: (playerId: string) => string,
): StimaResultEntry[] {
  const { answer, min, max, step } = state.question;
  const entries = [...state.guesses.entries()].map(([playerId, guess]) => ({
    playerId,
    nickname: nameOf(playerId),
    guess,
    diff: Math.abs(guess - answer),
  }));
  if (entries.length === 0) return [];
  const minDiff = Math.min(...entries.map((e) => e.diff));
  const exactThreshold = Math.max(step, (max - min) * 0.05);

  const results: StimaResultEntry[] = entries.map((e) => {
    const isWinner = e.diff === minDiff;
    const isExact = e.diff <= exactThreshold;
    const pointsAwarded = isWinner ? 120 + (isExact ? 50 : 0) : isExact ? 50 : 0;
    return {
      ...e,
      isWinner,
      isExact,
      pointsAwarded,
    };
  });
  results.sort((a, b) => a.diff - b.diff);
  return results;
}

export function serializeStimaState(
  state: StimaRoundState,
  activePlayers: Array<{ id: string; nickname: string }>,
  nameOf: (playerId: string) => string,
  reveal: boolean,
): PublicStimaState {
  const missingNicknames = activePlayers
    .filter((p) => !state.guesses.has(p.id))
    .map((p) => p.nickname);

  const base: PublicStimaState = {
    questionId: state.question.id,
    prompt: state.question.prompt,
    unit: state.question.unit,
    min: state.question.min,
    max: state.question.max,
    step: state.question.step,
    submittedCount: state.guesses.size,
    totalPlayers: activePlayers.length,
    missingNicknames,
  };

  if (reveal) {
    base.answer = state.question.answer;
    base.funFact = state.question.funFact;
    const results = resolveStimaResults(state, nameOf);
    base.results = results;
    if (results.length === 1) {
      base.soloPrecisionPct = computeStimaPrecisionPct(state.question, results[0].guess);
    }
  }
  return base;
}
