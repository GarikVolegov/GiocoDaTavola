import type { ReactNode } from 'react';
import { PHASE_LABELS, type DuoTurn, type Reaction } from '../../shared/events';
import { Button, Card } from '../../shared/ui';
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
  remaining?: number | null;
  canFinishNow?: boolean;
  minRemaining?: number | null;
  speakerElapsed?: number | null;
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
  remaining: _remaining = null,
  canFinishNow: _canFinishNow = true,
  minRemaining: _minRemaining = null,
  speakerElapsed: _speakerElapsed = null,
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
      {myTurn ? (
        <>
          <Card
            glow={speaker.advocate ? 'accent' : speaker.side === 'A' ? 'a' : 'b'}
            style={{
              width: 'min(90vw, 24rem)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-4)',
            }}
          >
            <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Tocca a te! 🎤</p>
            {roleBadge}
            {dilemma && (
              <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
                {dilemma.text}
              </p>
            )}
            <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
              Difendi: <strong>{sideOption ?? 'la tua posizione'}</strong>
              {speaker.inverted || speaker.advocate ? ' (non è la tua!)' : ''}
            </p>
          </Card>
          <Button variant="primary" size="lg" onClick={onFinish}>
            Ho finito ▶
          </Button>
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
