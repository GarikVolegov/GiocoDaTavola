import type { ReactNode } from 'react';
import { PHASE_LABELS, type DefenseState, type Reaction } from '../../shared/events';
import { formatMSS } from '../../shared/time';
import ReactionSwarm from '../../shared/ReactionSwarm';
import ReactionBar from './ReactionBar';
import { wrap } from './layout';

interface DefenseDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface DefenseViewProps {
  phase: 'DEFENSE' | 'INTERVENTI';
  defense: DefenseState | null;
  dilemma: DefenseDilemma | null | undefined;
  isDevilRound: boolean;
  playerId: string | null;
  handRaised: boolean;
  canFinishNow: boolean;
  minRemaining: number | null;
  remaining: number | null;
  speakerElapsed: number | null;
  onFinish: () => void;
  onToggleHand: () => void;
  onReact: (emoji: Reaction) => void;
  skipButton: ReactNode;
}

// The phone's defense/interventi turn screen. Presentational: the parent owns the
// raised-hand state, the turn timers, and the socket emits.
export default function DefenseView({
  phase,
  defense: d,
  dilemma,
  isDevilRound,
  playerId,
  handRaised,
  canFinishNow,
  minRemaining,
  remaining,
  speakerElapsed,
  onFinish,
  onToggleHand,
  onReact,
  skipButton,
}: DefenseViewProps) {
  const speaker = d?.speaker ?? null; // the defender (DEFENSE only)
  const myTurn = d?.speakerId != null && d.speakerId === playerId;
  const sideOption = speaker
    ? speaker.side === 'A'
      ? dilemma?.optionA
      : dilemma?.optionB
    : undefined;
  const myQueuePos = d?.queue ? d.queue.findIndex((q) => q.id === playerId) : -1;

  const finishButton = (
    <>
      <button
        type="button"
        onClick={onFinish}
        disabled={!canFinishNow}
        style={{
          fontSize: '1.2rem',
          fontWeight: 800,
          padding: '0.9rem 1.6rem',
          borderRadius: '0.9rem',
          border: 'none',
          cursor: canFinishNow ? 'pointer' : 'not-allowed',
          opacity: canFinishNow ? 1 : 0.5,
        }}
      >
        {canFinishNow ? 'Ho finito ▶' : `Ho finito tra ${minRemaining ?? ''}s`}
      </button>
      {remaining != null && (
        <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>max {remaining}s</p>
      )}
    </>
  );

  return (
    <main style={wrap}>
      <ReactionSwarm />
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS[phase]}</h1>

      {myTurn ? (
        <>
          {phase === 'INTERVENTI' ? (
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te: intervieni! 🙋</p>
          ) : speaker?.devil ? (
            <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#ffd36b' }}>
              🎭 Avvocato del Diavolo!
            </p>
          ) : (
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
          )}

          {phase === 'DEFENSE' && speaker && (
            <>
              {dilemma && (
                <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
                  {dilemma.text}
                </p>
              )}
              {speaker.devil ? (
                <p style={{ fontSize: '1.1rem', opacity: 0.95, margin: 0, maxWidth: '22rem' }}>
                  Hai votato <strong>{speaker.side === 'A' ? 'B' : 'A'}</strong>, ma ora convinci tutti
                  che <strong>{speaker.side}</strong>
                  {sideOption ? ` (${sideOption})` : ''} è la scelta giusta!
                </p>
              ) : (
                <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
                  Difendi <strong>{speaker.side}</strong>
                  {sideOption ? `: ${sideOption}` : ''}
                </p>
              )}
              {d?.spunti && d.spunti.length > 0 && (
                <div style={{ width: 'min(90vw, 22rem)', textAlign: 'left' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.8, margin: '0 0 0.3rem' }}>
                    Spunti per te:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {d.spunti.map((s, i) => (
                      <li key={`${i}-${s}`} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {d?.startedAt != null && (
            <div
              aria-label="Tempo trascorso"
              style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMSS(speakerElapsed ?? 0)}
            </div>
          )}
          {finishButton}
        </>
      ) : speaker == null && phase === 'DEFENSE' ? (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>
          Nessuna difesa per questo dilemma.
        </p>
      ) : (
        <>
          {phase === 'DEFENSE' && isDevilRound && (
            <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#ffd36b' }}>
              🎭 Round Avvocato del Diavolo — difende il contrario!
            </p>
          )}
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            {phase === 'INTERVENTI' ? (
              <>Interviene <strong>{d?.intervenor?.nickname ?? '…'}</strong> 🙋</>
            ) : (
              <>Sta parlando <strong>{speaker?.nickname ?? '…'}</strong> 🎤</>
            )}
          </p>

          {phase === 'DEFENSE' && d?.speakerId != null && (
            <button
              type="button"
              onClick={onToggleHand}
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                padding: '0.7rem 1.3rem',
                borderRadius: '0.8rem',
                border: handRaised ? '2px solid #ffd36b' : '2px solid rgba(255,255,255,0.3)',
                background: handRaised ? 'rgba(255,211,107,0.18)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              {handRaised ? '✋ Abbassa la mano' : '✋ Alza la mano'}
            </button>
          )}
          {phase === 'INTERVENTI' && myQueuePos >= 0 && (
            <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0 }}>
              Sei in coda: {myQueuePos + 1}º
            </p>
          )}

          <ReactionBar onReact={onReact} />
        </>
      )}
      {skipButton}
    </main>
  );
}
