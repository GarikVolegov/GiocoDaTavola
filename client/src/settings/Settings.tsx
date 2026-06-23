import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, Field, TextInput, Alert, Logo } from '../shared/ui';
import { PRESET_AVATARS } from '../shared/avatars';
import type { MyProfile } from '../shared/events';
import styles from './Settings.module.css';

const NICK_MAX = 24; // mirrors the server display-name cap
const AVATAR_PX = 256; // resize target — keeps the data-URL tens of KB

// Downscale a picked image to a square-ish thumbnail and return a small raster
// data-URL (WebP, JPEG fallback). No upload of the raw file — the server only
// ever stores this already-resized string.
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_PX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

// `/impostazioni`: a signed-in user edits their nickname + avatar (upload a photo
// or pick a preset). Persists via PUT /api/me/profile. Also hosts sign-out.
export default function Settings() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/me/profile', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const p = (await res.json()) as MyProfile;
        if (!cancelled) {
          setDisplayName(p.displayName ?? user?.firstName ?? '');
          setAvatar(p.avatar);
        }
      } catch {
        if (!cancelled) setError('Impossibile caricare il profilo.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, user?.firstName]);

  if (!isLoaded) return <main className={styles.page} />;
  if (!isSignedIn) return <Navigate to="/" replace />;

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setSaved(false);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch {
      setError('Immagine non valida.');
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      const res = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ displayName: displayName.trim(), avatar }),
      });
      if (res.status === 503) {
        setError('Salvataggio non disponibile al momento.');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setSaved(true);
    } catch {
      setError('Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Logo size={24} />
        <button type="button" className={styles.back} onClick={() => navigate('/casa')}>
          ← Casa
        </button>
      </header>

      <h1 className={styles.title}>Impostazioni</h1>

      <Card className={styles.card}>
        <div className={styles.preview}>
          <Avatar avatar={avatar} imageUrl={user?.imageUrl} name={displayName} size={96} />
          <div className={styles.previewActions}>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Carica foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
            <p className={styles.hint}>Una foto dal telefono, oppure scegli un avatar.</p>
          </div>
        </div>

        <div className={styles.presets} role="group" aria-label="Avatar predefiniti">
          {PRESET_AVATARS.map((p) => {
            const value = `preset:${p.id}`;
            const selected = avatar === value;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.preset} ${selected ? styles.presetSelected : ''}`}
                aria-pressed={selected}
                aria-label={p.label}
                onClick={() => {
                  setAvatar(value);
                  setSaved(false);
                }}
              >
                <Avatar avatar={value} size={44} />
              </button>
            );
          })}
        </div>

        <Field label="Nickname">
          <TextInput
            value={displayName}
            maxLength={NICK_MAX}
            placeholder="Come ti chiami in partita"
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
          />
        </Field>

        {error && <Alert>{error}</Alert>}
        {saved && <p className={styles.saved}>Salvato ✓</p>}

        <Button variant="primary" size="lg" onClick={onSave} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </Button>
      </Card>

      <button type="button" className={styles.signout} onClick={() => void signOut({ redirectUrl: '/' })}>
        Esci
      </button>
    </main>
  );
}
