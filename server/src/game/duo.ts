// "Percorso in 2" helpers: the pure pieces of the rebuilt 1v1 — the act plan
// (how many dilemmas each act plays), side assignments, waver scoring, and the
// couple-portrait readers. The stateful transition (advanceDuoPhase) stays in
// rooms.ts because it drives timers/clock; these are pure given a Room.

import type { Room, Player, VoteChoice } from './rooms';

// actForIndex lives in phases.ts (nextDuoPhase needs it and phases.ts must not
// import from here — rooms.ts already imports phases, and a value import in the
// other direction would close a require cycle); re-exported for callers that
// think in duo terms.
export { actForIndex } from './phases';

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
