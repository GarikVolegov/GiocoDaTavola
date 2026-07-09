// DEFENSE entry setup: pick the defenders (one per side, devil-aware), arm the
// turn timer, and the bot defender's templated argument. Operates on a Room with
// injected rng/now. Type-only import from rooms.ts keeps it cycle-free.
import type { Room, Defender, VoteChoice } from './rooms';
import { DEFENSE_MIN_MS, INTERVENTO_MIN_MS, INTERVENTI_MAX_MS, TURN_BOT_MS } from './phases';
import { countGiocatori, rulesForGiocatoriCount } from './ruleset';
import { botDefenseArgument } from './botDefense';
import { TWIST_DEFENSE_LAMPO_MS } from './twists';
import * as devilAdvocate from './devilAdvocate';
import * as defenseTurns from './defenseTurns';

/** Set the turn's start + min/max timers based on whether the speaker is a bot.
 * Also resets the live per-emoji applause tally for the new turn — the caller
 * is responsible for snapshotting the PREVIOUS turn's tally (if any) into
 * `lastTurnApplause` before calling this, since by now the speaker has
 * already changed. The "difesa-lampo" twist (4.3) forces a hard 30s cap in
 * place of the room's normal budget, for this round only. */
export function armTurn(room: Room, now: number): void {
  const interventi = room.phase === 'INTERVENTI';
  const speakerId = defenseTurns.currentSpeakerId(room);
  const speaker = speakerId ? room.players.get(speakerId) : undefined;
  const defenseMax = room.currentTwist?.id === 'difesa-lampo' ? TWIST_DEFENSE_LAMPO_MS : room.defenseMaxMs;
  room.turnStartedAt = now;
  room.turnReactionTally = {};
  // Each new turn is a fresh sabotage opportunity (4.5) — the decoy from the
  // PREVIOUS speaker's turn doesn't carry over.
  room.infiltratoDecoySpunto = null;
  if (speaker && !speaker.isBot && speaker.connected !== false) {
    room.turnMinEndsAt = now + (interventi ? INTERVENTO_MIN_MS : DEFENSE_MIN_MS);
    room.phaseExpiresAt = now + (interventi ? INTERVENTI_MAX_MS : defenseMax);
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
      if (devil) {
        // "Avvocato del Diavolo": argue the OPPOSITE side. Everything downstream keys
        // off `side` = the side being argued, so no other code needs to know.
        const argued: VoteChoice = side === 'A' ? 'B' : 'A';
        defenders.push({ id: player.id, nickname: player.nickname, side: argued, devil: true });
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
