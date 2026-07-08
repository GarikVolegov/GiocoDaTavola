// End-of-game scoring: the per-player stat record and the fun superlatives
// computed from it. Pure data helpers (given a Room) extracted from rooms.ts;
// RoomStore folds rounds into stats and exposes the gated public awards.

import type { Room, Player } from './rooms';

export interface PlayerStats {
  /** Rounds the player took part in (voted in both VOTE_1 and VOTE_2). */
  rounds: number;
  /** Rounds where the second vote differed from the first. */
  changedCount: number;
  /** Rounds the player ended on the majority side of the second vote. */
  majorityCount: number;
  /** Rounds the player ended on the minority side of the second vote. */
  minorityCount: number;
  /** Net votes that swung toward sides this player defended. */
  persuasion: number;
  /** Rounds the player was a chosen defender. */
  defendedCount: number;
  /**
   * Live audience reactions received while this player was the current speaker
   * (DEFENSE / DUEL_ARGUE). Optional + only set once non-zero, so a player who
   * was never reacted to keeps the base shape.
   */
  reactionsReceived?: number;
  /**
   * How many rounds this player predicted the post-defense majority correctly
   * (PREDICT phase). Optional + only set once non-zero (see reactionsReceived).
   */
  correctPredictions?: number;
  /**
   * Total peer votes received as "most convincing defender" across the game
   * (SPEAKER_VOTE phase). Optional + only set once non-zero (see reactionsReceived).
   */
  oratorVotes?: number;
  /**
   * Net votes swung toward the side this player DEFENDED while playing devil's
   * advocate (the surprise "Avvocato del Diavolo" round — argued the side they
   * did NOT vote). A subset of `persuasion`. Optional + only set once non-zero.
   */
  devilPersuasion?: number;
  /**
   * Rounds this player correctly bet whether the leading side would change after
   * the defenses (PREDICT phase swing bet). Optional + only set once non-zero.
   */
  correctSwingBets?: number;
  /**
   * Total "minds changed" across rounds that played a dilemma THIS player wrote
   * (player-submitted dilemmas). Optional + only set once non-zero.
   */
  authoredSwing?: number;
  /**
   * How many times this player correctly guessed a friend's vote in a "Quanto mi
   * conosci" round. Optional + only set once non-zero.
   */
  knowCorrect?: number;
  /**
   * Rounds this player was the first to cast a vote (VOTE_1 or VOTE_2). Feeds
   * the jolly "Il Fulmine" award. Optional + only set once non-zero.
   */
  firstToVoteCount?: number;
}

/** The fun end-of-game superlatives (persuasion-themed). */
export type AwardId =
  | 'persuasore'
  | 'banderuola'
  | 'roccione'
  | 'sintonia'
  | 'bastian'
  | 'beniamino'
  | 'oracolo'
  | 'oratore'
  | 'voltagabbana'
  | 'sensitivo'
  | 'autore'
  | 'telepate'
  // Jolly pool (2.5): each goes to an otherwise empty-handed player, one apiece
  // — never competed for like the awards above. See computeAwards's jolly pass.
  | 'fulmine'
  | 'sfinge'
  | 'partecipante';

/** An award and who won it. Only awards with a real winner are ever returned. */
export interface Award {
  id: AwardId;
  title: string;
  emoji: string;
  description: string;
  winner: Player;
}

/** Get (creating if needed) the accumulating stats record for a player. */
export function ensureStats(room: Room, id: string): PlayerStats {
  let s = room.stats.get(id);
  if (!s) {
    s = { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0 };
    room.stats.set(id, s);
  }
  return s;
}

/**
 * Compute the end-of-game awards from the accumulated per-player stats. Each
 * superlative goes to its leader; ties break by join order (insertion order of
 * the stats map). Awards with no meaningful winner (e.g. nobody changed their
 * mind) are omitted. Ungated — RoomStore.publicAwards applies the FINAL_AWARDS gate.
 */
export function computeAwards(room: Room): Award[] {
  const entries = [...room.stats.entries()]; // insertion order == join order
  const winnerBy = (
    score: (s: PlayerStats) => number,
    eligible: (s: PlayerStats) => boolean,
  ): Player | null => {
    let best: { id: string; score: number } | null = null;
    for (const [id, s] of entries) {
      if (!eligible(s)) continue;
      const value = score(s);
      if (best === null || value > best.score) best = { id, score: value };
    }
    if (!best) return null;
    const nickname = room.players.get(best.id)?.nickname ?? '';
    return { id: best.id, nickname };
  };
  const defs: Array<Omit<Award, 'winner'> & { winner: Player | null }> = [
    { id: 'persuasore', title: 'Il Persuasore', emoji: '🏆',
      description: 'Le sue difese hanno spostato più voti.',
      winner: winnerBy((s) => s.persuasion, (s) => s.persuasion > 0) },
    { id: 'banderuola', title: 'La Banderuola', emoji: '🎏',
      description: 'Ha cambiato idea più spesso.',
      winner: winnerBy((s) => s.changedCount, (s) => s.changedCount > 0) },
    { id: 'roccione', title: 'Il Roccione', emoji: '🪨',
      description: 'Non ha mai cambiato idea.',
      winner: winnerBy((s) => s.rounds, (s) => s.rounds > 0 && s.changedCount === 0) },
    { id: 'sintonia', title: 'In sintonia col gruppo', emoji: '🔮',
      description: 'Più spesso dalla parte della maggioranza.',
      winner: winnerBy((s) => s.majorityCount, (s) => s.majorityCount > 0) },
    { id: 'bastian', title: 'Bastian Contrario', emoji: '🦓',
      description: 'Più spesso in minoranza.',
      winner: winnerBy((s) => s.minorityCount, (s) => s.minorityCount > 0) },
    { id: 'beniamino', title: 'Beniamino del pubblico', emoji: '👏',
      description: 'Ha ricevuto più reazioni mentre difendeva.',
      winner: winnerBy((s) => s.reactionsReceived ?? 0, (s) => (s.reactionsReceived ?? 0) > 0) },
    { id: 'oracolo', title: "L'Oracolo", emoji: '🎯',
      description: 'Ha pronosticato meglio l’esito delle difese.',
      winner: winnerBy((s) => s.correctPredictions ?? 0, (s) => (s.correctPredictions ?? 0) > 0) },
    { id: 'oratore', title: 'Il Grande Oratore', emoji: '🎤',
      description: 'Votato dai più come il più convincente.',
      winner: winnerBy((s) => s.oratorVotes ?? 0, (s) => (s.oratorVotes ?? 0) > 0) },
    { id: 'voltagabbana', title: 'Il Voltagabbana', emoji: '🎭',
      description: 'Ha spostato più voti difendendo il lato che NON aveva votato.',
      winner: winnerBy((s) => s.devilPersuasion ?? 0, (s) => (s.devilPersuasion ?? 0) > 0) },
    { id: 'sensitivo', title: 'Il Sensitivo', emoji: '🎰',
      description: 'Ha indovinato più spesso se il gruppo si sarebbe ribaltato.',
      winner: winnerBy((s) => s.correctSwingBets ?? 0, (s) => (s.correctSwingBets ?? 0) > 0) },
    { id: 'autore', title: "L'Autore", emoji: '✍️',
      description: 'Il suo dilemma ha fatto cambiare più idee.',
      winner: winnerBy((s) => s.authoredSwing ?? 0, (s) => (s.authoredSwing ?? 0) > 0) },
    { id: 'telepate', title: 'Il Telepate', emoji: '🔮',
      description: 'Ha indovinato più spesso come avevano votato gli amici.',
      winner: winnerBy((s) => s.knowCorrect ?? 0, (s) => (s.knowCorrect ?? 0) > 0) },
  ];
  const main = defs.filter((d): d is Award => d.winner !== null);

  // Jolly pool (2.5, "nessuno a mani vuote"): every player who played at least
  // one round but won none of the awards above gets exactly one consolation
  // superlative — never competed for, just a true thing about THEIR own game.
  const alreadyWon = new Set(main.map((a) => a.winner.id));
  const jolly: Award[] = [];
  for (const [id, s] of entries) {
    if (s.rounds === 0 || alreadyWon.has(id)) continue;
    const nickname = room.players.get(id)?.nickname ?? '';
    const winner = { id, nickname };
    if ((s.firstToVoteCount ?? 0) > 0) {
      jolly.push({ id: 'fulmine', title: 'Il Fulmine', emoji: '⚡',
        description: 'Il primo a votare, più spesso di chiunque altro.', winner });
    } else if (s.changedCount === 0) {
      jolly.push({ id: 'sfinge', title: 'La Sfinge', emoji: '🗿',
        description: 'Impassibile: non ha mai cambiato idea.', winner });
    } else {
      jolly.push({ id: 'partecipante', title: 'Il Partecipante', emoji: '⭐',
        description: "C'era, ha votato, ha fatto la sua parte.", winner });
    }
  }
  return [...main, ...jolly];
}
