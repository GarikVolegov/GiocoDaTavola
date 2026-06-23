import { describe, it, expect } from 'vitest';
import {
  validateProfileInput,
  DISPLAY_NAME_MAX,
  AVATAR_MAX_LEN,
  PRESET_AVATAR_IDS,
  loadProfile,
  saveProfile,
} from '../profile';
import { dbEnabled } from '../db';

// A tiny but format-valid raster data URL.
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('validateProfileInput — displayName', () => {
  it('trims surrounding whitespace', () => {
    const r = validateProfileInput({ displayName: '  Marco  ', avatar: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.displayName).toBe('Marco');
  });

  it('caps to DISPLAY_NAME_MAX characters', () => {
    const long = 'x'.repeat(DISPLAY_NAME_MAX + 10);
    const r = validateProfileInput({ displayName: long, avatar: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.displayName).toHaveLength(DISPLAY_NAME_MAX);
  });

  it('treats empty / whitespace-only as null', () => {
    for (const v of ['', '   ', null, undefined]) {
      const r = validateProfileInput({ displayName: v, avatar: null });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.displayName).toBeNull();
    }
  });

  it('rejects a non-string displayName', () => {
    const r = validateProfileInput({ displayName: 42, avatar: null });
    expect(r.ok).toBe(false);
  });
});

describe('validateProfileInput — avatar', () => {
  it('accepts a whitelisted preset id', () => {
    const id = [...PRESET_AVATAR_IDS][0];
    const r = validateProfileInput({ displayName: null, avatar: `preset:${id}` });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.avatar).toBe(`preset:${id}`);
  });

  it('rejects an unknown preset id', () => {
    const r = validateProfileInput({ displayName: null, avatar: 'preset:__nope__' });
    expect(r.ok).toBe(false);
  });

  it('accepts small png/jpeg/webp data URLs', () => {
    for (const url of [PNG, 'data:image/jpeg;base64,/9j/4AAQ=', 'data:image/webp;base64,UklGRg==']) {
      const r = validateProfileInput({ displayName: null, avatar: url });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.avatar).toBe(url);
    }
  });

  it('rejects an svg data URL (script vector)', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(validateProfileInput({ displayName: null, avatar: svg }).ok).toBe(false);
  });

  it('rejects an http(s) URL', () => {
    expect(validateProfileInput({ displayName: null, avatar: 'https://evil.example/x.png' }).ok).toBe(false);
  });

  it('rejects an oversize data URL', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(AVATAR_MAX_LEN + 10);
    const r = validateProfileInput({ displayName: null, avatar: big });
    expect(r.ok).toBe(false);
  });

  it('treats empty / null avatar as null', () => {
    for (const v of ['', null, undefined]) {
      const r = validateProfileInput({ displayName: null, avatar: v });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.avatar).toBeNull();
    }
  });
});

describe('loadProfile / saveProfile (no DATABASE_URL in tests)', () => {
  it('saveProfile is disabled and resolves without throwing', async () => {
    expect(dbEnabled()).toBe(false);
    await expect(saveProfile('user_x', { displayName: 'Ann', avatar: null })).resolves.toBeUndefined();
  });

  it('loadProfile returns empty profile when DB disabled', async () => {
    await expect(loadProfile('user_x')).resolves.toEqual({ displayName: null, avatar: null });
  });
});
