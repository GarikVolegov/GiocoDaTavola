// "Termometro (Hot Take 1–10)": mobile-first tactile slider mini-game.
// Everyone rates a provocative statement from 1 (Mai nella vita) to 10 (100% d'accordo).
// The reveal shows the group's average, distribution, and spotlights the two
// extremes (lowest vs highest score) to justify their stance out loud.
import type { Room } from './rooms';
import { pickByFamiliarita, type DilemmaFamiliarita, type Familiarita } from './deck';

export interface HotTakePrompt {
  id: string;
  text: string;
  lowLabel?: string;
  highLabel?: string;
  familiarita?: DilemmaFamiliarita;
}

export const HOT_TAKE_PROMPTS: HotTakePrompt[] = [
  { id: 'ht01', text: 'Ghostare dopo un primo appuntamento è legittimo se non c’è chimica.' },
  { id: 'ht02', text: 'Gli amici veri si contano sulle dita di una mano: gli altri sono conoscenti.' },
  { id: 'ht03', text: 'Un lavoro che odi ma pagato il doppio batte un lavoro che ami pagato poco.' },
  { id: 'ht04', text: 'Controllare la posizione del partner o condividere la posizione 24/7 è normale.' },
  { id: 'ht05', text: 'Se trovi un portafoglio con 500€ senza documenti, li tieni.' },
  { id: 'ht06', text: 'Chi arriva sempre con 20 minuti di ritardo in realtà non rispetta il tempo altrui.' },
  { id: 'ht07', text: 'I vocali WhatsApp sopra i 60 secondi andrebbero vietati per legge.' },
  { id: 'ht08', text: 'Meglio sapere una verità che fa malissimo oggi che restare in una bugia serena.' },
  { id: 'ht09', text: 'In amicizia, prestare soldi è il modo più veloce per rovinare il rapporto.' },
  { id: 'ht10', text: 'Le relazioni a distanza funzionano solo se c’è già una data di fine.' },
  { id: 'ht11', text: 'La gente che posta ogni cosa sui social sta compensando qualcosa.' },
  { id: 'ht12', text: 'Al ristorante, se qualcuno ordina solo un’insalata e gli altri vino e antipasti, si divide comunque alla pari.' },
  { id: 'ht13', text: 'Avere un piano B significa già non credere abbastanza nel piano A.' },
  { id: 'ht14', text: 'Si può rimanere davvero amici con un/una ex senza secondi fini.' },
  { id: 'ht15', text: 'I soldi comprano la felicità, almeno fino a quando non devi più guardare i prezzi.' },
  { id: 'ht16', text: 'Licenziarsi senza avere un altro lavoro in mano è coraggio, non incoscienza.' },
  { id: 'ht17', text: 'Chi dice "non ho tempo" in realtà intende "non sei una priorità".' },
  { id: 'ht18', text: 'Il matrimonio oggi è più una festa costosa che una necessità.' },
  { id: 'ht19', text: 'In un gruppo di amici c’è sempre qualcuno che nessuno sopporta davvero al 100%.' },
  { id: 'ht20', text: 'Le vacanze con gli amici rovinano più amicizie di quanto le rafforzino.' },
  { id: 'ht21', text: 'Senza intelligenza emotiva, l’intelligenza logica serve a poco.' },
  { id: 'ht22', text: 'La maggior parte delle riunioni di lavoro potrebbe essere un’email di 3 righe.' },
  { id: 'ht23', text: 'Chi non lascia mai la mancia anche quando il servizio è ottimo è tirchio.' },
  { id: 'ht24', text: 'Perdonare un tradimento è segno di maturità, non di debolezza.' },
  { id: 'ht25', text: 'Meglio vivere di rimorsi che di rimpianti.' },
  { id: 'ht26', text: 'Il colpo di fulmine esiste, ma dura massimo 6 mesi.' },
  { id: 'ht27', text: 'Se un amico fa una cazzata enorme, devi coprirlo anche se ha torto.' },
  { id: 'ht28', text: 'Lo smart working al 100% ti fa perdere connessioni umane importanti.' },
  { id: 'ht29', text: 'Nessuno sa davvero cosa sta facendo nella vita, stiamo tutti improvvisando.' },
  { id: 'ht30', text: 'A 30 anni dovresti avere già capito cosa vuoi fare, almeno a grandi linee.' },
  { id: 'ht31', text: 'In un gruppo di vecchi amici, ci si conosce davvero meno di quanto si creda.', familiarita: 'vecchi_amici' },
  { id: 'ht32', text: 'È giusto far pesare a un amico storico che sparisce ogni volta che si fidanza.', familiarita: 'vecchi_amici' },
  { id: 'ht33', text: 'Tra amici di lunga data, la sincerità brutale vale più della diplomazia.', familiarita: 'vecchi_amici' },
  { id: 'ht34', text: 'Molte amicizie lunghe vanno avanti più per abitudine che per reale affinità oggi.', familiarita: 'vecchi_amici' },
  { id: 'ht35', text: 'Anche tra i migliori amici esiste sempre un filo di confronto o invidia silenziosa.', familiarita: 'vecchi_amici' },
  { id: 'ht36', text: 'I soldi prestati tra amici veri non dovrebbero mai creare imbarazzo, nemmeno se tardano.', familiarita: 'vecchi_amici' },
];

export const HOT_TAKE_MIN = 1;
export const HOT_TAKE_MAX = 10;

export function pickHotTakePrompt(
  usedIds: Set<string>,
  rng: () => number,
  familiarita: Familiarita = 'misto',
): HotTakePrompt | null {
  const pool = HOT_TAKE_PROMPTS.filter((p) => !usedIds.has(p.id));
  return pickByFamiliarita(pool, familiarita, rng);
}

export function castBotHotTake(room: Room, rng: () => number): void {
  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    const score = 1 + Math.floor(rng() * 10);
    room.hotTakeScores.set(p.id, score);
  }
}

export type HotTakeSubmitError =
  | 'NOT_HOT_TAKE_PHASE'
  | 'NOT_IN_ROOM'
  | 'INVALID_SCORE';

export type HotTakeSubmitResult =
  | { ok: true; room: Room }
  | { ok: false; error: HotTakeSubmitError };

export function submitHotTake(room: Room, playerId: string, score: number): HotTakeSubmitResult {
  if (room.phase !== 'HOT_TAKE_VOTE') return { ok: false, error: 'NOT_HOT_TAKE_PHASE' };
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  if (!Number.isInteger(score) || score < HOT_TAKE_MIN || score > HOT_TAKE_MAX) {
    return { ok: false, error: 'INVALID_SCORE' };
  }
  room.hotTakeScores.set(playerId, score);
  return { ok: true, room };
}

function presentVoters(room: Room) {
  return [...room.players.values()].filter(
    (p) => !p.isBot && p.connected !== false && !room.lateJoiners.has(p.id),
  );
}

export function hotTakeSubmittedCount(room: Room): number {
  return room.hotTakeScores.size;
}

export function hotTakePhaseComplete(room: Room): boolean {
  const present = presentVoters(room);
  if (present.length === 0) return false;
  return present.every((p) => room.hotTakeScores.has(p.id));
}

export function hotTakeProgress(
  room: Room,
): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'HOT_TAKE_VOTE') return null;
  const present = presentVoters(room);
  const missing = present.filter((p) => !room.hotTakeScores.has(p.id));
  return {
    done: present.length - missing.length,
    total: present.length,
    missingNicknames: missing.map((p) => p.nickname),
  };
}

export function applyHotTakeDefaults(room: Room): void {
  if (room.phase !== 'HOT_TAKE_VOTE') return;
  for (const p of presentVoters(room)) {
    if (!room.hotTakeScores.has(p.id)) {
      room.hotTakeScores.set(p.id, 5);
    }
  }
}

export interface HotTakePlayerScore {
  playerId: string;
  nickname: string;
  score: number;
}

function deterministicPromptAverage(promptId: string): number {
  let h = 2166136261;
  for (let i = 0; i < promptId.length; i++) {
    h ^= promptId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const tenths = 32 + ((h >>> 0) % 47); // 3.2 .. 7.8
  return Math.round(tenths) / 10;
}

export interface HotTakeReveal {
  prompt: HotTakePrompt;
  average: number;
  scores: HotTakePlayerScore[];
  lowest: HotTakePlayerScore | null;
  highest: HotTakePlayerScore | null;
  spread: number;
  communityAverage?: number;
}

export function buildHotTakeReveal(room: Room): HotTakeReveal | null {
  if (room.phase !== 'HOT_TAKE_REVEAL' || !room.currentHotTakePrompt) return null;
  const entries: HotTakePlayerScore[] = [];
  for (const [playerId, score] of room.hotTakeScores.entries()) {
    const nickname = room.players.get(playerId)?.nickname ?? 'Anonimo';
    entries.push({ playerId, nickname, score });
  }
  if (entries.length === 0) {
    return {
      prompt: room.currentHotTakePrompt,
      average: 0,
      scores: [],
      lowest: null,
      highest: null,
      spread: 0,
    };
  }
  entries.sort((a, b) => a.score - b.score || a.nickname.localeCompare(b.nickname));
  const sum = entries.reduce((acc, e) => acc + e.score, 0);
  const average = Math.round((sum / entries.length) * 10) / 10;
  const lowest = entries[0];
  const highest = entries[entries.length - 1];
  const isSolo = room.players.size === 1 && entries.length === 1;
  const communityAverage = isSolo
    ? deterministicPromptAverage(room.currentHotTakePrompt.id)
    : undefined;
  return {
    prompt: room.currentHotTakePrompt,
    average,
    scores: entries,
    lowest,
    highest,
    spread: highest.score - lowest.score,
    ...(communityAverage !== undefined ? { communityAverage } : {}),
  };
}
