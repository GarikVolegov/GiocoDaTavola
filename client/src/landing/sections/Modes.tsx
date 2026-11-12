import { DURATIONS, PARTY_MODES_INFO } from '../content';
import styles from '../Landing.module.css';

// The 4 new viral party modes powered by Gemini Flash, plus classic formats
export default function Modes() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="modalita">
      <p className={styles.kicker}>Modalità & divertimento</p>
      <h2 className={styles.h2}>4 Nuove Modalità Party</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', width: '100%', marginBottom: '1.5rem' }}>
        {PARTY_MODES_INFO.map((m) => (
          <div
            key={m.name}
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg, 12px)',
              background: 'linear-gradient(145deg, rgba(30, 40, 75, 0.7) 0%, rgba(15, 20, 40, 0.7) 100%)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '1.8rem' }}>{m.icon}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(229, 193, 88, 0.15)', color: 'var(--gold)' }}>
                {m.tag}
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>{m.name}</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.45 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div className={styles.modes}>
        <div className={styles.mode}>
          <span className={styles.modeTag}>3–8 giocatori</span>
          <div className={styles.modeT}>Gruppo Classico</div>
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
        <span className={styles.chip}><b>✨ Motore:</b> Gemini Flash · Risate immediate</span>
      </div>
    </div>
  );
}
