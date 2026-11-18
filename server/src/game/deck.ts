// The deck of dilemmas. Loaded once from server/data/dilemmas.json and drawn
// without repeats within a single game. Randomness is injectable so draw order
// is deterministically testable (mirrors RoomStore's genCode pattern).

import { readFileSync } from 'fs';
import { join } from 'path';

/** Content register: 'misto' is a filter meaning "any". */
export type ContentRegister = 'vita' | 'business' | 'carriera' | 'misto';

/**
 * Exclusive tonal lane ("corsia"): keeps a light night of laughs strictly
 * separated from constructive life-direction questions and deep/serious talks.
 */
export type CorsiaTono = 'risate' | 'direzione' | 'serio';

/**
 * A 1-based "tappa" (life chapter / depth level) for the "Percorso" mode. Higher
 * = a later, deeper chapter of life. Absent on a dilemma means it is NOT part of
 * a percorso (classic 3/5/7 mode ignores this field entirely).
 */
export type Tappa = 1 | 2 | 3 | 4;

/**
 * Cross-cutting debate-complexity tier (a universal difficulty ladder, present on
 * every dilemma — classic and percorso). Ascending: 'sorbetto' (light/absurd,
 * low-stakes, high-friction fun — the "permesso di ridere" warm-up tier) <
 * 'alto' (real, accessible stakes) < 'max' (heavy personal/relational stakes) <
 * 'power' (existential / moral / taboo).
 */
export type Complessita = 'sorbetto' | 'alto' | 'max' | 'power';

/** Ascending rank of a complexity tier (for ordering an escalation). */
export const COMPLESSITA_RANK: Record<Complessita, number> = { sorbetto: -1, alto: 0, max: 1, power: 2 };

export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business' | 'carriera';
  /** Percorso chapter/level (1..4); absent ⇒ classic-only dilemma. */
  tappa?: Tappa;
  /** Themed percorso step (1..4), decoupled from legacy complexity-bound `tappa`. */
  percorsoTappa?: Tappa;
  /** Debate-complexity tier (alto < max < power). Present on every curated dilemma. */
  complessita?: Complessita;
  /**
   * Flags an especially heavy theme (euthanasia, grief, ...) among the 'power'
   * dilemmas. Excluded from the classic draw by default; the leader must
   * opt in (2.2's "tema delicato" toggle) to make it eligible.
   */
  delicato?: boolean;
  /**
   * "Contenuto combinatorio sul roster" (5.3): a template whose text/options
   * embed a `{nome}` placeholder, filled in with a random player's nickname
   * on each DILEMMA_REVEAL (rosterDilemmas.ts) — the same template reads
   * differently every game, so it's exempt from the "già visto" exclusion
   * (deviceSeenIds/excludeDilemmaIds) and never truly gets "consumed".
   */
  roster?: boolean;
  /**
   * "Igiene del pool" (5.4): groups near-duplicate dilemmas (same premise,
   * different wording) so at most one member plays in a single game —
   * dilemmaPlan.ts's buildClassicPlan enforces it. Absent ⇒ not part of any
   * family (the common case).
   */
  famiglia?: string;
  /**
   * "Igiene del pool" (5.4): the content author's expectation of how the vote
   * splits — 'equilibrato' invites real debate; 'sbilanciato' tends toward a
   * near-unanimous vote (still worth keeping around, just not back to back —
   * dilemmaPlan.ts's pacing spaces them out so they don't "uccidere il
   * round" two in a row). Absent ⇒ no signal either way.
   */
  bilanciamento?: 'equilibrato' | 'sbilanciato';
  /** 2–3 talking points for someone defending side A (optionA). */
  spuntiA: string[];
  /** 2–3 talking points for someone defending side B (optionB). */
  spuntiB: string[];
  /**
   * "Insegnamento per il Mondo Reale": modello mentale, evidenza psicologica o
   * spunto pratico che collega il dilemma alle scelte autentiche di vita e lavoro.
   */
  lezioneReale?: string;
  /** Exclusive tonal lane ('risate' | 'direzione' | 'serio') for strict separation. */
  tono?: CorsiaTono;
  /** Percorso IDs this question belongs to (e.g. ['bussola', 'carriera-soldi']). */
  percorsi?: string[];
  /**
   * Eye-opening follow-up question shown right after the vote to spark real
   * live conversation and self-awareness among players.
   */
  domandaRilancio?: string;
  /** Semantic theme tags (e.g. ['soldi', 'amicizia', 'tempo']) for anti-monotony. */
  temi?: string[];
  /** Psychological lever / dilemma archetype. */
  dinamica?: DinamicaDilemma;
  /** Expected vote split heat ('alta' = 50/50 debate, 'bassa' = near-unanimous). */
  polarizzazione?: PolarizzazioneDilemma;
  /** Group familiarity fit: close/old friends vs new acquaintances vs universal. */
  familiarita?: DilemmaFamiliarita;
}

/** Group familiarity setting chosen by the leader for a session. */
export type Familiarita = 'vecchi_amici' | 'nuove_conoscenze' | 'misto';

/** Per-dilemma familiarity tag ('tutti' = works well for any group). */
export type DilemmaFamiliarita = 'vecchi_amici' | 'nuove_conoscenze' | 'tutti';

export function isFamiliarita(v: string): v is Familiarita {
  return v === 'vecchi_amici' || v === 'nuove_conoscenze' || v === 'misto';
}

/** Psychological/narrative lever of a dilemma for thematic diversity matching. */
export type DinamicaDilemma =
  | 'identita'
  | 'relazione'
  | 'etica'
  | 'azione'
  | 'assurdo'
  | 'priorita';

/** Expected vote polarization heat used by the intelligent matching engine. */
export type PolarizzazioneDilemma = 'alta' | 'media' | 'bassa';

/**
 * Derive the tonal lane of a dilemma if `tono` is not explicitly set,
 * keeping existing 390+ dilemmas cleanly separated by complexity/register.
 */
export function tonoOfDilemma(d: Dilemma): CorsiaTono {
  if (d.tono) return d.tono;
  if (d.complessita === 'sorbetto') return 'risate';
  if (d.delicato || d.complessita === 'power' || d.complessita === 'max') return 'serio';
  return 'direzione';
}

const TEMA_RULES: ReadonlyArray<[string, RegExp]> = [
  ['soldi', /sold[io]|stipendi|pagar|conto|prestit|ricc|pover|econom|spesa|bonus|budget|affitto|euro|€/i],
  ['lavoro', /lavor|capo|collega|aziend|carriera|ufficio|progetto|team|cliente|licenzi|promozione|startup|riunione/i],
  ['amicizia', /amic[oi]|gruppo|compagn|serata|festa|vacanz|passaggio|chat|whatsapp/i],
  ['amore', /partner|amore|relazione|coppia|tradim|gelos|matrimonio|ex\b|appuntamento|bacio/i],
  ['famiglia', /genitor|mamma|papà|madre|padre|figli|fratell|sorell|famigli|casa|radic|nonn/i],
  ['tempo', /tempo|ore|anni|futuro|passato|fretta|aspett|rimand|giorno|settiman|vita/i],
  ['digitale', /telefono|social|schermo|notific|online|instagram|app\b|algoritm|ia\b|ai\b|digitale|reperib/i],
  ['verita', /verit|mentir|bugi|segret|sincer|onest|confess|fing|nascond/i],
  ['coraggio', /paura|coragg|rischi|giudizi|fallir|cambi|salt|comfort|espor/i],
  ['etica', /giust|legge|rub|colp|salvare|sacrif|coscienz|morale|danno|innocent|potere/i],
];

/**
 * Derive semantic themes for a dilemma (explicit `temi` if present, otherwise
 * deterministically inferred from text, options, and register).
 */
export function inferTemi(d: Dilemma): string[] {
  if (d.temi && d.temi.length > 0) return d.temi;
  const hay = `${d.text} ${d.optionA} ${d.optionB}`;
  const matched = TEMA_RULES.filter(([, re]) => re.test(hay)).map(([tema]) => tema);
  if (matched.length > 0) return matched;
  return [d.register];
}

/**
 * Derive the primary psychological lever (`dinamica`) of a dilemma.
 */
export function inferDinamica(d: Dilemma): DinamicaDilemma {
  if (d.dinamica) return d.dinamica;
  const tono = tonoOfDilemma(d);
  if (tono === 'risate') return 'assurdo';
  const temi = inferTemi(d);
  if (temi.includes('etica')) return 'etica';
  if (temi.includes('amore') || temi.includes('amicizia') || temi.includes('famiglia')) return 'relazione';
  if (temi.includes('coraggio') || d.register === 'carriera' || d.register === 'business') return 'azione';
  if (temi.includes('tempo')) return 'priorita';
  return 'identita';
}

/**
 * Derive expected vote polarization (`alta` = divisive debate, `bassa` = lopsided).
 */
export function inferPolarizzazione(d: Dilemma): PolarizzazioneDilemma {
  if (d.polarizzazione) return d.polarizzazione;
  if (d.bilanciamento === 'sbilanciato') return 'bassa';
  if (d.bilanciamento === 'equilibrato') return 'alta';
  if (d.complessita === 'max' || d.complessita === 'power') return 'alta';
  return 'media';
}

const RILANCIO_BY_TEMA: Record<string, string> = {
  soldi: 'Quanto conta davvero la sicurezza economica rispetto alla libertà di scegliere come vivere?',
  lavoro: 'Se domani cambiassi lavoro o ruolo, cosa difenderesti della tua scelta attuale?',
  amicizia: 'Con gli amici più stretti: dici sempre ciò che pensi o proteggi l’equilibrio del gruppo?',
  amore: 'In una relazione, qual è il confine tra compromesso sano e rinuncia a te stesso?',
  famiglia: 'Quanto delle tue scelte di oggi nasce da ciò che vuoi tu e quanto da ciò che si aspettano i tuoi?',
  tempo: 'Se guardassi la tua ultima settimana, dove hai messo il tempo rispetto a ciò che dici di amare?',
  digitale: 'Senza notifiche né pubblico esterno, faresti esattamente la stessa scelta?',
  verita: 'Preferisci una verità scomoda che chiarisce o un silenzio gentile che rimanda il problema?',
  coraggio: 'Qual è il piccolo passo che rimandi da mesi solo per paura del giudizio altrui?',
  etica: 'Quando una regola è ingiusta ma comoda, da che parte ti schieri nella vita di tutti i giorni?',
};

/**
 * Ensure every dilemma has a post-vote follow-up question that nudges real
 * reflection, tailored to its themes or tonal lane if not explicitly authored.
 */
export function ensureDomandaRilancio(d: Dilemma): string {
  if (d.domandaRilancio && d.domandaRilancio.trim().length > 0) return d.domandaRilancio;
  const temi = inferTemi(d);
  for (const t of temi) {
    if (RILANCIO_BY_TEMA[t]) return RILANCIO_BY_TEMA[t];
  }
  const tono = tonoOfDilemma(d);
  if (tono === 'risate') {
    return 'Chi nel gruppo sarebbe davvero capace di fare la scelta opposta nella vita reale, e perché?';
  }
  if (tono === 'serio') {
    return 'Questa scelta parla più di ciò che desideri davvero o di ciò che hai paura di perdere?';
  }
  return 'Nella tua vita attuale, stai già andando verso quello che hai votato o stai rimandando?';
}

const LEZIONE_BY_TEMA: Record<string, string> = {
  soldi: 'Nella vita reale: il denaro compra margine di manovra, ma ogni euro inseguito senza un limite chiaro diventa un nuovo vincolo.',
  amicizia: 'Nei legami: la fiducia non si misura nei momenti facili, ma quando dire la verità costa un po’ di imbarazzo.',
  amore: 'Nelle relazioni: la chiarezza all’inizio evita i risentimenti alla fine. Nessuno legge nel pensiero.',
  famiglia: 'In famiglia: onorare le proprie radici non significa ripetere ogni copione; si può amare scegliendo la propria strada.',
  tempo: 'Sul tempo: ogni "sì" automatico a qualcosa di urgente è un "no" silenzioso a qualcosa di importante.',
  digitale: 'Nel digitale: l’attenzione è la tua risorsa più scarsa; ciò che misuri e condividi finisce per guidare ciò che desideri.',
  verita: 'Sulla sincerità: la trasparenza selettiva protegge nel breve periodo, ma la coerenza costruisce reputazione nel lungo.',
  coraggio: 'Sul coraggio: la chiarezza arriva quasi sempre dopo la prima mossa, quasi mai prima.',
  etica: 'Sull’etica pratica: i valori si vedono solo quando rispettarli ha un prezzo concreto.',
};

/**
 * Assicura che ogni dilemma abbia un insegnamento per il mondo reale,
 * sintetizzandone uno specifico per tema o registro se non esplicitamente presente.
 */
export function ensureLezioneReale(d: Dilemma): string {
  if (d.lezioneReale && d.lezioneReale.trim().length > 0) return d.lezioneReale;

  if (d.register === 'business') {
    return 'Nel business: ogni compromesso immediato tra velocità e integrità crea un debito invisibile ad alto tasso di interesse. I migliori leader non cercano la risposta perfetta, ma gestiscono il rischio del secondo ordine.';
  }
  if (d.register === 'carriera') {
    return 'Nel lavoro: la sicurezza apparente ha spesso il costo nascosto di un tetto al proprio potenziale. Chi sa cambiare idea davanti a nuove evidenze impara il doppio di chi difende l’inerzia.';
  }
  const temi = inferTemi(d);
  for (const t of temi) {
    if (LEZIONE_BY_TEMA[t]) return LEZIONE_BY_TEMA[t];
  }
  return 'Nella vita reale: il rimpianto per un’opportunità mancata brucia molto più a lungo del disagio di un tentativo fallito. Ascoltare chi dissente è l’unico modo per superare i propri punti ciechi.';
}

/**
 * Ensure every dilemma (including player-submitted or party cards) has at least
 * two concrete defense talking points per side so DEFENSE never shows an empty list.
 */
export function ensureSpunti(
  d: Pick<Dilemma, 'optionA' | 'optionB' | 'spuntiA' | 'spuntiB'>,
): { spuntiA: string[]; spuntiB: string[] } {
  const cleanA = (d.spuntiA ?? []).map((s) => s.trim()).filter(Boolean);
  const cleanB = (d.spuntiB ?? []).map((s) => s.trim()).filter(Boolean);
  const fallbackA = [
    `Difendi "${d.optionA}": è la scelta più coerente con ciò che conta davvero sul lungo periodo.`,
    `Chiedi al gruppo quale costo nascosto comporta scegliere "${d.optionB}" rispetto a "${d.optionA}".`,
  ];
  const fallbackB = [
    `Difendi "${d.optionB}": è la scelta più lucida e sostenibile nella vita reale.`,
    `Fai notare al gruppo cosa si rischia di perdere scegliendo d'impulso "${d.optionA}".`,
  ];
  const spuntiA = cleanA.length >= 2 ? cleanA : [...cleanA, ...fallbackA].slice(0, 2);
  const spuntiB = cleanB.length >= 2 ? cleanB : [...cleanB, ...fallbackB].slice(0, 2);
  return { spuntiA, spuntiB };
}

/** Dilemmas matching a register; 'misto' returns the whole pool. */
export function dilemmasForRegister(all: Dilemma[], register: ContentRegister): Dilemma[] {
  if (register === 'misto') return all;
  return all.filter((d) => d.register === register);
}

/**
 * The evening's mood (2.2's setup selector): 'leggera' keeps things sorbetto +
 * alto (no existential 'power' stakes); 'mista' (default) is the full mix;
 * 'profonda' skips the sorbetto warm-up tier and leans into max/power.
 */
export type Mood = 'leggera' | 'mista' | 'profonda';

/**
 * Filter a dilemma pool by mood, then by the delicate-theme opt-in (excluding
 * `delicato` dilemmas unless the leader explicitly opted in). Applied before
 * drawing, so the pacing pass (dilemmaPlan.ts) only ever sees eligible cards.
 */
export function filterByMood(pool: Dilemma[], mood: Mood, delicatoOptIn: boolean): Dilemma[] {
  const withoutDelicate = delicatoOptIn ? pool : pool.filter((d) => !d.delicato);
  if (mood === 'leggera') return withoutDelicate.filter((d) => (d.complessita ?? 'alto') !== 'power');
  if (mood === 'profonda') return withoutDelicate.filter((d) => (d.complessita ?? 'alto') !== 'sorbetto');
  return withoutDelicate;
}

/**
 * Filter a dilemma pool by group familiarity ('vecchi_amici' excludes basic
 * icebreakers meant only for strangers; 'nuove_conoscenze' excludes deep
 * group-history dilemmas meant for close friends; 'misto' keeps everything).
 * Falls back to the unfiltered pool only if filtering would leave it empty.
 */
export function filterByFamiliarita<T extends { familiarita?: DilemmaFamiliarita }>(
  pool: T[],
  familiarita: Familiarita,
): T[] {
  if (familiarita === 'misto') return pool;
  const filtered =
    familiarita === 'vecchi_amici'
      ? pool.filter((d) => d.familiarita !== 'nuove_conoscenze')
      : pool.filter((d) => d.familiarita !== 'vecchi_amici');
  return filtered.length > 0 ? filtered : pool;
}

/**
 * Pick one item from `pool` respecting `familiarita` and prioritizing items
 * explicitly tagged for the selected group type when available.
 */
export function pickByFamiliarita<T extends { familiarita?: DilemmaFamiliarita }>(
  pool: T[],
  familiarita: Familiarita,
  rng: () => number,
): T | null {
  if (pool.length === 0) return null;
  const eligible = filterByFamiliarita(pool, familiarita);
  if (familiarita === 'vecchi_amici' || familiarita === 'nuove_conoscenze') {
    const preferred = eligible.filter((item) => item.familiarita === familiarita);
    if (preferred.length > 0) {
      return preferred[Math.floor(rng() * preferred.length)];
    }
  }
  return eligible[Math.floor(rng() * eligible.length)];
}

/**
 * Dilemmas belonging to a given percorso tappa. Dilemmas without a `tappa` are
 * never returned — they belong to the classic (untagged) pool only.
 */
export function dilemmasForTappa(all: Dilemma[], tappa: Tappa): Dilemma[] {
  return all.filter((d) => d.tappa === tappa);
}

/**
 * Dilemmas belonging to a specific themed percorso (and optionally filtered by
 * its guaranteed tonal lane so light and deep nights never leak into each other).
 */
export function dilemmasForPercorso(
  all: Dilemma[],
  percorsoId: string,
  requiredTono?: CorsiaTono,
): Dilemma[] {
  return all.filter((d) => {
    if ((d.percorsoTappa ?? d.tappa) == null) return false;
    if (requiredTono && tonoOfDilemma(d) !== requiredTono) return false;
    if (d.percorsi && d.percorsi.length > 0) {
      return d.percorsi.includes(percorsoId);
    }
    // Backward-compatible fallback for untagged legacy dilemmas in 'bussola'
    return percorsoId === 'bussola' && d.register === 'vita';
  });
}

/** Dilemmas belonging to a given step (1..4) within a themed percorso. */
export function dilemmasForPercorsoTappa(all: Dilemma[], tappa: Tappa): Dilemma[] {
  return all.filter((d) => (d.percorsoTappa ?? d.tappa) === tappa);
}

/**
 * Load the dilemma deck from server/data/dilemmas.json. The path is resolved
 * from __dirname so it works both in dev (tsx: server/src/game) and in the
 * compiled build (server/dist/game) — the data dir lives at server/data in both.
 */
export function loadDilemmas(): Dilemma[] {
  const file = join(__dirname, '..', '..', 'data', 'dilemmas.json');
  const list = JSON.parse(readFileSync(file, 'utf-8')) as Dilemma[];
  return list.map((d) => {
    const spunti = ensureSpunti(d);
    return {
      ...d,
      tono: tonoOfDilemma(d),
      spuntiA: spunti.spuntiA,
      spuntiB: spunti.spuntiB,
      lezioneReale: ensureLezioneReale(d),
      domandaRilancio: ensureDomandaRilancio(d),
    };
  });
}

/**
 * A shuffled-on-demand deck: each draw removes one dilemma at random so there
 * are no repeats within a single game. Returns null once exhausted. The source
 * array is never mutated.
 */
export class Deck {
  private readonly remaining: Dilemma[];

  constructor(
    dilemmas: Dilemma[],
    private readonly rng: () => number = Math.random,
  ) {
    this.remaining = [...dilemmas];
  }

  /** How many dilemmas are still available to draw. */
  get remainingCount(): number {
    return this.remaining.length;
  }

  /** A copy of the cards still available to draw (for snapshotting the deck). */
  get cards(): Dilemma[] {
    return [...this.remaining];
  }

  /** Draw one random dilemma (without repeats), or null if the deck is empty. */
  draw(): Dilemma | null {
    if (this.remaining.length === 0) return null;
    const index = Math.floor(this.rng() * this.remaining.length);
    const [picked] = this.remaining.splice(index, 1);
    return picked;
  }

  /** Return drawn-but-unused cards to the deck (e.g. set-asides from a
   * mid-game replacement draw) so they stay available for later draws. */
  putBack(dilemmas: Dilemma[]): void {
    this.remaining.push(...dilemmas);
  }
}
