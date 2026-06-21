import { AWARDS } from '../content';
import styles from '../Landing.module.css';

export default function Awards() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Cerimonia finale</p>
      <h2 className={styles.h2}>Premi per tutti, a modo loro</h2>
      <div className={styles.awards}>
        {AWARDS.map((a) => (
          <div className={styles.award} key={a.title}>
            <div className={styles.awardE}>{a.emoji}</div>
            <div className={styles.awardT}>{a.title}</div>
            <div className={styles.awardS}>{a.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
