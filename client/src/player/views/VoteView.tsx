import type { ReactNode } from 'react';
import { PHASE_LABELS, type VoteChoice } from '../../shared/events';
import { Button, VoteOption, Alert } from '../../shared/ui';
import { wrap } from './layout';

type VotePhase = 'VOTE_1' | 'VOTE_2' | 'DUEL_PICK' | 'DUEL_REPICK';

interface VoteDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface VoteViewProps {
  phase: VotePhase;
  dilemma: VoteDilemma | null | undefined;
  remaining: number | null;
  vote: VoteChoice | null;
  voteError: string | null;
  onVote: (choice: VoteChoice) => void;
  onConfirm: () => void;
  confirmedCount: number;
  playerCount: number;
  skipButton: ReactNode;
}

// The phone's voting screen (first vote, second vote, and the duel pick/repick).
// Purely presentational: the parent owns the vote state and the socket emits.
export default function VoteView({
  phase,
  dilemma,
  remaining,
  vote,
  voteError,
  onVote,
  onConfirm,
  confirmedCount,
  playerCount,
  skipButton,
}: VoteViewProps) {
  // VOTE_2 / DUEL_REPICK keep the player's first choice as the default they can
  // keep or change; the sub-line nudges them per phase.
  const subtitle =
    phase === 'VOTE_2'
      ? 'Hai sentito le difese: confermi o cambi idea?'
      : phase === 'DUEL_PICK'
        ? 'Scegli la tua posizione.'
        : phase === 'DUEL_REPICK'
          ? 'Ti ha convinto? Conferma o cambia.'
          : null;
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>
      {subtitle && (
        <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0 }}>{subtitle}</p>
      )}
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {dilemma && (
        <p style={{ fontSize: '1.1rem', opacity: 0.85, margin: 0 }}>{dilemma.text}</p>
      )}
      <div
        role="group"
        aria-label="Il tuo voto"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
      >
        {(['A', 'B'] as const).map((letter) => (
          <VoteOption
            key={letter}
            faction={letter === 'A' ? 'a' : 'b'}
            letter={letter}
            label={dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
            selected={vote === letter}
            onClick={() => onVote(letter)}
          />
        ))}
      </div>
      {voteError ? (
        <Alert>{voteError}</Alert>
      ) : vote ? (
        <p style={{ opacity: 0.8, margin: 0 }}>
          Hai votato <strong>{vote}</strong>. Puoi cambiare finché c’è tempo.
        </p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Tocca A o B per votare.</p>
      )}
      {phase === 'VOTE_2' && (
        <>
          <Button variant="primary" onClick={onConfirm} style={{ marginTop: '0.25rem' }}>
            Confermo ✓
          </Button>
          <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
            Confermati {confirmedCount}/{playerCount} · si va avanti quando tutti confermano
          </p>
        </>
      )}
      {skipButton}
    </main>
  );
}
