// Intelligent dilemma matching engine.
// Scores and sequences candidates using multi-factor context: novelty (seen IDs),
// near-duplicate family exclusion, thematic & narrative anti-monotony, emotional
// arc progression, and live debate polarization. Pure and deterministic given `rng`.

import {
  COMPLESSITA_RANK,
  inferDinamica,
  inferPolarizzazione,
  inferTemi,
  type Dilemma,
  type Familiarita,
} from './deck';

export interface MatchContext {
  /** Dilemmas already played or scheduled earlier in the current game. */
  alreadyPicked: readonly Dilemma[];
  /** Seen/discarded IDs to avoid (roster templates are exempt). */
  excludeIds?: ReadonlySet<string>;
  /** Number of active players (boosts `{nome}` roster templates when >= 3). */
  playerCount?: number;
  /** Normalized progress through the game (0.0 = start, 1.0 = finale). */
  progress?: number;
  /** Boost high-polarization dilemmas (e.g. after a unanimous vote or discard). */
  boostPolarization?: boolean;
  /** Group familiarity setting ('vecchi_amici' vs 'nuove_conoscenze' vs 'misto'). */
  familiarita?: Familiarita;
}

export interface ScoredCandidate {
  dilemma: Dilemma;
  score: number;
}

/**
 * Score a single candidate dilemma against the current game context.
 * Higher score = better fit for the next slot.
 */
export function scoreCandidate(candidate: Dilemma, ctx: MatchContext): number {
  let score = 0;
  const { alreadyPicked, excludeIds, playerCount = 0, progress, boostPolarization, familiarita } = ctx;

  // 1. Family deduplication: never repeat a near-duplicate premise unless forced.
  if (candidate.famiglia != null) {
    const usedFamily = alreadyPicked.some((d) => d.famiglia === candidate.famiglia);
    if (usedFamily) score -= 500;
  }

  // 2. Novelty: strongly avoid already-seen dilemmas (except `{nome}` roster templates).
  if (excludeIds && excludeIds.has(candidate.id) && !candidate.roster) {
    score -= 200;
  } else {
    score += 20;
  }

  // 3. Roster fit: `{nome}` templates shine in groups of 3+ players.
  if (candidate.roster && playerCount >= 3) {
    score += 12;
  }

  // 4. Thematic & psychological anti-monotony against the last 2 rounds.
  const candTemi = inferTemi(candidate);
  const candDinamica = inferDinamica(candidate);
  const prev1 = alreadyPicked.length >= 1 ? alreadyPicked[alreadyPicked.length - 1] : undefined;
  const prev2 = alreadyPicked.length >= 2 ? alreadyPicked[alreadyPicked.length - 2] : undefined;

  if (prev1) {
    const prev1Temi = new Set(inferTemi(prev1));
    const overlap1 = candTemi.filter((t) => prev1Temi.has(t)).length;
    if (overlap1 > 0) {
      score -= overlap1 * 18;
    } else {
      score += 10;
    }
    if (inferDinamica(prev1) === candDinamica) {
      score -= 14;
    }
  }

  if (prev2) {
    const prev2Temi = new Set(inferTemi(prev2));
    const overlap2 = candTemi.filter((t) => prev2Temi.has(t)).length;
    if (overlap2 > 0) {
      score -= overlap2 * 8;
    }
  }

  // 5. Emotional & complexity arc fit when game progress is provided.
  if (progress !== undefined) {
    const clamped = Math.max(0, Math.min(1, progress));
    const targetRank = -0.4 + clamped * 2.0; // -0.4 (light/accessible) -> +1.6 (deep/power)
    const candRank = COMPLESSITA_RANK[candidate.complessita ?? 'alto'];
    score += 14 - Math.abs(candRank - targetRank) * 8;
  }

  // 6. Debate heat & polarization balance.
  const pol = inferPolarizzazione(candidate);
  if (pol === 'alta') {
    score += boostPolarization ? 28 : 12;
  } else if (pol === 'media') {
    score += 5;
  } else {
    // 'bassa' (sbilanciato): avoid back-to-back lopsided rounds
    score -= 10;
    if (prev1 && inferPolarizzazione(prev1) === 'bassa') {
      score -= 30;
    }
  }

  // 7. Group familiarity fit ('vecchi_amici' vs 'nuove_conoscenze').
  if (familiarita === 'vecchi_amici') {
    if (candidate.familiarita === 'vecchi_amici') score += 45;
    else if (candidate.familiarita === 'nuove_conoscenze') score -= 60;
    if (candidate.roster && playerCount >= 3) score += 15;
  } else if (familiarita === 'nuove_conoscenze') {
    if (candidate.familiarita === 'nuove_conoscenze') score += 20;
    else if (candidate.familiarita === 'vecchi_amici') score -= 60;
  }

  return score;
}

export interface SelectSequenceOptions {
  count: number;
  alreadyPicked?: readonly Dilemma[];
  excludeIds?: ReadonlySet<string>;
  playerCount?: number;
  useArc?: boolean;
  boostPolarization?: boolean;
  familiarita?: Familiarita;
  rng?: () => number;
  /** Pool size among top-scored candidates to sample from for variety (default 3). */
  topK?: number;
}

/**
 * Select `count` dilemmas sequentially using `scoreCandidate` at every step
 * so each pick adapts to what came immediately before it.
 */
export function selectMatchedSequence(
  candidates: readonly Dilemma[],
  opts: SelectSequenceOptions,
): Dilemma[] {
  const {
    count,
    alreadyPicked = [],
    excludeIds,
    playerCount = 0,
    useArc = false,
    boostPolarization = false,
    familiarita,
    rng = Math.random,
    topK = 1,
  } = opts;

  if (count <= 0 || candidates.length === 0) return [];

  const remaining = [...candidates];
  const picked: Dilemma[] = [];
  const history: Dilemma[] = [...alreadyPicked];
  const target = Math.min(count, remaining.length);

  for (let step = 0; step < target; step++) {
    const progress = useArc
      ? target <= 1
        ? 0.5
        : step / (target - 1)
      : undefined;

    const scored: ScoredCandidate[] = remaining.map((d) => ({
      dilemma: d,
      score: scoreCandidate(d, {
        alreadyPicked: history,
        excludeIds,
        playerCount,
        progress,
        boostPolarization,
        familiarita,
      }),
    }));

    // Sort descending by score; use rng tie-break only inside the top-K band
    // whose scores are within 15 points of the best candidate so we never
    // accidentally pick a penalized (-200 / -500) card.
    scored.sort((a, b) => b.score - a.score);
    const bestScore = scored[0].score;
    const band = scored.filter((s) => s.score >= bestScore - 15).slice(0, Math.max(1, topK));
    const chosenIdx = Math.floor(rng() * band.length);
    const chosen = band[chosenIdx].dilemma;

    picked.push(chosen);
    history.push(chosen);
    const remIdx = remaining.findIndex((d) => d.id === chosen.id);
    if (remIdx !== -1) remaining.splice(remIdx, 1);
  }

  return picked;
}

/**
 * Pick the single best replacement dilemma from `candidates` given current game context.
 */
export function pickBestReplacement(
  candidates: readonly Dilemma[],
  ctx: MatchContext,
  rng: () => number = Math.random,
): Dilemma | null {
  const res = selectMatchedSequence(candidates, {
    count: 1,
    alreadyPicked: ctx.alreadyPicked,
    excludeIds: ctx.excludeIds,
    playerCount: ctx.playerCount,
    boostPolarization: ctx.boostPolarization,
    familiarita: ctx.familiarita,
    rng,
    topK: 1,
  });
  return res[0] ?? null;
}
