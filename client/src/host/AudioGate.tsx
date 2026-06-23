import styles from './AudioGate.module.css';

// Browsers block audio until a user gesture. /host is a passive TV screen, so the host
// might never click it — leaving the musichetta + effects silent forever. This overlay
// makes activation explicit and unmissable: one tap unlocks the audio (and plays a
// confirmation sound), then it disappears. Host-only.
export function AudioGate({ onActivate }: { onActivate: () => void }) {
  return (
    <div
      className={styles.overlay}
      role="button"
      tabIndex={0}
      aria-label="Attiva l'audio"
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          🔊
        </span>
        <p className={styles.text}>Tocca per attivare l'audio</p>
        <p className={styles.hint}>musica di sottofondo ed effetti sonori</p>
      </div>
    </div>
  );
}
