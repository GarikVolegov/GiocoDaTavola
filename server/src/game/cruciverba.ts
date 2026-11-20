// Cruciverba Show: TV-style turn-based 2D mini-crossword engine.
// Each board is a compact 4-word interlocking crossword with funny, relatable
// Italian clues. Players take explicit 15-second turns solving or unlocking a
// letter, while solved intersections immediately fill shared cells for everyone.

export type CruciverbaMode = 'indizi' | 'scelte';

export interface CruciverbaWord {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  word: string;
  clue: string;
  choices?: string[];
}

export interface CruciverbaBoard {
  id: string;
  theme: string;
  rows: number;
  cols: number;
  words: CruciverbaWord[];
}

export type CruciverbaWordStatus = 'pending' | 'solved' | 'revealed';

export interface CruciverbaRoundState {
  board: CruciverbaBoard;
  mode: CruciverbaMode;
  turnOrder: string[];
  currentTurnIndex: number;
  /** Word currently spotlighted for the active player. */
  activeWordId: string;
  wordStatus: Record<string, CruciverbaWordStatus>;
  /** Shuffled 4-choice options per word id (populated for `'scelte'` mode). */
  wordChoices: Record<string, string[]>;
  /** Normalized wrong choices already attempted per word id in `'scelte'` mode. */
  wrongChoices: Record<string, string[]>;
  /** PlayerId who solved each word (if solved, not merely revealed). */
  solvedBy: Record<string, string>;
  /** Grid coordinates `"r,c"` whose letters are currently revealed to all. */
  revealedCells: Set<string>;
  turnsTaken: number;
  maxTurns: number;
  lastEvent?: {
    playerId: string;
    kind: 'solved' | 'hint' | 'timeout' | 'wrong';
    wordId: string;
    wordText?: string;
    revealedLetter?: { row: number; col: number; letter: string };
    pointsAwarded: number;
  };
}

export const CRUCIVERBA_READ_MS = 8_000;
export const CRUCIVERBA_TURN_DURATION_MS = 15_000;

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Normalize player input / answer words for accent-insensitive comparison.
 */
export function normalizeCruciverbaInput(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/**
 * Curated 10-board deck. Every board has 4 intersecting Italian words with
 * strict 2D grid invariants (shared intersections agree letter-for-letter,
 * zero unintended orthogonal touching between distinct words).
 */
export const CRUCIVERBA_BOARDS: CruciverbaBoard[] = [
  {
    id: 'cb_aperitivo',
    theme: 'Spritz & Chiacchiere',
    rows: 7,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'SPRITZ',
        clue: 'Arancione o rosso, trasforma il "beviamo solo una cosa" in mezzanotte',
        choices: ['SPRITZ', 'SPAGHI', 'CALICE', 'TONICA'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 2,
        col: 1,
        word: 'PIZZA',
        clue: 'Quella che ordini alle 23 giurando di prendere "solo metà"',
        choices: ['PIZZA', 'PASTA', 'PINSA', 'OLIVE'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 4,
        word: 'NOTTE',
        clue: 'Inizia con "sto a casa a dormire" e finisce con un cornetto caldo',
        choices: ['NOTTE', 'BOTTE', 'FESTA', 'CORSO'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 1,
        word: 'AMARO',
        clue: 'Lo bevi "per digerire" anche dopo aver mangiato tre patatine',
        choices: ['AMARO', 'ACQUA', 'AMICI', 'BIRRA'],
      },
    ],
  },
  {
    id: 'cb_vacanza',
    theme: 'Vacanza con gli Amici',
    rows: 6,
    cols: 8,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 1,
        word: 'VALIGIA',
        clue: 'La chiudi sedendotici sopra alle 5 del mattino prima di partire',
        choices: ['VALIGIA', 'VACANZA', 'VIAGGIO', 'TURISMO'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 2,
        col: 1,
        word: 'VOLO',
        clue: 'Partenza alle 06:15 per risparmiare 14 euro e perdere un anno di vita',
        choices: ['VOLO', 'VANO', 'MARE', 'SOLE'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'SOLARE',
        clue: 'Crema che dici di aver messo ma alle 14 sembri un gambero',
        choices: ['SOLARE', 'SALINA', 'PALUDE', 'ESTATE'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 5,
        col: 0,
        word: 'HOTEL',
        clue: 'Sul sito era "vista mare", ma il mare si vede solo sporgendosi dal bagno',
        choices: ['HOTEL', 'MOTEL', 'MAREA', 'TENDA'],
      },
    ],
  },
  {
    id: 'cb_ufficio',
    theme: 'Smart Working & Call',
    rows: 7,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'MUTATO',
        clue: 'Come scopri di avere il microfono dopo un monologo appassionato su Meet',
        choices: ['MUTATO', 'MINUTO', 'LAVORO', 'SCHEDA'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 0,
        col: 0,
        word: 'CAMICIA',
        clue: 'La indossi elegante sopra, mentre sotto hai i pantaloni del pigiama',
        choices: ['CAMICIA', 'DOMANDA', 'PIGIAMA', 'UFFICIO'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'CHAT',
        clue: 'Dove il collega scrive "ci sei?" senza dirti cosa vuole davvero',
        choices: ['CHAT', 'SPAM', 'MAIL', 'CALL'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 0,
        word: 'AGENDA',
        clue: 'Il posto magico in cui rimandi tutto a "lunedì prossimo"',
        choices: ['AGENDA', 'ATTESA', 'ORARIO', 'REPORT'],
      },
    ],
  },
  {
    id: 'cb_coinquilini',
    theme: 'Casa & Coinquilini',
    rows: 7,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'FRIGO',
        clue: 'Contiene il tuo yogurt col nome scritto col pennarello indelebile',
        choices: ['FRIGO', 'FORNO', 'LETTO', 'PIANO'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 0,
        col: 0,
        word: 'AFFITTO',
        clue: 'Ciò che svuota il tuo conto corrente ogni 1° del mese alle 08:00',
        choices: ['AFFITTO', 'UFFICIO', 'BALCONE', 'PULIZIA'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'BAGNO',
        clue: 'Diventa misteriosamente occupato per 50 minuti quando hai fretta',
        choices: ['BAGNO', 'FUGHE', 'PORTA', 'TENDA'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 0,
        word: 'OSPITE',
        clue: 'L’amico sul divano "solo per una notte" da ormai due settimane',
        choices: ['OSPITE', 'ORDINE', 'DIVANO', 'CHIAVI'],
      },
    ],
  },
  {
    id: 'cb_discoteca',
    theme: 'Notte Brava',
    rows: 7,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 4,
        col: 0,
        word: 'TAVOLO',
        clue: 'Lo prenotate "per fare i signori" ma dividete la spesa in dodici',
        choices: ['TAVOLO', 'TICKET', 'LOCALE', 'SERATA'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 2,
        col: 0,
        word: 'AFTER',
        clue: 'Quello che propone l’amico con ancora troppe energie alle 06:00',
        choices: ['AFTER', 'NOTTE', 'PISTA', 'CASSA'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 5,
        word: 'DISCO',
        clue: 'Locale dove dici "non si sente niente" ma torni senza voce',
        choices: ['DISCO', 'BALLO', 'LISTA', 'DRINK'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 0,
        word: 'REMIX',
        clue: 'Versione velocizzata della hit anni 2000 che manda in delirio la pista',
        choices: ['REMIX', 'RITMO', 'VOCAL', 'SUONO'],
      },
    ],
  },
  {
    id: 'cb_amore',
    theme: 'Dating & App',
    rows: 9,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 4,
        col: 0,
        word: 'TINDER',
        clue: 'L’app su cui giudichi la compatibilità dell’anima in 0,4 secondi',
        choices: ['TINDER', 'TESORO', 'COPPIA', 'AMANTI'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 3,
        col: 0,
        word: 'STORIA',
        clue: 'Quella su Instagram con canzone strappalacrime messa per farti notare',
        choices: ['STORIA', 'STELLA', 'SOCIAL', 'PAROLA'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 4,
        word: 'CUORE',
        clue: 'Emoji che invii per errore al posto del pollice su e non puoi più togliere',
        choices: ['CUORE', 'AMORE', 'MATCH', 'FIORE'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 8,
        col: 0,
        word: 'AMICO',
        clue: 'Ciò che diventi subito dopo la frase "ti vedo solo come un..."',
        choices: ['AMICO', 'AMATO', 'BACIO', 'SOGNO'],
      },
    ],
  },
  {
    id: 'cb_viaggio',
    theme: 'Aereo & Aeroporto',
    rows: 7,
    cols: 7,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'RITARDO',
        clue: 'L’unica vera costante garantita dal tabellone partenze del venerdì',
        choices: ['RITARDO', 'RIENTRO', 'DECOLLO', 'BAGAGLI'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 1,
        col: 0,
        word: 'PREZZO',
        clue: 'Raddoppia magicamente dopo che hai ricaricato la pagina due volte',
        choices: ['PREZZO', 'PRONTO', 'CODICE', 'VIAGGI'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 1,
        col: 3,
        word: 'GATE',
        clue: 'È sempre in fondo al corridoio più lontano del terminal sbagliato',
        choices: ['GATE', 'SALA', 'VOLO', 'TAXI'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 0,
        word: 'OFFERTA',
        clue: 'Biglietto "a 9 euro" che al pagamento diventa misteriosamente 118',
        choices: ['OFFERTA', 'OPZIONE', 'TARIFFA', 'IMBARCO'],
      },
    ],
  },
  {
    id: 'cb_gruppo',
    theme: 'Chat di Gruppo',
    rows: 6,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'VOCALE',
        clue: 'Quello da 6 minuti e 40 secondi che sei costretto ad ascoltare a 2x',
        choices: ['VOCALE', 'VISITA', 'GRUPPO', 'SCRIVO'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 0,
        col: 0,
        word: 'INVITO',
        clue: 'Quello per una cena che organizzate da tre mesi ma poi saltano tutti',
        choices: ['INVITO', 'AVVISO', 'SERATA', 'USCIRE'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'SPAM',
        clue: 'I trenta link consecutivi dell’amico che prova a piazzare biglietti',
        choices: ['SPAM', 'CHAT', 'LINK', 'MEME'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 5,
        col: 0,
        word: 'ORARIO',
        clue: 'L’unico dato fondamentale che nessuno legge nel messaggio fissato in alto',
        choices: ['ORARIO', 'OPPURE', 'GIORNO', 'TAVOLA'],
      },
    ],
  },
  {
    id: 'cb_serie',
    theme: 'Divano & Serie TV',
    rows: 7,
    cols: 7,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 3,
        col: 0,
        word: 'SPOILER',
        clue: 'La rivelazione killer che ti rovina il finale prima di cena',
        choices: ['SPOILER', 'SCHERMO', 'PUNTATA', 'EPISODI'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 1,
        col: 0,
        word: 'PISOLO',
        clue: 'Quello sul divano al minuto 12 urlando "non sto dormendo, ti ascolto!"',
        choices: ['PISOLO', 'CASINO', 'DIVANO', 'CINEMA'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'SERIE',
        clue: 'Ne inizi una da 8 stagioni giurando di guardare "solo una puntata"',
        choices: ['SERIE', 'AUDIO', 'TRAMA', 'VIDEO'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 6,
        col: 0,
        word: 'OSCAR',
        clue: 'La notte in cui tutti diventano critici cinematografici professionisti',
        choices: ['OSCAR', 'OPERA', 'SCENA', 'REGIA'],
      },
    ],
  },
  {
    id: 'cb_cibo',
    theme: 'Pizza & Consegna',
    rows: 6,
    cols: 6,
    words: [
      {
        id: 'w1',
        number: 1,
        direction: 'H',
        row: 2,
        col: 0,
        word: 'CONTO',
        clue: 'Appena arriva sul tavolo tutti iniziano magicamente a guardare lo schermo',
        choices: ['CONTO', 'CARTA', 'PIZZA', 'FORNO'],
      },
      {
        id: 'w2',
        number: 2,
        direction: 'V',
        row: 1,
        col: 0,
        word: 'ACQUA',
        clue: 'Quella naturale che ordini insieme al fritto misto per pulirti la coscienza',
        choices: ['ACQUA', 'ACETO', 'BIRRA', 'PASTA'],
      },
      {
        id: 'w3',
        number: 3,
        direction: 'V',
        row: 0,
        col: 3,
        word: 'SETE',
        clue: 'Quella implacabile alle 3 di notte dopo una pizza con salame piccante',
        choices: ['SETE', 'NOTE', 'FAME', 'CIBO'],
      },
      {
        id: 'w4',
        number: 4,
        direction: 'H',
        row: 5,
        col: 0,
        word: 'AVANZI',
        clue: 'Li porti via nel contenitore anche se sono esattamente tre patatine',
        choices: ['AVANZI', 'ARANCE', 'ORDINE', 'PIATTO'],
      },
    ],
  },
];

export function getWordCells(word: CruciverbaWord): Array<{ row: number; col: number; letter: string }> {
  const out: Array<{ row: number; col: number; letter: string }> = [];
  for (let i = 0; i < word.word.length; i++) {
    out.push({
      row: word.direction === 'V' ? word.row + i : word.row,
      col: word.direction === 'H' ? word.col + i : word.col,
      letter: word.word[i],
    });
  }
  return out;
}

export function drawCruciverbaBoard(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): CruciverbaBoard {
  const pool = CRUCIVERBA_BOARDS.filter((b) => !usedIds.has(b.id));
  const source = pool.length > 0 ? pool : CRUCIVERBA_BOARDS;
  const idx = Math.floor(rng() * source.length);
  const picked = source[Math.max(0, Math.min(source.length - 1, idx))];
  usedIds.add(picked.id);
  return picked;
}

export function initCruciverbaRound(
  board: CruciverbaBoard,
  playerIds: string[],
  rng: () => number = Math.random,
  mode: CruciverbaMode = 'indizi',
): CruciverbaRoundState {
  const turnOrder = [...playerIds];
  for (let i = turnOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
  }
  const wordStatus: Record<string, CruciverbaWordStatus> = {};
  const wordChoices: Record<string, string[]> = {};
  for (const w of board.words) {
    wordStatus[w.id] = 'pending';
    const rawChoices =
      w.choices && w.choices.length > 0
        ? Array.from(new Set([w.word, ...w.choices]))
        : [w.word];
    for (let i = rawChoices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [rawChoices[i], rawChoices[j]] = [rawChoices[j], rawChoices[i]];
    }
    wordChoices[w.id] = rawChoices;
  }

  const revealedCells = new Set<string>();
  if (mode === 'scelte' && board.words.length > 0) {
    const firstWord = board.words[0];
    const firstWordCells = getWordCells(firstWord);
    const otherKeys = new Set<string>();
    for (const w of board.words.slice(1)) {
      for (const c of getWordCells(w)) otherKeys.add(cellKey(c.row, c.col));
    }
    const anchor =
      firstWordCells.find((c) => otherKeys.has(cellKey(c.row, c.col))) ?? firstWordCells[0];
    if (anchor) {
      revealedCells.add(cellKey(anchor.row, anchor.col));
    }
  }

  return {
    board,
    mode,
    turnOrder,
    currentTurnIndex: 0,
    activeWordId: board.words[0].id,
    wordStatus,
    wordChoices,
    wrongChoices: {},
    solvedBy: {},
    revealedCells,
    turnsTaken: 0,
    maxTurns:
      mode === 'scelte'
        ? Math.max(board.words.length * 3, turnOrder.length * 3)
        : Math.max(board.words.length * 2, turnOrder.length * 2),
  };
}

export function getCurrentCruciverbaPlayerId(state: CruciverbaRoundState): string | null {
  if (state.turnOrder.length === 0) return null;
  return state.turnOrder[state.currentTurnIndex % state.turnOrder.length] ?? null;
}

export function getPendingWords(state: CruciverbaRoundState): CruciverbaWord[] {
  return state.board.words.filter((w) => state.wordStatus[w.id] === 'pending');
}

export function isCruciverbaRoundComplete(state: CruciverbaRoundState): boolean {
  return getPendingWords(state).length === 0 || state.turnsTaken >= state.maxTurns;
}

function advanceTurnPointer(state: CruciverbaRoundState): void {
  state.turnsTaken += 1;
  if (state.turnOrder.length > 0) {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  }
  const pending = getPendingWords(state);
  if (pending.length === 0) return;
  const activeIdx = pending.findIndex((w) => w.id === state.activeWordId);
  if (activeIdx === -1) {
    state.activeWordId = pending[0].id;
  } else {
    state.activeWordId = pending[(activeIdx + 1) % pending.length].id;
  }
}

function revealWordCells(state: CruciverbaRoundState, word: CruciverbaWord): void {
  for (const cell of getWordCells(word)) {
    state.revealedCells.add(cellKey(cell.row, cell.col));
  }
  // If any OTHER pending word now has all its cells revealed via intersections,
  // auto-complete it as revealed so it isn't stuck waiting to be guessed.
  for (const w of state.board.words) {
    if (state.wordStatus[w.id] !== 'pending') continue;
    const allKnown = getWordCells(w).every((c) =>
      state.revealedCells.has(cellKey(c.row, c.col)),
    );
    if (allKnown) {
      state.wordStatus[w.id] = 'revealed';
    }
  }
}

export interface AttemptResult {
  ok: boolean;
  error?: 'NOT_YOUR_TURN' | 'INVALID_WORD' | 'ALREADY_SOLVED' | 'ROUND_COMPLETE';
  correct: boolean;
  pointsAwarded: number;
  wordId: string;
  boardSolved: boolean;
  roundEnded: boolean;
}

export function submitCruciverbaAttempt(
  state: CruciverbaRoundState,
  playerId: string,
  guess: string,
  wordId?: string,
): AttemptResult {
  if (isCruciverbaRoundComplete(state)) {
    return { ok: false, error: 'ROUND_COMPLETE', correct: false, pointsAwarded: 0, wordId: state.activeWordId, boardSolved: false, roundEnded: true };
  }
  const activePlayer = getCurrentCruciverbaPlayerId(state);
  if (activePlayer !== playerId) {
    return { ok: false, error: 'NOT_YOUR_TURN', correct: false, pointsAwarded: 0, wordId: wordId ?? state.activeWordId, boardSolved: false, roundEnded: false };
  }
  const targetId = wordId && state.wordStatus[wordId] ? wordId : state.activeWordId;
  const word = state.board.words.find((w) => w.id === targetId);
  if (!word) {
    return { ok: false, error: 'INVALID_WORD', correct: false, pointsAwarded: 0, wordId: targetId, boardSolved: false, roundEnded: false };
  }
  if (state.wordStatus[word.id] !== 'pending') {
    return { ok: false, error: 'ALREADY_SOLVED', correct: false, pointsAwarded: 0, wordId: word.id, boardSolved: false, roundEnded: false };
  }

  const normalizedGuess = normalizeCruciverbaInput(guess);
  const normalizedTarget = normalizeCruciverbaInput(word.word);
  if (!normalizedGuess || normalizedGuess !== normalizedTarget) {
    if (state.mode === 'scelte') {
      const prevWrong = state.wrongChoices[word.id] ?? [];
      if (normalizedGuess && !prevWrong.includes(normalizedGuess)) {
        state.wrongChoices[word.id] = [...prevWrong, normalizedGuess];
      }
      if (state.turnOrder.length > 1) {
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      }
    }
    state.lastEvent = {
      playerId,
      kind: 'wrong',
      wordId: word.id,
      pointsAwarded: 0,
    };
    return { ok: true, correct: false, pointsAwarded: 0, wordId: word.id, boardSolved: false, roundEnded: false };
  }

  const cells = getWordCells(word);
  const alreadyRevealedCount = cells.filter((c) =>
    state.revealedCells.has(cellKey(c.row, c.col)),
  ).length;
  const cleanBonus = alreadyRevealedCount <= 1 ? 20 : 0;
  const pointsAwarded = 100 + cleanBonus;

  state.wordStatus[word.id] = 'solved';
  state.solvedBy[word.id] = playerId;
  revealWordCells(state, word);
  state.lastEvent = {
    playerId,
    kind: 'solved',
    wordId: word.id,
    wordText: word.word,
    pointsAwarded,
  };

  advanceTurnPointer(state);
  const boardSolved = getPendingWords(state).length === 0;
  const roundEnded = isCruciverbaRoundComplete(state);
  return {
    ok: true,
    correct: true,
    pointsAwarded,
    wordId: word.id,
    boardSolved,
    roundEnded,
  };
}

export interface PassTurnResult {
  ok: boolean;
  error?: 'NOT_YOUR_TURN' | 'ROUND_COMPLETE';
  revealedLetter?: { row: number; col: number; letter: string };
  roundEnded: boolean;
}

export function passOrTimeoutCruciverbaTurn(
  state: CruciverbaRoundState,
  reason: 'hint' | 'timeout',
  actingPlayerId?: string,
  rng: () => number = Math.random,
): PassTurnResult {
  if (isCruciverbaRoundComplete(state)) {
    return { ok: false, error: 'ROUND_COMPLETE', roundEnded: true };
  }
  const activePlayer = getCurrentCruciverbaPlayerId(state);
  if (reason === 'hint' && actingPlayerId && activePlayer !== actingPlayerId) {
    return { ok: false, error: 'NOT_YOUR_TURN', roundEnded: false };
  }

  const targetWord =
    state.board.words.find((w) => w.id === state.activeWordId && state.wordStatus[w.id] === 'pending') ??
    getPendingWords(state)[0];

  let revealedLetter: { row: number; col: number; letter: string } | undefined;
  if (targetWord) {
    const hiddenCells = getWordCells(targetWord).filter(
      (c) => !state.revealedCells.has(cellKey(c.row, c.col)),
    );
    if (hiddenCells.length > 0) {
      const chosen = hiddenCells[Math.floor(rng() * hiddenCells.length)];
      state.revealedCells.add(cellKey(chosen.row, chosen.col));
      revealedLetter = chosen;
    }
    // Check if that hint filled the word or any cross-words
    for (const w of state.board.words) {
      if (state.wordStatus[w.id] !== 'pending') continue;
      const allKnown = getWordCells(w).every((c) =>
        state.revealedCells.has(cellKey(c.row, c.col)),
      );
      if (allKnown) {
        state.wordStatus[w.id] = 'revealed';
      }
    }
  }

  state.lastEvent = {
    playerId: activePlayer ?? '',
    kind: reason,
    wordId: targetWord?.id ?? state.activeWordId,
    revealedLetter,
    pointsAwarded: 0,
  };

  advanceTurnPointer(state);
  return {
    ok: true,
    revealedLetter,
    roundEnded: isCruciverbaRoundComplete(state),
  };
}

export function revealRemainingCruciverbaWords(state: CruciverbaRoundState): void {
  for (const w of state.board.words) {
    if (state.wordStatus[w.id] === 'pending') {
      state.wordStatus[w.id] = 'revealed';
    }
    for (const c of getWordCells(w)) {
      state.revealedCells.add(cellKey(c.row, c.col));
    }
  }
}

export interface PublicCruciverbaWord {
  id: string;
  number: number;
  direction: 'H' | 'V';
  row: number;
  col: number;
  length: number;
  clue: string;
  choices?: string[];
  wrongChoices?: string[];
  status: CruciverbaWordStatus;
  solvedByName: string | null;
  answer?: string;
}

export interface PublicCruciverbaState {
  boardId: string;
  theme: string;
  mode: CruciverbaMode;
  rows: number;
  cols: number;
  activePlayerId: string | null;
  activePlayerName: string | null;
  activeWordId: string;
  turnsTaken: number;
  maxTurns: number;
  words: PublicCruciverbaWord[];
  /** Grid of cells: null = black/unused block; '' = hidden white cell; 'A' = revealed letter. */
  cells: Array<Array<{ letter: string; wordNumbers: number[] } | null>>;
  lastEvent?: {
    playerName: string;
    kind: 'solved' | 'hint' | 'timeout' | 'wrong';
    wordId: string;
    wordText?: string;
    pointsAwarded: number;
  };
}

export function serializeCruciverbaState(
  state: CruciverbaRoundState,
  resolvePlayerName: (id: string) => string,
  includeAllAnswers: boolean,
): PublicCruciverbaState {
  const { board } = state;
  const cells: Array<Array<{ letter: string; wordNumbers: number[] } | null>> = Array.from(
    { length: board.rows },
    () => Array.from({ length: board.cols }, () => null),
  );

  for (const w of board.words) {
    const wordCells = getWordCells(w);
    wordCells.forEach((wc, idx) => {
      const existing = cells[wc.row][wc.col];
      const shown =
        includeAllAnswers || state.revealedCells.has(cellKey(wc.row, wc.col))
          ? wc.letter
          : '';
      if (!existing) {
        cells[wc.row][wc.col] = {
          letter: shown,
          wordNumbers: idx === 0 ? [w.number] : [],
        };
      } else {
        if (idx === 0 && !existing.wordNumbers.includes(w.number)) {
          existing.wordNumbers.push(w.number);
        }
        if (shown) existing.letter = shown;
      }
    });
  }

  const activePlayerId = getCurrentCruciverbaPlayerId(state);

  return {
    boardId: board.id,
    theme: board.theme,
    mode: state.mode ?? 'indizi',
    rows: board.rows,
    cols: board.cols,
    activePlayerId,
    activePlayerName: activePlayerId ? resolvePlayerName(activePlayerId) : null,
    activeWordId: state.activeWordId,
    turnsTaken: state.turnsTaken,
    maxTurns: state.maxTurns,
    words: board.words.map((w) => {
      const status = state.wordStatus[w.id];
      const revealThisWord = includeAllAnswers || status !== 'pending';
      const isChoices = state.mode === 'scelte';
      return {
        id: w.id,
        number: w.number,
        direction: w.direction,
        row: w.row,
        col: w.col,
        length: w.word.length,
        clue: isChoices ? '' : w.clue,
        ...(isChoices
          ? {
              choices: state.wordChoices?.[w.id] ?? [],
              wrongChoices: state.wrongChoices?.[w.id] ?? [],
            }
          : {}),
        status,
        solvedByName: state.solvedBy[w.id] ? resolvePlayerName(state.solvedBy[w.id]) : null,
        ...(revealThisWord ? { answer: w.word } : {}),
      };
    }),
    cells,
    lastEvent: state.lastEvent
      ? {
          playerName: resolvePlayerName(state.lastEvent.playerId),
          kind: state.lastEvent.kind,
          wordId: state.lastEvent.wordId,
          wordText: state.lastEvent.wordText,
          pointsAwarded: state.lastEvent.pointsAwarded,
        }
      : undefined,
  };
}
