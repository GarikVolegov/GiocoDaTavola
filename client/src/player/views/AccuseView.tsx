import { PHASE_LABELS, type PublicPlayer } from '../../shared/events';
import { wrap } from './layout';

interface AccuseViewProps {
  candidates: PublicPlayer[]; // already filtered to exclude the viewer
  remaining: number | null;
  myAccusation: string | null;
  onAccuse: (accusedId: string) => void;
}

// The phone's "who is the infiltrator?" screen (ACCUSE). Presentational: the
// parent owns the accusation state and the socket emit.
export default function AccuseView({ candidates, remaining, myAccusation, onAccuse }: AccuseViewProps) {
  return (
    <main style={wrap}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{PHASE_LABELS.ACCUSE}</h1>
      <p style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, maxWidth: '22rem' }}>
        🕵️ Chi ha cercato di ribaltare il gruppo?
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
        aria-label="La tua accusa"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 'min(90vw, 22rem)' }}
      >
        {candidates.map((p) => {
          const selected = myAccusation === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onAccuse(p.id)}
              aria-pressed={selected}
              style={{
                padding: '0.9rem 1.1rem',
                borderRadius: '0.8rem',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1.05rem',
                color: 'inherit',
                textAlign: 'left',
                background: selected ? 'rgba(168,130,255,0.32)' : 'rgba(168,130,255,0.12)',
                border: `2px solid rgba(168,130,255,${selected ? 0.9 : 0.4})`,
              }}
            >
              {p.nickname}
              {p.isBot ? ' 🤖' : ''}
            </button>
          );
        })}
      </div>
      {myAccusation ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Accusa registrata. Vediamo chi era… 👀</p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Tocca chi sospetti.</p>
      )}
    </main>
  );
}
