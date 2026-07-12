// "Il fallimento diventa contenuto" (2.4): a wrong guess gets a funny,
// self-deprecating title instead of a flat X — private to the one player it
// happened to (never shared, since predictions/bets/guesses stay secret).

export const WRONG_PREDICTION_TITLES: readonly string[] = [
  'Visionario del passato 🔮💥',
  'Il Profeta al contrario 🙃',
  'Radar rotto 📡',
  'Sfera di cristallo appannata 🔮😵',
  "L'Oracolo in giornata no 🎱",
];

export const WRONG_SWING_BET_TITLES: readonly string[] = [
  'Scommettitore sfortunato 🎰💸',
  'Il Bookmaker si è sbagliato 📉',
  'Puntata sul cavallo sbagliato 🐴',
  'Fiuto per gli affari da rivedere 🎰',
];

export const WRONG_KNOW_TITLES: readonly string[] = [
  'Amico misterioso 🕵️‍♂️',
  'Ti conosco... o forse no 🤷',
  'Telepatia in tilt 🔮📵',
  'Serve più tempo insieme 🫂',
];

/** A random title from `pool`; `rng` defaults to Math.random (injectable for tests). */
export function pickIronicTitle(pool: readonly string[], rng: () => number = Math.random): string {
  return pool[Math.floor(rng() * pool.length)];
}
