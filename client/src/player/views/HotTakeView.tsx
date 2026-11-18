import { useEffect, useState, type ReactNode } from 'react';
import {
  PHASE_LABELS,
  type HotTakePromptPayload,
  type HotTakeRevealPayload,
} from '../../shared/events';
import { Button, Card } from '../../shared/ui';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';
import MobilePhaseShell from './MobilePhaseShell';
import { formatWaitingList } from './layout';

interface HotTakeViewProps {
  phase: 'HOT_TAKE_VOTE' | 'HOT_TAKE_REVEAL';
  prompt: HotTakePromptPayload | null | undefined;
  reveal: HotTakeRevealPayload | null | undefined;
  remaining?: number | null;
  myScore: number | null;
  submittedCount: number;
  playerCount: number;
  missingHotTakers: string[] | null | undefined;
  onSubmitScore: (score: number) => void;
  skipButton: ReactNode;
}

export default function HotTakeView({
  phase,
  prompt,
  reveal,
  remaining: _remaining = null,
  myScore,
  submittedCount,
  playerCount,
  missingHotTakers,
  onSubmitScore,
  skipButton,
}: HotTakeViewProps) {
  const [draft, setDraft] = useState<number>(myScore ?? 5);
  useEffect(() => {
    setDraft(myScore ?? 5);
  }, [prompt?.id, prompt?.text, myScore]);
  const activeScore = myScore ?? draft;

  if (phase === 'HOT_TAKE_REVEAL' && reveal) {
    return (
      <MobilePhaseShell
        title={PHASE_LABELS.HOT_TAKE_REVEAL}
        dock={skipButton}
      >
        <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, opacity: 0.92 }}>
          {reveal.prompt.text}
        </p>

        <Card glow="accent" style={{ width: '100%', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>
            Media del gruppo
          </div>
          <div style={{ fontSize: '2.75rem', fontWeight: 900, color: 'var(--gold)', lineHeight: 1.1 }}>
            {reveal.average.toFixed(1)} <span style={{ fontSize: '1.1rem', opacity: 0.6 }}>/ 10</span>
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '0.25rem' }}>
            Distanza tra estremi: {reveal.spread} punti
          </div>
        </Card>

        {reveal.lowest && reveal.highest && reveal.lowest.playerId !== reveal.highest.playerId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%' }}>
            <Card style={{ padding: '0.85rem', borderColor: 'var(--faction-a-line)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--faction-a)', textTransform: 'uppercase' }}>
                ❄️ Più Freddo
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '0.25rem' }}>
                {reveal.lowest.nickname}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--faction-a)' }}>
                {reveal.lowest.score}/10
              </div>
            </Card>

            <Card style={{ padding: '0.85rem', borderColor: 'var(--faction-b-line)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--faction-b)', textTransform: 'uppercase' }}>
                🔥 Più Caldo
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '0.25rem' }}>
                {reveal.highest.nickname}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--faction-b)' }}>
                {reveal.highest.score}/10
              </div>
            </Card>
          </div>
        )}

        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
          🗣️ I due estremi si giustificano dal vivo!
        </p>
      </MobilePhaseShell>
    );
  }

  const dock = (
    <>
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          vibrateWarning();
          onSubmitScore(activeScore);
        }}
        style={{ width: '100%' }}
      >
        {myScore != null ? `Aggiorna voto (${activeScore}/10) ✓` : `Invia ${activeScore}/10 ▶`}
      </Button>
      {missingHotTakers && missingHotTakers.length > 0 ? (
        <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
          Aspettiamo {formatWaitingList(missingHotTakers)}…
        </p>
      ) : (
        <p style={{ opacity: 0.65, margin: 0, fontSize: '0.85rem' }}>
          Votato {submittedCount}/{playerCount}
        </p>
      )}
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell
      title={PHASE_LABELS.HOT_TAKE_VOTE}
      dock={dock}
    >
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.18rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 'var(--tracking-display, 0.03em)', margin: 0, lineHeight: 1.25 }}>
        {prompt?.text ?? 'Quanto sei d’accordo?'}
      </p>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div
          style={{
            fontSize: '3rem',
            fontWeight: 900,
            fontFamily: 'var(--font-display)',
            color:
              activeScore <= 3
                ? 'var(--faction-a)'
                : activeScore >= 8
                  ? 'var(--faction-b)'
                  : 'var(--gold)',
            lineHeight: 1,
          }}
        >
          {activeScore}
          <span style={{ fontSize: '1.1rem', opacity: 0.5 }}> / 10</span>
        </div>

        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={activeScore}
          aria-label="Scala da 1 a 10"
          onChange={(e) => {
            const val = Number(e.target.value);
            setDraft(val);
            vibrateTick();
          }}
          style={{ width: '100%', accentColor: 'var(--gold)', height: '2.2rem', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.7 }}>
          <span>❄️ 1 · Mai nella vita</span>
          <span>10 · 100% sì 🔥</span>
        </div>

        <div
          role="group"
          aria-label="Scegli punteggio rapido"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem', width: '100%' }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const selected = activeScore === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setDraft(n);
                  vibrateTick();
                  onSubmitScore(n);
                }}
                style={{
                  minHeight: '3rem',
                  borderRadius: 'var(--radius-md)',
                  border: selected ? '2px solid var(--gold)' : '1px solid var(--border-strong)',
                  background: selected ? 'var(--gold-soft)' : 'var(--surface-2)',
                  color: selected ? 'var(--gold)' : 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </MobilePhaseShell>
  );
}
