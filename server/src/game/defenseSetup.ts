// DEFENSE entry setup: pick the defenders (one per side, devil-aware), arm the
// turn timer, and the bot defender's templated argument. Operates on a Room with
// injected rng/now. Type-only import from rooms.ts keeps it cycle-free.
import type { Room, Defender, VoteChoice } from './rooms';
import { TURN_BOT_MS } from './phases';
import { countGiocatori, rulesForGiocatoriCount } from './ruleset';
import { botDefenseArgument } from './botDefense';
import * as devilAdvocate from './devilAdvocate';
import * as defenseTurns from './defenseTurns';

/** Set the turn's start + bot timer based on whether the speaker is a bot.
 * Human speakers have no minimum floor and no countdown limit ("Ho finito ▶"
 * is enabled immediately); bots/disconnected speakers use TURN_BOT_MS. */
export function armTurn(room: Room, now: number): void {
  const speakerId = defenseTurns.currentSpeakerId(room);
  const speaker = speakerId ? room.players.get(speakerId) : undefined;
  room.turnStartedAt = now;
  room.turnReactionTally = {};
  // Each new turn is a fresh sabotage opportunity (4.5) — the decoy from the
  // PREVIOUS speaker's turn doesn't carry over.
  room.infiltratoDecoySpunto = null;
  if (speaker && !speaker.isBot && speaker.connected !== false) {
    room.turnMinEndsAt = null;
    room.phaseExpiresAt = null;
  } else {
    room.turnMinEndsAt = null;
    room.phaseExpiresAt = now + TURN_BOT_MS;
  }
}

/**
 * Auto-select one defender per side from that side's secret voters (side A
 * before B), or TWO per side ("a coppie", 3.3) once the room has
 * DEFENSE_COPPIE_THRESHOLD+ giocatori — more of a larger group gets stage
 * time, still bounded. A side with 0 votes is skipped. Among a side's voters
 * the least-used defender is chosen (fairness, no repeats within the side),
 * ties broken by the injected rng. In the devil round each defender argues
 * the OPPOSITE side.
 */
export function selectDefenders(room: Room, rng: () => number): Defender[] {
  const devil = devilAdvocate.isDevilRound(room);
  const invertSide = devil || room.currentTwist?.id === 'avvocato-opposto';
  // The "doppio-difensore" twist (4.3) forces pairs regardless of group size.
  const perSide =
    room.currentTwist?.id === 'doppio-difensore'
      ? 2
      : rulesForGiocatoriCount(countGiocatori(room.players.values())).defendersPerSide;
  const defenders: Defender[] = [];
  for (const side of ['A', 'B'] as const) {
    const pool = [...room.votes.entries()]
      .filter(([, choice]) => choice === side)
      .map(([id]) => id)
      .filter((id) => room.players.get(id)?.connected !== false)
      .filter((id) => room.players.get(id)?.role !== 'pubblico'); // 3.1: never on stage
    if (pool.length === 0) continue; // side with no votes -> no defender
    for (let i = 0; i < perSide && pool.length > 0; i++) {
      const min = Math.min(...pool.map((id) => room.defenseCounts.get(id) ?? 0));
      const candidates = pool.filter((id) => (room.defenseCounts.get(id) ?? 0) === min);
      const chosen = candidates[Math.floor(rng() * candidates.length)];
      pool.splice(pool.indexOf(chosen), 1); // never pick the same person twice for this side
      const player = room.players.get(chosen);
      if (!player) continue;
      room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1);
      if (invertSide) {
        // "Avvocato del Diavolo" / "avvocato-opposto": argue the OPPOSITE side.
        const argued: VoteChoice = side === 'A' ? 'B' : 'A';
        defenders.push({ id: player.id, nickname: player.nickname, side: argued, devil: devil || undefined });
      } else {
        defenders.push({ id: player.id, nickname: player.nickname, side });
      }
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
