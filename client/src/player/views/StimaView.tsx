import { useEffect, useState, type ReactNode } from 'react';
import { PHASE_LABELS, type StimaStatePayload } from '../../shared/events';
import { Button, Card } from '../../shared/ui';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';

interface StimaViewProps {
  phase: 'STIMA_GUESS' | 'STIMA_REVEAL';
  state: StimaStatePayload | null | undefined;
  submittedValue: number | null;
  onSubmit: (value: number) => void;
  skipButton: ReactNode;
}

export default function StimaView({
  phase,
  state,
  submittedValue,
  onSubmit,
  skipButton,
}: StimaViewProps) {
  const midpoint = state ? state.min + Math.round((state.max - state.min) / 2 / state.step) * state.step : 0;
  const [draft, setDraft] = useState<number>(submittedValue ?? midpoint);

  useEffect(() => {
    if (!state) return;
    setDraft(submittedValue ?? (state.min + Math.round((state.max - state.min) / 2 / state.step) * state.step));
  }, [state?.questionId, state?.min, state?.max, state?.step, submittedValue]);

  if (!state) return null;

  if (phase === 'STIMA_REVEAL') {
    return (
      <MobilePhaseShell title={`💰 ${PHASE_LABELS.STIMA_REVEAL}`} dock={skipButton}>
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, opacity: 0.92 }}>
          {state.prompt}
        </p>

        <Card glow="accent" style={{ width: '100%', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold)', letterSpacing: '0.08em' }}>
            Valore Reale
          </div>
          <div style={{ fontSize: '2.35rem', fontWeight: 900, color: '#34d399', lineHeight: 1.1 }}>
            {state.answer} <span style={{ fontSize: '1rem', opacity: 0.8 }}>{state.unit}</span>
          </div>
          {typeof state.soloPrecisionPct === 'number' && (
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fbbf24' }}>
              🎯 Precisione: {state.soloPrecisionPct}%
            </div>
          )}
          {state.funFact && (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.86rem', opacity: 0.9, lineHeight: 1.35 }}>
              {state.funFact}
            </p>
          )}
        </Card>

        {state.results && state.results.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {state.results.map((r, idx) => (
              <Card
                key={r.playerId}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: r.isWinner ? 'rgba(251, 191, 36, 0.65)' : undefined,
                  background: r.isWinner ? 'rgba(251, 191, 36, 0.14)' : undefined,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    {idx === 0 ? '🏆 ' : ''}
                    {r.nickname}
                  </div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                    Stima: {r.guess} {state.unit} (scarto {r.diff})
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: r.pointsAwarded > 0 ? '#fbbf24' : 'rgba(255,255,255,0.45)' }}>
                  {r.pointsAwarded > 0 ? `+${r.pointsAwarded} pt` : '—'}
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
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          vibrateWarning();
          onSubmit(draft);
        }}
        style={{ width: '100%' }}
      >
        {submittedValue != null ? `Aggiorna stima (${draft} ${state.unit}) ✓` : `Blocca ${draft} ${state.unit} ▶`}
      </Button>
      <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>
        {isSolo
          ? 'Trascina lo slider e scopri quanto ci sei andato vicino'
          : state.missingNicknames.length > 0
            ? `Aspettiamo ${formatWaitingList(state.missingNicknames)}…`
            : `Stime bloccate ${state.submittedCount}/${state.totalPlayers}`}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={`💰 ${PHASE_LABELS.STIMA_GUESS}`} dock={dock}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0, lineHeight: 1.25 }}>
        {state.prompt}
      </p>

      <Card glow="accent" style={{ width: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
          {draft}{' '}
          <span style={{ fontSize: '0.95rem', opacity: 0.75, fontWeight: 700 }}>{state.unit}</span>
        </div>

        <input
          type="range"
          aria-label="Stima numerica"
          min={state.min}
          max={state.max}
          step={state.step}
          value={draft}
          onChange={(e) => {
            vibrateTick();
            setDraft(Number(e.target.value));
          }}
          style={{ width: '100%', accentColor: '#fbbf24', height: '2.2rem', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.78rem', opacity: 0.72 }}>
          <span>{state.min} {state.unit}</span>
          <span>{state.max} {state.unit}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <Button
            type="button"
            variant="ghost"
            style={{ flex: 1 }}
            onClick={() => {
              vibrateTick();
              setDraft((v) => Math.max(state.min, v - state.step));
            }}
          >
            − {state.step}
          </Button>
          <Button
            type="button"
            variant="ghost"
            style={{ flex: 1 }}
            onClick={() => {
              vibrateTick();
              setDraft((v) => Math.min(state.max, v + state.step));
            }}
          >
            + {state.step}
          </Button>
        </div>
      </Card>
    </MobilePhaseShell>
  );
}
