import { FEATURES } from '../content';
import styles from '../Landing.module.css';

function FeaturePreview({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className={styles.sceneBox} aria-hidden="true">
        <div className={styles.deckStack}>
          <div className={`${styles.deckBack} ${styles.deckBackLeft}`}>LAVORO</div>
          <div className={`${styles.deckBack} ${styles.deckBackRight}`}>CAOS 18+</div>
          <div className={styles.deckFront}>
            <div className={styles.deckFrontTop}>
              <span className={styles.miniBadgeGold}>DILEMMA #142</span>
              <span className={styles.deckCat}>MORALE</span>
            </div>
            <div className={styles.deckQ}>SALVI UN AMICO O LA TUA CARRIERA?</div>
            <div className={styles.deckOpts}>
              <span className={styles.deckOptA}>AMICO</span>
              <span className={styles.deckOptB}>CARRIERA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className={styles.sceneBox} aria-hidden="true">
        <div className={styles.swingScene}>
          <div className={styles.swingCompareRow}>
            <span className={styles.swingBefore}>PRIMA: 65%</span>
            <span className={styles.miniShiftTag}>+2 VOTI RIBALTATI</span>
            <span className={styles.swingAfter}>DOPO: 68%</span>
          </div>
          <div className={styles.swingTokensRow}>
            <span className={styles.tokenBlue}>M</span>
            <span className={styles.tokenShift}>S →</span>
            <span className={styles.tokenShift}>L →</span>
            <span className={styles.tokenOrange}>G</span>
            <span className={styles.tokenOrange}>A</span>
          </div>
          <div className={styles.miniSplitTrackTall}>
            <div className={styles.miniSplitA} style={{ width: '32%' }}>32%</div>
            <div className={styles.miniSplitB} style={{ width: '68%' }}>68%</div>
          </div>
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className={styles.sceneBox} aria-hidden="true">
        <div className={styles.rosterGrid}>
          <div className={styles.rosterTile}>
            <span className={`${styles.rosterAvatar} ${styles.rosterAvatarA}`}>M</span>
            <div className={styles.rosterInfo}>
              <span className={styles.rosterName}>MARCO</span>
              <span className={styles.rosterRole}>HOST</span>
            </div>
          </div>
          <div className={styles.rosterTile}>
            <span className={`${styles.rosterAvatar} ${styles.rosterAvatarB}`}>S</span>
            <div className={styles.rosterInfo}>
              <span className={styles.rosterName}>SARA</span>
              <span className={styles.rosterRoleReady}>PRONTO ✓</span>
            </div>
          </div>
          <div className={`${styles.rosterTile} ${styles.rosterTileBot}`}>
            <span className={`${styles.rosterAvatar} ${styles.rosterAvatarBot}`}>🤖</span>
            <div className={styles.rosterInfo}>
              <span className={styles.rosterName}>LOGICO</span>
              <span className={styles.rosterRoleBot}>BOT AI</span>
            </div>
          </div>
          <div className={`${styles.rosterTile} ${styles.rosterTileBot}`}>
            <span className={`${styles.rosterAvatar} ${styles.rosterAvatarBot}`}>🤖</span>
            <div className={styles.rosterInfo}>
              <span className={styles.rosterName}>CAOS</span>
              <span className={styles.rosterRoleBot}>BOT AI</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.sceneBox} aria-hidden="true">
      <div className={styles.trophyRow}>
        <div className={styles.trophyCard}>
          <span className={styles.trophyEmoji}>🏆</span>
          <span className={styles.trophyTitle}>PERSUASORE</span>
          <span className={styles.trophySub}>SARA · +4 VOTI</span>
        </div>
        <div className={styles.trophyCard}>
          <span className={styles.trophyEmoji}>🎤</span>
          <span className={styles.trophyTitle}>ORATORE</span>
          <span className={styles.trophySub}>MARCO · 92%</span>
        </div>
        <div className={styles.trophyCard}>
          <span className={styles.trophyEmoji}>🎏</span>
          <span className={styles.trophyTitle}>BANDERUOLA</span>
          <span className={styles.trophySub}>LUCA · 3 CAMBI</span>
        </div>
      </div>
    </div>
  );
}

// Feature cards with rich, realistic mini-UI scenes representing key game moments.
export default function Features() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Perché ti piacerà</p>
      <h2 className={styles.h2}>Fatto per accendere il tavolo</h2>
      <div className={styles.feat}>
        {FEATURES.map((f, i) => (
          <div className={styles.card} key={f.title}>
            <FeaturePreview index={i} />
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
