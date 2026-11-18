// "Percorso" mode: a long, themed session that climbs through life chapters
// ("tappe"), each deeper than the last. Pure planning helpers — no game state —
// so the budget distribution and per-tappa draw are deterministically testable.

import {
  dilemmasForPercorso,
  dilemmasForPercorsoTappa,
  dilemmasForTappa,
  filterByFamiliarita,
  type CorsiaTono,
  type Dilemma,
  type Familiarita,
  type Tappa,
} from './deck';
import { selectMatchedSequence } from './matcher';

/** Number of tappe in a full percorso (the summit is the last). */
export const N_TAPPE = 4;

/** Duration presets the host can pick; each maps to a target dilemma budget. */
export const DURATE = ['corto', 'medio', 'lungo'] as const;
export type Durata = (typeof DURATE)[number];

/** Target number of dilemmas per duration preset (~5–6 min/dilemma). Tunable. */
export const DURATA_BUDGET: Record<Durata, number> = {
  corto: 10, // ~1h
  medio: 20, // ~2h
  lungo: 30, // ~3h
};

export function isDurata(v: string): v is Durata {
  return (DURATE as readonly string[]).includes(v);
}

/** Display metadata for a single tappa (mirrored on the client). */
export interface TappaMeta {
  id: Tappa;
  key: 'basi' | 'bivi' | 'legami' | 'bilanci';
  nome: string;
  emoji: string;
  sottotitolo: string;
  descrizione: string;
}

/** The fixed climb: four life chapters, rising in theme and emotional stakes. */
export const TAPPE: readonly TappaMeta[] = [
  {
    id: 1,
    key: 'basi',
    nome: 'Le Basi',
    emoji: '🌱',
    sottotitolo: 'Giovinezza & prime scelte',
    descrizione: 'Indipendenza, studio, soldi vs passione: le scelte di partenza, leggere e quotidiane.',
  },
  {
    id: 2,
    key: 'bivi',
    nome: 'I Bivi',
    emoji: '🔀',
    sottotitolo: 'Carriera, soldi & relazioni',
    descrizione: 'Ambizione vs stabilità, amore vs lavoro: i bivi che indirizzano la vita.',
  },
  {
    id: 3,
    key: 'legami',
    nome: 'I Legami',
    emoji: '🤝',
    sottotitolo: 'Famiglia & responsabilità',
    descrizione: 'Lealtà, sacrifici, io vs gli altri: scelte personali che pesano sugli affetti.',
  },
  {
    id: 4,
    key: 'bilanci',
    nome: 'I Bilanci',
    emoji: '🌅',
    sottotitolo: 'Eredità & senso',
    descrizione: 'Rimpianti, valori, cosa lasci: i dilemmi più profondi ed esistenziali.',
  },
];

export const PERCORSO_IDS = [
  'risate-assurdi',
  'risate-quotidiano',
  'risate-amicizia-soldi',
  'bussola',
  'carriera-soldi',
  'rompere-schemi',
  'direzione-tempo-digitale',
  'direzione-coraggio-paure',
  'legami-verita',
  'bilanci-senso',
  'etica-estremi',
  'serio-famiglia-radici',
] as const;

export type PercorsoId = (typeof PERCORSO_IDS)[number];

export interface PercorsoMeta {
  id: PercorsoId;
  corsia: CorsiaTono;
  nome: string;
  emoji: string;
  sottotitolo: string;
  descrizione: string;
  tappe: readonly TappaMeta[];
}

export const PERCORSI_CATALOG: readonly PercorsoMeta[] = [
  // ─── CORSIA 1: SERATA TRA RISATE ───────────────────────────────────────────
  {
    id: 'risate-assurdi',
    corsia: 'risate',
    nome: 'Assurdi & Scenari Folli',
    emoji: '🎭',
    sottotitolo: 'Zero pensieri · Ridere subito',
    descrizione: 'Domande surreali, paradossi quotidiani e scelte impossibili per scatenare risate senza impegno.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Riscaldamento', emoji: '🍕', sottotitolo: 'Gusti & manie', descrizione: 'Piccole follie quotidiane e abitudini inconfessabili.' },
      { id: 2, key: 'bivi', nome: 'Scenari Assurdi', emoji: '🛸', sottotitolo: 'E se succedesse…', descrizione: 'Situazioni paradossali dove ogni scelta è ridicola.' },
      { id: 3, key: 'legami', nome: 'Caos Sociale', emoji: '🍻', sottotitolo: 'Amici & figuracce', descrizione: 'Cosa faresti davanti a tutti pur di cavartela.' },
      { id: 4, key: 'bilanci', nome: 'Follia Finale', emoji: '🎪', sottotitolo: 'Senza freni', descrizione: 'Le domande più assurde per chiudere tra le risate.' },
    ],
  },
  {
    id: 'risate-quotidiano',
    corsia: 'risate',
    nome: 'Vita Quotidiana & Red Flag',
    emoji: '🚩',
    sottotitolo: 'Ex, serate & scomodità leggere',
    descrizione: 'Dibattiti accesi su abitudini, amicizie, appuntamenti e piccoli egoismi di ogni giorno.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Piccole Ipocrisie', emoji: '📱', sottotitolo: 'Quello che fanno tutti', descrizione: 'Chat, social, ritardi e bugie bianche.' },
      { id: 2, key: 'bivi', nome: 'Red Flag', emoji: '🚩', sottotitolo: 'Appuntamenti & ex', descrizione: 'Segnali d’allarme e scelte scomode ma divertenti.' },
      { id: 3, key: 'legami', nome: 'Segreti da Tavola', emoji: '🍷', sottotitolo: 'Complicità', descrizione: 'Quanto siamo davvero sinceri con gli amici?' },
      { id: 4, key: 'bilanci', nome: 'Verdetto Leggero', emoji: '😂', sottotitolo: 'Senza maschere', descrizione: 'Le confessioni più spassose della serata.' },
    ],
  },
  {
    id: 'risate-amicizia-soldi',
    corsia: 'risate',
    nome: 'Amici, Vacanze & Conti',
    emoji: '💸',
    sottotitolo: 'Conti alla romana, favori & case condivise',
    descrizione: 'Le micro-tensioni comiche e verissime quando si dividono spese, vacanze di gruppo, passaggi e regali.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Al Ristorante', emoji: '🍕', sottotitolo: 'Conti & mance', descrizione: 'Alla romana vs chi ha preso solo l’insalata.' },
      { id: 2, key: 'bivi', nome: 'Vacanza di Gruppo', emoji: '🏖️', sottotitolo: 'Convivenza forzata', descrizione: 'Orari, pulizie, aria condizionata e spese comuni.' },
      { id: 3, key: 'legami', nome: 'Prestiti & Favori', emoji: '🤝', sottotitolo: '«Poi te li ridò»', descrizione: 'Anticipi, passaggi alle 2 di notte e regali di gruppo.' },
      { id: 4, key: 'bilanci', nome: 'Sopravvivere al Gruppo', emoji: '🍻', sottotitolo: 'Amicizia vs portafoglio', descrizione: 'Dove finisce la leggerezza e inizia la calcolatrice.' },
    ],
  },

  // ─── CORSIA 2: DIREZIONE & POSSIBILITÀ ─────────────────────────────────────
  {
    id: 'bussola',
    corsia: 'direzione',
    nome: 'Bussola di Vita',
    emoji: '🧭',
    sottotitolo: 'Priorità, coraggio & direzione',
    descrizione: 'Domande che aprono gli occhi su come stai usando il tuo tempo, cosa rimandi e dove stai andando.',
    tappe: TAPPE,
  },
  {
    id: 'carriera-soldi',
    corsia: 'direzione',
    nome: 'Ambizione, Carriera & Soldi',
    emoji: '🚀',
    sottotitolo: 'Libertà, rischio & compromessi',
    descrizione: 'Lavoro vs vita vera, sicurezza vs salto nel vuoto, etica del successo e prezzo dell’ambizione.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Punto di Partenza', emoji: '💼', sottotitolo: 'Talento & sicurezza', descrizione: 'Stipendio sicuro o strada tua? Le prime scelte.' },
      { id: 2, key: 'bivi', nome: 'Il Prezzo della Crescita', emoji: '📈', sottotitolo: 'Tempo vs denaro', descrizione: 'Quanto sei disposto a sacrificare per salire?' },
      { id: 3, key: 'legami', nome: 'Integrità & Potere', emoji: '🤝', sottotitolo: 'Etica al lavoro', descrizione: 'Scelte difficili tra risultati, colleghi e coscienza.' },
      { id: 4, key: 'bilanci', nome: 'Libertà Vera', emoji: '🦅', sottotitolo: 'Abbastanza o sempre di più?', descrizione: 'Cosa significa davvero aver vinto nel lavoro.' },
    ],
  },
  {
    id: 'rompere-schemi',
    corsia: 'direzione',
    nome: 'Rompere gli Schemi',
    emoji: '💡',
    sottotitolo: 'Nuove possibilità & punti ciechi',
    descrizione: 'Domande progettate per smontare il pilota automatico, riconoscere le paure invisibili e vedere alternative.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Lo Specchio', emoji: '🪞', sottotitolo: 'Abitudini automatiche', descrizione: 'Cosa fai per inerzia senza chiederti più il perché.' },
      { id: 2, key: 'bivi', nome: 'L’Attrito', emoji: '⚡', sottotitolo: 'Uscire dalla comfort zone', descrizione: 'Il costo nascosto del restare dove sei.' },
      { id: 3, key: 'legami', nome: 'Il Cambio di Rotta', emoji: '🔄', sottotitolo: 'Nuove lenti', descrizione: 'Guardare i tuoi problemi con gli occhi di un altro.' },
      { id: 4, key: 'bilanci', nome: 'Possibilità Aperte', emoji: '✨', sottotitolo: 'Da domani', descrizione: 'Una scelta concreta che cambia la tua traiettoria.' },
    ],
  },
  {
    id: 'direzione-tempo-digitale',
    corsia: 'direzione',
    nome: 'Tempo, Attenzione & Digitale',
    emoji: '📵',
    sottotitolo: 'Presenza reale vs pilota automatico',
    descrizione: 'Chi possiede davvero le tue ore? Notifiche, vetrina social, reperibilità continua e recupero della presenza.',
    tappe: [
      { id: 1, key: 'basi', nome: 'L’Attenzione Rubata', emoji: '📱', sottotitolo: 'Schermi & riflessi', descrizione: 'Quante ore spariscono senza che te ne accorga.' },
      { id: 2, key: 'bivi', nome: 'Vetrina vs Realtà', emoji: '🪞', sottotitolo: 'Confronto continuo', descrizione: 'Vivere un momento o raccontarlo online.' },
      { id: 3, key: 'legami', nome: 'Reperibilità & Confini', emoji: '🔕', sottotitolo: 'Sempre connessi', descrizione: 'Il diritto di sparire senza sensi di colpa.' },
      { id: 4, key: 'bilanci', nome: 'Riprendersi il Tempo', emoji: '⏳', sottotitolo: 'Scelte di presenza', descrizione: 'Cosa succede quando spegni il rumore.' },
    ],
  },
  {
    id: 'direzione-coraggio-paure',
    corsia: 'direzione',
    nome: 'Coraggio, Rischio & Paure',
    emoji: '🦁',
    sottotitolo: 'Sbloccare ciò che rimandi da anni',
    descrizione: 'Il prezzo nascosto dell’immobilismo, la paura del giudizio altrui e il confine tra prudenza e resa.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Freno a Mano', emoji: '🛑', sottotitolo: 'Paure quotidiane', descrizione: 'Le piccole scuse con cui eviti di esporti.' },
      { id: 2, key: 'bivi', nome: 'Il Giudizio Altrui', emoji: '👀', sottotitolo: 'Sguardi & aspettative', descrizione: 'Quanto decidi tu e quanto decide la paura di fallire.' },
      { id: 3, key: 'legami', nome: 'Il Salto Calcolato', emoji: '🪂', sottotitolo: 'Errore vs rimpianto', descrizione: 'Accettare di essere principianti pur di iniziare.' },
      { id: 4, key: 'bilanci', nome: 'Il Primo Passo', emoji: '🦁', sottotitolo: 'Azione concreta', descrizione: 'Cosa faresti oggi se sapessi che non puoi perdere dignità.' },
    ],
  },

  // ─── CORSIA 3: DISCORSI SERI & CONSAPEVOLEZZA ─────────────────────────────
  {
    id: 'legami-verita',
    corsia: 'serio',
    nome: 'Legami, Amore & Verità',
    emoji: '❤️',
    sottotitolo: 'Affetti, confini & sincerità',
    descrizione: 'Discorsi seri su amore, famiglia, lealtà, perdono e tutto ciò che spesso non ci si dice.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Presenza', emoji: '🫶', sottotitolo: 'Essere davvero lì', descrizione: 'Attenzione, ascolto e piccole verità nelle relazioni.' },
      { id: 2, key: 'bivi', nome: 'Confini', emoji: '🛡️', sottotitolo: 'Io vs noi', descrizione: 'Dove finisce l’amore e inizia il perdersi.' },
      { id: 3, key: 'legami', nome: 'Lealtà & Sacrificio', emoji: '🤝', sottotitolo: 'Scelte che pesano', descrizione: 'Famiglia, amicizie storiche e verità scomode.' },
      { id: 4, key: 'bilanci', nome: 'Perdono & Verità', emoji: '🕊️', sottotitolo: 'Cosa resta', descrizione: 'Ciò che vale la pena salvare, e ciò che va lasciato andare.' },
    ],
  },
  {
    id: 'bilanci-senso',
    corsia: 'serio',
    nome: 'Bilanci, Senso & Eredità',
    emoji: '🌅',
    sottotitolo: 'Identità, rimpianti & valore',
    descrizione: 'Le domande profonde che mettono in prospettiva tutta una vita: cosa conta quando togli il rumore.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Il Tempo', emoji: '⏳', sottotitolo: 'Come lo spendi', descrizione: 'La differenza tra essere occupati ed essere vivi.' },
      { id: 2, key: 'bivi', nome: 'L’Identità', emoji: '🧩', sottotitolo: 'Chi sei senza ruoli', descrizione: 'Cosa resta di te se togli lavoro, soldi e status.' },
      { id: 3, key: 'legami', nome: 'I Rimpianti', emoji: '🌊', sottotitolo: 'Cose non dette o non fatte', descrizione: 'Guardare in faccia ciò che ancora puoi cambiare.' },
      { id: 4, key: 'bilanci', nome: 'L’Eredità', emoji: '🌅', sottotitolo: 'Il segno che lasci', descrizione: 'Come vuoi essere ricordato da chi hai amato.' },
    ],
  },
  {
    id: 'etica-estremi',
    corsia: 'serio',
    nome: 'Etica, Potere & Scelte Estreme',
    emoji: '⚖️',
    sottotitolo: 'Dilemmi morali & coscienza',
    descrizione: 'Scenari limite dove non esiste una risposta facile: giustizia, responsabilità e principi non negoziabili.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Regole vs Coscienza', emoji: '📜', sottotitolo: 'Piccoli test morali', descrizione: 'Quando la legge e ciò che è giusto non coincidono.' },
      { id: 2, key: 'bivi', nome: 'Il Bene Maggiore', emoji: '⚖️', sottotitolo: 'Uno o molti', descrizione: 'Responsabilità verso gli sconosciuti vs chi ami.' },
      { id: 3, key: 'legami', nome: 'Potere & Verità', emoji: '🕯️', sottotitolo: 'Cosa faresti al comando', descrizione: 'Il peso delle decisioni irreversibili.' },
      { id: 4, key: 'bilanci', nome: 'Principi Ultimi', emoji: '🏛️', sottotitolo: 'La linea che non superi', descrizione: 'Scoprire fino a dove arrivano davvero i tuoi valori.' },
    ],
  },
  {
    id: 'serio-famiglia-radici',
    corsia: 'serio',
    nome: 'Famiglia, Radici & Aspettative',
    emoji: '🏡',
    sottotitolo: 'Eredità emotiva, confini & perdono',
    descrizione: 'Il rapporto con chi ti ha cresciuto: onorare le radici senza restarne prigionieri, verità taciute e cura.',
    tappe: [
      { id: 1, key: 'basi', nome: 'Le Aspettative', emoji: '🎒', sottotitolo: 'Sogni ereditati', descrizione: 'Quello che la famiglia si aspetta da te vs ciò che sei.' },
      { id: 2, key: 'bivi', nome: 'La Distanza Giusta', emoji: '🚪', sottotitolo: 'Autonomia & sensi di colpa', descrizione: 'Mettere confini sani senza rompere l’affetto.' },
      { id: 3, key: 'legami', nome: 'Verità di Casa', emoji: '🕯️', sottotitolo: 'Non detti & ruoli', descrizione: 'Affrontare i silenzi che pesano da anni.' },
      { id: 4, key: 'bilanci', nome: 'Perdono & Cura', emoji: '🏡', sottotitolo: 'Pace con le origini', descrizione: 'Accettare i limiti di chi ci ha amato come sapeva fare.' },
    ],
  },
];

export function isPercorsoId(v: string): v is PercorsoId {
  return (PERCORSO_IDS as readonly string[]).includes(v);
}

export function getPercorsoMeta(id?: string | null): PercorsoMeta {
  return PERCORSI_CATALOG.find((p) => p.id === id) ?? PERCORSI_CATALOG.find((p) => p.id === 'bussola')!;
}

/** Clamp an arbitrary number to a valid tappa (1..N_TAPPE). */
export function clampTappa(t: number): Tappa {
  return Math.min(N_TAPPE, Math.max(1, Math.floor(t))) as Tappa;
}

/**
 * Distribute a duration's dilemma budget across the tappe from `startTappa` up to
 * the summit, as evenly as possible. The remainder goes to the DEEPER tappe (so
 * the climax carries a touch more weight). Tappe below the start get 0. This is
 * the pre-cap allocation — the actual plan is capped by available content.
 */
export function allocateBudget(startTappa: number, durata: Durata): Record<Tappa, number> {
  const start = clampTappa(startTappa);
  const budget = DURATA_BUDGET[durata];
  const range: Tappa[] = [];
  for (let t = start; t <= N_TAPPE; t++) range.push(t as Tappa);
  const count = range.length;
  const base = Math.floor(budget / count);
  const rem = budget % count;
  const alloc: Record<Tappa, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  range.forEach((t, i) => {
    // The last `rem` tappe in the range (the deeper ones) get one extra.
    alloc[t] = base + (i >= count - rem ? 1 : 0);
  });
  return alloc;
}

/** How many dilemmas are available per tappa (for capping + host estimates). */
export function tappaCounts(all: Dilemma[]): Record<Tappa, number> {
  return {
    1: dilemmasForTappa(all, 1).length,
    2: dilemmasForTappa(all, 2).length,
    3: dilemmasForTappa(all, 3).length,
    4: dilemmasForTappa(all, 4).length,
  };
}

/** How many dilemmas are available per percorso & tappa (for capping + host estimates). */
export function percorsoCounts(all: Dilemma[]): Record<PercorsoId, Record<Tappa, number>> {
  const out = {} as Record<PercorsoId, Record<Tappa, number>>;
  for (const p of PERCORSI_CATALOG) {
    const pool = dilemmasForPercorso(all, p.id, p.corsia);
    out[p.id] = {
      1: dilemmasForPercorsoTappa(pool, 1).length,
      2: dilemmasForPercorsoTappa(pool, 2).length,
      3: dilemmasForPercorsoTappa(pool, 3).length,
      4: dilemmasForPercorsoTappa(pool, 4).length,
    };
  }
  return out;
}

/** A planned ascent: the ordered dilemmas plus the tappa each belongs to. */
export interface PercorsoPlan {
  dilemmas: Dilemma[];
  /** Parallel to `dilemmas`: tappe[i] is the tappa of dilemmas[i] (ascending). */
  tappe: number[];
}

/**
 * Build the ordered dilemma sequence for a percorso: from `startTappa` to the
 * summit, drawing each tappa's allocation (without repeats) from the selected
 * percorso's pool (strictly enforcing its tonal lane so risate and serio never
 * mix). When `percorsoId` is omitted, falls back to all dilemmas with a `tappa`
 * for backward compatibility with legacy tests.
 */
export function buildPercorsoPlan(
  all: Dilemma[],
  startTappa: number,
  durata: Durata,
  rng: () => number = Math.random,
  percorsoId?: string,
  excludeIds?: ReadonlySet<string>,
  playerCount = 0,
  familiarita: Familiarita = 'misto',
): PercorsoPlan {
  const alloc = allocateBudget(startTappa, durata);
  const start = clampTappa(startTappa);
  const pool = percorsoId
    ? dilemmasForPercorso(all, getPercorsoMeta(percorsoId).id, getPercorsoMeta(percorsoId).corsia)
    : all;
  const dilemmas: Dilemma[] = [];
  const tappe: number[] = [];
  for (let t = start; t <= N_TAPPE; t++) {
    const rawStepPool = percorsoId
      ? dilemmasForPercorsoTappa(pool, t as Tappa)
      : dilemmasForTappa(pool, t as Tappa);
    const famPool = filterByFamiliarita(rawStepPool, familiarita);
    const target = alloc[t as Tappa];
    let stepPool = famPool;
    if (stepPool.length < target && famPool.length < rawStepPool.length) {
      const famIds = new Set(famPool.map((d) => d.id));
      stepPool = [...famPool, ...rawStepPool.filter((d) => !famIds.has(d.id))];
    }
    const take = Math.min(target, stepPool.length);
    const picked = selectMatchedSequence(stepPool, {
      count: take,
      alreadyPicked: dilemmas,
      excludeIds,
      playerCount,
      useArc: false,
      familiarita,
      rng,
    });
    for (const d of picked) {
      dilemmas.push(d);
      tappe.push(t);
    }
  }
  return { dilemmas, tappe };
}

/** Actual planned length given availability (host's live estimate, capped). */
export function planSize(all: Dilemma[], startTappa: number, durata: Durata): number {
  const alloc = allocateBudget(startTappa, durata);
  const counts = tappaCounts(all);
  let total = 0;
  for (let t = 1 as Tappa; t <= N_TAPPE; t = (t + 1) as Tappa) {
    total += Math.min(alloc[t], counts[t]);
  }
  return total;
}
