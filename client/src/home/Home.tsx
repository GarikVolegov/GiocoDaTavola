import { useEffect, useState } from 'react';
import { useAuth, useUser, UserButton } from '@clerk/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, Logo } from '../shared/ui';
import type { MyDashboard } from '../shared/events';
import styles from './Home.module.css';

const MODE_LABEL: Record<string, string> = { gruppo: 'Gruppo', duello: 'Duello' };

// `/casa`: the signed-in user's home. Quick game start + their trophies, stats
// and recent games (one round-trip to GET /api/me/dashboard). Anonymous visitors
// are bounced to the marketing landing; App.tsx redirects signed-in users here.
export default function Home() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [data, setData] = useState<MyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/me/dashboard', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as MyDashboard;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError('Impossibile caricare i tuoi dati.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  if (!isLoaded) return <main className={styles.page} />;
  if (!isSignedIn) return <Navigate to="/" replace />;

  const firstName = user?.firstName ?? 'giocatore';
  const stats = data?.stats;
  const games = data?.recentGames ?? [];
  const awards = data?.recentAwards ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Logo size={24} />
        <UserButton />
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>La tua casa</p>
        <h1 className={styles.greeting}>Ciao, {firstName}</h1>
        <div className={styles.cta}>
          <Button variant="primary" size="lg" onClick={() => navigate('/join?create=1')}>
            Crea partita
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/join')}>
            Partecipa
          </Button>
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.statsGrid} aria-label="Statistiche">
        <Stat label="Partite" value={stats?.gamesPlayed} />
        <Stat label="Persuasione totale" value={stats?.totalPersuasion} />
        <Stat label="Record persuasione" value={stats?.bestPersuasion} />
        <Stat label="Premi" value={stats?.awardsCount} />
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Bacheca premi</h2>
          <button type="button" className={styles.link} onClick={() => navigate('/profilo')}>
            Vedi tutti
          </button>
        </div>
        {awards.length === 0 ? (
          <p className={styles.empty}>Nessun premio (ancora). Gioca una partita! 🎲</p>
        ) : (
          <ul className={styles.awards}>
            {awards.map((a) => (
              <li key={a.id}>
                <Card className={styles.award}>
                  <div className={styles.awardEmoji}>{a.emoji}</div>
                  <div className={styles.awardTitle}>{a.title}</div>
                  <div className={styles.awardDesc}>{a.description}</div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Cronologia partite</h2>
        {games.length === 0 ? (
          <p className={styles.empty}>Nessuna partita ancora — creane una!</p>
        ) : (
          <ul className={styles.history}>
            {games.map((g) => (
              <li key={g.id} className={styles.row}>
                <span className={styles.rowMode}>{MODE_LABEL[g.mode] ?? g.mode}</span>
                <span className={styles.rowName}>{g.nickname}</span>
                <span className={styles.rowMeta}>
                  {g.persuasion > 0 && <span title="Persuasione">🎯 {g.persuasion}</span>}
                  {g.awardsCount > 0 && <span title="Premi">🏆 {g.awardsCount}</span>}
                </span>
                <span className={styles.rowDate}>
                  {new Date(g.playedAt).toLocaleDateString('it-IT')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className={styles.stat}>
      <div className={styles.statValue}>{value ?? '—'}</div>
      <div className={styles.statLabel}>{label}</div>
    </Card>
  );
}
