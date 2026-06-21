import { HOW_TO_PLAY } from '../../shared/events';
import styles from '../Landing.module.css';

const TITLES = ['Voti A o B', 'Si difende', 'Si rivota'];

// 3-step explainer; the short body lines come from the shared HOW_TO_PLAY copy.
export default function HowToPlay() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="come">
      <p className={styles.kicker}>Come si gioca</p>
      <h2 className={styles.h2}>Tre mosse, mille discussioni</h2>
      <div className={styles.steps}>
        {HOW_TO_PLAY.map((line, i) => (
          <div className={styles.step} key={TITLES[i]}>
            <div className={styles.stepN}>{i + 1}</div>
            <h3>{TITLES[i]}</h3>
            <p>{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
