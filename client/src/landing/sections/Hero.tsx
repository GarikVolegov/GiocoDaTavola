import { useNavigate } from 'react-router-dom';
import { Button, Swing } from '../../shared/ui';
import styles from '../Landing.module.css';

interface HeroProps {
  onCreate: () => void;
  onJoin: () => void;
}

// Hero: claim + CTAs on the left, a CSS-built device showcase (phone → TV → phone)
// on the right that mirrors a real moment of play.
export default function Hero({ onCreate, onJoin }: HeroProps) {
  const navigate = useNavigate();
  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrowBadge}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            <span className={styles.eyebrowText}>IL PARTY GAME DAL VIVO DELLE GRANDI SCELTE</span>
          </div>

          <h1 className={styles.title}>
            <span className={styles.titleLine}>Scegli un lato.</span>
            <span className={`${styles.titleLine} ${styles.a}`}>Difendilo.</span>
            <span className={`${styles.titleLine} ${styles.b}`}>Falli cambiare idea.</span>
          </h1>

          <p className={styles.lead}>
            Dilemmi scomodi tra amici. Si vota in segreto, si difende la propria scelta,
            si rivota. Nessun vincitore — solo risate e grandi verità.
          </p>

          <div className={styles.ctaRow}>
            <Button variant="primary" size="lg" onClick={onCreate}>Crea una partita</Button>
            <Button variant="ghost" size="lg" onClick={onJoin}>Ho un codice · Partecipa</Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/passa')}>
              📱 Passa il telefono (1 dispositivo)
            </Button>
          </div>

          <p className={styles.meta}>
            Su uno schermo condiviso + smartphone · 20–40 min · Niente account
          </p>
        </div>

        <div className={styles.stageWrapper}>
          <div className={styles.stageLabel} aria-hidden="true">
            <span className={styles.stageDot} />
            ESPERIENZA MULTISCHERMO DAL VIVO
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
                <Swing split={38} width="100%" height={12} labels />
              </div>
            </div>
            <div className={styles.phone}>
              <div className={styles.deviceLab}>Tocca a te</div>
              <div className={styles.mic}>🎤</div>
              <div className={styles.phoneBig} style={{ color: 'var(--faction-b)' }}>Difendi B</div>
              <div className={styles.deviceLab}>30s</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
