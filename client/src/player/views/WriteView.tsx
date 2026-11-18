import type { ReactNode } from 'react';
import { PHASE_LABELS, type WritePrompt } from '../../shared/events';
import { Button, TextInput } from '../../shared/ui';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';
import { vibrateTick } from '../../shared/haptics';

interface WriteViewProps {
  prompt: WritePrompt | null;
  remaining: number | null;
  text: string;
  submitted: string | null;
  onTextChange: (v: string) => void;
  onSubmit: () => void;
  progress: { done: number; total: number; missingNicknames: string[] } | null;
  skipButton: ReactNode;
}

// The phone's WRITE screen ("In Altre Parole", 4.2): everyone writes a short
// answer to the same prompt in parallel, then votes anonymously in the next
// phase. Presentational — the parent owns the draft state and socket emit.
export default function WriteView({ prompt, remaining, text, submitted, onTextChange, onSubmit, progress, skipButton }: WriteViewProps) {
  const dock = (
    <>
      {!submitted && (
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            vibrateTick();
            onSubmit();
          }}
          disabled={text.trim() === ''}
          style={{ width: '100%' }}
        >
          Invia
        </Button>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.85rem' }}>
        {progress && (progress.missingNicknames?.length ?? 0) > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames ?? [])}…`
          : progress
            ? `Hanno scritto ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={`✍️ ${PHASE_LABELS.WRITE}`} remaining={remaining} dock={dock}>
      {prompt && (
        <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, maxWidth: '22rem', lineHeight: 1.35 }}>{prompt.text}</p>
      )}
      {submitted ? (
        <p style={{ opacity: 0.85, margin: 0 }}>Hai scritto: <strong>{submitted}</strong></p>
      ) : (
        <TextInput
          aria-label="La tua risposta"
          placeholder="Scrivi qui…"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          style={{ width: '100%' }}
        />
      )}
    </MobilePhaseShell>
  );
}
