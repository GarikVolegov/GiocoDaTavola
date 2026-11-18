// Generator for "Schierati" Party Game using Gemini Flash.
// Implements strict writing guidelines for viral Italian party gameplay (18-28 years old).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from '@google/genai';
import type { DilemmaFamiliarita, Familiarita } from './deck';

export type PartyMode =
  | 'flash'
  | 'infiltrato'
  | 'coppie'
  | 'assurdo'
  | 'preferiresti'
  | 'cruciverba'
  | 'tribunale'
  | 'classico'
  | 'mix';

export interface FlashCard {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  spuntiA?: string[];
  spuntiB?: string[];
  penalty?: string;
  familiarita?: DilemmaFamiliarita;
}

export interface InfiltratoCard {
  id: string;
  groupQuestion: string;
  impostorQuestion: string;
  category?: string;
  tono?: 'risate' | 'profondo';
  botAnswersGroup?: string[];
  botAnswersImpostor?: string[];
  familiarita?: DilemmaFamiliarita;
}

export type CoppieIntensity = 'complicita' | 'piccante' | 'profondo';

export interface CoppieCard {
  id: string;
  cardType: 'allineamento' | 'verita' | 'obbligo';
  intensity: CoppieIntensity;
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  familiarita?: DilemmaFamiliarita;
}

export interface AssurdoCard {
  id: string;
  cardType: 'gogna' | 'dignita';
  prompt: string;
  optionA?: string;
  optionB?: string;
  penalty?: string;
  sentenza?: string;
  familiarita?: DilemmaFamiliarita;
}

export interface PreferirestiCard {
  id: string;
  prompt: string;
  options: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  penalty?: string;
  familiarita?: DilemmaFamiliarita;
}

export type PartyCard = FlashCard | InfiltratoCard | CoppieCard | AssurdoCard | PreferirestiCard;

export const SYSTEM_PROMPT = `Sei l'autore creativo di un party game virale per ragazzi italiani (18-28 anni). Il tuo unico obiettivo è generare domande, dilemmi, obblighi e round per il gioco "Impostore" che scatenino risate immediate, dibattiti accesi e zero noia.

REGOLE TASSATIVE DI SCRITTURA (VIETATO INFRANGERLE):
1. ZERO FILOSOFIA O ASTRAZIONE: Vietati dilemmi morali complessi, scenari fantascientifici contorti, paradossi temporali o domande che richiedono più di 3 secondi per essere capite.
2. BREVITÀ ESTREMA: Ogni carta deve avere massimo 15-18 parole. Deve poter essere letta ad alta voce in 3 secondi in un locale rumoroso.
3. LINGUAGGIO REALE E GIOVANILE (NON CRINGE): Usa un italiano naturale, diretto, parlato. Niente linguaggio burocratico o da libro scolastico, ma evita anche lo slang forzato da boomer. Parla di: ex, ghosting, serate, soldi, tradimenti, red flag, figure di merda, amici falsi, abitudini segrete, attrazione.
4. POLARIZZAZIONE IMMEDIATA: Nei dilemmi "Schierati", non deve mai esserci una risposta "ovvia". Entrambe le scelte devono avere un lato imbarazzante, egoista o controverso che costringa gli amici a urlare "Ma come fai a scegliere questo?!".
5. FORMATO JSON RIGOROSO: Rispondi esclusivamente in formato JSON valido secondo lo schema richiesto dalla modalità attiva, senza testo extra.`;

export const DEEP_SYSTEM_PROMPT = `Sei l'autore creativo di un gioco di domande profonde e consapevolezza per amici e coppie. Il tuo obiettivo è porre domande che aprono gli occhi sulla vita, sulle possibilità, sui legami e sulle scelte di direzione.

REGOLE DI SCRITTURA:
1. CHIAREZZA E IMPATTO: Niente giri di parole accademici. Ogni domanda deve colpire nel segno in pochi secondi e far pensare "cavolo, non ci avevo mai pensato così".
2. PROFONDITÀ AUTENTICA: Parla di paure nascoste, desideri rimandati, confini nei legami, priorità di vita, cosa conta davvero.
3. FORMATO JSON RIGOROSO: Rispondi esclusivamente in formato JSON valido secondo lo schema richiesto.`;

interface PartyDecksData {
  flash: FlashCard[];
  infiltrato: InfiltratoCard[];
  coppie: {
    complicita: CoppieCard[];
    piccante: CoppieCard[];
    profondo?: CoppieCard[];
  };
  assurdo: AssurdoCard[];
  preferiresti?: PreferirestiCard[];
}

let cachedDecks: PartyDecksData | null = null;

export function loadCuratedDecks(): PartyDecksData {
  if (cachedDecks) return cachedDecks;
  const filePath = join(__dirname, '..', '..', 'data', 'party_decks.json');
  if (existsSync(filePath)) {
    try {
      cachedDecks = JSON.parse(readFileSync(filePath, 'utf-8')) as PartyDecksData;
      return cachedDecks;
    } catch {
      // fallback below
    }
  }
  return {
    flash: [],
    infiltrato: [],
    coppie: { complicita: [], piccante: [], profondo: [] },
    assurdo: [],
    preferiresti: [],
  };
}

export function getCuratedCards(
  mode: PartyMode,
  options: {
    count?: number;
    intensity?: CoppieIntensity;
    infiltratoTono?: 'risate' | 'profondo' | 'misto';
    familiarita?: Familiarita;
    rng?: () => number;
    excludeIds?: Set<string>;
  } = {},
): PartyCard[] {
  const decks = loadCuratedDecks();
  const rng = options.rng ?? Math.random;
  let pool: PartyCard[] = [];

  if (mode === 'flash') {
    pool = [...decks.flash];
  } else if (mode === 'infiltrato') {
    const tono = options.infiltratoTono ?? 'misto';
    pool =
      tono === 'misto'
        ? [...decks.infiltrato]
        : decks.infiltrato.filter((c) => (c.tono ?? 'risate') === tono);
    if (pool.length === 0) pool = [...decks.infiltrato];
  } else if (mode === 'coppie') {
    const intensity: CoppieIntensity =
      options.intensity === 'piccante'
        ? 'piccante'
        : options.intensity === 'profondo'
          ? 'profondo'
          : 'complicita';
    pool = [...(decks.coppie[intensity] ?? decks.coppie.complicita)];
  } else if (mode === 'assurdo') {
    pool = [...decks.assurdo];
  } else if (mode === 'preferiresti') {
    pool = [...(decks.preferiresti ?? [])];
  } else if (mode === 'mix') {
    pool = [...decks.flash, ...decks.assurdo, ...(decks.preferiresti ?? [])];
  }

  const fam = options.familiarita;
  const count = options.count ?? pool.length;
  if (fam === 'vecchi_amici' || fam === 'nuove_conoscenze') {
    const filtered =
      fam === 'vecchi_amici'
        ? pool.filter((c) => c.familiarita !== 'nuove_conoscenze')
        : pool.filter((c) => c.familiarita !== 'vecchi_amici');
    if (filtered.length >= count) {
      pool = filtered;
    } else if (filtered.length > 0) {
      const famIds = new Set(filtered.map((c) => c.id));
      pool = [...filtered, ...pool.filter((c) => !famIds.has(c.id))];
    }
  }

  const exclude = options.excludeIds;
  const fresh = exclude && exclude.size > 0 ? pool.filter((c) => !exclude.has(c.id)) : pool;
  const stale = exclude && exclude.size > 0 ? pool.filter((c) => exclude.has(c.id)) : [];

  const shuffleWithRng = <T>(arr: T[]) => [...arr].sort(() => rng() - 0.5);
  // When playing as vecchi_amici, prioritize cards explicitly written for vecchi_amici first
  const prioritize = (arr: PartyCard[]) => {
    const s = shuffleWithRng(arr);
    if (fam !== 'vecchi_amici') return s;
    const preferred = s.filter((c) => c.familiarita === 'vecchi_amici');
    const rest = s.filter((c) => c.familiarita !== 'vecchi_amici');
    return [...preferred, ...rest];
  };
  const ordered = [...prioritize(fresh), ...prioritize(stale)];
  return ordered.slice(0, count);
}

export function isGeminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_BASE_URL);
}

/**
 * Generate fresh party game cards using Gemini Flash (gemini-3.8-flash) or OpenAI-compatible endpoint.
 * Falls back transparently to curated cards on any error, timeout, or missing key.
 */
export async function generatePartyCards(
  mode: PartyMode,
  options: { count?: number; intensity?: CoppieIntensity; infiltratoTono?: 'risate' | 'profondo' | 'misto'; familiarita?: Familiarita; theme?: string } = {},
): Promise<PartyCard[]> {
  const count = options.count ?? 5;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const aiBase = process.env.AI_BASE_URL;

  if (!apiKey && !aiBase) {
    return getCuratedCards(mode, options);
  }

  const useDeepPrompt =
    (mode === 'coppie' && options.intensity === 'profondo') ||
    (mode === 'infiltrato' && options.infiltratoTono === 'profondo');
  const systemPrompt = useDeepPrompt ? DEEP_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userPrompt = getUserPromptForMode(mode, count, options.intensity, options.theme, options.infiltratoTono, options.familiarita);

  // Strict 3.5s timeout: if Gemini Flash or network takes longer, fallback immediately to curated cards!
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI Generation Timeout (3.5s)')), 3500),
  );

  try {
    const fetchAi = async (): Promise<string | null> => {
      let rawJson: string | null = null;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 1.0,
          },
        });
        rawJson = response.text ?? null;
      } else if (aiBase) {
        const model = process.env.AI_MODEL || 'gemma3:4b';
        const res = await fetch(`${aiBase.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {}),
          },
          body: JSON.stringify({
            model,
            temperature: 0.9,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          rawJson = data.choices?.[0]?.message?.content ?? null;
        }
      }
      return rawJson;
    };

    const rawJson = await Promise.race([fetchAi(), timeoutPromise]);
    if (rawJson) {
      const parsed = parseGeneratedCards(mode, rawJson);
      if (parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[geminiGenerator] AI generation error/timeout (<=3.5s), falling back to curated deck:', err instanceof Error ? err.message : err);
  }

  return getCuratedCards(mode, options);
}

function getUserPromptForMode(
  mode: PartyMode,
  count: number,
  intensity?: CoppieIntensity,
  theme?: string,
  infiltratoTono?: 'risate' | 'profondo' | 'misto',
  familiarita?: Familiarita,
): string {
  const famContext =
    familiarita === 'vecchi_amici'
      ? '\nCONTESTO GRUPPO: I giocatori sono VECCHI AMICI che si conoscono benissimo da anni. Vietate domande banali o da sconosciuti: punta su dinamiche vere di gruppo, non detti, ipocrisie affettuose, scelte che svelano chi sono davvero.'
      : familiarita === 'nuove_conoscenze'
        ? '\nCONTESTO GRUPPO: I giocatori sono NUOVE CONOSCENZE o un gruppo misto. Fai domande accessibili, divertenti e coinvolgenti per rompere il ghiaccio senza creare imbarazzo eccessivo.'
        : '';
  let prompt = '';
  switch (mode) {
    case 'flash':
      prompt = `Genera ${count} carte per la modalità "SCHIERATI FLASH".
Ogni carta deve essere un dilemma A o B secco, quotidiano, divisivo (ex, segreti, soldi, amici, red flag).
Massimo 12-15 parole per quesito.
Rispondi con un JSON array di oggetti con questo schema:
[
  {
    "id": "gen_fl_1",
    "text": "Controllare il telefono del partner mentre dorme: legittima difesa o psicopatia?",
    "optionA": "Legittima difesa",
    "optionB": "Psicopatia pura",
    "penalty": "Chi è in minoranza beve 1 shot o subisce penitenza!"
  }
]`;
      break;

    case 'infiltrato':
      prompt = `Genera ${count} carte per la modalità "L'INFILTRATO"${infiltratoTono === 'profondo' ? ' a tono PROFONDO (valori, paure, scelte di vita, cosa conta davvero — domande che fanno riflettere pur restando brevi)' : ''}.
Ogni elemento deve avere:
- "groupQuestion": domanda ricevuta dalla maggioranza (${infiltratoTono === 'profondo' ? 'es. "Qual è la cosa che hai rimandato più a lungo per paura?"' : 'es. "Qual è il posto più strano dove hai fatto serata?"'})
- "impostorQuestion": domanda simile ma con significato diverso ricevuta dall'infiltrato (${infiltratoTono === 'profondo' ? 'es. "Qual è la scelta di cui vai più fiero nonostante la paura?"' : 'es. "Qual è il posto più strano dove hai dormito?"'})
- "category": breve categoria tematica.
Rispondi con un JSON array di oggetti:
[
  {
    "id": "gen_inf_1",
    "groupQuestion": "Qual è la scusa peggiore usata per bidonare un'uscita all'ultimo?",
    "impostorQuestion": "Qual è la bugia più stupida che hai detto ai tuoi genitori?",
    "category": "scuse"
  }
]`;
      break;

    case 'coppie': {
      const intensityDesc =
        intensity === 'piccante'
          ? 'piccante (18+ sensuale tra fidanzati, desiderio, attrazione, vita sotto le lenzuola — MAI per semplici amici)'
          : intensity === 'profondo'
            ? 'profondo (domande intime di relazione tra fidanzati: paure sul futuro insieme, convivenza, gratitudine affettiva, confini di coppia)'
            : 'complicita (gelosia amorosa, primo appuntamento, anniversari, piccole abitudini da fidanzati)';
      prompt = `Genera ${count} carte per la modalità "COPPIE & SCINTILLE" a intensità "${intensityDesc}".
IMPORTANTE: Questa modalità è ESCLUSIVAMENTE per FIDANZATI / PARTNER SENTIMENTALI.
Non generare MAI domande generiche adatte a semplici amici, colleghi o gruppi: ogni singola carta deve riguardare la relazione amorosa tra due partner ("il tuo partner", "la vostra storia", "gelosia", "primo bacio", "convivenza", "intimità di coppia", "futuro insieme").
Alterna carte di 3 tipi:
1. "allineamento": "Al 3 indicate chi dei due..." (sul rapporto tra i due fidanzati)
2. "verita": domanda diretta ${intensity === 'profondo' ? 'autentica e profonda' : 'scomoda o complice'} sulla vita da fidanzati
3. "obbligo": ${intensity === 'profondo' ? 'gesto di ascolto, sincerità o tenerezza tra partner' : 'sfida romantica, bacio o contatto diretto tra fidanzati'}
Rispondi con un JSON array di oggetti:
[
  {
    "id": "gen_cp_1",
    "cardType": "allineamento",
    "intensity": "${intensity || 'complicita'}",
    "prompt": "Al 3 indicate chi dei due chiede scusa per primo dopo una litigata di coppia.",
    "penalty": "Non siete d'accordo! Abbraccio di 5 secondi tra fidanzati."
  }
]`;
      break;
    }

    case 'assurdo':
      prompt = `Genera ${count} carte per la modalità "ASSURDO MA SEMPLICE".
Alterna:
1. "gogna": dinamica "Chi del gruppo..." con "sentenza" dell'app (sfida o penitenza per il più votato)
2. "dignita": "Prezzo della Dignità" ("Accetteresti 500€ subito se...?")
Rispondi con un JSON array di oggetti:
[
  {
    "id": "gen_as_1",
    "cardType": "gogna",
    "prompt": "Chi del gruppo manderebbe per sbaglio uno screenshot alla persona di cui parlava male?",
    "penalty": "Il più votato beve!",
    "sentenza": "Bevi un sorso per ogni voto ricevuto e hai 15 secondi per scusarti con il gruppo!"
  },
  {
    "id": "gen_as_2",
    "cardType": "dignita",
    "prompt": "Accetteresti 500€ subito, ma devi mandare un vocale in cui piangi alla tua ultima chat WhatsApp?",
    "optionA": "Accetto subito 💸",
    "optionB": "Col cavolo 🙅‍♂️",
    "penalty": "Chi è in minoranza beve!"
  }
]`;
      break;

    case 'preferiresti':
      prompt = `Genera ${count} carte per la modalità "PREFERIRESTI CHE..." con 4 scelte.
Ogni carta deve avere un incipit breve ("Preferiresti che...") e 4 opzioni assurde, scomode o divisivissime tra cui i giocatori devono scegliere e dibattere.
Rispondi con un JSON array di oggetti:
[
  {
    "id": "gen_pr_1",
    "prompt": "Preferiresti che per il resto della vita...",
    "options": [
      "Ogni tuo starnuto suonasse come una tromba da stadio",
      "Le tue orecchie diventassero viola ogni volta che dici una bugia",
      "Dovessi cantare in falsetto per ordinare al ristorante",
      "Il tuo telefono leggesse ad alta voce l'ultimo messaggio appena lo sblocchi"
    ],
    "penalty": "Chi resta in minoranza difende la sua scelta davanti al tavolo o beve!"
  }
]`;
      break;
  }

  if (theme && theme.trim().length > 0) {
    prompt += `\n\nTEMA DELLA SERATA RICHIESTO DAL GRUPPO: "${theme.trim()}". Ambientate e contestualizzate le situazioni a questo tema!`;
  }
  if (famContext) {
    prompt += `\n${famContext}`;
  }

  return prompt;
}

function parseGeneratedCards(mode: PartyMode, rawText: string): PartyCard[] {
  let cleaned = rawText.trim();
  // Strip Markdown fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  try {
    const data = JSON.parse(cleaned);
    const list = Array.isArray(data) ? data : data.items || data.cards || [];
    return list.filter((item: Record<string, unknown>) => {
      if (mode === 'flash') {
        return typeof item.text === 'string' && typeof item.optionA === 'string' && typeof item.optionB === 'string';
      }
      if (mode === 'infiltrato') {
        return typeof item.groupQuestion === 'string' && typeof item.impostorQuestion === 'string';
      }
      if (mode === 'coppie') {
        return typeof item.prompt === 'string';
      }
      if (mode === 'assurdo') {
        return typeof item.prompt === 'string';
      }
      if (mode === 'preferiresti') {
        return (
          typeof item.prompt === 'string' &&
          Array.isArray(item.options) &&
          item.options.length >= 3 &&
          item.options.every((opt) => typeof opt === 'string')
        );
      }
      return true;
    });
  } catch {
    return [];
  }
}
