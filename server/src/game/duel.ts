// 1v1 "Duello" helpers: the pure pieces of the duel — who the two players are,
// whether they agreed, folding a finished round into the score, and the gated
// public readers the server broadcasts. The stateful transition
// (advanceDuelPhase) stays in rooms.ts because it drives timers/clock; these are
// pure given a Room. RoomStore's public methods delegate here.

import type { Room, Player, VoteChoice } from './rooms';

export interface DuelPick {
  id: string;
  nickname: string;
  choice: VoteChoice;
}
export interface DuelReveal {
  picks: DuelPick[];
  agreed: boolean;
}
export interface DuelSpeaker {
  id: string;
  nickname: string;
  side: VoteChoice;
}
export interface DuelTurn {
  speaker: DuelSpeaker | null;
  turn: number;
  totalTurns: number;
}
export interface DuelConvinced {
  persuader: { id: string; nickname: string };
  convinced: { id: string; nickname: string };
}
export interface DuelResult {
  agreed: boolean;
  convinced: DuelConvinced[];
}
export interface DuelScore {
  id: string;
  nickname: string;
  persuasions: number;
}
export interface DuelSummary {
  scores: DuelScore[];
  agreements: number;
}

/** The (up to two) human players of a duel room, in insertion order. */
export function duelPlayers(room: Room): Player[] {
  return [...room.players.values()].filter((p) => !p.isBot);
}

/** True when both duel players picked the same side this round (current votes). */
export function duelAgreed(room: Room): boolean {
  const players = duelPlayers(room);
  if (players.length !== 2) return false;
  const a = room.votes.get(players[0].id);
  const b = room.votes.get(players[1].id);
  return a != null && a === b;
}

/**
 * Fold a finished duel round into the score: if the two first picks (votes1)
 * already agreed, count one agreement; otherwise a player whose re-pick changed
 * side was convinced, so the OTHER player earns +1 persuasion. Called on entry to
 * DUEL_RESULT, while votes1 (first pick) and votes (re-pick) are still intact.
 */
export function recordDuelResult(room: Room): void {
  const players = duelPlayers(room);
  if (players.length !== 2) return;
  const first0 = room.votes1.get(players[0].id);
  const first1 = room.votes1.get(players[1].id);
  if (first0 != null && first0 === first1) {
    room.duelAgreements++;
    return;
  }
  for (let i = 0; i < players.length; i++) {
    const me = players[i];
    const other = players[1 - i];
    const before = room.votes1.get(me.id);
    const after = room.votes.get(me.id);
    if (before && after && before !== after) {
      room.duelScore.set(other.id, (room.duelScore.get(other.id) ?? 0) + 1);
    }
  }
}

/**
 * Public duel reveal (only DUEL_REVEAL, null otherwise): both players' picks +
 * whether they agreed. The picks are intentionally public here — that's the
 * point of the reveal; no other state leaks.
 */
export function duelReveal(room: Room): DuelReveal | null {
  if (room.phase !== 'DUEL_REVEAL') return null;
  const picks = duelPlayers(room)
    .map((p) => ({ id: p.id, nickname: p.nickname, choice: room.votes.get(p.id) }))
    .filter((p): p is DuelPick => p.choice != null);
  return { picks, agreed: duelAgreed(room) };
}

/**
 * Public duel argue turn (only DUEL_ARGUE, null otherwise): who is arguing now
 * (the current player + their picked side) and the turn progress.
 */
export function duelTurn(room: Room): DuelTurn | null {
  if (room.phase !== 'DUEL_ARGUE') return null;
  const players = duelPlayers(room);
  const total = players.length;
  const cur = players[room.duelTurnIndex];
  const side = cur ? room.votes.get(cur.id) ?? null : null;
  return {
    speaker: cur && side ? { id: cur.id, nickname: cur.nickname, side } : null,
    turn: total === 0 ? 0 : room.duelTurnIndex + 1,
    totalTurns: total,
  };
}

/**
 * Public duel result (only DUEL_RESULT, null otherwise): whether they agreed,
 * and—if not—who convinced whom (a player whose re-pick changed was convinced
 * by the other). Derived from votes1 (first pick) vs votes (re-pick).
 */
export function duelResult(room: Room): DuelResult | null {
  if (room.phase !== 'DUEL_RESULT') return null;
  const players = duelPlayers(room);
  const first0 = players[0] ? room.votes1.get(players[0].id) : undefined;
  const first1 = players[1] ? room.votes1.get(players[1].id) : undefined;
  const agreed = players.length === 2 && first0 != null && first0 === first1;
  const convinced: DuelConvinced[] = [];
  if (!agreed) {
    for (let i = 0; i < players.length; i++) {
      const me = players[i];
      const other = players[1 - i];
      const before = room.votes1.get(me.id);
      const after = room.votes.get(me.id);
      if (other && before && after && before !== after) {
        convinced.push({
          persuader: { id: other.id, nickname: other.nickname },
          convinced: { id: me.id, nickname: me.nickname },
        });
      }
    }
  }
  return { agreed, convinced };
}

/**
 * Public duel summary (only FINAL_DUEL, null otherwise): each player's total
 * persuasions and how many rounds the two agreed.
 */
export function duelSummary(room: Room): DuelSummary | null {
  if (room.phase !== 'FINAL_DUEL') return null;
  const scores = duelPlayers(room).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    persuasions: room.duelScore.get(p.id) ?? 0,
  }));
  return { scores, agreements: room.duelAgreements };
}
