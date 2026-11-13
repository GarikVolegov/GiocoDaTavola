import { useState } from 'react';
import { useAuth, SignInButton, SignUpButton } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Logo } from '../shared/ui';
import styles from './AuthPage.module.css';

const PERKS = [
  {
    icon: '✍️',
    title: 'Fino a 5 dilemmi personali a partita',
    desc: 'Gli ospiti possono inserirne fino a 2: con un account ne aggiungi fino a 5 e guidi subito il tavolo.',
  },
  {
    icon: '🏆',
    title: 'Sala dei Trofei & Storico',
    desc: 'Salva automaticamente premi, archetipi decisionali e risultati di tutte le tue serate.',
  },
  {
    icon: '🎭',
    title: 'Profilo & Avatar sincronizzati',
    desc: 'Il tuo nome e il tuo avatar restano pronti su ogni dispositivo, senza riscriverli ogni volta.',
  },
  {
    icon: '📊',
    title: 'Dashboard personale rapida',
    desc: 'Ritrova statistiche, partite recenti e avvia nuove serate in un tap.',
  },
] as const;

export default function AuthPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'registrati' ? 'registrati' : 'accedi';
  const [tab, setTab] = useState<'accedi' | 'registrati'>(initialTab);
  const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Indietro
        </button>
        <Logo size={24} />
      </div>

      <div className={styles.shell}>
        <Card glow="accent" className={styles.perksCard}>
          <p className={styles.eyebrow}>ACCOUNT GRATUITO · VANTAGGI</p>
          <h1 className={styles.title}>Sblocca di più nelle tue serate</h1>
          <p className={styles.lead}>
            Puoi sempre giocare al volo senza registrazione. Creando un account gratuito in 10 secondi sblocchi:
          </p>
          <ul className={styles.perksList}>
            {PERKS.map((perk) => (
              <li key={perk.title} className={styles.perkItem}>
                <span className={styles.perkIcon} aria-hidden="true">{perk.icon}</span>
                <div className={styles.perkBody}>
                  <span className={styles.perkTitle}>{perk.title}</span>
                  <span className={styles.perkDesc}>{perk.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={styles.authCard}>
          {isLoaded && isSignedIn ? (
            <>
              <p className={styles.eyebrow}>SESSIONE ATTIVA</p>
              <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>Sei già dentro!</h2>
              <p className={styles.lead}>
                I tuoi vantaggi (fino a 5 dilemmi personali, trofei e profilo salvato) sono attivi.
              </p>
              <Button variant="primary" size="lg" onClick={() => navigate('/casa')}>
                Vai alla Dashboard →
              </Button>
            </>
          ) : (
            <>
              <div className={styles.tabs} role="tablist" aria-label="Accesso o registrazione">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'accedi'}
                  className={`${styles.tabBtn} ${tab === 'accedi' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('accedi')}
                >
                  Accedi
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'registrati'}
                  className={`${styles.tabBtn} ${tab === 'registrati' ? styles.tabBtnActive : ''}`}
                  onClick={() => setTab('registrati')}
                >
                  Registrati gratis
                </button>
              </div>

              {tab === 'accedi' ? (
                <>
                  <h2 className={styles.title} style={{ fontSize: '1.2rem' }}>Bentornato al tavolo</h2>
                  <p className={styles.lead}>
                    Accedi per ritrovare trofei, profilo e il limite sbloccato a 5 dilemmi personali.
                  </p>
                  {clerkConfigured ? (
                    <SignInButton mode="modal" forceRedirectUrl="/casa" signUpForceRedirectUrl="/casa">
                      <Button variant="primary" size="lg" style={{ width: '100%' }}>
                        Accedi ora
                      </Button>
                    </SignInButton>
                  ) : (
                    <p className={styles.lead} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.06)' }}>
                      Login disattivato in questa istanza locale (manca <code>VITE_CLERK_PUBLISHABLE_KEY</code>).
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2 className={styles.title} style={{ fontSize: '1.2rem' }}>Crea il tuo account gratis</h2>
                  <p className={styles.lead}>
                    Zero spam, solo salvataggio automatico dei premi e fino a 5 dilemmi personali per partita.
                  </p>
                  {clerkConfigured ? (
                    <SignUpButton mode="modal" forceRedirectUrl="/casa" signInForceRedirectUrl="/casa">
                      <Button variant="primary" size="lg" style={{ width: '100%' }}>
                        Registrati gratis
                      </Button>
                    </SignUpButton>
                  ) : (
                    <p className={styles.lead} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.6rem', background: 'rgba(255,255,255,0.06)' }}>
                      Registrazione disattivata in questa istanza locale (manca <code>VITE_CLERK_PUBLISHABLE_KEY</code>).
                    </p>
                  )}
                </>
              )}

              <button
                type="button"
                className={styles.guestBtn}
                onClick={() => navigate('/join?create=1')}
              >
                Continua come ospite →
              </button>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
