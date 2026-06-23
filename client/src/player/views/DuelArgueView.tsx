import type { ReactNode } from 'react';
import { PHASE_LABELS, type VoteChoice, type Reaction } from '../../shared/events';
import ReactionBar from './ReactionBar';
import { wrap } from './layout';

interface DuelSpeaker {
  id: string;
  nickname: string;
  side: VoteChoice;
}

interface DuelDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface DuelArgueViewProps {
  speaker: DuelSpeaker | null | undefined;
  dilemma: DuelDilemma | null | undefined;
  playerId: string | null;
  remaining: number | null;
  onReact: (emoji: Reaction) => void;
  skipButton: ReactNode;
}

// The phone's 1v1 duel speaking turn (DUEL_ARGUE). Presentational: the parent
// owns the timer and the reaction emit.
export default function DuelArgueView({
  speaker,
  dilemma,
  playerId,
  remaining,
  onReact,
  skipButton,
}: DuelArgueViewProps) {
  const myTurn = speaker != null && speaker.id === playerId;
  const sideOption = speaker
    ? speaker.side === 'A'
      ? dilemma?.optionA
      : dilemma?.optionB
    : undefined;
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{PHASE_LABELS.DUEL_ARGUE}</h1>
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
          {dilemma && (
            <p style={{ fontSize: '1rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>
              {dilemma.text}
            </p>
          )}
          <p style={{ fontSize: '1.1rem', opacity: 0.9, margin: 0 }}>
            Argomenta <strong>{speaker.side}</strong>
            {sideOption ? `: ${sideOption}` : ''}
          </p>
        </>
      ) : speaker ? (
        <>
          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            Sta argomentando <strong>{speaker.nickname}</strong> 🎤
          </p>
          <ReactionBar onReact={onReact} />
        </>
      ) : (
        <p style={{ fontSize: '1.1rem', opacity: 0.8, margin: 0 }}>Guarda lo schermo condiviso.</p>
      )}
      {skipButton}
    </main>
  );
}
