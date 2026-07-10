// End-of-game podium: the transparent "Punti Serata" score and the full final
// ranking computed from the accumulated PlayerStats. Pure sibling of awards.ts;
// RoomStore gates the public version to FINAL_AWARDS (see publicPodium).

import type { PlayerStats } from './awards';
import type { Room, Player } from './rooms';

/** One row of the final ranking (rank 1..3 stand on the podium). */
export interface PodiumEntry {
  player: Player;
  points: number;
  rank: number;
}

/**
 * The "Punti Serata" formula. Only positive, only merit-based signals already
 * tracked in PlayerStats — never a new per-vote record. devilPersuasion is a
 * subset of persuasion (skipped: double count); reactions are spammable (skipped).
 */
export function podiumPoints(s: PlayerStats): number {
  return (
    s.rounds +
    2 * Math.max(0, s.persuasion) +
    2 * (s.oratorVotes ?? 0) +
    (s.correctPredictions ?? 0) +
    (s.correctSwingBets ?? 0) +
    (s.knowCorrect ?? 0) +
    (s.authoredSwing ?? 0)
  );
}

/**
 * The full final ranking, best first: everyone STILL IN the room who played at
 * least one round (a leaver's orphan stats never rank), competition-ranked
 * (ties share a rank: 1, 1, 3). Ties keep join order (the stats map's insertion
 * order — sort is stable). Ungated — RoomStore.publicPodium applies the
 * FINAL_AWARDS gate.
 */
export function computePodium(room: Room): PodiumEntry[] {
  const ranked: PodiumEntry[] = [];
  for (const [id, s] of room.stats.entries()) {
    if (s.rounds === 0) continue;
    const player = room.players.get(id);
    if (!player) continue;
    ranked.push({ player: { id, nickname: player.nickname }, points: podiumPoints(s), rank: 0 });
  }
  ranked.sort((a, b) => b.points - a.points);
  ranked.forEach((e, i) => {
    e.rank = i > 0 && e.points === ranked[i - 1].points ? ranked[i - 1].rank : i + 1;
  });
  return ranked;
}
