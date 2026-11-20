import { useEffect, useState, type ReactNode } from 'react';
import { PHASE_LABELS, type GhigliottinaStatePayload } from '../../shared/events';
import { Button, Card, TextInput } from '../../shared/ui';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';

interface GhigliottinaViewProps {
  phase: 'GHIGLIOTTINA' | 'GHIGLIOTTINA_REVEAL';
  state: GhigliottinaStatePayload | null | undefined;
  submittedGuess: string | null;
  onSubmit: (guess: string, usedChoices: boolean) => void;
  skipButton: ReactNode;
}

export default function GhigliottinaView({
  phase,
  state,
  submittedGuess,
  onSubmit,
  skipButton,
}: GhigliottinaViewProps) {
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    setFreeText('');
  }, [state?.puzzleId]);

  if (!state) return null;

  if (phase === 'GHIGLIOTTINA_REVEAL') {
    return (
      <MobilePhaseShell title={`🔗 ${PHASE_LABELS.GHIGLIOTTINA_REVEAL}`} dock={skipButton}>
        <Card
          glow="accent"
          style={{
            width: '100%',
            padding: '1rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold)', letterSpacing: '0.08em' }}>
            La parola che collega tutto è
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24', letterSpacing: '0.04em' }}>
            {state.answer}
          </div>
          {state.connections && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left', marginTop: '0.25rem' }}>
              {state.clues.map((clue, idx) => (
                <div
                  key={clue}
                  style={{
                    fontSize: '0.84rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <strong>{clue}</strong>
                  <span style={{ opacity: 0.85, textAlign: 'right' }}>{state.connections?.[idx]}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {state.results && state.results.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {state.results.map((r) => (
              <Card
                key={r.playerId}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: r.correct ? 'rgba(52, 211, 153, 0.55)' : undefined,
                  background: r.correct ? 'rgba(16, 185, 129, 0.14)' : undefined,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{r.nickname}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.78 }}>{r.guess}</div>
                </div>
                <span style={{ fontWeight: 800, color: r.correct ? '#34d399' : '#fda4af', fontSize: '0.88rem' }}>
                  {r.correct ? `+${r.pointsAwarded} pt` : '✗'}
                </span>
              </Card>
            ))}
          </div>
        )}
      </MobilePhaseShell>
    );
  }

  const isSolo = state.totalPlayers <= 1;
  const dock = (
    <>
      <p style={{ opacity: 0.72, margin: 0, fontSize: '0.85rem' }}>
        {isSolo
          ? 'Scegli 1 parola tra le 4 oppure scrivila tu per +150 pt!'
          : state.missingNicknames.length > 0
            ? `Aspettiamo ${formatWaitingList(state.missingNicknames)}…`
            : `Pronti ${state.submittedCount}/${state.totalPlayers}`}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={`🔗 ${PHASE_LABELS.GHIGLIOTTINA}`} dock={dock}>
      <Card style={{ width: '100%', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
          Cosa collega queste 5 parole?
        </div>
        {state.clues.map((clue) => (
          <div
            key={clue}
            style={{
              padding: '0.42rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(251, 191, 36, 0.28)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '0.98rem',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}
          >
            {clue}
          </div>
        ))}
      </Card>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, textAlign: 'center' }}>
          🎯 Scelta rapida (+100 pt)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '0.5rem',
            width: '100%',
          }}
          role="group"
          aria-label="Opzioni La Ghigliottina"
        >
          {state.choices.map((choice) => {
            const isSel = submittedGuess?.toUpperCase() === choice.toUpperCase();
            return (
              <Button
                key={choice}
                type="button"
                variant={isSel ? 'primary' : 'ghost'}
                onClick={() => {
                  vibrateTick();
                  onSubmit(choice, true);
                }}
                style={{ fontWeight: 800 }}
              >
                {choice}
              </Button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!freeText.trim()) return;
            vibrateWarning();
            onSubmit(freeText.trim(), false);
          }}
          style={{ display: 'flex', gap: '0.45rem', marginTop: '0.2rem' }}
        >
          <TextInput
            aria-label="Oppure scrivi la parola (+150 pt)"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value.toUpperCase())}
            placeholder="Colpo da +150 pt..."
            autoComplete="off"
            autoCapitalize="characters"
            style={{ flex: 1 }}
          />
          <Button type="submit" variant="primary" disabled={!freeText.trim()}>
            Invia ✓
          </Button>
        </form>
        {submittedGuess && (
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9, textAlign: 'center' }}>
            Risposta inviata: <strong>{submittedGuess}</strong> ✓
          </p>
        )}
      </div>
    </MobilePhaseShell>
  );
}
