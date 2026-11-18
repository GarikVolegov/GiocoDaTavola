import type { ReactNode } from 'react';
import { PHASE_LABELS, REACTIONS, type Reaction, type TribunaleStatePayload } from '../../shared/events';
import { Button, Card, VoteOption } from '../../shared/ui';
import MobilePhaseShell from './MobilePhaseShell';

interface TribunaleViewProps {
  phase: 'TRIBUNALE_ARGUE' | 'TRIBUNALE_VOTE' | 'TRIBUNALE_REVEAL';
  state: TribunaleStatePayload | null | undefined;
  myId: string | null;
  isLeader?: boolean;
  turnRemaining?: number | null;
  phaseRemaining?: number | null;
  readingRemaining?: number | null;
  myVote: 'ACCUSA' | 'DIFESA' | null;
  onFinishTurn: () => void;
  onFinishReading?: () => void;
  onVote: (choice: 'ACCUSA' | 'DIFESA') => void;
  onReaction: (emoji: Reaction) => void;
  skipButton: ReactNode;
}

export default function TribunaleView({
  phase,
  state,
  myId,
  isLeader: _isLeader = false,
  turnRemaining: _turnRemaining = null,
  phaseRemaining: _phaseRemaining = null,
  readingRemaining: _readingRemaining = null,
  myVote,
  onFinishTurn,
  onFinishReading: _onFinishReading,
  onVote,
  onReaction,
  skipButton,
}: TribunaleViewProps) {
  if (!state) return null;

  const isAccusa = myId === state.accusaId;
  const isDifesa = myId === state.difesaId;
  const isContender = isAccusa || isDifesa;
  const isMyTurn = phase === 'TRIBUNALE_ARGUE' && myId === state.activeSpeakerId;

  if (phase === 'TRIBUNALE_REVEAL' && state.verdict) {
    const v = state.verdict;
    return (
      <MobilePhaseShell
        title={`⚖️ ${PHASE_LABELS.TRIBUNALE_REVEAL}`}
        dock={skipButton}
      >
        <Card
          glow="accent"
          style={{
            width: '100%',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>
            {state.caseData.title.toUpperCase()}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            {v.winner === 'TIE'
              ? '🤝 Patteggiamento!'
              : `🏆 Vince ${v.winnerNames.join(' & ')}!`}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {state.accusaName}: <strong>{v.accusaVotes}</strong> voti · {state.difesaName}:{' '}
            <strong>{v.difesaVotes}</strong> voti
          </div>
          {v.loserName && (
            <div
              style={{
                padding: '0.65rem',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.14)',
                border: '1px solid rgba(244, 63, 94, 0.45)',
                fontSize: '0.88rem',
              }}
            >
              <strong>🔨 Sentenza per {v.loserName}:</strong> {state.caseData.penalty}
            </div>
          )}
        </Card>
      </MobilePhaseShell>
    );
  }

  if (phase === 'TRIBUNALE_VOTE') {
    return (
      <MobilePhaseShell
        title={`⚖️ ${PHASE_LABELS.TRIBUNALE_VOTE}`}
        dock={skipButton}
      >
        <Card
          style={{
            width: '100%',
            padding: '0.95rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', textAlign: 'center' }}>
            {state.caseData.title.toUpperCase()}
          </div>
          <p style={{ margin: 0, fontSize: '0.92rem', textAlign: 'center' }}>{state.caseData.scenario}</p>

          {isContender ? (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                textAlign: 'center',
                fontSize: '0.9rem',
              }}
            >
              ⏳ La giuria sta votando ({state.votesCount}/{state.totalJurors})… incrocia le dita!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', color: 'var(--text-muted)' }}>
                Chi ti ha convinto di più?
              </div>
              <VoteOption
                faction="a"
                label={`⚔️ ${state.accusaName} — ${state.caseData.accusaRole.replace(/^Accusa:\s*/i, '')}`}
                selected={myVote === 'ACCUSA'}
                onClick={() => onVote('ACCUSA')}
              />
              <VoteOption
                faction="b"
                label={`🛡️ ${state.difesaName} — ${state.caseData.difesaRole.replace(/^Difesa:\s*/i, '')}`}
                selected={myVote === 'DIFESA'}
                onClick={() => onVote('DIFESA')}
              />
            </div>
          )}
        </Card>
      </MobilePhaseShell>
    );
  }

  // TRIBUNALE_ARGUE
  return (
    <MobilePhaseShell
      title={`⚖️ ${state.caseData.title}`}
      dock={skipButton}
    >
      <Card
        glow={isMyTurn ? 'accent' : undefined}
        style={{
          width: '100%',
          padding: '0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          borderColor: isMyTurn ? '#fbbf24' : undefined,
        }}
      >
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.4 }}>{state.caseData.scenario}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div
            style={{
              padding: '0.55rem',
              borderRadius: '10px',
              background: state.speakerIndex === 0 ? 'rgba(251, 191, 36, 0.16)' : 'rgba(255,255,255,0.05)',
              border: state.speakerIndex === 0 ? '1px solid #fbbf24' : '1px solid transparent',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ fontWeight: 800 }}>⚔️ {state.accusaName}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{state.caseData.accusaRole}</div>
          </div>
          <div
            style={{
              padding: '0.55rem',
              borderRadius: '10px',
              background: state.speakerIndex === 1 ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.05)',
              border: state.speakerIndex === 1 ? '1px solid #38bdf8' : '1px solid transparent',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ fontWeight: 800 }}>🛡️ {state.difesaName}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{state.caseData.difesaRole}</div>
          </div>
        </div>

        <div
          style={{
            padding: '0.55rem 0.7rem',
            borderRadius: '10px',
            background: isMyTurn ? 'rgba(251, 191, 36, 0.18)' : 'rgba(255,255,255,0.06)',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '0.92rem',
          }}
        >
          {isMyTurn
            ? '🎙️ TOCCA A TE DIFENDERTI!'
            : `🎙️ Parla ${state.activeSpeakerName}`}
        </div>

        {isMyTurn ? (
          <Button variant="primary" onClick={onFinishTurn}>
            Ho finito l’arringa ✓
          </Button>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction(emoji)}
                style={{
                  fontSize: '1.2rem',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </Card>
    </MobilePhaseShell>
  );
}
