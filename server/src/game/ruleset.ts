// Single source of truth for player-count-dependent rules (3.6): how many
// giocatori are in a room right now, whether the NEXT joiner becomes Pubblico,
// and how many defenders DEFENSE picks per side. Kept a leaf module (no
// imports) so it's trivial to unit-test in isolation at every room size;
// rooms.ts and defenseSetup.ts both call into it instead of each repeating
// their own `giocatoriCount >= threshold` check.

/**
 * Above this many giocatori, new joiners get the 'pubblico' role (3.1) — same
 * QR, same vote/react/bet/speaker-vote, but never picked as a defender. Keeps
 * the on-stage cast small while the room itself scales much further.
 */
export const MAX_GIOCATORI = 8;

/**
 * At or above this many giocatori, DEFENSE picks TWO defenders per side
 * ("a coppie", 3.3) instead of one — more of the room gets stage time as the
 * group scales up, still bounded (never more than a small constant).
 */
export const DEFENSE_COPPIE_THRESHOLD = 7;

/** Anything with an optional 3.1 participation role — same shape as rooms.ts's Player. */
export interface RosterMember {
  role?: 'giocatore' | 'pubblico';
}

/** How many of these players currently hold the 'giocatore' role (role absent = giocatore). */
export function countGiocatori(players: Iterable<RosterMember>): number {
  let n = 0;
  for (const p of players) if (p.role !== 'pubblico') n++;
  return n;
}

/** The full set of N-dependent rules in force for a room with this many giocatori. */
export interface RulesForN {
  giocatoriCount: number;
  /** Would the NEXT joiner (at LOBBY, or on promotion) become Pubblico? */
  isPubblicoCapped: boolean;
  /** How many defenders DEFENSE selects per side. */
  defendersPerSide: 1 | 2;
}

export function rulesForGiocatoriCount(giocatoriCount: number): RulesForN {
  return {
    giocatoriCount,
    isPubblicoCapped: giocatoriCount >= MAX_GIOCATORI,
    defendersPerSide: giocatoriCount >= DEFENSE_COPPIE_THRESHOLD ? 2 : 1,
  };
}

/** Convenience: compute the rules directly from a roster. */
export function rulesForRoster(players: Iterable<RosterMember>): RulesForN {
  return rulesForGiocatoriCount(countGiocatori(players));
}
