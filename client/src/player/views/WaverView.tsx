import type { ReactNode } from 'react';
import { PHASE_LABELS } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { wrap } from './layout';

interface WaverViewProps {
  partnerNickname: string;
  /** The Atto III twist caps the rating at 1 (the 🤯 is a real flip's business). */
  twist: boolean;
  /** The devil's advocate has nothing to rate — they wait for the verdict. */
  isAdvocate: boolean;
  remaining: number | null;
  rating: 0 | 1 | 2 | null;
  onRate: (rating: 0 | 1 | 2) => void;
  waverCount: number;
  skipButton: ReactNode;
}

const RATING_META: Array<{ value: 0 | 1 | 2; emoji: string; label: string }> = [
  { value: 0, emoji: '😐', label: 'Nemmeno un po’' },
  { value: 1, emoji: '🤔', label: 'Un po’, lo ammetto' },
  { value: 2, emoji: '🤯', label: 'Mi ha quasi convinto' },
];

// Percorso in 2 (DUO_WAVER): the secret "ti ha fatto vacillare?" rating of the
// partner's arringa. Presentational: the parent owns the emit + echo state.
export default function WaverView({
  partnerNickname,
  twist,
  isAdvocate,
  remaining,
  rating,
  onRate,
  waverCount,
  skipButton,
}: WaverViewProps) {
  const choices = twist ? RATING_META.slice(0, 2) : RATING_META;
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.DUO_WAVER}</h1>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {isAdvocate ? (
        <>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Arringa consegnata 🎭
          </p>
          <p style={{ opacity: 0.75, margin: 0 }}>
            Ora {partnerNickname} decide quanto l'hai fatto vacillare…
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>
            L'arringa di <strong>{partnerNickname}</strong>: quanto ti ha smosso? (Voto segreto)
          </p>
          <div
            role="group"
            aria-label="Ti ha fatto vacillare?"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}
          >
            {choices.map((c) => (
              <VoteOption
                key={c.value}
                faction="accent"
                label={`${c.emoji} ${c.label}`}
                selected={rating === c.value}
                onClick={() => onRate(c.value)}
                centered
              />
            ))}
          </div>
          {rating != null ? (
            <p style={{ fontWeight: 800, margin: 0 }}>✓ Registrato — puoi cambiare finché c'è tempo</p>
          ) : (
            <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
              Sii onesto: i punti vanno a chi argomenta bene.
            </p>
          )}
        </>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>Voti segreti arrivati: {waverCount}</p>
      {skipButton}
    </main>
  );
}
