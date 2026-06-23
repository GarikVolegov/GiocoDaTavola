import type { ReactNode } from 'react';
import { PHASE_LABELS, type Defender } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { wrap } from './layout';

interface SpeakerVoteViewProps {
  candidates: Defender[]; // already filtered to exclude the viewer
  remaining: number | null;
  speakerVote: string | null;
  onVote: (defenderId: string) => void;
  skipButton: ReactNode;
}

// The phone's "who was most convincing?" screen (SPEAKER_VOTE). Presentational:
// the parent owns the selection state and the socket emit.
export default function SpeakerVoteView({
  candidates,
  remaining,
  speakerVote,
  onVote,
  skipButton,
}: SpeakerVoteViewProps) {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.SPEAKER_VOTE}</h1>
      <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
        Chi è stato più convincente?
      </p>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {candidates.length === 0 ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Hai parlato tu: guarda lo schermo.</p>
      ) : (
        <div
          role="group"
          aria-label="Il tuo voto al miglior oratore"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 'min(90vw, 22rem)' }}
        >
          {candidates.map((d) => (
            <VoteOption
              key={d.id}
              faction={d.side === 'A' ? 'a' : 'b'}
              letter={d.side}
              label={d.nickname}
              selected={speakerVote === d.id}
              onClick={() => onVote(d.id)}
            />
          ))}
        </div>
      )}
      {speakerVote && (
        <p style={{ opacity: 0.8, margin: 0 }}>Voto registrato. Puoi cambiare finché c’è tempo.</p>
      )}
      {skipButton}
    </main>
  );
}
