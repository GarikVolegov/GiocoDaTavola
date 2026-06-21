import { DURATIONS } from '../content';
import styles from '../Landing.module.css';

// Two first-class ways to play: the group classic and the 1v1 duel. Both get an
// equal card with a tag, a one-liner and the headcount so neither feels secondary.
export default function Modes() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="modalita">
      <p className={styles.kicker}>Modalità & durata</p>
      <h2 className={styles.h2}>La serata come la vuoi</h2>
      <div className={styles.modes}>
        <div className={styles.mode}>
          <span className={styles.modeTag}>3–8 giocatori</span>
          <div className={styles.modeT}>Gruppo</div>
          <div className={styles.modeD}>
            Il classico: si vota in segreto, si difende la propria scelta, si rivota.
            Più siete, più il tavolo si accende.
          </div>
        </div>
        <div className={styles.mode}>
          <span className={styles.modeTag}>in due</span>
          <div className={styles.modeT}>1v1 Duello</div>
          <div className={styles.modeD}>
            Testa a testa: due posizioni, nessuno scampo. Chi convince chi prima
            che scada il tempo?
          </div>
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
