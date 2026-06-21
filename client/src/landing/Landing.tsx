import { Show, SignInButton, UserButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui';
import Hero from './sections/Hero';
import HowToPlay from './sections/HowToPlay';
import Features from './sections/Features';
import Modes from './sections/Modes';
import Awards from './sections/Awards';
import FinalCta from './sections/FinalCta';
import styles from './Landing.module.css';

// Marketing landing on `/`: describes the game and funnels to play.
// "Crea" routes to the phone create flow (/join?create=1) — the creator becomes
// the room's leader on their own phone. "Partecipa" routes to /join. The TV view
// stays reachable directly at /host?code= for anyone who wants a shared screen.
export default function Landing() {
  const navigate = useNavigate();
  const create = () => navigate('/join?create=1');
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
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className={styles.navAuth}>Accedi</button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Button variant="primary" size="md" onClick={create}>Crea una partita</Button>
        </div>
      </nav>

      <Hero onCreate={create} onJoin={join} />
      <HowToPlay />
      <Features />
      <Modes />
      <Awards />
      <FinalCta onCreate={create} />
    </main>
  );
}
