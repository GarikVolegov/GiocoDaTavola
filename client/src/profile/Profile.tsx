import { useEffect, useState } from 'react';
import { useAuth, Show, SignInButton } from '@clerk/react';
import type { MyAward } from '../shared/events';

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
        const res = await fetch('/api/me/awards', {
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

  const wrap = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem 1.5rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-body)',
  } as const;

  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', margin: 0 }}>
        I miei premi
      </h1>
      <Show when="signed-out">
        <p style={{ color: 'var(--text-muted)' }}>Accedi per vedere i premi salvati.</p>
        <SignInButton mode="modal">
          <button type="button" style={{ fontWeight: 700, padding: '0.7rem 1.4rem', borderRadius: '0.7rem', cursor: 'pointer' }}>
            Accedi
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {awards == null && !error && <p style={{ color: 'var(--text-muted)' }}>Carico…</p>}
        {awards != null && awards.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Nessun premio salvato (ancora). Gioca una partita! 🎲</p>
        )}
        {awards != null && awards.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'center', maxWidth: 'min(92vw, 60rem)' }}>
            {awards.map((a) => (
              <li
                key={a.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.2rem',
                  textAlign: 'center',
                  flex: '1 1 14rem',
                  maxWidth: '16rem',
                }}
              >
                <div style={{ fontSize: '2rem' }}>{a.emoji}</div>
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.3rem' }}>
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
