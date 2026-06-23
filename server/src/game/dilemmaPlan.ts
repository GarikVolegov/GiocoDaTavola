// Classic-mode dilemma sequencing: build the ordered list a game plays through
// (group submissions first, then drawn from the deck, finally ordered by ascending
// complexity so the game escalates). Pure given a Deck + rng. (Percorso planning
// lives in percorso.ts.)
import { COMPLESSITA_RANK, type Deck, type Dilemma } from './deck';

/** A fresh shuffled copy of `arr` using the injected rng (Fisher–Yates). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build the ordered CLASSIC sequence: the group's own dilemmas first (shuffled),
 * then drawn from the deck to reach `count`, finally ordered by ascending complexity
 * so the game escalates alto → max → power. Submitted dilemmas have no complexity,
 * so they count as 'alto' (the warm-up). Within a tier the random draw order is
 * preserved (stable sort) for variety across games.
 */
export function buildClassicPlan(
  deck: Deck,
  submitted: Dilemma[],
  count: number,
  rng: () => number,
): Dilemma[] {
  const chosen: Dilemma[] = [...shuffle(submitted, rng).slice(0, count)];
  while (chosen.length < count) {
    const d = deck.draw();
    if (!d) break;
    chosen.push(d);
  }
  const rank = (d: Dilemma) => COMPLESSITA_RANK[d.complessita ?? 'alto'];
  return chosen
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
    .map((x) => x.d);
}
