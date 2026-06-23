import { REACTIONS, type Reaction } from '../../shared/events';

// A row of tap-to-send reaction emojis, shown to the audience during a defense /
// duel turn so non-speakers stay engaged. Throttled by the caller.
export default function ReactionBar({ onReact }: { onReact: (emoji: Reaction) => void }) {
  return (
    <div
      role="group"
      aria-label="Reagisci"
      style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          aria-label={`Reagisci ${emoji}`}
          style={{
            fontSize: '1.8rem',
            lineHeight: 1,
            padding: '0.55rem 0.7rem',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            color: 'inherit',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
