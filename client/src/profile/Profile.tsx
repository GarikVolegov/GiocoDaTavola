import { useEffect, useState } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import { fetchWithTimeout } from '../shared/api';
import { Logo, Button } from '../shared/ui';
import type { MyAward } from '../shared/events';
import styles from './Profile.module.css';

// "I miei premi": fetches the signed-in user's saved awards from the server.
export default function Profile() {
  const { isSignedIn, getToken } = useAuth();
  const [awards, setAwards] = useState<MyAward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetchWithTimeout('/api/me/awards', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { awards: MyAward[] };
        if (!cancelled) setAwards(data.awards);
      } catch {
        if (!cancelled) setError('Impossibile caricare i premi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <a href="/casa" className={styles.backBtn}>
          ← Torna alla Dashboard
        </a>
        <Logo size={24} />
      </div>

      <header className={styles.header}>
        <p className={styles.eyebrow}>SALA DEI TROFEI</p>
        <h1 className={styles.title}>I miei premi</h1>
      </header>

      <Show when="signed-out">
        <div className={styles.emptyState}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Accedi per vedere i premi salvati.</p>
          <SignInButton mode="modal">
            <Button variant="primary">Accedi</Button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        {error && <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p>}
        {awards == null && !error && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Carico…</p>}
        {awards != null && awards.length === 0 && (
          <div className={styles.emptyState}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Nessun premio salvato (ancora). Gioca una partita! 🎲
            </p>
            <a href="/join?create=1" style={{ textDecoration: 'none' }}>
              <Button variant="primary">
                Crea una partita
              </Button>
            </a>
          </div>
        )}
        {awards != null && awards.length > 0 && (
          <ul className={styles.grid}>
            {awards.map((a) => (
              <li key={a.id} className={styles.awardCard}>
                <div className={styles.awardEmoji}>{a.emoji}</div>
                <div className={styles.awardTitle}>{a.title}</div>
                <div className={styles.awardDesc}>{a.description}</div>
                <div className={styles.awardMeta}>
                  come {a.nickname} · {new Date(a.wonAt).toLocaleDateString('it-IT')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Show>
    </main>
  );
}
