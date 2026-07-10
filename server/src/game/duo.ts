// "Percorso in 2" helpers: the pure pieces of the rebuilt 1v1 — the act plan
// (how many dilemmas each act plays), side assignments, waver scoring, and the
// couple-portrait readers. The stateful transition (advanceDuoPhase) stays in
// rooms.ts because it drives timers/clock; these are pure given a Room.

import type { Room, Player, VoteChoice } from './rooms';
import { actForIndex } from './phases';

// actForIndex lives in phases.ts (nextDuoPhase needs it and phases.ts must not
// import from here — rooms.ts already imports phases, and a value import in the
// other direction would close a require cycle); re-exported for callers that
// think in duo terms.
export { actForIndex };

/** Per-player score counters of a Percorso in 2 (drives the portrait verdict). */
export interface DuoPoints {
  /** Atto I: correct predictions of the partner's pick. */
  tiConosco: number;
  /** "Ti ha fatto vacillare?" points earned as the arguer (0-2 per arringa). */
  vacillare: number;
  /** Atto III: times the partner flipped after your arringa (+2 each). */
  persuasione: number;
  /** Atto III twist: times your devil's-advocate arringa flipped the partner (+2 each). */
  ribaltone: number;
}

/** A duo highlight accumulated during the game ("il momento della serata"). */
export interface DuoMoment {
  emoji: string;
  title: string;
  description: string;
  playerId?: string;
}

/** Act sizes (Sintonia / A parti invertite / Schierati) per leader wire value. */
const ACT_SPLITS: Record<number, [number, number, number]> = {
  3: [2, 1, 1], // assaggio → 4 dilemmi
  5: [3, 2, 2], // classica → 7 dilemmi
  7: [4, 3, 3], // maratona → 10 dilemmi
};

/**
 * Map the leader's session-format dilemma count (3/5/7, the group wire value)
 * to the three acts' sizes; unexpected values fall back to the classica split.
 */
export function buildDuoActPlan(dilemmaCount: number): [number, number, number] {
  const split = ACT_SPLITS[dilemmaCount] ?? ACT_SPLITS[5];
  return [...split];
}

/** Expand act sizes into the per-dilemma act list: [2,1,1] → [1,1,2,3]. */
export function expandActs(plan: number[]): number[] {
  return plan.flatMap((size, i) => Array<number>(size).fill(i + 1));
}

/** The (exactly two, humans-only) players of a duo room, in insertion order. */
export function duoPlayers(room: Room): Player[] {
  return [...room.players.values()].filter((p) => !p.isBot);
}

const opposite = (side: VoteChoice): VoteChoice => (side === 'A' ? 'B' : 'A');

/**
 * Atto I combined submit: the player's own secret pick plus their prediction of
 * the partner's pick, both overwritable while DUO_PICK_PREDICT lasts. The own
 * pick rides the normal votes map (same secrecy rules); the prediction stays in
 * duoPredictions until DUO_SYNC_REVEAL.
 */
export function submitDuoSync(
  room: Room,
  playerId: string,
  own: VoteChoice,
  predict: VoteChoice,
): boolean {
  if (room.phase !== 'DUO_PICK_PREDICT') return false;
  if (!duoPlayers(room).some((p) => p.id === playerId)) return false;
  room.votes.set(playerId, own);
  room.duoPredictions.set(playerId, predict);
  return true;
}

/** True once BOTH players submitted their pick + prediction (early-advance gate). */
export function duoSyncComplete(room: Room): boolean {
  const players = duoPlayers(room);
  return (
    players.length === 2 &&
    players.every((p) => room.votes.has(p.id) && room.duoPredictions.has(p.id))
  );
}

/**
 * Atto II assignment: each player argues the side they did NOT pick. When both
 * picked the same side that's impossible for both, so the fairness alternation
 * designates who takes the opposite side (and the counter advances); with
 * different picks nobody is favoured and the counter stays put.
 */
export function assignInvertedSides(room: Room): void {
  const players = duoPlayers(room);
  const [p0, p1] = players;
  if (!p0 || !p1) return;
  const v0 = room.votes.get(p0.id);
  const v1 = room.votes.get(p1.id);
  if (!v0 || !v1) return;
  room.duoAssignedSides = new Map();
  if (v0 !== v1) {
    room.duoAssignedSides.set(p0.id, v1);
    room.duoAssignedSides.set(p1.id, v0);
  } else {
    const designated = players[room.duoFairness % 2];
    const other = players[1 - (room.duoFairness % 2)];
    room.duoAssignedSides.set(designated.id, opposite(v0));
    room.duoAssignedSides.set(other.id, v0);
    room.duoFairness++;
  }
  room.duoSpeakers = [p0.id, p1.id];
  room.duoTurnIndex = 0;
  room.duoAdvocacy = false;
}

/**
 * Atto III agreement twist: the fairness alternation designates ONE devil's
 * advocate who argues the side neither picked, solo turn; the other player
 * only listens (and later re-picks).
 */
export function assignAdvocate(room: Room): void {
  const players = duoPlayers(room);
  const advocate = players[room.duoFairness % 2];
  const side = advocate ? room.votes.get(advocate.id) : undefined;
  if (!advocate || !side) return;
  room.duoFairness++;
  room.duoAssignedSides = new Map([[advocate.id, opposite(side)]]);
  room.duoSpeakers = [advocate.id];
  room.duoTurnIndex = 0;
  room.duoAdvocacy = true;
}

/** The players expected to rate this round's arringa: both in Atto II (each
 * rates the other), only the listener in the advocacy twist. */
function duoRaters(room: Room): Player[] {
  const players = duoPlayers(room);
  return room.duoAdvocacy
    ? players.filter((p) => !room.duoAssignedSides.has(p.id))
    : players;
}

/**
 * Record a secret "ti ha fatto vacillare?" rating. 0|1|2 in Atto II; the
 * advocacy twist caps it at 1 (the big 🤯 is reserved for a real flip) and
 * only the listener may rate. Overwritable while DUO_WAVER lasts.
 */
export function duoWaver(room: Room, raterId: string, rating: 0 | 1 | 2): boolean {
  if (room.phase !== 'DUO_WAVER') return false;
  if (!duoRaters(room).some((p) => p.id === raterId)) return false;
  const max = room.duoAdvocacy ? 1 : 2;
  if (!Number.isInteger(rating) || rating < 0 || rating > max) return false;
  room.duoWaverRatings.set(raterId, rating);
  return true;
}

/** True once every expected rater rated (early-advance gate for DUO_WAVER). */
export function duoWaverComplete(room: Room): boolean {
  const raters = duoRaters(room);
  return raters.length > 0 && raters.every((p) => room.duoWaverRatings.has(p.id));
}

/**
 * True once everyone who re-picks confirmed (early-advance gate for
 * DUO_REPICK): both players normally, only the listener in the advocacy twist
 * (the advocate argued a side that isn't theirs — they have nothing to re-pick).
 */
export function duoRepickComplete(room: Room): boolean {
  const required = room.duoAdvocacy
    ? duoPlayers(room).filter((p) => !room.duoAssignedSides.has(p.id))
    : duoPlayers(room);
  return required.length > 0 && required.every((p) => room.confirmedVote2.has(p.id));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function ensurePoints(room: Room, id: string): DuoPoints {
  let pts = room.duoScore.get(id);
  if (!pts) {
    pts = { tiConosco: 0, vacillare: 0, persuasione: 0, ribaltone: 0 };
    room.duoScore.set(id, pts);
  }
  return pts;
}

/** A player's duo verdict total (all four counters summed). */
export const duoTotalPoints = (pts?: DuoPoints): number =>
  pts ? pts.tiConosco + pts.vacillare + pts.persuasione + pts.ribaltone : 0;

/**
 * Fold a finished Atto I round into the counters (entering DUO_SYNC_REVEAL):
 * one true-pick dilemma toward the sintonia %, an agreement when the picks
 * match, +1 "ti conosco" per correct prediction of the partner's pick.
 */
export function recordSyncRound(room: Room): void {
  const [p0, p1] = duoPlayers(room);
  if (!p0 || !p1) return;
  const v0 = room.votes.get(p0.id);
  const v1 = room.votes.get(p1.id);
  if (!v0 || !v1) return;
  room.duoTruePicks++;
  if (v0 === v1) room.duoFirstPickAgreements++;
  if (room.duoPredictions.get(p0.id) === v1) ensurePoints(room, p0.id).tiConosco++;
  if (room.duoPredictions.get(p1.id) === v0) ensurePoints(room, p1.id).tiConosco++;
}

/** Fold an Atto III first pick into the sintonia counters (entering DUO_REVEAL). */
export function recordDuoReveal(room: Room): void {
  const [p0, p1] = duoPlayers(room);
  if (!p0 || !p1) return;
  const v0 = room.votes.get(p0.id);
  const v1 = room.votes.get(p1.id);
  if (!v0 || !v1) return;
  room.duoTruePicks++;
  if (v0 === v1) room.duoFirstPickAgreements++;
}

/**
 * Whether the re-pick flipped anyone (leaving DUO_REPICK): in the advocacy
 * twist only the listener re-picks so only their flip counts; in the normal
 * Atto III either player may have been persuaded.
 */
export function computeRepickFlipped(room: Room): boolean {
  const players = room.duoAdvocacy
    ? duoPlayers(room).filter((p) => !room.duoAssignedSides.has(p.id))
    : duoPlayers(room);
  return players.some((p) => {
    const before = room.votes1.get(p.id);
    const after = room.votes.get(p.id);
    return before != null && after != null && before !== after;
  });
}

/**
 * Fold a finished Atto II/III round into the score (entering DUO_ROUND_RESULT).
 * Atto II: each arguer earns the rating the OTHER gave (a 🤯 becomes a moment).
 * Atto III normal: flipping the partner is +2 persuasione. Atto III twist: a
 * flip pays the advocate +2 ribaltone, otherwise the listener's 0/1 rating.
 */
export function recordRoundOutcome(room: Room): void {
  const players = duoPlayers(room);
  const [p0, p1] = players;
  if (!p0 || !p1) return;
  const act = actForIndex(room.duoPlannedActs, room.dilemmaIndex);
  if (act === 2) {
    for (const [arguer, rater] of [
      [p0, p1],
      [p1, p0],
    ] as const) {
      const r = room.duoWaverRatings.get(rater.id) ?? 0;
      if (r > 0) ensurePoints(room, arguer.id).vacillare += r;
      if (r === 2) {
        room.duoMoments.push({
          emoji: '🤯',
          title: 'Ha fatto vacillare',
          description: `${arguer.nickname} ha fatto quasi crollare ${rater.nickname} difendendo il lato che non era suo`,
          playerId: arguer.id,
        });
      }
    }
    return;
  }
  if (room.duoAdvocacy) {
    const advocate = players.find((p) => room.duoAssignedSides.has(p.id));
    const listener = players.find((p) => !room.duoAssignedSides.has(p.id));
    if (!advocate || !listener) return;
    if (room.duoRepickFlipped) {
      ensurePoints(room, advocate.id).ribaltone += 2;
      room.duoMoments.push({
        emoji: '🎭',
        title: 'Ribaltone!',
        description: `${advocate.nickname} da avvocato del diavolo ha fatto cambiare idea a ${listener.nickname}`,
        playerId: advocate.id,
      });
    } else {
      const r = room.duoWaverRatings.get(listener.id) ?? 0;
      if (r > 0) ensurePoints(room, advocate.id).vacillare += r;
    }
    return;
  }
  for (const [me, other] of [
    [p0, p1],
    [p1, p0],
  ] as const) {
    const before = room.votes1.get(me.id);
    const after = room.votes.get(me.id);
    if (before && after && before !== after) {
      ensurePoints(room, other.id).persuasione += 2;
      room.duoMoments.push({
        emoji: '🎯',
        title: 'Persuasione riuscita',
        description: `${other.nickname} ha fatto cambiare idea a ${me.nickname}`,
        playerId: other.id,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Gated public readers (the only duo state that ever leaves the server).
// ---------------------------------------------------------------------------

export interface DuoPickView {
  id: string;
  nickname: string;
  choice: VoteChoice;
}
export interface DuoPredictionView {
  id: string;
  nickname: string;
  predicted: VoteChoice;
  correct: boolean;
}
export interface DuoSyncReveal {
  picks: DuoPickView[];
  predictions: DuoPredictionView[];
  agreed: boolean;
  /** Running sintonia counters (numerator/denominator), for the live gauge. */
  agreements: number;
  truePicks: number;
}
export interface DuoSpeakerView {
  id: string;
  nickname: string;
  side: VoteChoice;
  /** Atto II: arguing a side that is not their pick. */
  inverted: boolean;
  /** Atto III twist: the designated devil's advocate. */
  advocate: boolean;
}
export interface DuoTurn {
  speaker: DuoSpeakerView | null;
  listenerId: string | null;
  turn: number;
  totalTurns: number;
  /** When the current turn's "Ho finito" floor lifts; null if there is none. */
  minEndsAt: number | null;
  /** Whether the current arguer may end their turn early right now. */
  canFinish: boolean;
  /** When the current turn started, for the client's count-up display. */
  startedAt: number | null;
}
export interface DuoScoreView {
  id: string;
  nickname: string;
  total: number;
}
export interface DuoVacillareView {
  id: string;
  nickname: string;
  received: 0 | 1 | 2;
}
export interface DuoConvincedView {
  persuader: { id: string; nickname: string };
  convinced: { id: string; nickname: string };
  /** True when the flip came from the devil's-advocate twist. */
  ribaltone: boolean;
}
export interface DuoRoundResult {
  act: number;
  advocacy: boolean;
  vacillare: DuoVacillareView[];
  convinced: DuoConvincedView[];
  scores: DuoScoreView[];
}
export interface DuoTiConoscoView {
  id: string;
  nickname: string;
  hits: number;
}
export interface DuoTitle {
  playerId: string;
  nickname: string;
  emoji: string;
  title: string;
  description: string;
}
export interface DuoPortrait {
  sintoniaPct: number;
  agreements: number;
  truePicks: number;
  tiConosco: DuoTiConoscoView[];
  scores: DuoScoreView[];
  /** The playful micro-verdict's winner; null on a perfect tie. */
  winnerId: string | null;
  momento: DuoMoment | null;
  titoli: DuoTitle[];
}
export interface DuoActState {
  act: number;
  roundInAct: number;
  roundsInAct: number;
  totalActs: number;
}

/** Public Atto I reveal (only DUO_SYNC_REVEAL): both picks + prediction hits. */
export function duoSyncReveal(room: Room): DuoSyncReveal | null {
  if (room.phase !== 'DUO_SYNC_REVEAL') return null;
  const players = duoPlayers(room);
  const picks = players
    .map((p) => ({ id: p.id, nickname: p.nickname, choice: room.votes.get(p.id) }))
    .filter((p): p is DuoPickView => p.choice != null);
  const predictions = players
    .map((p) => {
      const other = players.find((o) => o.id !== p.id);
      const predicted = room.duoPredictions.get(p.id);
      const actual = other ? room.votes.get(other.id) : undefined;
      if (!predicted) return null;
      return { id: p.id, nickname: p.nickname, predicted, correct: predicted === actual };
    })
    .filter((x): x is DuoPredictionView => x != null);
  const agreed = picks.length === 2 && picks[0].choice === picks[1].choice;
  return {
    picks,
    predictions,
    agreed,
    agreements: room.duoFirstPickAgreements,
    truePicks: room.duoTruePicks,
  };
}

/** Public argue turn (only DUO_ARGUE): who speaks, on which (assigned) side. */
export function duoTurn(room: Room, now: number): DuoTurn | null {
  if (room.phase !== 'DUO_ARGUE') return null;
  const players = duoPlayers(room);
  const speakerId = room.duoSpeakers[room.duoTurnIndex];
  const speaker = players.find((p) => p.id === speakerId) ?? null;
  const side = speaker
    ? room.duoAssignedSides.get(speaker.id) ?? room.votes.get(speaker.id) ?? null
    : null;
  const listener = players.find((p) => p.id !== speakerId) ?? null;
  return {
    speaker:
      speaker && side
        ? {
            id: speaker.id,
            nickname: speaker.nickname,
            side,
            inverted: !room.duoAdvocacy && room.duoAssignedSides.has(speaker.id),
            advocate: room.duoAdvocacy && room.duoAssignedSides.has(speaker.id),
          }
        : null,
    listenerId: listener?.id ?? null,
    turn: room.duoSpeakers.length === 0 ? 0 : room.duoTurnIndex + 1,
    totalTurns: room.duoSpeakers.length,
    minEndsAt: room.turnMinEndsAt,
    canFinish: room.turnMinEndsAt == null || now >= room.turnMinEndsAt,
    startedAt: room.turnStartedAt,
  };
}

/** Public round outcome (only DUO_ROUND_RESULT): act-shaped points + totals. */
export function duoRoundResult(room: Room): DuoRoundResult | null {
  if (room.phase !== 'DUO_ROUND_RESULT') return null;
  const players = duoPlayers(room);
  const act = actForIndex(room.duoPlannedActs, room.dilemmaIndex);
  const vacillare: DuoVacillareView[] = [];
  const convinced: DuoConvincedView[] = [];
  if (act === 2) {
    for (const arguer of players) {
      const rater = players.find((p) => p.id !== arguer.id);
      const received = ((rater ? room.duoWaverRatings.get(rater.id) : undefined) ?? 0) as 0 | 1 | 2;
      vacillare.push({ id: arguer.id, nickname: arguer.nickname, received });
    }
  } else if (room.duoAdvocacy) {
    const advocate = players.find((p) => room.duoAssignedSides.has(p.id));
    const listener = players.find((p) => !room.duoAssignedSides.has(p.id));
    if (advocate && listener) {
      if (room.duoRepickFlipped) {
        convinced.push({
          persuader: { id: advocate.id, nickname: advocate.nickname },
          convinced: { id: listener.id, nickname: listener.nickname },
          ribaltone: true,
        });
      } else {
        const received = (room.duoWaverRatings.get(listener.id) ?? 0) as 0 | 1 | 2;
        vacillare.push({ id: advocate.id, nickname: advocate.nickname, received });
      }
    }
  } else {
    for (const me of players) {
      const other = players.find((p) => p.id !== me.id);
      const before = room.votes1.get(me.id);
      const after = room.votes.get(me.id);
      if (other && before && after && before !== after) {
        convinced.push({
          persuader: { id: other.id, nickname: other.nickname },
          convinced: { id: me.id, nickname: me.nickname },
          ribaltone: false,
        });
      }
    }
  }
  const scores = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    total: duoTotalPoints(room.duoScore.get(p.id)),
  }));
  return { act, advocacy: room.duoAdvocacy, vacillare, convinced, scores };
}

/** Structural act progress (never secret): which act, which round within it. */
export function duoActState(room: Room): DuoActState {
  const acts = room.duoPlannedActs;
  const totalActs = new Set(acts).size;
  const idx = room.phase === 'DUO_ACT_INTRO' ? room.dilemmaIndex + 1 : room.dilemmaIndex;
  const act = actForIndex(acts, idx);
  const roundsInAct = acts.filter((a) => a === act).length;
  const roundInAct =
    room.phase === 'DUO_ACT_INTRO' ? 0 : acts.slice(0, idx).filter((a) => a === act).length;
  return { act, roundInAct, roundsInAct, totalActs };
}

// ---------------------------------------------------------------------------
// The couple portrait (DUO_PORTRAIT).
// ---------------------------------------------------------------------------

const FALLBACK_TITLES: Array<Omit<DuoTitle, 'playerId' | 'nickname'>> = [
  { emoji: '⚔️', title: 'Il Duellante', description: "Ha tenuto vivo il faccia a faccia fino all'ultimo dilemma" },
  { emoji: '🤝', title: 'Il Complice', description: 'Metà di questo ritratto è opera sua' },
  { emoji: '🧠', title: 'Lo Stratega', description: 'Ogni scelta pesata come una mossa di scacchi' },
  { emoji: '💛', title: 'Cuore della serata', description: "Il duello è più bello quando c'è anche il cuore" },
];

/** The duo title pool, exactly two per player, ranked by the score counters. */
export function duoTitles(room: Room): DuoTitle[] {
  const players = duoPlayers(room);
  if (players.length !== 2) return [];
  const pts = (id: string): DuoPoints =>
    room.duoScore.get(id) ?? { tiConosco: 0, vacillare: 0, persuasione: 0, ribaltone: 0 };
  // Times a player themselves flipped = the PARTNER's flip points (2 each).
  const flips = (id: string): number => {
    const other = players.find((p) => p.id !== id)!;
    const op = pts(other.id);
    return (op.persuasione + op.ribaltone) / 2;
  };
  const count = new Map<string, number>(players.map((p) => [p.id, 0]));
  const titles: DuoTitle[] = [];
  const give = (p: Player, t: Omit<DuoTitle, 'playerId' | 'nickname'>) => {
    if ((count.get(p.id) ?? 0) >= 2) return;
    titles.push({ playerId: p.id, nickname: p.nickname, ...t });
    count.set(p.id, (count.get(p.id) ?? 0) + 1);
  };
  const best = (metric: (id: string) => number): Player | null => {
    const [a, b] = players;
    const va = metric(a.id);
    const vb = metric(b.id);
    if (va <= 0 && vb <= 0) return null;
    if (va === vb) return (count.get(a.id) ?? 0) <= (count.get(b.id) ?? 0) ? a : b;
    return va > vb ? a : b;
  };
  let w = best((id) => pts(id).persuasione);
  if (w) give(w, { emoji: '🎯', title: 'Il Persuasore', description: "Ha fatto cambiare idea all'altro a viso aperto" });
  w = best((id) => pts(id).ribaltone);
  if (w) give(w, { emoji: '🎭', title: "L'Avvocato del Diavolo", description: "Ha ribaltato l'altro difendendo il lato che non era suo" });
  w = best((id) => pts(id).tiConosco);
  if (w) give(w, { emoji: '🔮', title: 'Il Telepate', description: "Sa cosa sceglierà l'altro prima che lo dica" });
  w = best((id) => pts(id).vacillare);
  if (w) give(w, { emoji: '✨', title: "L'Incantatore", description: 'Le sue arringhe fanno tremare le certezze' });
  const rock = players.filter((p) => flips(p.id) === 0);
  if (rock.length > 0) {
    const r =
      rock.length === 2
        ? (count.get(players[0].id) ?? 0) <= (count.get(players[1].id) ?? 0)
          ? players[0]
          : players[1]
        : rock[0];
    give(r, { emoji: '🪨', title: 'Il Roccione', description: 'Nessuno è riuscito a smuoverlo di un millimetro' });
  }
  w = best((id) => flips(id));
  if (w) give(w, { emoji: '🍃', title: 'La Banderuola', description: 'Cambia idea con stile — ed è un pregio' });
  let fi = 0;
  for (const p of players) {
    while ((count.get(p.id) ?? 0) < 2) give(p, FALLBACK_TITLES[fi++ % FALLBACK_TITLES.length]);
  }
  return titles;
}

/** The momento della serata: ribaltone > 🤯 > persuasione > first anything. */
function pickMomento(room: Room): DuoMoment | null {
  const find = (emoji: string) => room.duoMoments.find((m) => m.emoji === emoji) ?? null;
  return find('🎭') ?? find('🤯') ?? find('🎯') ?? room.duoMoments[0] ?? null;
}

/** The couple portrait (only DUO_PORTRAIT): the finale's whole payload. */
export function duoPortrait(room: Room): DuoPortrait | null {
  if (room.phase !== 'DUO_PORTRAIT') return null;
  const players = duoPlayers(room);
  const sintoniaPct =
    room.duoTruePicks > 0
      ? Math.round((100 * room.duoFirstPickAgreements) / room.duoTruePicks)
      : 0;
  const tiConosco = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    hits: room.duoScore.get(p.id)?.tiConosco ?? 0,
  }));
  const scores = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    total: duoTotalPoints(room.duoScore.get(p.id)),
  }));
  let winnerId: string | null = null;
  if (scores.length === 2 && scores[0].total !== scores[1].total) {
    winnerId = scores[0].total > scores[1].total ? scores[0].id : scores[1].id;
  }
  return {
    sintoniaPct,
    agreements: room.duoFirstPickAgreements,
    truePicks: room.duoTruePicks,
    tiConosco,
    scores,
    winnerId,
    momento: pickMomento(room),
    titoli: duoTitles(room),
  };
}
