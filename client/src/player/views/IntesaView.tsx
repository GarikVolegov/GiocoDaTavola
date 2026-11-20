import type { ReactNode } from 'react';
import {
  PHASE_LABELS,
  type IntesaSecretPayload,
  type IntesaStatePayload,
  type PublicPlayer,
} from '../../shared/events';
import { Button, Card } from '../../shared/ui';
import { vibrateTick, vibrateWarning } from '../../shared/haptics';
import MobilePhaseShell from './MobilePhaseShell';

interface IntesaViewProps {
  phase: 'INTESA_PLAY' | 'INTESA_REVEAL';
  state: IntesaStatePayload | null | undefined;
  secret: IntesaSecretPayload | null;
  myId: string | null;
  isLeader: boolean;
  players: PublicPlayer[];
  onResolve: (outcome: 'guessed' | 'taboo' | 'skipped', winnerId?: string | null) => void;
  skipButton: ReactNode;
}

export default function IntesaView({
  phase,
  state,
  secret,
  myId,
  isLeader,
  players,
  onResolve,
  skipButton,
}: IntesaViewProps) {
  if (!state) return null;

  if (phase === 'INTESA_REVEAL') {
    return (
      <MobilePhaseShell title={`🚫 ${PHASE_LABELS.INTESA_REVEAL}`} dock={skipButton}>
        <Card glow="accent" style={{ width: '100%', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            La parola segreta era
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24' }}>
            {state.word}
          </div>
          {state.forbidden && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
              {state.forbidden.map((fw) => (
                <span
                  key={fw}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: 'rgba(244, 63, 94, 0.16)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    color: '#fda4af',
                  }}
                >
                  🚫 {fw}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '0.25rem', color: state.outcome === 'guessed' ? '#34d399' : '#fda4af' }}>
            {state.outcome === 'guessed'
              ? state.winnerName
                ? `🎉 ${state.speakerName} & ${state.winnerName} in sintonia! (+100 pt)`
                : `🎉 Parola indovinata da ${state.speakerName}! (+100 pt)`
              : state.outcome === 'taboo'
                ? `🚨 Scivolone su parola vietata!`
                : '⏭️ Round saltato'}
          </div>
        </Card>
      </MobilePhaseShell>
    );
  }

  const isSpeaker = Boolean(myId && myId === state.speakerId);
  const canControl = isSpeaker || isLeader;
  const guessers = players.filter((p) => p.id !== state.speakerId);

  return (
    <MobilePhaseShell title={`🚫 ${PHASE_LABELS.INTESA_PLAY}`} dock={skipButton}>
      <Card
        glow={isSpeaker ? 'accent' : undefined}
        style={{
          width: '100%',
          padding: '0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          textAlign: 'center',
          borderColor: isSpeaker ? '#fbbf24' : undefined,
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#fde68a' }}>
          {state.category} · {isSpeaker ? '🎙️ TOCCA A TE DESCRIVERE!' : `🎙️ DESCRIVE ${state.speakerName.toUpperCase()}`}
        </div>

        {isSpeaker && secret ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.78 }}>
              Fai indovinare al tavolo senza dire queste 4 parole:
            </div>
            <div
              style={{
                padding: '0.7rem',
                borderRadius: '12px',
                background: 'rgba(251, 191, 36, 0.16)',
                border: '2px solid #fbbf24',
                fontSize: '1.7rem',
                fontWeight: 900,
                color: '#fef08a',
                letterSpacing: '0.04em',
              }}
            >
              {secret.word}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' }}>
              {secret.forbidden.map((fw) => (
                <div
                  key={fw}
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.18)',
                    border: '1px solid rgba(244, 63, 94, 0.45)',
                    color: '#fda4af',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                  }}
                >
                  🚫 {fw}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: '0.4rem 0', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.35 }}>
            Ascolta <strong>{state.speakerName}</strong> e urla la parola giusta prima che scivoli su una parola vietata!
          </p>
        )}
      </Card>

      {canControl && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, opacity: 0.85, textAlign: 'center' }}>
            Chi l’ha indovinata a voce? (+100 pt ciascuno)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem' }}>
            {guessers.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="primary"
                onClick={() => {
                  vibrateTick();
                  onResolve('guessed', p.id);
                }}
              >
                ✓ {p.nickname}
              </Button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.15rem' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                vibrateWarning();
                onResolve('taboo', null);
              }}
              style={{ borderColor: 'rgba(244, 63, 94, 0.45)', color: '#fda4af' }}
            >
              🚨 Parola vietata!
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                vibrateTick();
                onResolve('skipped', null);
              }}
            >
              ⏭️ Passo
            </Button>
          </div>
        </div>
      )}
    </MobilePhaseShell>
  );
}
