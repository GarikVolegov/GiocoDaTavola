import { FEATURES } from '../content';
import styles from '../Landing.module.css';

export default function Features() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Perché ti piacerà</p>
      <h2 className={styles.h2}>Fatto per accendere il tavolo</h2>
      <div className={styles.feat}>
        {FEATURES.map((f) => (
          <div className={styles.card} key={f.title}>
            <div className={styles.cardIc}>{f.icon}</div>
            <div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
