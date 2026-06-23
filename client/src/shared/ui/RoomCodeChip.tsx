import { JoinQr } from './JoinQr';
import styles from './RoomCodeChip.module.css';

// A compact corner chip for the shared screen (/host) shown DURING a game — the
// big code only appears in the lobby, so latecomers couldn't otherwise join
// mid-session. Code + a small branded join QR.
export function RoomCodeChip({ code }: { code: string }) {
  return (
    <aside className={styles.chip} aria-label={`Codice stanza ${code}`}>
      <span className={styles.label}>Entra</span>
      <span className={styles.code}>{code}</span>
      <JoinQr code={code} size={84} />
    </aside>
  );
}
