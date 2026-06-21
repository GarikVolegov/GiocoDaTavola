import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui';
import Hero from './sections/Hero';
import styles from './Landing.module.css';

// Marketing landing on `/`: describes the game and funnels to play.
// CTAs route to /host (Crea) and /join (Partecipa) — unchanged targets.
export default function Landing() {
  const navigate = useNavigate();
  const create = () => navigate('/host');
  const join = () => navigate('/join');

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandA}>SCHIE</span>⚡<span className={styles.brandB}>RATI</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#come">Come si gioca</a>
          <a href="#modalita">Modalità</a>
          <Button variant="primary" size="md" onClick={create}>Crea una partita</Button>
        </div>
      </nav>

      <Hero onCreate={create} onJoin={join} />
    </main>
  );
}
