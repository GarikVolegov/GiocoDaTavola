// "Quanto mi conosci" round logic, operating on a Room. Extracted from RoomStore
// so the know-round rules live in one focused place; RoomStore delegates after
// looking up the room. Type-only imports from rooms.ts keep this cycle-free.
import type { Room, KnowPair, KnowGuessOutcome, KnowGuessResult } from './rooms';

/** True when the current dilemma is the special "Quanto mi conosci" round. */
export function isKnowRound(room: Room): boolean {
  return room.knowRoundIndex !== null && room.dilemmaIndex === room.knowRoundIndex;
}

/** Record (or change) a guesser's guess of how their assigned target voted. */
export function knowGuess(room: Room, guesserId: string, choice: string): KnowGuessResult {
  if (room.phase !== 'PREDICT' || !isKnowRound(room)) return { ok: false, error: 'NOT_KNOW_PHASE' };
  if (!room.knowTargets.has(guesserId)) return { ok: false, error: 'NO_TARGET' };
  if (choice !== 'A' && choice !== 'B') return { ok: false, error: 'INVALID_CHOICE' };
  room.knowGuesses.set(guesserId, choice);
  return { ok: true, room };
}

/** How many guessers have guessed this round (aggregate only). */
export function knowGuessedCount(room: Room): number {
  return room.knowGuesses.size;
}

/** True once every guesser in the ring has guessed (used to end PREDICT early). */
export function allKnowGuessed(room: Room): boolean {
  const guessers = [...room.knowTargets.keys()];
  if (guessers.length === 0) return false;
  return guessers.every((id) => room.knowGuesses.has(id));
}

/**
 * The public guesser→target ring, revealed only during the "Quanto mi conosci"
 * round (PREDICT → PHASE_RESULTS) so phones know whom to read; null otherwise.
 * The ring itself is not secret (only the guesses + the actual votes are).
 */
export function publicKnowPairs(room: Room): KnowPair[] | null {
  if (!isKnowRound(room)) return null;
  const phaseOk =
    room.phase === 'PREDICT' || room.phase === 'DEFENSE' ||
    room.phase === 'VOTE_2' || room.phase === 'SPEAKER_VOTE' || room.phase === 'PHASE_RESULTS';
  if (!phaseOk) return null;
  return [...room.knowTargets].map(([guesserId, targetId]) => ({
    guesserId,
    guesserNickname: room.players.get(guesserId)?.nickname ?? '',
    targetId,
    targetNickname: room.players.get(targetId)?.nickname ?? '',
  }));
}

/**
 * Each guesser's own outcome for the just-finished know round, for the private
 * `player:knowGuessResult` emit at PHASE_RESULTS.
 */
export function knowGuessResults(room: Room): KnowGuessOutcome[] {
  return [...room.knowGuesses].map(([guesserId, guess]) => {
    const targetId = room.knowTargets.get(guesserId) ?? '';
    const actual = room.votes1.get(targetId) ?? null;
    return { guesserId, targetId, guess, actual, correct: actual != null && guess === actual };
  });
}
