// Round scoring: fold a just-finished round into each player's accumulating stats
// (participation, mind-changes, majority/minority, defender persuasion, prediction
// and swing-bet hits, peer orator votes, know-round reads, dilemma authorship).
// Operates on a Room; called once on entry to PHASE_RESULTS. Type-only imports
// from rooms.ts keep it cycle-free; tally/stats/lead-flip come from sibling modules.
import type { Room, VoteChoice, VoteTally } from './rooms';
import { tally } from './voteCount';
import { ensureStats } from './awards';
import { leadFlipped } from './predictions';

/**
 * Fold the just-finished round into each player's accumulating stats: who took
 * part, who changed their mind, who ended on the majority/minority side, and how
 * many votes each defender's side gained (persuasion). Called once on entry to
 * PHASE_RESULTS, while votes1 (first vote), votes (second) and defenders are still
 * intact for this round.
 */
export function recordRoundStats(room: Room): void {
  const first = tally(room.votes1);
  const second = tally(room.votes);
  const majoritySide: VoteChoice | null =
    second.A > second.B ? 'A' : second.B > second.A ? 'B' : null;
  // room.votes1 is a Map, which preserves insertion order — its first key is
  // whoever cast VOTE_1 first this round (the jolly ⚡ "Il Fulmine" award).
  const firstVoterId = room.votes1.keys().next().value;
  let roundSwitched = 0;
  for (const [id, firstChoice] of room.votes1) {
    const secondChoice = room.votes.get(id);
    if (!secondChoice) continue; // left before the second vote -> skip this round
    const s = ensureStats(room, id);
    s.rounds++;
    if (id === firstVoterId) s.firstToVoteCount = (s.firstToVoteCount ?? 0) + 1;
    if (secondChoice !== firstChoice) {
      s.changedCount++;
      roundSwitched++;
    }
    if (majoritySide) {
      if (secondChoice === majoritySide) s.majorityCount++;
      else s.minorityCount++;
    }
  }
  const netSwing: VoteTally = { A: second.A - first.A, B: second.B - first.B };
  for (const d of room.defenders) {
    const s = ensureStats(room, d.id);
    s.defendedCount++;
    if (netSwing[d.side] <= 0) continue;
    s.persuasion += netSwing[d.side];
    // In the "Avvocato del Diavolo" round, also bank it as devil persuasion (a
    // subset of persuasion) for the 🎭 Il Voltagabbana award.
    if (d.devil) s.devilPersuasion = (s.devilPersuasion ?? 0) + netSwing[d.side];
  }
  // Credit each predictor who called the post-defense majority (the second-vote
  // majority). On a tie there is no majority, so nobody scores.
  for (const [id, predicted] of room.predictions) {
    if (majoritySide && predicted === majoritySide) {
      const s = ensureStats(room, id);
      s.correctPredictions = (s.correctPredictions ?? 0) + 1;
    }
  }
  // Credit each swing bettor who correctly called whether the lead would change
  // ('ribalta' when it flipped, 'regge' when it held).
  const flipped = leadFlipped(room);
  // "L'Infiltrato col merito" (4.5): a round where the leading side flipped
  // scores for the infiltrator ONLY if they actively used their sabotage tool
  // this round — a passive lucky flip they had no hand in earns nothing.
  if (room.infiltratorId && flipped && room.infiltratoToolUsedThisRound) room.infiltratorFlips++;
  for (const [id, bet] of room.swingBets) {
    if ((bet === 'ribalta') === flipped) {
      const s = ensureStats(room, id);
      s.correctSwingBets = (s.correctSwingBets ?? 0) + 1;
    }
  }
  // Credit each defender with the peer "best speaker" votes they received.
  for (const defenderId of room.speakerVotes.values()) {
    const s = ensureStats(room, defenderId);
    s.oratorVotes = (s.oratorVotes ?? 0) + 1;
  }
  // Credit each "Quanto mi conosci" guesser who read their target's first vote
  // right (the 🔮 Il Telepate award).
  for (const [guesserId, guess] of room.knowGuesses) {
    const targetId = room.knowTargets.get(guesserId);
    const actual = targetId ? room.votes1.get(targetId) : undefined;
    if (actual && guess === actual) {
      const s = ensureStats(room, guesserId);
      s.knowCorrect = (s.knowCorrect ?? 0) + 1;
    }
  }
  // Credit the author of a player-written dilemma with the minds it changed this
  // round (the ✍️ L'Autore award).
  const dilemmaId = room.currentDilemma?.id;
  if (dilemmaId && roundSwitched > 0) {
    const authorId = room.dilemmaAuthors.get(dilemmaId);
    if (authorId) {
      const s = ensureStats(room, authorId);
      s.authoredSwing = (s.authoredSwing ?? 0) + roundSwitched;
    }
  }
  // Credit the author with how close to 50/50 their dilemma's final split
  // landed — the 🎯 Spacca la Stanza award (5.2), rewarding controversial,
  // well-balanced dilemmas over safe unanimous ones. Keeps their BEST split
  // across every one of their dilemmas played this game.
  if (dilemmaId) {
    const authorId = room.dilemmaAuthors.get(dilemmaId);
    const total = second.A + second.B;
    if (authorId && total > 0) {
      const balance = Math.min(second.A, second.B) / total;
      const s = ensureStats(room, authorId);
      if (s.authoredBestBalance == null || balance > s.authoredBestBalance) {
        s.authoredBestBalance = balance;
      }
    }
  }
}
