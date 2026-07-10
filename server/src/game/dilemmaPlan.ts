// Classic-mode dilemma sequencing: build the ordered list a game plays through
// (group submissions + drawn from the deck, ordered by ascending complexity so
// the game escalates) and pace it (2.1): round 1 opens light, no two heavy
// (max/power) dilemmas back to back, power never opens or closes the game.
// Player-submitted dilemmas (5.2, "non bruciati in testa") are spread through
// the game rather than clustered at the front. Pure given a Deck + rng.
// (Percorso planning lives in percorso.ts.)
import { COMPLESSITA_RANK, type Deck, type Dilemma, type Complessita } from './deck';

/** A fresh shuffled copy of `arr` using the injected rng (Fisher–Yates). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const tierOf = (d: Dilemma): Complessita => d.complessita ?? 'alto';
const isHeavy = (d: Dilemma): boolean => tierOf(d) === 'max' || tierOf(d) === 'power';

/**
 * Repair an ascending-complexity sequence so it also respects the group's
 * pacing rules (2.1) and the UGC spread rule (5.2), best-effort (a game where
 * every dilemma is heavy — or every dilemma is submitted — simply can't
 * satisfy them, left as-is rather than crashing):
 *  1. Round 1 opens on a 'sorbetto' dilemma whenever one was drawn.
 *  2. 'power' never opens or closes the game (checked last, so it always wins
 *     over the spacing pass below).
 *  3. No two 'max'/'power' dilemmas run back to back when a lighter one is
 *     available to swap in — scanned left to right, forward-only swaps (a
 *     later fix can only affect positions the scan hasn't reached yet, so it
 *     can't silently undo an earlier one).
 *  4. No two player-submitted (UGC) dilemmas run back to back, and round 1
 *     isn't one when a deck dilemma is available instead — spread through the
 *     game rather than clustered at the front (5.2, "non bruciati in testa").
 */
function enforcePacing(seq: Dilemma[], submittedIds: Set<string>): Dilemma[] {
  const arr = [...seq];
  const n = arr.length;
  if (n < 2) return arr;
  const isUgc = (d: Dilemma) => submittedIds.has(d.id);

  const sorbettoIdx = arr.findIndex((d) => tierOf(d) === 'sorbetto');
  if (sorbettoIdx > 0) [arr[0], arr[sorbettoIdx]] = [arr[sorbettoIdx], arr[0]];

  // The heavy-spacing, power-at-the-edges, and UGC-spacing passes can each
  // undo one another, so alternate them until the arrangement stops changing.
  // Small dilemma counts (3-9) converge in a couple of rounds; the loop is
  // capped as a safety net for a case with no valid resolution, accepting
  // best-effort past that.
  for (let round = 0; round < 5; round++) {
    const before = arr.map((d) => d.id).join('|');

    for (let i = 0; i < n - 1; i++) {
      if (isHeavy(arr[i]) && isHeavy(arr[i + 1])) {
        const swapIdx = arr.findIndex((d, j) => j > i + 1 && !isHeavy(d));
        if (swapIdx !== -1) [arr[i + 1], arr[swapIdx]] = [arr[swapIdx], arr[i + 1]];
      }
    }
    if (tierOf(arr[n - 1]) === 'power') {
      const idx = arr.findIndex((d, i) => i > 0 && i < n - 1 && tierOf(d) !== 'power');
      if (idx !== -1) [arr[n - 1], arr[idx]] = [arr[idx], arr[n - 1]];
    }
    if (tierOf(arr[0]) === 'power') {
      const idx = arr.findIndex((d, i) => i > 0 && tierOf(d) !== 'power');
      if (idx !== -1) [arr[0], arr[idx]] = [arr[idx], arr[0]];
    }
    for (let i = 0; i < n - 1; i++) {
      if (isUgc(arr[i]) && isUgc(arr[i + 1])) {
        const swapIdx = arr.findIndex((d, j) => j > i + 1 && !isUgc(d));
        if (swapIdx !== -1) [arr[i + 1], arr[swapIdx]] = [arr[swapIdx], arr[i + 1]];
      }
    }
    if (isUgc(arr[0])) {
      const idx = arr.findIndex((d, i) => i > 0 && !isUgc(d));
      if (idx !== -1) [arr[0], arr[idx]] = [arr[idx], arr[0]];
    }

    if (arr.map((d) => d.id).join('|') === before) break; // stable
  }

  return arr;
}

/**
 * Build the ordered CLASSIC sequence: the group's own dilemmas (shuffled) plus
 * drawn from the deck to reach `count`, ordered by ascending complexity so the
 * game escalates sorbetto → alto → max → power, then paced (see
 * enforcePacing) — which also spreads the submitted ones through the game
 * instead of clustering them at the front (5.2). Submitted dilemmas have no
 * complexity, so they count as 'alto'. Within a tier the random draw order is
 * preserved (stable sort) for variety.
 */
export function buildClassicPlan(
  deck: Deck,
  submitted: Dilemma[],
  count: number,
  rng: () => number,
): Dilemma[] {
  const chosenSubmitted = shuffle(submitted, rng).slice(0, count);
  const submittedIds = new Set(chosenSubmitted.map((d) => d.id));
  const chosen: Dilemma[] = [...chosenSubmitted];
  while (chosen.length < count) {
    const d = deck.draw();
    if (!d) break;
    chosen.push(d);
  }
  const rank = (d: Dilemma) => COMPLESSITA_RANK[d.complessita ?? 'alto'];
  const escalating = chosen
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
    .map((x) => x.d);
  return enforcePacing(escalating, submittedIds);
}
