// Pre-written ("templated") bot defenses for Fase B. A bot can't speak aloud in
// the room, so when a bot is the defender the host screen shows this canned line
// instead. Deliberately simple — Fase C replaces this seam with Claude-generated
// arguments. Kept side-effect free and rng-injected so it stays deterministic.
import type { Dilemma } from './deck';
import type { BotPersona, VoteChoice } from './rooms';

// A short opener that hints at the persona's attitude.
const OPENERS: Record<BotPersona, string> = {
  roccione: 'Non cambierò idea:',
  indeciso: 'Mah, a pensarci bene',
  gregge: 'Mi pare che molti la vedano così:',
  bastian: 'Vado controcorrente, ma',
  equilibrato: 'Soppesando le due opzioni,',
};

// A closer that names the chosen option, so the line stays on-topic.
const CLOSERS: Array<(opt: string) => string> = [
  (opt) => `“${opt}” è la scelta giusta.`,
  (opt) => `secondo me conviene “${opt}”.`,
  (opt) => `io sto con “${opt}”.`,
];

/** Build a one-line canned defense for a bot defending `side` of `dilemma`. */
export function botDefenseArgument(
  persona: BotPersona,
  dilemma: Dilemma,
  side: VoteChoice,
  rng: () => number,
): string {
  const opt = side === 'A' ? dilemma.optionA : dilemma.optionB;
  const closer = CLOSERS[Math.floor(rng() * CLOSERS.length)] ?? CLOSERS[0];
  return `${OPENERS[persona]} ${closer(opt)}`;
}
