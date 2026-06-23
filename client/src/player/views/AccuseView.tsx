import { PHASE_LABELS, type PublicPlayer } from '../../shared/events';
import { VoteOption } from '../../shared/ui';
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
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 'min(90vw, 22rem)' }}
      >
        {candidates.map((p) => (
          <VoteOption
            key={p.id}
            faction="accent"
            label={`${p.nickname}${p.isBot ? ' 🤖' : ''}`}
            selected={myAccusation === p.id}
            onClick={() => onAccuse(p.id)}
          />
        ))}
      </div>
      {myAccusation ? (
        <p style={{ opacity: 0.8, margin: 0 }}>Accusa registrata. Vediamo chi era… 👀</p>
      ) : (
        <p style={{ opacity: 0.7, margin: 0 }}>Tocca chi sospetti.</p>
      )}
    </main>
  );
}
