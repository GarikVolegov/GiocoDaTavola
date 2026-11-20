import type { ReactNode } from 'react';
import {
  PHASE_LABELS,
  type GroupMindQuestion,
  type SoloFeedbackPayload,
  type VoteChoice,
} from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';
import { vibrateTick } from '../../shared/haptics';

interface GroupMindViewProps {
  question: GroupMindQuestion | null;
  remaining?: number | null;
  answer: VoteChoice | null;
  guess: VoteChoice | null;
  onAnswer: (choice: VoteChoice) => void;
  onGuess: (choice: VoteChoice) => void;
  progress: { done: number; total: number; missingNicknames: string[] } | null;
  isSolo?: boolean;
  lastSoloFeedback?: SoloFeedbackPayload | null;
  skipButton: ReactNode;
}

// The phone's GROUP_MIND screen ("La Mente del Gruppo", 4.1): everyone answers
// their own take AND predicts what the group's majority will answer, in one
// combined submission (both parent-driven emits fire together once both are
// picked). Presentational — the parent owns state and socket emits.
export default function GroupMindView({
  question,
  remaining: _remaining = null,
  answer,
  guess,
  onAnswer,
  onGuess,
  progress,
  isSolo = false,
  lastSoloFeedback = null,
  skipButton,
}: GroupMindViewProps) {
  const dock = isSolo ? (
    <>
      <p style={{ opacity: 0.72, margin: 0, fontSize: '0.88rem' }}>
        1 tocco · Avanza subito
      </p>
      {skipButton}
    </>
  ) : (
    <>
      {answer && guess ? (
        <p style={{ opacity: 0.85, margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>
          Fatto! Vediamo chi legge meglio il gruppo. 🔮
        </p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0, fontSize: '0.88rem' }}>
          Rispondi ed indovina, poi aspetta gli altri.
        </p>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>
        {progress && progress.missingNicknames.length > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames)}…`
          : progress
            ? `Hanno risposto ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell
      title={isSolo ? '🪞 Domanda Lampo' : `🧠 ${PHASE_LABELS.GROUP_MIND}`}
      dock={dock}
    >
      {isSolo && lastSoloFeedback && (
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.35rem 0.7rem',
            borderRadius: '999px',
            background: 'rgba(251, 191, 36, 0.14)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            color: '#fde68a',
            textAlign: 'center',
            maxWidth: 'min(90vw, 22rem)',
          }}
        >
          🧭 Scelta precedente: «{lastSoloFeedback.chosenLabel}» · {lastSoloFeedback.crowdPct}% come te
        </div>
      )}
      {question && (
        <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>{question.prompt}</p>
      )}
      <div
        role="group"
        aria-label="La tua risposta"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}
      >
        <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
          {isSolo ? 'Scegli con 1 tocco:' : 'Tu, sinceramente:'}
        </p>
        {(['A', 'B'] as const).map((letter) => (
          <VoteOption
            key={letter}
            faction={letter === 'A' ? 'a' : 'b'}
            label={question ? (letter === 'A' ? question.optionA : question.optionB) : letter === 'A' ? 'Prima scelta' : 'Seconda scelta'}
            selected={answer === letter}
            onClick={() => {
              vibrateTick();
              onAnswer(letter);
            }}
            centered
          />
        ))}
      </div>
      {!isSolo && (
        <div
          role="group"
          aria-label="La tua previsione sulla maggioranza"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}
        >
          <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>Cosa risponderà la maggioranza del gruppo?</p>
          {(['A', 'B'] as const).map((letter) => (
            <VoteOption
              key={letter}
              faction="accent"
              label={question ? (letter === 'A' ? question.optionA : question.optionB) : letter === 'A' ? 'Prima scelta' : 'Seconda scelta'}
              selected={guess === letter}
              onClick={() => {
                vibrateTick();
                onGuess(letter);
              }}
              centered
            />
          ))}
        </div>
      )}
    </MobilePhaseShell>
  );
}
