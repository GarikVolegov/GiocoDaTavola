import { HOW_TO_PLAY } from '../../shared/events';
import styles from '../Landing.module.css';

const TITLES = ['Voti A o B', 'Si difende', 'Si rivota'];

function StepPreview({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className={styles.miniUi} aria-hidden="true">
        <div className={styles.miniUiHead}>
          <span className={styles.miniBadgeGold}>VOTO SEGRETO</span>
          <span className={styles.miniTimer}>0:12</span>
        </div>
        <div className={styles.miniVoteRow}>
          <span className={`${styles.miniVoteBtn} ${styles.miniVoteA}`}>A ✓</span>
          <span className={`${styles.miniVoteBtn} ${styles.miniVoteB}`}>B</span>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className={styles.miniUi} aria-hidden="true">
        <div className={styles.miniSpeakerRow}>
          <span className={styles.miniMic}>🎤</span>
          <div className={styles.miniSpeakerText}>
            <span className={styles.miniSpeakerName}>MARCO DIFENDE B</span>
            <span className={styles.miniSpeakerSub}>ARRINGA DAL VIVO · 0:24</span>
          </div>
        </div>
        <div className={styles.miniProgressTrack}>
          <div className={styles.miniProgressFill} />
        </div>
      </div>
    );
  }
  return (
    <div className={styles.miniUi} aria-hidden="true">
      <div className={styles.miniUiHead}>
        <span className={styles.miniSplitText}>38% A · 62% B</span>
        <span className={styles.miniSwingBadge}>⚡ RIBALTONE!</span>
      </div>
      <div className={styles.miniSplitTrack}>
        <div className={styles.miniSplitA} />
        <div className={styles.miniSplitB} />
      </div>
    </div>
  );
}

// 3-step explainer with realistic mini-UI game snapshots for each phase.
export default function HowToPlay() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="come">
      <p className={styles.kicker}>Come si gioca</p>
      <h2 className={styles.h2}>Tre mosse, mille discussioni</h2>
      <div className={styles.steps}>
        {HOW_TO_PLAY.map((line, i) => (
          <div className={styles.step} key={TITLES[i]}>
            <div className={styles.stepHeader}>
              <div className={styles.stepN}>{i + 1}</div>
              <h3>{TITLES[i]}</h3>
            </div>
            <StepPreview step={i} />
            <p>{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
