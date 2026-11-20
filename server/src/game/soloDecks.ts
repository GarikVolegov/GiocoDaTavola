// Dedicated strange, quirky, personal decks for Solo (1-player) gameplay.
// Loaded from server/data/solo_decks.json so solo dilemmas and questionnaires
// never contain group/friends/table prompts and always offer strictly 2 choices.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ensureDomandaRilancio,
  ensureLezioneReale,
  ensureSpunti,
  inferDinamica,
  inferPolarizzazione,
  inferTemi,
  tonoOfDilemma,
  type Dilemma,
} from './deck';
import type { GroupMindQuestion } from './groupMind';
import type { AssurdoCard, FlashCard, PartyCard, PreferirestiCard } from './geminiGenerator';

const GROUP_CONTEXT_REGEX =
  /\{nome\}|chi di voi|nel gruppo|questo gruppo|del gruppo|tra di noi|uno di noi|al tavolo|giocatore alla tua|maggioranza del gruppo|vota un amico|minoranza beve/i;

export function isSoloFriendlyText(text: string): boolean {
  return !GROUP_CONTEXT_REGEX.test(text);
}

interface SoloDecksRaw {
  dilemmi: Dilemma[];
  flash: FlashCard[];
  preferiresti: PreferirestiCard[];
  assurdo: AssurdoCard[];
  questionari: GroupMindQuestion[];
}

let cachedSoloDecks: SoloDecksRaw | null = null;

export function loadSoloDecksRaw(): SoloDecksRaw {
  if (cachedSoloDecks) return cachedSoloDecks;
  const filePath = join(__dirname, '..', '..', 'data', 'solo_decks.json');
  if (existsSync(filePath)) {
    try {
      cachedSoloDecks = JSON.parse(readFileSync(filePath, 'utf-8')) as SoloDecksRaw;
      return cachedSoloDecks;
    } catch {
      // fallback to empty below
    }
  }
  return {
    dilemmi: [],
    flash: [],
    preferiresti: [],
    assurdo: [],
    questionari: [],
  };
}

export function getSoloDilemmas(): Dilemma[] {
  const raw = loadSoloDecksRaw();
  return raw.dilemmi.map((d) => {
    const spunti = ensureSpunti(d);
    const hydrated: Dilemma = {
      ...d,
      tono: tonoOfDilemma(d),
      spuntiA: spunti.spuntiA,
      spuntiB: spunti.spuntiB,
      temi: inferTemi(d),
      dinamica: inferDinamica(d),
      polarizzazione: inferPolarizzazione(d),
      familiarita: d.familiarita ?? 'tutti',
    };
    return {
      ...hydrated,
      lezioneReale: ensureLezioneReale(hydrated),
      domandaRilancio: ensureDomandaRilancio(hydrated),
    };
  });
}

export function getSoloQuestionari(): GroupMindQuestion[] {
  return loadSoloDecksRaw().questionari.map((q) => ({ ...q }));
}

export function enforceTwoOptionsForSolo<T extends PartyCard>(card: T): T {
  if ('options' in card && Array.isArray(card.options)) {
    const two = card.options.slice(0, 2);
    return {
      ...card,
      options: two,
      optionA: two[0] ?? card.optionA ?? 'Prima scelta',
      optionB: two[1] ?? card.optionB ?? 'Seconda scelta',
      optionC: undefined,
      optionD: undefined,
    };
  }
  return card;
}

function shuffleSlice<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSoloPartyCards(
  mode: 'flash' | 'preferiresti' | 'assurdo',
  options: { count?: number; rng?: () => number; excludeIds?: Set<string> } = {},
): PartyCard[] {
  const raw = loadSoloDecksRaw();
  const rng = options.rng ?? Math.random;
  let pool: PartyCard[] = [];

  if (mode === 'flash') {
    pool = raw.flash.map((c) => ({ ...c, mode: 'flash' as const }));
  } else if (mode === 'preferiresti') {
    pool = raw.preferiresti.map((c) =>
      enforceTwoOptionsForSolo({ ...c, mode: 'preferiresti' as const }),
    );
  } else {
    pool = raw.assurdo
      .filter((c) => c.cardType === 'dignita')
      .map((c) => ({ ...c, mode: 'assurdo' as const }));
  }

  const exclude = options.excludeIds;
  const fresh = exclude && exclude.size > 0 ? pool.filter((c) => !exclude.has(c.id)) : pool;
  const stale = exclude && exclude.size > 0 ? pool.filter((c) => exclude.has(c.id)) : [];
  const ordered = [...shuffleSlice(fresh, rng), ...shuffleSlice(stale, rng)];
  const count = options.count ?? ordered.length;
  return ordered.slice(0, count);
}
