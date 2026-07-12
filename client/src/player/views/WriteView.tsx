import type { ReactNode } from 'react';
import { PHASE_LABELS, type WritePrompt } from '../../shared/events';
import { Button, TextInput } from '../../shared/ui';
import { wrap, formatWaitingList } from './layout';

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
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>✍️ {PHASE_LABELS.WRITE}</h1>
      {prompt && (
        <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>{prompt.text}</p>
      )}
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {submitted ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Hai scritto: <strong>{submitted}</strong></p>
      ) : (
        <>
          <TextInput
            aria-label="La tua risposta"
            placeholder="Scrivi qui…"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            style={{ width: 'min(90vw, 22rem)' }}
          />
          <Button variant="primary" onClick={onSubmit} disabled={text.trim() === ''}>
            Invia
          </Button>
        </>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        {progress && progress.missingNicknames.length > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames)}…`
          : progress
            ? `Hanno scritto ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </main>
  );
}
