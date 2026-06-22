import type { ReactNode } from 'react';
import { PHASE_LABELS, type KnowPair, type VoteChoice, type SwingBet } from '../../shared/events';
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
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
        >
          {(['A', 'B'] as const).map((letter) => {
            const selected = knowGuess === letter;
            const accent = letter === 'A' ? '79,140,255' : '255,140,79';
            return (
              <button
                key={letter}
                type="button"
                onClick={() => onKnowGuess(letter)}
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
                <span style={{ fontSize: '1.6rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
                <span style={{ fontSize: '1.1rem' }}>
                  {dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
                </span>
              </button>
            );
          })}
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
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(90vw, 22rem)' }}
      >
        {(['A', 'B'] as const).map((letter) => {
          const selected = predicted === letter;
          const accent = letter === 'A' ? '84,134,196' : '199,122,69';
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onPredict(letter)}
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
              <span style={{ fontSize: '1.6rem', fontWeight: 800, opacity: 0.85 }}>{letter}</span>
              <span style={{ fontSize: '1.1rem' }}>
                {dilemma ? (letter === 'A' ? dilemma.optionA : dilemma.optionB) : letter}
              </span>
            </button>
          );
        })}
      </div>
      {predicted ? (
        <p style={{ opacity: 0.8, margin: 0 }}>
          Hai pronosticato <strong>{predicted}</strong>. Vediamo se indovini!
        </p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Scegli chi pensi convincerà di più.</p>
      )}
      <div
        role="group"
        aria-label="La tua scommessa sul ribaltone"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 'min(90vw, 22rem)' }}
      >
        <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.5rem 0 0' }}>🎰 Ci sarà un ribaltone?</p>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {(
            [
              ['regge', 'REGGE', 'La maggioranza tiene'],
              ['ribalta', 'RIBALTA', 'La maggioranza cambia'],
            ] as const
          ).map(([value, label, hint]) => {
            const selected = swingBet === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSwingBet(value)}
                aria-pressed={selected}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                  padding: '0.75rem 0.6rem',
                  borderRadius: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: 'inherit',
                  background: selected ? 'rgba(168,130,255,0.32)' : 'rgba(168,130,255,0.12)',
                  border: `2px solid rgba(168,130,255,${selected ? 0.9 : 0.4})`,
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>{label}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.8 }}>{hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      {skipButton}
    </main>
  );
}
