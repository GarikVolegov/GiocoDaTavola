import type { VoteSplit } from '../events';

/**
 * Percentuale di voti sul lato A (0–100). Quando non ci sono voti ritorna 50
 * (neutro). Guida la CSS var --bivio-lean per far "pendere" lo sfondo bivio al
 * SPLIT_REVEAL verso il lato in testa.
 */
export function leanFromSplit(split: VoteSplit): number {
  const total = split.A + split.B;
  if (total === 0) return 50;
  return Math.round((split.A / total) * 100);
}
