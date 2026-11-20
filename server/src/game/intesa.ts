// "Parola Vietata" (L'Intesa / Taboo): inspired by Reazione a Catena & Taboo.
// Only ONE speaker secretly sees the target word and 4 forbidden words on their phone.
// They describe it live to the group without saying any forbidden word!

export interface IntesaCard {
  id: string;
  word: string;
  forbidden: [string, string, string, string];
  category: string;
}

export type IntesaOutcome = 'pending' | 'guessed' | 'taboo' | 'skipped';

export interface IntesaRoundState {
  card: IntesaCard;
  speakerId: string;
  outcome: IntesaOutcome;
  winnerId: string | null;
}

export interface PublicIntesaState {
  cardId: string;
  category: string;
  speakerId: string;
  speakerName: string;
  outcome: IntesaOutcome;
  winnerId: string | null;
  winnerName: string | null;
  word?: string;
  forbidden?: string[];
}

export interface IntesaSecretPayload {
  cardId: string;
  word: string;
  forbidden: [string, string, string, string];
  category: string;
  round: number;
}

export const INTESA_CARDS: readonly IntesaCard[] = [
  { id: 'in01', word: 'CARBONARA', forbidden: ['PASTA', 'UOVO', 'GUANCIALE', 'PECORINO'], category: 'Cucina' },
  { id: 'in02', word: 'SPRITZ', forbidden: ['APEROL', 'PROSECCO', 'ARANCIONE', 'APERITIVO'], category: 'Vita notturna' },
  { id: 'in03', word: 'OMBRELLO', forbidden: ['PIOGGIA', 'APRIRE', 'ACQUA', 'BAGNATO'], category: 'Oggetti' },
  { id: 'in04', word: 'SVEGLIA', forbidden: ['MATTINA', 'SUONARE', 'DORMIRE', 'ORA'], category: 'Vita quotidiana' },
  { id: 'in05', word: 'ASCENSORE', forbidden: ['PIANO', 'SALIRE', 'SCENDERE', 'BOTTONE'], category: 'Luoghi' },
  { id: 'in06', word: 'KARAOKE', forbidden: ['CANTARE', 'MICROFONO', 'CANZONE', 'TESTO'], category: 'Festa' },
  { id: 'in07', word: 'AEROPORTO', forbidden: ['AEREO', 'VOLO', 'VALIGIA', 'PARTIRE'], category: 'Viaggi' },
  { id: 'in08', word: 'GHOSTING', forbidden: ['SPARITO', 'MESSAGGIO', 'RISPONDERE', 'CHAT'], category: 'Relazioni' },
  { id: 'in09', word: 'PIZZA', forbidden: ['MOZZARELLA', 'POMODORO', 'FORNO', 'NAPOLI'], category: 'Cucina' },
  { id: 'in10', word: 'PATENTE', forbidden: ['GUIDARE', 'MACCHINA', 'ESAME', 'FOGLIO'], category: 'Vita quotidiana' },
  { id: 'in11', word: 'PIGIAMA', forbidden: ['LETTO', 'DORMIRE', 'NOTTE', 'VESTITO'], category: 'Casa' },
  { id: 'in12', word: 'SANREMO', forbidden: ['FESTIVAL', 'FIORI', 'ARISTON', 'CANTANTI'], category: 'TV & Cultura' },
  { id: 'in13', word: 'GELATO', forbidden: ['CONO', 'COPPETTA', 'FREDDO', 'ESTATE'], category: 'Cibo' },
  { id: 'in14', word: 'SMARTPHONE', forbidden: ['TELEFONO', 'SCHERMO', 'APP', 'CHIAMARE'], category: 'Tecnologia' },
  { id: 'in15', word: 'SEMAFORO', forbidden: ['ROSSO', 'VERDE', 'STRADA', 'MACCHINE'], category: 'Città' },
  { id: 'in16', word: 'CAFFETTIERA', forbidden: ['MOKA', 'CAFFE', 'FORNELLO', 'MATTINA'], category: 'Casa' },
  { id: 'in17', word: 'CINEMA', forbidden: ['FILM', 'POPCORN', 'SCHERMO', 'POLTRONA'], category: 'Tempo libero' },
  { id: 'in18', word: 'VALIGIA', forbidden: ['VIAGGIO', 'VESTITI', 'TROLLEY', 'CHIUDERE'], category: 'Viaggi' },
  { id: 'in19', word: 'ZAINO', forbidden: ['SPALLA', 'SCUOLA', 'LIBRI', 'BORSA'], category: 'Oggetti' },
  { id: 'in20', word: 'OCCHIALI', forbidden: ['VEDERE', 'SOLE', 'LENTI', 'NASELLO'], category: 'Oggetti' },
  { id: 'in21', word: 'PENDOLARE', forbidden: ['TRENO', 'LAVORO', 'MATTINA', 'VIAGGIARE'], category: 'Vita quotidiana' },
  { id: 'in22', word: 'BILIARDINO', forbidden: ['CALCIO', 'STECCA', 'BAR', 'PORTA'], category: 'Giochi' },
  { id: 'in23', word: 'FUOCHI D’ARTIFICIO', forbidden: ['CAPODANNO', 'CIELO', 'BOTTI', 'COLORI'], category: 'Festa' },
  { id: 'in24', word: 'DIETA', forbidden: ['DIMAGRIRE', 'CALORIE', 'MANGIARE', 'PALESTRA'], category: 'Vita quotidiana' },
];

export function drawIntesaCard(
  usedIds: Set<string>,
  rng: () => number = Math.random,
): IntesaCard {
  const fresh = INTESA_CARDS.filter((c) => !usedIds.has(c.id));
  const pool = fresh.length > 0 ? fresh : [...INTESA_CARDS];
  return pool[Math.floor(rng() * pool.length)];
}

export function pickIntesaSpeaker(
  poolIds: string[],
  appearances: Map<string, number>,
  rng: () => number = Math.random,
): string | null {
  if (poolIds.length === 0) return null;
  const minCount = Math.min(...poolIds.map((id) => appearances.get(id) ?? 0));
  const candidates = poolIds.filter((id) => (appearances.get(id) ?? 0) === minCount);
  return candidates[Math.floor(rng() * candidates.length)];
}

export function initIntesaRound(card: IntesaCard, speakerId: string): IntesaRoundState {
  return {
    card,
    speakerId,
    outcome: 'pending',
    winnerId: null,
  };
}

export function resolveIntesaOutcome(
  state: IntesaRoundState,
  outcome: Exclude<IntesaOutcome, 'pending'>,
  winnerId: string | null = null,
): { speakerPoints: number; winnerPoints: number; winnerId: string | null } {
  state.outcome = outcome;
  const resolvedWinner = outcome === 'guessed' && winnerId && winnerId !== state.speakerId ? winnerId : null;
  state.winnerId = resolvedWinner;
  if (outcome === 'guessed') {
    return {
      speakerPoints: 100,
      winnerPoints: resolvedWinner ? 100 : 0,
      winnerId: resolvedWinner,
    };
  }
  return { speakerPoints: 0, winnerPoints: 0, winnerId: null };
}

export function serializeIntesaState(
  state: IntesaRoundState,
  nameOf: (playerId: string) => string,
  reveal: boolean,
): PublicIntesaState {
  const base: PublicIntesaState = {
    cardId: state.card.id,
    category: state.card.category,
    speakerId: state.speakerId,
    speakerName: nameOf(state.speakerId),
    outcome: state.outcome,
    winnerId: state.winnerId,
    winnerName: state.winnerId ? nameOf(state.winnerId) : null,
  };
  if (reveal) {
    base.word = state.card.word;
    base.forbidden = [...state.card.forbidden];
  }
  return base;
}
