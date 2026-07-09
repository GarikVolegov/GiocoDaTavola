import type { ReactNode } from 'react';
import { PHASE_LABELS, type GroupMindQuestion, type VoteChoice } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { wrap, formatWaitingList } from './layout';

interface GroupMindViewProps {
  question: GroupMindQuestion | null;
  remaining: number | null;
  answer: VoteChoice | null;
  guess: VoteChoice | null;
  onAnswer: (choice: VoteChoice) => void;
  onGuess: (choice: VoteChoice) => void;
  progress: { done: number; total: number; missingNicknames: string[] } | null;
  skipButton: ReactNode;
}

// The phone's GROUP_MIND screen ("La Mente del Gruppo", 4.1): everyone answers
// their own take AND predicts what the group's majority will answer, in one
// combined submission (both parent-driven emits fire together once both are
// picked). Presentational — the parent owns state and socket emits.
export default function GroupMindView({
  question,
  remaining,
  answer,
  guess,
  onAnswer,
  onGuess,
  progress,
  skipButton,
}: GroupMindViewProps) {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>🧠 {PHASE_LABELS.GROUP_MIND}</h1>
      {question && (
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>{question.prompt}</p>
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
        aria-label="La tua risposta"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>Tu, sinceramente:</p>
        {(['A', 'B'] as const).map((letter) => (
          <VoteOption
            key={letter}
            faction={letter === 'A' ? 'a' : 'b'}
            letter={letter}
            label={question ? (letter === 'A' ? question.optionA : question.optionB) : letter}
            selected={answer === letter}
            onClick={() => onAnswer(letter)}
            centered
          />
        ))}
      </div>
      <div
        role="group"
        aria-label="La tua previsione sulla maggioranza"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>Cosa risponderà la maggioranza del gruppo?</p>
        {(['A', 'B'] as const).map((letter) => (
          <VoteOption
            key={letter}
            faction="accent"
            letter={letter}
            label={question ? (letter === 'A' ? question.optionA : question.optionB) : letter}
            selected={guess === letter}
            onClick={() => onGuess(letter)}
            centered
          />
        ))}
      </div>
      {answer && guess ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Fatto! Vediamo chi legge meglio il gruppo. 🔮</p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Rispondi ed indovina, poi aspetta gli altri.</p>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        {progress && progress.missingNicknames.length > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames)}…`
          : progress
            ? `Hanno risposto ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </main>
  );
}
