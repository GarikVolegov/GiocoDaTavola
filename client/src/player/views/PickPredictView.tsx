import type { ReactNode } from 'react';
import { PHASE_LABELS, type VoteChoice } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { wrap } from './layout';

interface PickPredictDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface PickPredictViewProps {
  dilemma: PickPredictDilemma | null | undefined;
  partnerNickname: string;
  remaining: number | null;
  own: VoteChoice | null;
  predict: VoteChoice | null;
  synced: boolean;
  onOwn: (choice: VoteChoice) => void;
  onPredict: (choice: VoteChoice) => void;
  syncedCount: number;
  skipButton: ReactNode;
}

// Percorso in 2, Atto I (DUO_PICK_PREDICT): one screen, two secret selections —
// the player's own pick AND their prediction of the partner's. Presentational:
// the parent owns the state and emits the combined player:duoSync.
export default function PickPredictView({
  dilemma,
  partnerNickname,
  remaining,
  own,
  predict,
  synced,
  onOwn,
  onPredict,
  syncedCount,
  skipButton,
}: PickPredictViewProps) {
  const options = (selected: VoteChoice | null, onPick: (choice: VoteChoice) => void) =>
    (['A', 'B'] as const).map((letter) => (
      <VoteOption
        key={letter}
        faction={letter === 'A' ? 'a' : 'b'}
        letter={letter}
        label={dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
        selected={selected === letter}
        onClick={() => onPick(letter)}
        centered
      />
    ));
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.DUO_PICK_PREDICT}</h1>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      {dilemma && <p style={{ fontSize: '1.05rem', opacity: 0.85, margin: 0 }}>{dilemma.text}</p>}
      <div
        role="group"
        aria-label="La tua scelta"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>Tu cosa scegli?</p>
        {options(own, onOwn)}
      </div>
      <div
        role="group"
        aria-label={`Cosa sceglie ${partnerNickname}?`}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
          🔮 E {partnerNickname} cosa sceglie?
        </p>
        {options(predict, onPredict)}
      </div>
      {synced ? (
        <p style={{ fontWeight: 800, margin: 0 }}>✓ Inviato — puoi cambiare finché c'è tempo</p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
          Scegli il tuo lato e prevedi il suo: contano entrambi.
        </p>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>Hanno inviato {syncedCount}/2</p>
      {skipButton}
    </main>
  );
}
