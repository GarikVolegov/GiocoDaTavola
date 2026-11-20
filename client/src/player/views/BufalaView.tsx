import type { ReactNode } from 'react';
import { PHASE_LABELS, type BufalaStatePayload } from '../../shared/events';
import { Card, VoteOption } from '../../shared/ui';
import { vibrateTick } from '../../shared/haptics';
import { formatWaitingList } from './layout';
import MobilePhaseShell from './MobilePhaseShell';

interface BufalaViewProps {
  phase: 'BUFALA_VOTE' | 'BUFALA_REVEAL';
  state: BufalaStatePayload | null | undefined;
  submittedVote: boolean | null;
  onVote: (vote: boolean) => void;
  skipButton: ReactNode;
}

export default function BufalaView({
  phase,
  state,
  submittedVote,
  onVote,
  skipButton,
}: BufalaViewProps) {
  if (!state) return null;

  if (phase === 'BUFALA_REVEAL') {
    const factIsTrue = Boolean(state.isTrue);
    return (
      <MobilePhaseShell title={`🎭 ${PHASE_LABELS.BUFALA_REVEAL}`} dock={skipButton}>
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
          {state.statement}
        </p>

        <Card
          glow="accent"
          style={{
            width: '100%',
            padding: '1rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            borderColor: factIsTrue ? '#34d399' : '#f43f5e',
          }}
        >
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: factIsTrue ? '#34d399' : '#fda4af' }}>
            {factIsTrue ? '✅ È VERO!' : '🤡 È UNA BUFALA!'}
          </div>
          {state.explanation && (
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.92, lineHeight: 1.4 }}>
              {state.explanation}
            </p>
          )}
        </Card>

        {state.results && state.results.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {state.results.map((r) => (
              <Card
                key={r.playerId}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderColor: r.correct ? 'rgba(52, 211, 153, 0.55)' : undefined,
                  background: r.correct ? 'rgba(16, 185, 129, 0.14)' : undefined,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                  {r.nickname} · {r.vote ? 'Vero' : 'Bufala'}
                </span>
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
          ? '1 tocco · Scopri subito la verità'
          : state.missingNicknames.length > 0
            ? `Aspettiamo ${formatWaitingList(state.missingNicknames)}…`
            : `Risposte ${state.submittedCount}/${state.totalPlayers}`}
      </p>
      {skipButton}
    </>
  );

  return (
    <MobilePhaseShell title={`🎭 ${PHASE_LABELS.BUFALA_VOTE}`} dock={dock}>
      <span
        style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          padding: '0.22rem 0.65rem',
          borderRadius: '999px',
          background: 'rgba(251, 191, 36, 0.16)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          color: '#fde68a',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {state.category}
      </span>

      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.18rem', fontWeight: 800, margin: 0, lineHeight: 1.3, maxWidth: '24rem' }}>
        {state.statement}
      </p>

      <div
        role="group"
        aria-label="Vero o Bufala"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(92vw, 24rem)' }}
      >
        <VoteOption
          faction="a"
          label="✅ È VERO!"
          selected={submittedVote === true}
          onClick={() => {
            vibrateTick();
            onVote(true);
          }}
          centered
        />
        <VoteOption
          faction="b"
          label="🤡 È UNA BUFALA!"
          selected={submittedVote === false}
          onClick={() => {
            vibrateTick();
            onVote(false);
          }}
          centered
        />
      </div>
    </MobilePhaseShell>
  );
}
