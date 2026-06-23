import type { ReactNode } from 'react';
import { PHASE_LABELS, type KnowPair, type VoteChoice, type SwingBet } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
import { wrap } from './layout';

interface PredictDilemma {
  text: string;
  optionA: string;
  optionB: string;
}

interface PredictViewProps {
  dilemma: PredictDilemma | null | undefined;
  knowPair: KnowPair | null; // the viewer's "quanto mi conosci" assignment, if any
  remaining: number | null;
  predicted: VoteChoice | null;
  swingBet: SwingBet | null;
  knowGuess: VoteChoice | null;
  onPredict: (choice: VoteChoice) => void;
  onSwingBet: (bet: SwingBet) => void;
  onKnowGuess: (choice: VoteChoice) => void;
  predictedCount: number;
  playerCount: number;
  skipButton: ReactNode;
}

// The phone's PREDICT screen. Two flavours: a private "quanto mi conosci" guess
// (when the player has an assignment), otherwise the post-defense prediction + the
// swing bet. Presentational: the parent owns state and socket emits.
export default function PredictView({
  dilemma,
  knowPair,
  remaining,
  predicted,
  swingBet,
  knowGuess,
  onPredict,
  onSwingBet,
  onKnowGuess,
  predictedCount,
  playerCount,
  skipButton,
}: PredictViewProps) {
  if (knowPair) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>🔮 Quanto mi conosci</h1>
        <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
          Come ha votato <strong>{knowPair.targetNickname}</strong>?
        </p>
        {dilemma && (
          <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: 0, maxWidth: '22rem' }}>{dilemma.text}</p>
        )}
        {remaining != null && (
          <div
            aria-label="Tempo rimanente"
            style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {remaining}s
          </div>
        )}
        <div
          role="group"
          aria-label="La tua ipotesi"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 'min(90vw, 22rem)' }}
        >
          {(['A', 'B'] as const).map((letter) => (
            <VoteOption
              key={letter}
              faction={letter === 'A' ? 'a' : 'b'}
              letter={letter}
              label={dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
              selected={knowGuess === letter}
              onClick={() => onKnowGuess(letter)}
            />
          ))}
        </div>
        {knowGuess ? (
          <p style={{ opacity: 0.8, margin: 0 }}>
            Hai scelto <strong>{knowGuess}</strong>. Conosci bene {knowPair.targetNickname}? 👀
          </p>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Indovina come ha votato.</p>
        )}
      </main>
    );
  }
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.PREDICT}</h1>
      <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
        Chi vincerà <em>dopo</em> le difese?
      </p>
      {remaining != null && (
        <div
          aria-label="Tempo rimanente"
          style={{ fontSize: '2.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
        >
          {remaining}s
        </div>
      )}
      <div
        role="group"
        aria-label="Il tuo pronostico"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 'min(90vw, 22rem)' }}
      >
        {(['A', 'B'] as const).map((letter) => (
          <VoteOption
            key={letter}
            faction={letter === 'A' ? 'a' : 'b'}
            letter={letter}
            label={dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
            selected={predicted === letter}
            onClick={() => onPredict(letter)}
          />
        ))}
      </div>
      {predicted ? (
        <p style={{ opacity: 0.8, margin: 0 }}>
          Hai pronosticato <strong>{predicted}</strong>. Vediamo se indovini!
        </p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Scegli chi pensi convincerà di più.</p>
      )}
      <p style={{ opacity: 0.6, margin: 0, fontSize: '0.9rem' }}>
        Hanno pronosticato {predictedCount}/{playerCount}
      </p>
      <div
        role="group"
        aria-label="La tua scommessa sul ribaltone"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.5rem 0 0' }}>🎰 Ci sarà un ribaltone?</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(
            [
              ['regge', 'REGGE', 'La maggioranza tiene'],
              ['ribalta', 'RIBALTA', 'La maggioranza cambia'],
            ] as const
          ).map(([value, label, hint]) => (
            <VoteOption
              key={value}
              faction="accent"
              centered
              fill
              label={label}
              hint={hint}
              selected={swingBet === value}
              onClick={() => onSwingBet(value)}
            />
          ))}
        </div>
        {swingBet && (
          <p style={{ opacity: 0.8, margin: 0, fontSize: '0.95rem' }}>
            Hai scommesso: la maggioranza <strong>{swingBet === 'regge' ? 'regge' : 'ribalta'}</strong>.
          </p>
        )}
      </div>
      {skipButton}
    </main>
  );
}
