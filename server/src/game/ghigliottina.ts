// "La Ghigliottina": inspired by L'Eredita's iconic final game.
// Five clue words all connect via compounds, idioms, or associations to ONE mystery word.
// Players can type the word directly (+150 pt) or tap among 4 candidates (+100 pt).

export interface GhigliottinaPuzzle {
  id: string;
  clues: [string, string, string, string, string];
  answer: string;
  choices: [string, string, string, string];
  connections: [string, string, string, string, string];
}

export interface GhigliottinaSubmission {
  guess: string;
  usedChoices: boolean;
}

export interface GhigliottinaRoundState {
  puzzle: GhigliottinaPuzzle;
  shuffledChoices: string[];
  submissions: Map<string, GhigliottinaSubmission>;
}

export interface GhigliottinaResultEntry {
  playerId: string;
  nickname: string;
  guess: string;
  correct: boolean;
  usedChoices: boolean;
  pointsAwarded: number;
}

export interface PublicGhigliottinaState {
  puzzleId: string;
  clues: string[];
  choices: string[];
  submittedCount: number;
  totalPlayers: number;
  missingNicknames: string[];
  answer?: string;
  connections?: string[];
  results?: GhigliottinaResultEntry[];
}

export const GHIGLIOTTINA_PUZZLES: readonly GhigliottinaPuzzle[] = [
  {
    id: 'gh01',
    clues: ['SCENA', 'FULMINE', 'GRAZIA', 'STATO', 'STOMACO'],
    answer: 'COLPO',
    choices: ['COLPO', 'TAGLIO', 'PASSO', 'GIRO'],
    connections: [
      'Colpo di scena',
      'Colpo di fulmine',
      'Colpo di grazia',
      'Colpo di stato',
      'Colpo allo stomaco',
    ],
  },
  {
    id: 'gh02',
    clues: ['ACQUA', 'NOTTE', 'VENTI', 'SPINA', 'PALLINO'],
    answer: 'ROSA',
    choices: ['ROSA', 'FIORE', 'ROSSO', 'VERDE'],
    connections: [
      'Acqua di rose',
      'Notte rosa',
      'Rosa dei venti',
      'Spina della rosa',
      'Pallino / squadra rosa',
    ],
  },
  {
    id: 'gh03',
    clues: ['FEBBRE', 'PALLA', 'CUORE', 'ETA', 'MINUTO'],
    answer: 'ORO',
    choices: ['ORO', 'ARGENTO', 'FERRO', 'SOLE'],
    connections: [
      "Febbre dell'oro",
      "Pallone d'oro",
      "Cuore d'oro",
      "Età dell'oro",
      "Minuto d'oro",
    ],
  },
  {
    id: 'gh04',
    clues: ['TERRA', 'GIOCHI', 'BOCCA', 'PIETRA', 'LINEA'],
    answer: 'FUOCO',
    choices: ['FUOCO', 'ACQUA', 'ARIA', 'FUMO'],
    connections: [
      'Terra del Fuoco',
      "Giochi d'artificio / di fuoco",
      'Bocca di fuoco',
      'Pietra focaia / di fuoco',
      'Linea del fuoco',
    ],
  },
  {
    id: 'gh05',
    clues: ['STELLA', 'LUNA', 'ACQUA', 'FRUTTI', 'ALTO'],
    answer: 'MARE',
    choices: ['MARE', 'LAGO', 'CIELO', 'MONTE'],
    connections: [
      'Stella marina',
      'Mare della tranquillità (Luna)',
      'Acqua di mare',
      'Frutti di mare',
      'Alto mare',
    ],
  },
  {
    id: 'gh06',
    clues: ['MEZZA', 'TAVOLA', 'BIANCHI', 'GUARDIA', 'BRAVA'],
    answer: 'NOTTE',
    choices: ['NOTTE', 'SERA', 'GIORNO', 'OMBRA'],
    connections: [
      'Mezzanotte',
      'Notte in bianco / tavola di notte',
      'Passare la notte in bianco',
      'Guardia di notte',
      'Buona notte',
    ],
  },
  {
    id: 'gh07',
    clues: ['PADRE', 'DOLCE', 'PORTA', 'CHIAVE', 'MONDO'],
    answer: 'CASA',
    choices: ['CASA', 'STANZA', 'TETTO', 'TERRA'],
    connections: [
      'Padre di casa / padrone di casa',
      'Casa dolce casa',
      'Porta di casa',
      'Chiavi di casa',
      'In capo al mondo / casa nel mondo',
    ],
  },
  {
    id: 'gh08',
    clues: ['GIOCO', 'IDENTITA', 'BIANCA', 'MONETA', 'VETRO'],
    answer: 'CARTA',
    choices: ['CARTA', 'FOGLIO', 'PENNA', 'SIGILLO'],
    connections: [
      'Gioco di carte',
      "Carta d'identità",
      'Carta bianca',
      'Carta moneta',
      'Carta vetrata / carta vetro',
    ],
  },
  {
    id: 'gh09',
    clues: ['MACCHINA', 'LINEA', 'PASSA', 'PERDERE', 'REALE'],
    answer: 'TEMPO',
    choices: ['TEMPO', 'SPAZIO', 'ANNO', 'CORSA'],
    connections: [
      'Macchina del tempo',
      'Linea del tempo',
      'Passatempo',
      'Perdere tempo',
      'Tempo reale',
    ],
  },
  {
    id: 'gh10',
    clues: ['VELOCITA', 'OMBRA', 'VERDE', 'ANNI', 'CORPO'],
    answer: 'LUCE',
    choices: ['LUCE', 'OMBRA', 'FUOCO', 'LAMPO'],
    connections: [
      'Velocità della luce',
      'Luce e ombra',
      'Luce verde (via libera)',
      'Anni luce',
      'Venire alla luce',
    ],
  },
  {
    id: 'gh11',
    clues: ['FORTE', 'SECONDA', 'LIBERO', 'DESTRA', 'PRIMA'],
    answer: 'MANO',
    choices: ['MANO', 'BRACCIO', 'DITO', 'PIEDE'],
    connections: [
      'Manforte',
      'Di seconda mano',
      'A mano libera',
      'Mano destra',
      'Di prima mano',
    ],
  },
  {
    id: 'gh12',
    clues: ['NUDO', 'CAMBIO', 'SCARPA', 'PORCO', 'PRIMO'],
    answer: 'PIEDE',
    choices: ['PIEDE', 'GAMBA', 'PASSO', 'SALTO'],
    connections: [
      'A piede libero / a piedi nudi',
      'Cambio di piede',
      'Scarpa e piede',
      'Porco con i piedi nel piatto',
      'Partire con il piede giusto / primo piede',
    ],
  },
  {
    id: 'gh13',
    clues: ['CALDA', 'COLLO', 'PONTE', 'GIRO', 'DURA'],
    answer: 'TESTA',
    choices: ['TESTA', 'MANO', 'SPALLA', 'CUORE'],
    connections: [
      'Testa calda',
      'Rompersi la testa / collo e testa',
      'Testa di ponte',
      'Giro di testa',
      'Testa dura',
    ],
  },
  {
    id: 'gh14',
    clues: ['GROSSA', 'ALTA', 'SOTTO', 'FUORI', 'CORO'],
    answer: 'VOCE',
    choices: ['VOCE', 'PAROLA', 'CANTO', 'SUONO'],
    connections: [
      'A voce grossa',
      'Ad alta voce',
      'Sottovoce',
      'Fuori voce / fuori campo',
      'Una sola voce / voce del coro',
    ],
  },
  {
    id: 'gh15',
    clues: ['CICLONE', 'NERO', 'MAGICO', 'COLPO', 'CHIUSO'],
    answer: 'OCCHIO',
    choices: ['OCCHIO', 'SGUARDO', 'VISO', 'NASO'],
    connections: [
      'Occhio del ciclone',
      'Occhio nero',
      'Occhio magico (spioncino)',
      "Colpo d'occhio",
      'A occhi chiusi',
    ],
  },
  {
    id: 'gh16',
    clues: ['PIETRA', 'SPEZZATO', 'GONFIO', 'BUONO', 'BATTITO'],
    answer: 'CUORE',
    choices: ['CUORE', 'ANIMA', 'SANGUE', 'PETTO'],
    connections: [
      'Cuore di pietra',
      'Cuore spezzato',
      'Cuore gonfio',
      'Buon cuore',
      'Battito del cuore',
    ],
  },
  {
    id: 'gh17',
    clues: ['AEREO', 'LEVATOIO', 'FESTIVO', 'SOSPESO', 'COMANDO'],
    answer: 'PONTE',
    choices: ['PONTE', 'ARCO', 'TORRE', 'PASSO'],
    connections: [
      'Ponte aereo',
      'Ponte levatoio',
      'Ponte festivo (tra weekend e festa)',
      'Ponte sospeso',
      'Ponte di comando',
    ],
  },
  {
    id: 'gh18',
    clues: ['DOPPIO', 'FALSO', 'CARRAIO', 'AVANTI', 'DIETRO'],
    answer: 'PASSO',
    choices: ['PASSO', 'CORSA', 'SALTO', 'GIRO'],
    connections: [
      'Doppio passo',
      'Passo falso',
      'Passo carraio',
      'Passo avanti',
      'Passo indietro',
    ],
  },
  {
    id: 'gh19',
    clues: ['ITALIA', 'BANCO', 'CHIAVE', 'VITA', 'MONDO'],
    answer: 'GIRO',
    choices: ['GIRO', 'VIAGGIO', 'CORSA', 'VOLO'],
    connections: [
      "Giro d'Italia",
      'Giroconto / giro di banco',
      'Giro di chiave',
      'Giro di boa / giro di vita',
      'Giro del mondo',
    ],
  },
  {
    id: 'gh20',
    clues: ['DEBOLE', 'ESCLAMATIVO', 'FUGGIRE', 'INTERROGATIVO', 'MORTO'],
    answer: 'PUNTO',
    choices: ['PUNTO', 'SEGNO', 'LINEA', 'TRATTO'],
    connections: [
      'Punto debole',
      'Punto esclamativo',
      'Punto di fuga',
      'Punto interrogativo',
      'Punto morto',
    ],
  },
];

export function normalizeWord(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .trim();
}

export function drawGhigliottinaPuzzle(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): GhigliottinaPuzzle {
  const fresh = GHIGLIOTTINA_PUZZLES.filter((p) => !usedIds.has(p.id));
  const pool = fresh.length > 0 ? fresh : [...GHIGLIOTTINA_PUZZLES];
  return pool[Math.floor(rng() * pool.length)];
}

export function initGhigliottinaRound(
  puzzle: GhigliottinaPuzzle,
  rng: () => number = Math.random,
): GhigliottinaRoundState {
  const shuffledChoices = [...puzzle.choices];
  for (let i = shuffledChoices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledChoices[i], shuffledChoices[j]] = [shuffledChoices[j], shuffledChoices[i]];
  }
  return {
    puzzle,
    shuffledChoices,
    submissions: new Map(),
  };
}

export function submitGhigliottinaGuess(
  state: GhigliottinaRoundState,
  playerId: string,
  guess: string,
  usedChoices = true,
): { ok: true; guess: string } | { ok: false; error: 'EMPTY_GUESS' } {
  const trimmed = guess.trim().slice(0, 32).toUpperCase();
  if (normalizeWord(trimmed).length === 0) {
    return { ok: false, error: 'EMPTY_GUESS' };
  }
  state.submissions.set(playerId, {
    guess: trimmed,
    usedChoices: Boolean(usedChoices),
  });
  return { ok: true, guess: trimmed };
}

export function fillBotGhigliottinaGuesses(
  state: GhigliottinaRoundState,
  bots: Array<{ id: string }>,
  rng: () => number = Math.random,
): void {
  for (const bot of bots) {
    if (state.submissions.has(bot.id)) continue;
    const hit = rng() < 0.45;
    if (hit) {
      state.submissions.set(bot.id, { guess: state.puzzle.answer, usedChoices: true });
    } else {
      const decoys = state.shuffledChoices.filter(
        (c) => normalizeWord(c) !== normalizeWord(state.puzzle.answer),
      );
      const pick = decoys[Math.floor(rng() * decoys.length)] ?? state.shuffledChoices[0];
      state.submissions.set(bot.id, { guess: pick, usedChoices: true });
    }
  }
}

export function resolveGhigliottinaScores(
  state: GhigliottinaRoundState,
  nameOf: (playerId: string) => string,
): GhigliottinaResultEntry[] {
  const targetNorm = normalizeWord(state.puzzle.answer);
  const results: GhigliottinaResultEntry[] = [];
  for (const [playerId, sub] of state.submissions.entries()) {
    const correct = normalizeWord(sub.guess) === targetNorm;
    const pointsAwarded = correct ? (sub.usedChoices ? 100 : 150) : 0;
    results.push({
      playerId,
      nickname: nameOf(playerId),
      guess: sub.guess,
      correct,
      usedChoices: sub.usedChoices,
      pointsAwarded,
    });
  }
  results.sort((a, b) => b.pointsAwarded - a.pointsAwarded);
  return results;
}

export function serializeGhigliottinaState(
  state: GhigliottinaRoundState,
  activePlayers: Array<{ id: string; nickname: string }>,
  nameOf: (playerId: string) => string,
  reveal: boolean,
): PublicGhigliottinaState {
  const missingNicknames = activePlayers
    .filter((p) => !state.submissions.has(p.id))
    .map((p) => p.nickname);

  const base: PublicGhigliottinaState = {
    puzzleId: state.puzzle.id,
    clues: [...state.puzzle.clues],
    choices: [...state.shuffledChoices],
    submittedCount: state.submissions.size,
    totalPlayers: activePlayers.length,
    missingNicknames,
  };

  if (reveal) {
    base.answer = state.puzzle.answer;
    base.connections = [...state.puzzle.connections];
    base.results = resolveGhigliottinaScores(state, nameOf);
  }
  return base;
}
