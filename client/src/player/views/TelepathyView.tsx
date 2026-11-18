import type { ReactNode } from 'react';
import {
  PHASE_LABELS,
  type TelepathyPromptPayload,
  type TelepathyRevealPayload,
} from '../../shared/events';
import { Button, Card, TextInput } from '../../shared/ui';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';

interface TelepathyViewProps {
  phase: 'TELEPATHY' | 'TELEPATHY_REVEAL';
  prompt: TelepathyPromptPayload | null | undefined;
  progress: { done: number; total: number; missingNicknames: string[] } | null | undefined;
  reveal: TelepathyRevealPayload | null | undefined;
  remaining: number | null;
  text: string;
  submitted: string | null;
  onTextChange: (v: string) => void;
  onSubmit: () => void;
  skipButton: ReactNode;
}

/**
 * "Telepatia" phone view: everyone writes ONE word silently without talking.
 * Anyone matching the exact same word scores synthesis points together!
 */
export default function TelepathyView({
  phase,
  prompt,
  progress,
  reveal,
  remaining,
  text,
  submitted,
  onTextChange,
  onSubmit,
  skipButton,
}: TelepathyViewProps) {
  if (phase === 'TELEPATHY_REVEAL' && reveal) {
    return (
      <MobilePhaseShell
        title={`🧠 ${PHASE_LABELS.TELEPATHY_REVEAL}`}
        remaining={remaining}
        dock={skipButton}
      >
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
          {reveal.prompt.prompt}
        </p>

        <Card glow={reveal.syncedCount > 0 ? 'accent' : undefined} style={{ width: '100%', padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72 }}>
            Menti allineate
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: reveal.syncedCount > 0 ? '#34d399' : 'var(--gold)' }}>
            {reveal.syncedCount}/{reveal.totalPlayers}
          </div>
        </Card>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {reveal.clusters.map((cluster) => {
            const synced = cluster.nicknames.length >= 2;
            return (
              <Card
                key={cluster.word}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  borderColor: synced ? 'rgba(52, 211, 153, 0.55)' : undefined,
                  background: synced ? 'rgba(16, 185, 129, 0.14)' : undefined,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.02rem' }}>{cluster.word}</div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.78 }}>{cluster.nicknames.join(', ')}</div>
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: synced ? '#34d399' : 'rgba(255,255,255,0.45)' }}>
                  {synced ? `+${cluster.pointsPerPlayer} pt` : 'Solo'}
                </span>
              </Card>
            );
          })}
        </div>
      </MobilePhaseShell>
    );
  }

  const normalized = text.trim();
  const dock = (
    <>
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          vibrateWarning();
          onSubmit();
        }}
        disabled={normalized === ''}
        style={{ width: '100%' }}
      >
        {submitted ? 'Aggiorna parola ✓' : 'Invia in silenzio ▶'}
      </Button>
      <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
        {progress && (progress.missingNicknames?.length ?? 0) > 0
          ? `Aspettiamo ${formatWaitingList(progress.missingNicknames ?? [])}…`
          : progress
            ? `Pronti ${progress.done}/${progress.total}`
            : null}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={`🧠 ${PHASE_LABELS.TELEPATHY}`} remaining={remaining} dock={dock}>
      <Card style={{ width: '100%', padding: '0.9rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gold)' }}>
          🤫 Vietato parlare · Una sola parola
        </div>
        <p style={{ margin: '0.4rem 0 0', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.3 }}>
          {prompt?.prompt ?? 'Scrivi la prima parola che ti viene in mente!'}
        </p>
      </Card>

      <TextInput
        aria-label="La tua parola segreta"
        autoComplete="off"
        placeholder="Una sola parola…"
        value={text}
        onChange={(e) => {
          vibrateTick();
          onTextChange(e.target.value);
        }}
        style={{ width: '100%' }}
      />

      {submitted && (
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.88 }}>
          Parola bloccata: <strong>{submitted}</strong> ✓
        </p>
      )}
    </MobilePhaseShell>
  );
}
