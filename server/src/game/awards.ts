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
}

/** The fun end-of-game superlatives (persuasion-themed). */
export type AwardId = 'persuasore' | 'banderuola' | 'roccione' | 'sintonia' | 'bastian';

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
    s = { rounds: 0, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0 };
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
  ];
  return defs.filter((d): d is Award => d.winner !== null);
}
