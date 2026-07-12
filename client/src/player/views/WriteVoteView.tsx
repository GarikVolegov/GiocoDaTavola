import type { ReactNode } from 'react';
import { PHASE_LABELS, type PublicWrittenAnswer, type WritePrompt } from '../../shared/events';
import { wrap, formatWaitingList } from './layout';

interface WriteVoteViewProps {
  prompt: WritePrompt | null;
  remaining: number | null;
  /** The anonymized list with the viewer's own answer already excluded. */
  answers: PublicWrittenAnswer[];
  /** Each answer's `id` is an opaque per-round token (its position in the
   * shuffled order), not a real player id — see writeRound.ts. */
  votedForToken: string | null;
  onVote: (token: string) => void;
  progress: { done: number; total: number; missingNicknames: string[] } | null;
  skipButton: ReactNode;
}

// The phone's WRITE_VOTE screen: everyone's answers, shuffled and anonymous —
// tap your favorite (never your own, already filtered out by the parent).
// Presentational — the parent owns state and the socket emit.
export default function WriteVoteView({ prompt, remaining, answers, votedForToken, onVote, progress, skipButton }: WriteVoteViewProps) {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>🗳️ {PHASE_LABELS.WRITE_VOTE}</h1>
      {prompt && (
        <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, maxWidth: '22rem', opacity: 0.85 }}>{prompt.text}</p>
      )}
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      <div
        role="group"
        aria-label="Vota la tua preferita"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 24rem)' }}
      >
        {answers.length === 0 ? (
          <p style={{ opacity: 0.7, margin: 0 }}>Nessun'altra risposta da votare stavolta.</p>
        ) : (
          answers.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={votedForToken === a.id}
              onClick={() => onVote(a.id)}
              style={{
                textAlign: 'center',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: votedForToken === a.id ? '2px solid var(--gold, currentColor)' : '1px solid var(--border-strong, currentColor)',
                background: 'var(--surface, transparent)',
                color: 'inherit',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              {a.text}
            </button>
          ))
        )}
      </div>
      {votedForToken ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Hai votato. Vediamo chi vince! 🏆</p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Tocca la tua preferita.</p>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        {progress && progress.missingNicknames.length > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames)}…`
          : progress
            ? `Hanno votato ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </main>
  );
}
