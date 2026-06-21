import { Button, Swing } from '../../shared/ui';
import styles from '../Landing.module.css';

interface HeroProps {
  onCreate: () => void;
  onJoin: () => void;
}

// Hero: claim + CTAs on the left, a CSS-built device showcase (phone → TV → phone)
// on the right that mirrors a real moment of play.
export default function Hero({ onCreate, onJoin }: HeroProps) {
  return (
    <div className={styles.wrap}>
      {/* one faint bivio watermark behind the hero — the dilemma made into a mark */}
      <svg className={styles.watermark} viewBox="0 0 200 215" aria-hidden="true">
        <path d="M100,205 L100,120" fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round" />
        <path d="M100,120 L42,26" fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round" />
        <path d="M100,120 L158,26" fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round" />
        <circle cx={100} cy={120} r={12} fill="currentColor" />
      </svg>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Party game dal vivo · 3–8 amici</p>
          <h1 className={styles.title}>
            Scegli un lato.<br />
            <span className={styles.a}>Difendilo.</span>{' '}
            <span className={styles.b}>Falli cambiare idea.</span>
          </h1>
          <p className={styles.lead}>
            Dilemmi scomodi di vita e di business. Si vota in segreto, si difende la
            propria scelta, si rivota. Nessun vincitore — solo risate e qualche verità.
          </p>
          <div className={styles.ctaRow}>
            <Button variant="primary" size="lg" onClick={onCreate}>Crea una partita</Button>
            <Button variant="ghost" size="lg" onClick={onJoin}>Ho un codice · Partecipa</Button>
          </div>
          <p className={styles.meta}>
            Su un solo schermo condiviso + i vostri telefoni · 20–40 min · niente account
          </p>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.phone}>
            <div className={styles.deviceLab}>Il tuo telefono</div>
            <div className={styles.phoneBig}>Tu da che parte stai?</div>
            <div className={`${styles.vbtn} ${styles.vbtnA}`}>A</div>
            <div className={`${styles.vbtn} ${styles.vbtnB}`}>B</div>
          </div>
          <div className={styles.tv}>
            <div className={styles.deviceLab}>Dilemma 2/5 · schermo condiviso</div>
            <div className={styles.tvQ}>
              Un socio ti propone di gonfiare i numeri per chiudere un investimento.
            </div>
            <div className={styles.opts}>
              <div className={`${styles.opt} ${styles.optA}`}>
                <span className={styles.optK}>A</span> Lo faccio: i soldi servono ora
              </div>
              <div className={`${styles.opt} ${styles.optB}`}>
                <span className={styles.optK}>B</span> Mai: la reputazione vale più dei soldi
              </div>
            </div>
            <div className={styles.tally}>
              <Swing split={38} width={260} height={12} labels />
            </div>
          </div>
          <div className={styles.phone}>
            <div className={styles.deviceLab}>Tocca a te</div>
            <div className={styles.mic}>🎤</div>
            <div className={styles.phoneBig} style={{ color: 'var(--faction-b)' }}>Difendi B</div>
            <div className={styles.deviceLab}>30s</div>
          </div>
        </div>
      </section>
    </div>
  );
}
