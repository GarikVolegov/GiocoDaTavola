import { DURATIONS } from '../content';
import styles from '../Landing.module.css';

export default function Modes() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="modalita">
      <p className={styles.kicker}>Modalità & durata</p>
      <h2 className={styles.h2}>La serata come la vuoi</h2>
      <div className={styles.modes}>
        <div className={styles.mode}>
          <div className={styles.modeT}>👥 Gruppo</div>
          <div className={styles.modeD}>3–8 giocatori · il classico: votate, difendete, cambiate idea.</div>
        </div>
        <div className={styles.mode}>
          <div className={styles.modeT}>⚔️ 1v1 Duello</div>
          <div className={styles.modeD}>In due: testa a testa, chi convince chi.</div>
        </div>
      </div>
      <div className={styles.durs}>
        {DURATIONS.map((d) => (
          <span className={styles.chip} key={d.nome}>
            <b>{d.nome}</b> · {d.durata} · {d.round}
          </span>
        ))}
        <span className={styles.chip}><b>Argomenti:</b> Vita · Business · Misto</span>
      </div>
    </div>
  );
}
