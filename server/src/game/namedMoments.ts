// "Momenti nominati" (5.5): a server-side detector that turns a round's raw
// numbers into a titled, shareable moment — a plebiscite, a dead-even split,
// a lead ribaltone, or a defender who swung 3+ votes alone. Accumulated on
// the room across the whole game into "I momenti della serata", shown before
// the awards. Pure given the round's tallies; called once per PHASE_RESULTS
// while votes/votes1/defenders are still intact (mirrors roundStats.ts).
import type { Room, VoteTally, Defender } from './rooms';
import { leadFlipped } from './predictions';

export type NamedMomentKind = 'plebiscito' | 'paritario' | 'ribaltone' | 'triplaPersuasione';

export interface NamedMoment {
  kind: NamedMomentKind;
  /** 1-based dilemma index the moment happened in. */
  dilemmaIndex: number;
  title: string;
  description: string;
  emoji: string;
  /** Set only for triplaPersuasione: the defender who pulled it off. */
  playerId?: string;
  playerNickname?: string;
}

/** Minimum votes a single defender must swing to count as a "tripla persuasione". */
const TRIPLA_THRESHOLD = 3;

/**
 * Detect every named moment in the round that just ended. `second` is the
 * final (VOTE_2) tally, `netSwing` the per-side vote change since VOTE_1
 * (second - first) — both already computed by the caller (roundStats.ts).
 * A round can produce more than one moment (e.g. a dead-even split that also
 * flipped the lead from a tie).
 */
export function detectNamedMoments(room: Room, second: VoteTally, netSwing: VoteTally): NamedMoment[] {
  const moments: NamedMoment[] = [];
  const total = second.A + second.B;
  const dilemmaIndex = room.dilemmaIndex;

  if (total >= 2 && (second.A === 0 || second.B === 0)) {
    moments.push({
      kind: 'plebiscito',
      dilemmaIndex,
      title: 'Plebiscito!',
      description: 'Il gruppo ha votato tutto dalla stessa parte.',
      emoji: '🙌',
    });
  }
  if (total >= 2 && second.A === second.B) {
    moments.push({
      kind: 'paritario',
      dilemmaIndex,
      title: 'Testa a testa!',
      description: 'Il gruppo si è spaccato esattamente a metà.',
      emoji: '⚖️',
    });
  }
  if (leadFlipped(room)) {
    moments.push({
      kind: 'ribaltone',
      dilemmaIndex,
      title: 'Ribaltone!',
      description: 'Le difese hanno cambiato la maggioranza del gruppo.',
      emoji: '🔄',
    });
  }
  const byPersuasion = (a: Defender, b: Defender) => (netSwing[b.side] ?? 0) - (netSwing[a.side] ?? 0);
  for (const d of [...room.defenders].sort(byPersuasion)) {
    if ((netSwing[d.side] ?? 0) >= TRIPLA_THRESHOLD) {
      moments.push({
        kind: 'triplaPersuasione',
        dilemmaIndex,
        title: 'Tripla Persuasione!',
        description: `${d.nickname} ha convinto ${netSwing[d.side]} persone a cambiare idea.`,
        emoji: '🎯',
        playerId: d.id,
        playerNickname: d.nickname,
      });
    }
  }
  return moments;
}
