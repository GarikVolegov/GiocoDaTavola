# PWA install icon — design

**Date:** 2026-06-23 · **Branch:** ralph/skeleton-dilemma

## Goal

When the web app is installed/added to the home screen on a phone (iOS + Android)
or installed on desktop, the system must show the **SCHIERATI brand logo** as the
app icon — not a blank/screenshot placeholder.

## Scope (approved)

**Logo + manifest only.** No service worker, no offline caching (avoids stale-asset
risk noted in the deployment/Vite memory). The logo will still appear on the home
screen on iOS/Android and on desktop install.

## Current state

- `client/index.html` references `schierati-icon.svg` only as a **browser-tab favicon**.
- The brand tile already exists: `client/public/schierati-icon.svg` — a rounded navy
  (`#131829`) tile with the "bivio" emblem (white stem splitting into blue `#5486C4`
  and terracotta `#C77A45` paths). This is the source of truth for the icon art.
- No web manifest, no PNG icons, no `apple-touch-icon`.

## Why the logo doesn't show on install today

- **iOS "Add to Home Screen"** ignores the manifest and SVG; it uses a PNG
  `apple-touch-icon` only.
- **Android home-screen** + **desktop install** read a **web manifest** with **PNG**
  icons (incl. a `maskable` variant for adaptive-icon masks).

## Deliverables

New static assets in `client/public/` (Vite copies `public/` → `dist/` on build;
Express `express.static` serves them in prod, `.webmanifest` → `application/manifest+json`):

| File | Size | Purpose |
|------|------|---------|
| `manifest.webmanifest` | — | name/short_name/start_url/display/theme + icon list |
| `icon-192.png` | 192² | manifest `purpose: any` |
| `icon-512.png` | 512² | manifest `purpose: any` |
| `icon-maskable-512.png` | 512² | manifest `purpose: maskable` (emblem in safe zone) |
| `apple-touch-icon.png` | 180² | iOS home screen |

PNGs are **full-bleed** navy squares (no transparent rounded corners) so each OS can
apply its own mask cleanly. The maskable variant scales the emblem to ~70% to stay
inside the adaptive-icon safe zone.

### Generation

PNGs are rasterized **once** from two SVG sources with a transient `sharp` install and
committed as static assets — no permanent build dependency. Sources + the generator
script live in `client/scripts/icons/` for reproducibility:
- `icon-fullbleed.svg` — full navy square, emblem at standard size → 192/512/apple.
- `icon-maskable.svg` — full navy square, emblem scaled to safe zone → maskable 512.
- `generate-icons.mjs` — `npx -y sharp-cli`-free Node script (run with transient sharp).

### `index.html` head additions

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="SCHIERATI" />
<meta name="application-name" content="SCHIERATI" />
```

The existing `<link rel="icon" type="image/svg+xml" href="/schierati-icon.svg">`
(vector tab favicon) stays.

## Manifest contents

```json
{
  "name": "SCHIERATI — il gioco dei dilemmi tra amici",
  "short_name": "SCHIERATI",
  "description": "Il gioco dei dilemmi tra amici, da fare in compagnia.",
  "lang": "it",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0B0E1A",
  "theme_color": "#0B0E1A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## Testing

A node-env vitest spec (`client/src/shared/pwaManifest.test.ts`) guards the wiring:
- `index.html` links the manifest and the apple-touch-icon.
- `manifest.webmanifest` parses and has required fields + ≥1 `any` + ≥1 `maskable` icon.
- Every icon `src` referenced by the manifest, plus `apple-touch-icon.png`, exists in
  `client/public/`.

## Out of scope

Service worker, offline support, install-prompt UI, screenshots/`shortcuts` in the
manifest. Can be added later if a true installable PWA is wanted.
