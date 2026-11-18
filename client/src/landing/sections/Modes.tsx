import { DURATIONS, PARTY_MODES_INFO, type PartyModeVisualId } from '../content';
import styles from '../Landing.module.css';

function ModeGraphic({ id }: { id: PartyModeVisualId | 'gruppo' | 'duello' }) {
  switch (id) {
    case 'flash':
      return (
        <svg viewBox="0 0 120 56" className={styles.modeSvg} aria-hidden="true">
          <path d="M18 46 A42 42 0 0 1 102 46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" strokeLinecap="round" />
          <path d="M18 46 A42 42 0 0 1 88 14" fill="none" stroke="#E5C158" strokeWidth="4" strokeLinecap="round" />
          <polygon points="63,11 49,31 59,31 55,47 71,26 61,26" fill="#E5C158" />
        </svg>
      );
    case 'infiltrato':
      return (
        <svg viewBox="0 0 120 56" className={styles.modeSvg} aria-hidden="true">
          <circle cx="60" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="28" cy="28" r="6" fill="#3E82FC" />
          <circle cx="48" cy="14" r="6" fill="#3E82FC" />
          <circle cx="48" cy="42" r="6" fill="#3E82FC" />
          <circle cx="76" cy="40" r="6" fill="#3E82FC" />
          <circle cx="88" cy="20" r="7.5" fill="#FF5252" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );
    case 'coppie':
      return (
        <svg viewBox="0 0 120 56" className={styles.modeSvg} aria-hidden="true">
          <circle cx="47" cy="28" r="17" fill="rgba(62, 130, 252, 0.16)" stroke="#3E82FC" strokeWidth="2.5" />
          <circle cx="73" cy="28" r="17" fill="rgba(245, 108, 56, 0.16)" stroke="#F56C38" strokeWidth="2.5" />
          <circle cx="60" cy="28" r="4.5" fill="#E5C158" />
        </svg>
      );
    case 'assurdo':
      return (
        <svg viewBox="0 0 120 56" className={styles.modeSvg} aria-hidden="true">
          <path d="M22 38 L44 16 L60 32 L78 14 L98 36" fill="none" stroke="#F56C38" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="49" y="20" width="22" height="22" rx="5" transform="rotate(-14 60 31)" fill="rgba(229,193,88,0.18)" stroke="#E5C158" strokeWidth="2" />
          <circle cx="56" cy="28" r="2" fill="#E5C158" />
          <circle cx="64" cy="34" r="2" fill="#E5C158" />
        </svg>
      );
    case 'gruppo':
      return (
        <svg viewBox="0 0 160 44" className={styles.modeSvgWide} aria-hidden="true">
          <line x1="28" y1="22" x2="132" y2="22" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
          <circle cx="28" cy="22" r="7" fill="#3E82FC" />
          <circle cx="54" cy="14" r="6" fill="#3E82FC" opacity="0.8" />
          <circle cx="80" cy="22" r="9" fill="rgba(229,193,88,0.22)" stroke="#E5C158" strokeWidth="2" />
          <circle cx="106" cy="30" r="6" fill="#F56C38" opacity="0.8" />
          <circle cx="132" cy="22" r="7" fill="#F56C38" />
        </svg>
      );
    case 'duello':
      return (
        <svg viewBox="0 0 160 44" className={styles.modeSvgWide} aria-hidden="true">
          <rect x="30" y="10" width="38" height="24" rx="6" fill="rgba(62,130,252,0.2)" stroke="#3E82FC" strokeWidth="2" />
          <path d="M84 8 L76 22 L82 22 L76 36" fill="none" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="92" y="10" width="38" height="24" rx="6" fill="rgba(245,108,56,0.2)" stroke="#F56C38" strokeWidth="2" />
        </svg>
      );
  }
}

// Visual-first mode showcase: custom SVG diagrams + concise 1-line descriptions
export default function Modes() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="modalita">
      <p className={styles.kicker}>Modalità di gioco</p>
      <h2 className={styles.h2}>Scegli il formato della serata</h2>

      <div className={styles.partyGrid}>
        {PARTY_MODES_INFO.map((m) => (
          <div key={m.id} className={styles.partyCard}>
            <div className={styles.partyVisual}>
              <ModeGraphic id={m.id} />
              <span className={styles.partyTag}>{m.tag}</span>
            </div>
            <div className={styles.partyTitle}>{m.name}</div>
            <p className={styles.partyDesc}>{m.desc}</p>
          </div>
        ))}
      </div>

      <div className={styles.modes}>
        <div className={styles.mode}>
          <div className={styles.modeHead}>
            <ModeGraphic id="gruppo" />
            <span className={styles.modeTag}>Da solo o in gruppo</span>
          </div>
          <div className={styles.modeT}>Gruppo Classico</div>
          <div className={styles.modeD}>
            Voto segreto, arringa dal vivo e rivoto: più siete, più il tavolo si accende.
          </div>
        </div>
        <div className={styles.mode}>
          <div className={styles.modeHead}>
            <ModeGraphic id="duello" />
            <span className={styles.modeTag}>In due · 1v1</span>
          </div>
          <div className={styles.modeT}>1v1 Duello</div>
          <div className={styles.modeD}>
            Due posizioni opposte, nessuno scampo: convinci l’altro senza limiti di tempo.
          </div>
        </div>
      </div>

      <div className={styles.durs}>
        {DURATIONS.map((d) => (
          <span className={styles.chip} key={d.nome}>
            <b>{d.nome}</b> · {d.durata} · {d.round}
          </span>
        ))}
      </div>
    </div>
  );
}
