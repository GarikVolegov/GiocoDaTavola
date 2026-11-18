// Coppie & Scintille: strict fixed-pairs (2 players per couple, even counts)
// engine. All couples play in parallel every round, voting on real partner
// names for `allineamento` ("chi dei due...") or completing couple challenges
// for `verita` / `obbligo`, with a Couple vs Couple leaderboard.

import type { CoppieCard } from './geminiGenerator';

export interface CouplePair {
  id: string;
  label: string;
  memberAId: string;
  memberBId: string;
  score: number;
  matches: number;
  mismatches: number;
}

export interface CoupleVoteOptions {
  optionA: string;
  optionB: string;
}

export interface CoupleRoundOutcome {
  coupleId: string;
  memberAId: string;
  memberBId: string;
  memberAName: string;
  memberBName: string;
  choiceA: 'A' | 'B' | null;
  choiceB: 'A' | 'B' | null;
  choiceALabel: string | null;
  choiceBLabel: string | null;
  kind: 'match' | 'mismatch' | 'challenge_done' | 'challenge_partial' | 'challenge_skip' | 'incomplete';
  pointsAwarded: number;
}

export function validateCoppiePlayerCount(count: number): boolean {
  return count >= 2 && count % 2 === 0;
}

/**
 * Partition playerIds into strict 2-player pairs. If explicitPairs covers every
 * player cleanly in pairs of 2, preserve it; otherwise deterministically pair
 * `[0,1], [2,3], ...`.
 */
export function buildFixedCouples(
  playerIds: string[],
  resolveName: (id: string) => string,
  explicitPairs?: Array<[string, string]>,
): CouplePair[] {
  const validSet = new Set(playerIds);
  let pairs: Array<[string, string]> | null = null;

  if (
    explicitPairs &&
    explicitPairs.length * 2 === playerIds.length &&
    playerIds.length >= 2
  ) {
    const seen = new Set<string>();
    const ok = explicitPairs.every(([a, b]) => {
      if (!a || !b || a === b) return false;
      if (!validSet.has(a) || !validSet.has(b)) return false;
      if (seen.has(a) || seen.has(b)) return false;
      seen.add(a);
      seen.add(b);
      return true;
    });
    if (ok && seen.size === playerIds.length) {
      pairs = explicitPairs;
    }
  }

  if (!pairs) {
    pairs = [];
    for (let i = 0; i + 1 < playerIds.length; i += 2) {
      pairs.push([playerIds[i], playerIds[i + 1]]);
    }
  }

  return pairs.map(([memberAId, memberBId], idx) => ({
    id: `c${idx + 1}`,
    label: `${resolveName(memberAId)} & ${resolveName(memberBId)}`,
    memberAId,
    memberBId,
    score: 0,
    matches: 0,
    mismatches: 0,
  }));
}

export function findCoupleForPlayer(
  couples: CouplePair[],
  playerId: string,
): CouplePair | undefined {
  return couples.find((c) => c.memberAId === playerId || c.memberBId === playerId);
}

/**
 * Resolve the exact A/B labels shown on a player's phone for a Coppie card.
 * Crucial invariant: for "allineamento" cards without explicit custom options,
 * BOTH members of the couple see the same mapping:
 *   optionA = partnerA's nickname
 *   optionB = partnerB's nickname
 * so vote `'A'` always refers to memberA and `'B'` to memberB!
 * For `verita` / `obbligo`, never show generic A/B — show clear challenge actions.
 */
export function resolveCoppieOptionsForCouple(
  card: Pick<CoppieCard, 'cardType' | 'optionA' | 'optionB'>,
  couple: Pick<CouplePair, 'memberAId' | 'memberBId'> | undefined,
  resolveName: (id: string) => string,
): CoupleVoteOptions {
  if (card.cardType === 'allineamento') {
    if (card.optionA && card.optionB) {
      return { optionA: card.optionA, optionB: card.optionB };
    }
    if (couple) {
      return {
        optionA: resolveName(couple.memberAId),
        optionB: resolveName(couple.memberBId),
      };
    }
  }
  if (card.optionA && card.optionB) {
    return { optionA: card.optionA, optionB: card.optionB };
  }
  return {
    optionA: '✅ Fatta insieme!',
    optionB: '🍺 Penitenza / Passiamo',
  };
}

/**
 * Score all couples in parallel for one Coppie round and return per-couple results.
 */
export function scoreCoppieRound(
  couples: CouplePair[],
  card: Pick<CoppieCard, 'cardType' | 'optionA' | 'optionB'>,
  votes: Map<string, 'A' | 'B'>,
  resolveName: (id: string) => string,
): CoupleRoundOutcome[] {
  const outcomes: CoupleRoundOutcome[] = [];

  for (const couple of couples) {
    const choiceA = votes.get(couple.memberAId) ?? null;
    const choiceB = votes.get(couple.memberBId) ?? null;
    const opts = resolveCoppieOptionsForCouple(card, couple, resolveName);
    const labelFor = (c: 'A' | 'B' | null) =>
      c === 'A' ? opts.optionA : c === 'B' ? opts.optionB : null;

    let kind: CoupleRoundOutcome['kind'] = 'incomplete';
    let pointsAwarded = 0;

    if (card.cardType === 'allineamento') {
      if (choiceA && choiceB) {
        if (choiceA === choiceB) {
          kind = 'match';
          pointsAwarded = 100;
          couple.score += pointsAwarded;
          couple.matches += 1;
        } else {
          kind = 'mismatch';
          couple.mismatches += 1;
        }
      }
    } else {
      // verita / obbligo challenge confirmation
      if (choiceA === 'A' && choiceB === 'A') {
        kind = 'challenge_done';
        pointsAwarded = 80;
        couple.score += pointsAwarded;
        couple.matches += 1;
      } else if (choiceA === 'A' || choiceB === 'A') {
        kind = 'challenge_partial';
        pointsAwarded = 40;
        couple.score += pointsAwarded;
      } else if (choiceA === 'B' || choiceB === 'B') {
        kind = 'challenge_skip';
      }
    }

    outcomes.push({
      coupleId: couple.id,
      memberAId: couple.memberAId,
      memberBId: couple.memberBId,
      memberAName: resolveName(couple.memberAId),
      memberBName: resolveName(couple.memberBId),
      choiceA,
      choiceB,
      choiceALabel: labelFor(choiceA),
      choiceBLabel: labelFor(choiceB),
      kind,
      pointsAwarded,
    });
  }

  return outcomes;
}
