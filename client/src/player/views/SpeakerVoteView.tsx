import type { ReactNode } from 'react';
import { PHASE_LABELS, type Defender } from '../../shared/events';
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
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
        >
          {candidates.map((d) => {
            const selected = speakerVote === d.id;
            const accent = d.side === 'A' ? '84,134,196' : '199,122,69';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onVote(d.id)}
                aria-pressed={selected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                  padding: '1rem 1.1rem',
                  borderRadius: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: 'inherit',
                  background: selected ? `rgba(${accent},0.32)` : `rgba(${accent},0.12)`,
                  border: `2px solid rgba(${accent},${selected ? 0.9 : 0.4})`,
                }}
              >
                <span style={{ fontSize: '1.4rem', fontWeight: 800, opacity: 0.85 }}>{d.side}</span>
                <span style={{ fontSize: '1.1rem' }}>{d.nickname}</span>
              </button>
            );
          })}
        </div>
      )}
      {speakerVote && (
        <p style={{ opacity: 0.8, margin: 0 }}>Voto registrato. Puoi cambiare finché c’è tempo.</p>
      )}
      {skipButton}
    </main>
  );
}
