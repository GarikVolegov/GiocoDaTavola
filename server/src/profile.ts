// User profile (display name + avatar) for signed-in accounts. Pure validation
// first so it stays unit-testable without a DB, then the Postgres read/write.
// Avatars are either a whitelisted `preset:<id>` or a small raster data-URL the
// client already resized — never an external URL or SVG (those can carry script).
import { getPool } from './db';

// Mirrors NICKNAME_MAX in game/rooms.ts: the in-game nickname cap.
export const DISPLAY_NAME_MAX = 24;
// Cap on the avatar data-URL string. The client resizes to ~256px, so an honest
// upload is tens of KB; this bounds a hostile payload (and the request body).
export const AVATAR_MAX_LEN = 256 * 1024;

// Whitelisted preset avatar ids. Keep in sync with client/src/shared/avatars.ts
// (CJS server and ESM client can't share a module — the lists are mirrored).
export const PRESET_AVATAR_IDS: ReadonlySet<string> = new Set([
  'volpe', 'lupo', 'leone', 'panda', 'gufo', 'polpo', 'aquila', 'drago', 'gatto', 'rana',
]);

// Raster data-URLs only (png/jpeg/webp). SVG is excluded on purpose.
const DATA_URL_RE = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export interface ProfileInput {
  displayName?: unknown;
  avatar?: unknown;
}

export interface Profile {
  displayName: string | null;
  avatar: string | null;
}

export type ValidationResult = { ok: true; value: Profile } | { ok: false; error: string };

/** Validate + normalize a profile PUT body. Full replace: an absent/empty field
 *  becomes null (cleared). Pure — no DB access. */
export function validateProfileInput(input: ProfileInput): ValidationResult {
  // --- displayName: optional string, trimmed, capped (forgiving like rooms.ts).
  let displayName: string | null = null;
  const dn = input.displayName;
  if (dn !== undefined && dn !== null) {
    if (typeof dn !== 'string') return { ok: false, error: 'invalid-display-name' };
    const trimmed = dn.trim().slice(0, DISPLAY_NAME_MAX);
    displayName = trimmed.length > 0 ? trimmed : null;
  }

  // --- avatar: optional preset id or small raster data-URL.
  let avatar: string | null = null;
  const av = input.avatar;
  if (av !== undefined && av !== null && av !== '') {
    if (typeof av !== 'string') return { ok: false, error: 'invalid-avatar' };
    if (av.startsWith('preset:')) {
      if (!PRESET_AVATAR_IDS.has(av.slice('preset:'.length))) {
        return { ok: false, error: 'invalid-avatar' };
      }
    } else if (DATA_URL_RE.test(av)) {
      if (av.length > AVATAR_MAX_LEN) return { ok: false, error: 'avatar-too-large' };
    } else {
      return { ok: false, error: 'invalid-avatar' };
    }
    avatar = av;
  }

  return { ok: true, value: { displayName, avatar } };
}

/** Persist a validated profile: upsert the user row (mirrors the upsert in
 *  persistence.ts). No-op when the DB is disabled. */
export async function saveProfile(userId: string, p: Profile): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO users (clerk_user_id, display_name, avatar, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (clerk_user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name, avatar = EXCLUDED.avatar, last_seen = now()`,
    [userId, p.displayName, p.avatar],
  );
}

/** Read a user's profile. Returns an empty profile when DB-disabled or unknown. */
export async function loadProfile(userId: string): Promise<Profile> {
  const pool = getPool();
  if (!pool) return { displayName: null, avatar: null };
  const { rows } = await pool.query(
    `SELECT display_name, avatar FROM users WHERE clerk_user_id = $1`,
    [userId],
  );
  if (rows.length === 0) return { displayName: null, avatar: null };
  return { displayName: rows[0].display_name ?? null, avatar: rows[0].avatar ?? null };
}
