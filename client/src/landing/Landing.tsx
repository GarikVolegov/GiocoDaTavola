import { useEffect } from 'react';
import { Show, SignInButton, UserButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { Button, Logo } from '../shared/ui';
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

  // Scroll reveal: sections tagged [data-reveal] fade/rise in as they enter the
  // viewport. A 1.2s timeout fallback reveals everything in case the observer
  // never fires (and an @media print guard in CSS keeps content visible on print).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add(styles.in)), 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Logo size={26} className={styles.navLogo} />
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
          <Button variant="primary" size="md" onClick={create} className={styles.navCta}>
            <span className={styles.ctaFull}>Crea una partita</span>
            <span className={styles.ctaShort}>Crea</span>
          </Button>
        </div>
      </nav>

      <Hero onCreate={create} onJoin={join} />
      <div className={styles.reveal} data-reveal><HowToPlay /></div>
      <div className={styles.reveal} data-reveal><Features /></div>
      <div className={styles.reveal} data-reveal><Modes /></div>
      <div className={styles.reveal} data-reveal><Awards /></div>
      <div className={styles.reveal} data-reveal><FinalCta onCreate={create} /></div>
    </main>
  );
}
