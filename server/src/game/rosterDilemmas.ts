// "Contenuto combinatorio sul roster" (5.3): dilemma templates that embed a
// `{nome}` placeholder, resolved to a random player's nickname fresh on every
// DILEMMA_REVEAL — so the same template plays differently game to game and
// never "runs out". Pure given a Dilemma + the room's player nicknames + rng.
import type { Dilemma } from './deck';

const TOKEN = '{nome}';

function fill(text: string, name: string): string {
  return text.split(TOKEN).join(name);
}

/**
 * Resolve a roster-template dilemma into a concrete one by substituting
 * `{nome}` with a random name — same `id`, so authorship/exclusion tracking
 * elsewhere keys off the template, not the resolved text. A no-op (returns
 * the dilemma unchanged) if it isn't a roster template or there's nobody to
 * name (e.g. an empty roster snapshot).
 */
export function resolveRosterDilemma(d: Dilemma, nicknames: string[], rng: () => number): Dilemma {
  if (!d.roster || nicknames.length === 0) return d;
  const name = nicknames[Math.floor(rng() * nicknames.length)];
  return { ...d, text: fill(d.text, name), optionA: fill(d.optionA, name), optionB: fill(d.optionB, name) };
}
