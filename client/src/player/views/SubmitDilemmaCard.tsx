import { useState } from 'react';
import { MAX_SUBMISSIONS_PER_PLAYER } from '../../shared/events';
import { Card, Button, Alert, TextInput } from '../../shared/ui';

interface SubmitDilemmaCardProps {
  submittedCount: number;
  mySubmitted: number;
  maxSubmissions?: number;
  isSignedIn?: boolean;
  text: string;
  optionA: string;
  optionB: string;
  onTextChange: (v: string) => void;
  onOptionAChange: (v: string) => void;
  onOptionBChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
}

// The lobby card where any player can add up to MAX_SUBMISSIONS_PER_PLAYER of
// their own dilemmas (they enter the game first). Collapsible by default so the
// lobby stays compact on mobile and desktop.
export default function SubmitDilemmaCard({
  submittedCount,
  mySubmitted,
  maxSubmissions = MAX_SUBMISSIONS_PER_PLAYER,
  isSignedIn = false,
  text,
  optionA,
  optionB,
  onTextChange,
  onOptionAChange,
  onOptionBChange,
  onSubmit,
  error,
}: SubmitDilemmaCardProps) {
  const [open, setOpen] = useState(false);
  const canSubmit =
    mySubmitted < maxSubmissions &&
    text.trim() !== '' &&
    optionA.trim() !== '' &&
    optionB.trim() !== '';

  return (
    <Card
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: open ? 'var(--space-2)' : 0,
        padding: '0.6rem 0.85rem',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          minHeight: '2.75rem',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
          ✍️ Aggiungi un dilemma
        </span>
        <span style={{ fontSize: '0.78rem', opacity: 0.72, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          {submittedCount > 0 ? `${submittedCount} dal gruppo` : 'Opzionale'}
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </span>
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: '0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75 }}>
            I vostri dilemmi entrano in gioco per primi · {submittedCount} dal gruppo
          </p>
          {mySubmitted >= maxSubmissions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ margin: 0, fontWeight: 700, opacity: 0.9 }}>
                Hai aggiunto {mySubmitted} dilemmi. Grazie! 🙌
              </p>
              {!isSignedIn && (
                <a href="/accedi" style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 700 }}>
                  Accedi gratis per sbloccare fino a 5 dilemmi →
                </a>
              )}
            </div>
          ) : (
            <>
              <TextInput
                id="dilemma-question"
                name="dilemmaQuestion"
                aria-label="La domanda"
                placeholder="La domanda (es. Mare o montagna?)"
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
              />
              <TextInput
                id="dilemma-option-a"
                name="dilemmaOptionA"
                aria-label="Prima scelta"
                placeholder="Prima scelta"
                value={optionA}
                onChange={(e) => onOptionAChange(e.target.value)}
              />
              <TextInput
                id="dilemma-option-b"
                name="dilemmaOptionB"
                aria-label="Seconda scelta"
                placeholder="Seconda scelta"
                value={optionB}
                onChange={(e) => onOptionBChange(e.target.value)}
              />
              <Button variant="ghost" onClick={onSubmit} disabled={!canSubmit}>
                Aggiungi dilemma{mySubmitted > 0 ? ` (${mySubmitted}/${maxSubmissions})` : ''}
              </Button>
              {error && <Alert>{error}</Alert>}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
