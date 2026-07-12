import type { ReactNode } from 'react';
import { PHASE_LABELS, type DuoTurn, type Reaction } from '../../shared/events';
import { formatMSS } from '../../shared/time';
import { Button } from '../../shared/ui';
import ReactionBar from './ReactionBar';
import { wrap } from './layout';

interface DuoArgueDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface DuoArgueViewProps {
  speaker: DuoTurn['speaker'] | null | undefined;
  dilemma: DuoArgueDilemma | null | undefined;
  playerId: string | null;
  remaining: number | null;
  canFinishNow: boolean;
  minRemaining: number | null;
  speakerElapsed: number | null;
  onFinish: () => void;
  onReact: (emoji: Reaction) => void;
  skipButton: ReactNode;
}

// The Percorso in 2 speaking turn (DUO_ARGUE). The banner tells the arguer which
// side they defend — their own, the inverted one (Atto II), or the devil's-
// advocate one (Atto III twist). Presentational: the parent owns timers/emits.
export default function DuoArgueView({
  speaker,
  dilemma,
  playerId,
  remaining,
  canFinishNow,
  minRemaining,
  speakerElapsed,
  onFinish,
  onReact,
  skipButton,
}: DuoArgueViewProps) {
  const myTurn = speaker != null && speaker.id === playerId;
  const sideOption = speaker
    ? speaker.side === 'A'
      ? dilemma?.optionA
      : dilemma?.optionB
    : undefined;
  const roleBadge = speaker?.advocate ? (
    <p style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--gold, inherit)' }}>
      🎭 Avvocato del diavolo!
    </p>
  ) : speaker?.inverted ? (
    <p style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>🔄 A parti invertite!</p>
  ) : null;
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DUO_ARGUE}</h1>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {myTurn ? (
        <>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
          {roleBadge}
          {dilemma && (
            <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
              {dilemma.text}
            </p>
          )}
          <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
            Difendi <strong>{speaker.side}</strong>
            {sideOption ? `: ${sideOption}` : ''}
            {speaker.inverted || speaker.advocate ? ' (non è il tuo!)' : ''}
          </p>
          <div
            aria-label="Tempo trascorso"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMSS(speakerElapsed ?? 0)}
          </div>
          <Button variant="primary" size="lg" onClick={onFinish} disabled={!canFinishNow}>
            Ho finito ▶
          </Button>
          {!canFinishNow && (
            <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: 0 }}>
              Parla ancora {minRemaining ?? ''}s prima di poter passare
            </p>
          )}
        </>
      ) : speaker ? (
        <>
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            Sta argomentando <strong>{speaker.nickname}</strong> 🎤
          </p>
          {roleBadge}
          <p style={{ fontSize: '0.95rem', opacity: 0.75, margin: 0 }}>
            Ascolta bene: dopo dirai se ti ha fatto vacillare.
          </p>
          <ReactionBar onReact={onReact} />
        </>
      ) : (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>Un attimo…</p>
      )}
      {skipButton}
    </main>
  );
}
