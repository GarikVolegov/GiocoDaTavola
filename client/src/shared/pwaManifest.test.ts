import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolve files relative to the client package root (this file lives in client/src/shared).
const clientRoot = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));

describe('PWA install icon wiring', () => {
  const html = readFileSync(clientRoot('index.html'), 'utf8');

  it('index.html links the web manifest', () => {
    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/);
  });

  it('index.html links a PNG apple-touch-icon for iOS home screen', () => {
    expect(html).toMatch(/<link[^>]+rel="apple-touch-icon"[^>]+href="\/apple-touch-icon\.png"/);
  });

  describe('manifest.webmanifest', () => {
    const manifest = JSON.parse(readFileSync(clientRoot('public/manifest.webmanifest'), 'utf8'));

    it('declares the SCHIERATI brand and standalone display', () => {
      expect(manifest.name).toMatch(/SCHIERATI/);
      expect(manifest.short_name).toBe('SCHIERATI');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/');
    });

    it('provides at least one "any" and one "maskable" PNG icon', () => {
      const icons: Array<{ src: string; type?: string; purpose?: string }> = manifest.icons;
      expect(icons.some((i) => /\bany\b/.test(i.purpose ?? 'any'))).toBe(true);
      expect(icons.some((i) => /\bmaskable\b/.test(i.purpose ?? ''))).toBe(true);
      for (const i of icons) expect(i.type).toBe('image/png');
    });

    it('every referenced icon file plus apple-touch-icon exists in public/', () => {
      const srcs: string[] = manifest.icons.map((i: { src: string }) => i.src);
      for (const src of [...srcs, '/apple-touch-icon.png']) {
        const file = clientRoot(`public${src}`);
        expect(existsSync(file), `missing icon asset: ${src}`).toBe(true);
      }
    });
  });
});
