// DEFENSE entry setup: pick the defenders (one per side, devil-aware), arm the
// turn timer, and the bot defender's templated argument. Operates on a Room with
// injected rng/now. Type-only import from rooms.ts keeps it cycle-free.
import type { Room, Defender, VoteChoice } from './rooms';
import {
  DEFENSE_MIN_MS,
  INTERVENTO_MIN_MS,
  DEFENSE_MAX_MS,
  INTERVENTI_MAX_MS,
  TURN_BOT_MS,
} from './phases';
import { botDefenseArgument } from './botDefense';
import * as devilAdvocate from './devilAdvocate';
import * as defenseTurns from './defenseTurns';

/** Set the turn's start + min/max timers based on whether the speaker is a bot. */
export function armTurn(room: Room, now: number): void {
  const interventi = room.phase === 'INTERVENTI';
  const speakerId = defenseTurns.currentSpeakerId(room);
  const speaker = speakerId ? room.players.get(speakerId) : undefined;
  room.turnStartedAt = now;
  if (speaker && !speaker.isBot) {
    room.turnMinEndsAt = now + (interventi ? INTERVENTO_MIN_MS : DEFENSE_MIN_MS);
    room.phaseExpiresAt = now + (interventi ? INTERVENTI_MAX_MS : DEFENSE_MAX_MS);
  } else {
    room.turnMinEndsAt = null;
    room.phaseExpiresAt = now + TURN_BOT_MS;
  }
}

/**
 * Auto-select one defender per side from that side's secret voters (side A before
 * B). A side with 0 votes is skipped. Among a side's voters the least-used defender
 * is chosen (fairness), ties broken by the injected rng. In the devil round each
 * defender argues the OPPOSITE side.
 */
export function selectDefenders(room: Room, rng: () => number): Defender[] {
  const devil = devilAdvocate.isDevilRound(room);
  const defenders: Defender[] = [];
  for (const side of ['A', 'B'] as const) {
    const voters = [...room.votes.entries()]
      .filter(([, choice]) => choice === side)
      .map(([id]) => id);
    if (voters.length === 0) continue; // side with no votes -> no defender
    const min = Math.min(...voters.map((id) => room.defenseCounts.get(id) ?? 0));
    const candidates = voters.filter((id) => (room.defenseCounts.get(id) ?? 0) === min);
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    const player = room.players.get(chosen);
    if (!player) continue;
    room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1);
    if (devil) {
      // "Avvocato del Diavolo": argue the OPPOSITE side. Everything downstream keys
      // off `side` = the side being argued, so no other code needs to know.
      const argued: VoteChoice = side === 'A' ? 'B' : 'A';
      defenders.push({ id: player.id, nickname: player.nickname, side: argued, devil: true });
    } else {
      defenders.push({ id: player.id, nickname: player.nickname, side });
    }
  }
  return defenders;
}

/** The canned argument for the current defender if a bot, else null (Fase B). */
export function argumentForCurrentDefender(room: Room, rng: () => number): string | null {
  const defender = room.defenders[room.defenseTurnIndex];
  if (!defender) return null;
  const player = room.players.get(defender.id);
  if (!player?.isBot || !player.persona || !room.currentDilemma) return null;
  return botDefenseArgument(player.persona, room.currentDilemma, defender.side, rng);
}
