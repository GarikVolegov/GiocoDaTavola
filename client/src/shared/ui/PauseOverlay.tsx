import { Button } from './Button';
import { Card } from './Card';
import styles from './PauseOverlay.module.css';

// Full-screen cover shown on /host and every phone while the leader has
// paused the game (menu ⋮ "Metti in pausa"). Sockets stay connected — this
// is a game-state overlay, not a disconnection. Only the leader gets the
// resume control; everyone else just waits.
export function PauseOverlay({ onResume }: { onResume?: () => void }) {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <Card glow="accent" className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          ⏸
        </span>
        <h2 className={styles.title}>Partita in pausa</h2>
        <p className={styles.hint}>
          {onResume ? 'Riprendi quando siete pronti.' : 'Riprende a breve — resta connesso.'}
        </p>
        {onResume && (
          <Button type="button" variant="primary" onClick={onResume}>
            ▶ Riprendi
          </Button>
        )}
      </Card>
    </div>
  );
}
