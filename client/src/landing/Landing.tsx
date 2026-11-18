import { useEffect } from 'react';
import { Show, UserButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../shared/ui';
import { useOnlineStatus } from '../shared/useOnlineStatus';
import Hero from './sections/Hero';
import BivioScrollRoad from './sections/BivioScrollRoad';
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
  const online = useOnlineStatus();
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
      {!online && (
        <div
          role="status"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '8px 16px',
            background: 'rgba(15, 23, 42, 0.96)',
            borderBottom: '1px solid rgba(255, 62, 127, 0.35)',
            color: '#F1F5F9',
            fontSize: 13,
          }}
        >
          <span>✈️ Sei offline — le partite online richiedono rete, ma puoi giocare subito su un solo telefono:</span>
          <button
            type="button"
            onClick={() => navigate('/passa')}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: 'none',
              background: '#FF3E7F',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            📱 Passa il telefono
          </button>
        </div>
      )}
      <div className={styles.navPillWrap}>
        <nav className={styles.navPill} aria-label="Navigazione principale">
          <Logo size={24} className={styles.navLogo} />
          <div className={styles.navCenterLinks}>
            <a href="#come">Come si gioca</a>
            <a href="#modalita">Modalità</a>
            <a href="#premi">Premi</a>
          </div>
          <div className={styles.navActions}>
            <Show when="signed-out">
              <button type="button" className={styles.navAuth} onClick={() => navigate('/accedi')}>
                Accedi
              </button>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
            <button type="button" className={styles.navJoinBtn} onClick={join}>
              <span className={styles.ctaFull}>Entra con codice</span>
              <span className={styles.ctaShort}>Entra</span>
            </button>
          </div>
        </nav>
      </div>

      <Hero onCreate={create} onJoin={join} />
      <div className={styles.scrollyBody}>
        <BivioScrollRoad />
        <div className={styles.reveal} data-reveal><HowToPlay /></div>
        <div className={styles.reveal} data-reveal><Features /></div>
        <div className={styles.reveal} data-reveal><Modes /></div>
        <div className={styles.reveal} data-reveal><Awards /></div>
        <div className={styles.reveal} data-reveal><FinalCta onCreate={create} /></div>
      </div>
    </main>
  );
}
