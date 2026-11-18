// "Telepatia Silenziosa": silent word-sync internal game mode.
// Everyone receives the same quick association prompt and secretly writes ONE
// word (no talking!). Players who arrive at the exact same word (normalized)
// fuse into telepathic clusters and earn points together. Pure functions given
// a Room (sibling of groupMind.ts and missingWord.ts).

import type { Room } from './rooms';
import { pickByFamiliarita, type DilemmaFamiliarita } from './deck';

export const TELEPATHY_MAX_LENGTH = 36;

export interface TelepathyPrompt {
  id: string;
  text: string;
  /** Optional guidance shown under the prompt (e.g. "Scrivi un solo cibo"). */
  constraint?: string;
  /** Realistic single-word suggestions used if bots participate. */
  botPool?: string[];
  familiarita?: DilemmaFamiliarita;
  tier?: number;
}

export interface TelepathyCluster {
  /** Representative display word (most common raw spelling or first submitted). */
  word: string;
  normalized: string;
  count: number;
  matched: boolean;
  playerIds: string[];
  nicknames: string[];
  pointsEach: number;
}

export type TelepathySubmitError = 'NOT_TELEPATHY_PHASE' | 'NOT_IN_ROOM' | 'EMPTY_ANSWER' | 'TOO_LONG';
export type TelepathySubmitResult = { ok: true; room: Room; word: string } | { ok: false; error: TelepathySubmitError };

export interface TelepathyReveal {
  prompt: TelepathyPrompt;
  clusters: TelepathyCluster[];
  totalAnswers: number;
  syncedPlayersCount: number;
  unanimousMatch: boolean;
}

export const TELEPATHY_PROMPTS: readonly TelepathyPrompt[] = [
  {
    id: 'tp01',
    text: 'La prima parola che associ a «Domenica sera».',
    constraint: 'Una sola parola, senza mettersi d’accordo!',
    botPool: ['divano', 'ansia', 'pizza', 'lunedì'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp02',
    text: 'Il gusto di gelato più sopravvalutato di sempre.',
    constraint: 'Un solo gusto — prova a leggere la mente al tavolo.',
    botPool: ['puffo', 'pistacchio', 'limone', 'menta'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp03',
    text: 'Una città italiana dove scappereste tutti domani per un weekend.',
    constraint: 'Nome di una sola città!',
    botPool: ['roma', 'napoli', 'firenze', 'palermo'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp04',
    text: 'L’ingrediente che non dovrebbe MAI finire sulla pizza.',
    constraint: 'Una sola parola.',
    botPool: ['ananas', 'banana', 'cioccolato', 'kiwi'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp05',
    text: 'Il superpotere più utile nella vita reale di tutti i giorni.',
    constraint: 'Un solo superpotere.',
    botPool: ['invisibilità', 'teletrasporto', 'volare', 'tempo'],
    familiarita: 'nuove_conoscenze',
    tier: 1,
  },
  {
    id: 'tp06',
    text: 'La scusa numero uno per dare buca alle 20:55.',
    constraint: 'Una parola chiave (es. febbre, traffico...).',
    botPool: ['febbre', 'lavoro', 'mal di testa', 'traffico'],
    familiarita: 'vecchi_amici',
    tier: 1,
  },
  {
    id: 'tp07',
    text: 'L’app che nessuno al tavolo riesce a smettere di aprire di notte.',
    constraint: 'Nome di una sola app.',
    botPool: ['instagram', 'tiktok', 'whatsapp', 'youtube'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp08',
    text: 'Una cosa che dimentichi sempre prima di partire in vacanza.',
    constraint: 'Un solo oggetto.',
    botPool: ['caricatore', 'spazzolino', 'ciabatte', 'documenti'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp09',
    text: 'Il momento della giornata in cui dai il peggio di te.',
    constraint: 'Una sola parola o momento (es. mattina, lunedì...).',
    botPool: ['mattina', 'lunedì', 'risveglio', 'notte'],
    familiarita: 'vecchi_amici',
    tier: 1,
  },
  {
    id: 'tp10',
    text: 'La prima bevanda che ordini quando finalmente è venerdì sera.',
    constraint: 'Un solo drink.',
    botPool: ['spritz', 'birra', 'gin tonic', 'vino'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp11',
    text: 'L’animale che rappresenta meglio questo gruppo quando organizza una cena.',
    constraint: 'Un solo animale.',
    botPool: ['bradipo', 'oca', 'scimmia', 'lupo'],
    familiarita: 'vecchi_amici',
    tier: 2,
  },
  {
    id: 'tp12',
    text: 'La cosa più costosa su cui sprechi comunque i soldi senza pentirti.',
    constraint: 'Una sola parola.',
    botPool: ['cibo', 'viaggi', 'caffè', 'scarpe'],
    familiarita: 'nuove_conoscenze',
    tier: 1,
  },
  {
    id: 'tp13',
    text: 'Il mese peggiore dell’anno.',
    constraint: 'Nome di un solo mese.',
    botPool: ['gennaio', 'novembre', 'febbraio', 'agosto'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp14',
    text: 'Un film che quasi tutti hanno visto almeno tre volte.',
    constraint: 'Titolo breve o una parola riconoscibile.',
    botPool: ['shrek', 'titanic', 'harry potter', 'matrix'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp15',
    text: 'La materia scolastica che ancora oggi ti mette ansia solo a nominarla.',
    constraint: 'Una sola materia.',
    botPool: ['matematica', 'latino', 'fisica', 'chimica'],
    familiarita: 'nuove_conoscenze',
    tier: 1,
  },
  {
    id: 'tp16',
    text: 'Il rumore più fastidioso di tutto il pianeta.',
    constraint: 'Una sola parola.',
    botPool: ['zanzara', 'sveglia', 'clacson', 'russare'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp17',
    text: 'Cosa porti sempre se vieni invitato a cena all’ultimo minuto.',
    constraint: 'Una sola cosa.',
    botPool: ['vino', 'gelato', 'birra', 'dolce'],
    familiarita: undefined,
    tier: 1,
  },
  {
    id: 'tp18',
    text: 'Il lato del letto migliore o la prima cosa che guardi in hotel.',
    constraint: 'Una sola parola.',
    botPool: ['bagno', 'finestra', 'colazione', 'wifi'],
    familiarita: 'nuove_conoscenze',
    tier: 2,
  },
  {
    id: 'tp19',
    text: 'Una parola che non vorresti mai sentir dire da un amico alla guida.',
    constraint: 'Una parola o esclamazione corta.',
    botPool: ['ops', 'freni', 'autovelox', 'uscita'],
    familiarita: 'vecchi_amici',
    tier: 1,
  },
  {
    id: 'tp20',
    text: 'L’emozione principale quando controlli il conto in banca il 27 del mese.',
    constraint: 'Una sola parola.',
    botPool: ['paura', 'ansia', 'panico', 'vuoto'],
    familiarita: 'vecchi_amici',
    tier: 1,
  },
];

const ARTICLE_RE = /^(?:(?:uno|una|gli|il|lo|la|un|i|le)\s+|(?:l|un)['’`]\s*)/i;

/** Normalize a submitted word for telepathy matching (case, accents, punctuation, leading article). */
export function normalizeTelepathyWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:«»"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICLE_RE, '')
    .trim();
}

/** Pick an unused telepathy prompt respecting familiarita. */
export function pickTelepathyPrompt(
  room: Room,
  rng: () => number = Math.random,
): TelepathyPrompt {
  const fresh = TELEPATHY_PROMPTS.filter((p) => !room.usedTelepathyIds.has(p.id));
  const pool = fresh.length > 0 ? fresh : [...TELEPATHY_PROMPTS];
  const fam = room.familiarita ?? 'misto';
  return pickByFamiliarita(pool, fam, rng) ?? pool[Math.floor(rng() * pool.length)];
}

/** Record (or update) a player's silent telepathy word during TELEPATHY. */
export function telepathySubmit(
  room: Room,
  playerId: string,
  rawWord: string,
): TelepathySubmitResult {
  if (room.phase !== 'TELEPATHY' || !room.currentTelepathyPrompt) {
    return { ok: false, error: 'NOT_TELEPATHY_PHASE' };
  }
  if (!room.players.has(playerId)) return { ok: false, error: 'NOT_IN_ROOM' };
  const cleaned = rawWord.trim().replace(/\s+/g, ' ');
  if (!cleaned) return { ok: false, error: 'EMPTY_ANSWER' };
  if (cleaned.length > TELEPATHY_MAX_LENGTH) return { ok: false, error: 'TOO_LONG' };

  room.telepathyAnswers.set(playerId, cleaned);
  return { ok: true, room, word: cleaned };
}

/** Progress tally during TELEPATHY (no individual words exposed before reveal). */
export function telepathyProgress(
  room: Room,
): { done: number; total: number; missingNicknames: string[] } | null {
  if (room.phase !== 'TELEPATHY' || !room.currentTelepathyPrompt) return null;
  const active = [...room.players.values()].filter(
    (p) => p.connected !== false && !room.lateJoiners.has(p.id),
  );
  const done = active.filter((p) => room.telepathyAnswers.has(p.id)).length;
  const missingNicknames = active
    .filter((p) => !room.telepathyAnswers.has(p.id))
    .map((p) => p.nickname);
  return { done, total: active.length, missingNicknames };
}

/** True once every connected active player has submitted a telepathy word. */
export function telepathyPhaseComplete(room: Room): boolean {
  if (room.phase !== 'TELEPATHY' || !room.currentTelepathyPrompt) return false;
  const active = [...room.players.values()].filter(
    (p) => p.connected !== false && !room.lateJoiners.has(p.id),
  );
  return active.length > 0 && active.every((p) => room.telepathyAnswers.has(p.id));
}

/** Have bots pick realistic words from the prompt's curated pool (weighted toward likely consensus). */
export function fillBotTelepathyAnswers(room: Room, rng: () => number = Math.random): void {
  if (room.phase !== 'TELEPATHY' || !room.currentTelepathyPrompt) return;
  const pool = room.currentTelepathyPrompt.botPool ?? ['pizza', 'caffè', 'divano'];
  for (const p of room.players.values()) {
    if (!p.isBot || room.lateJoiners.has(p.id) || room.telepathyAnswers.has(p.id)) continue;
    // Bias toward index 0 or 1 so humans + bots have real match tension!
    const pick = rng() < 0.6 ? pool[0] : pool[Math.floor(rng() * pool.length)];
    room.telepathyAnswers.set(p.id, pick);
  }
}

/** Cluster matching words and score synchronized players when entering TELEPATHY_REVEAL. */
export function resolveTelepathyReveal(room: Room): TelepathyReveal | null {
  const prompt = room.currentTelepathyPrompt;
  if (!prompt) return null;
  const groups = new Map<
    string,
    { rawWords: string[]; players: Array<{ id: string; nickname: string }> }
  >();
  let totalAnswers = 0;

  for (const [pid, raw] of room.telepathyAnswers.entries()) {
    const p = room.players.get(pid);
    if (!p) continue;
    const norm = normalizeTelepathyWord(raw);
    if (!norm) continue;
    totalAnswers++;
    const bucket = groups.get(norm);
    if (bucket) {
      bucket.rawWords.push(raw);
      bucket.players.push({ id: p.id, nickname: p.nickname });
    } else {
      groups.set(norm, { rawWords: [raw], players: [{ id: p.id, nickname: p.nickname }] });
    }
  }

  const unanimousMatch = totalAnswers >= 2 && groups.size === 1;
  const clusters: TelepathyCluster[] = [];
  let syncedPlayersCount = 0;

  for (const [norm, data] of groups.entries()) {
    const count = data.players.length;
    const matched = count >= 2;
    if (matched) syncedPlayersCount += count;
    const pointsEach = unanimousMatch ? 120 : matched ? 50 + (count - 1) * 25 : 0;
    clusters.push({
      word: data.rawWords[0].toUpperCase(),
      normalized: norm,
      count,
      matched,
      playerIds: data.players.map((pl) => pl.id),
      nicknames: data.players.map((pl) => pl.nickname),
      pointsEach,
    });
  }

  clusters.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  const reveal: TelepathyReveal = {
    prompt,
    clusters,
    totalAnswers,
    syncedPlayersCount,
    unanimousMatch,
  };
  room.telepathyReveal = reveal;
  return reveal;
}
