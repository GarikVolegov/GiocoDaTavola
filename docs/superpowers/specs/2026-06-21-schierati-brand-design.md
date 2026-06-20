# SCHIERATI — Brand & logo design

Date: 2026-06-21
Status: Approved (logo direction + in-app wiring)

## Goal

Give the party game (internal codename "Dibattiti tra amici") a catchy,
brandable name and a logo, then wire the brand into the app.

## Name

**SCHIERATI** — imperative for "take a side / line up".

- One strong word, instantly memorable, great on a logo.
- Describes the core loop precisely: you pick side A or B and defend it.
- Tone: playful / irreverent (party-game, Jackbox-style), the personality the
  user chose.
- Payoff line: **"il gioco dei dilemmi tra amici"**.

Runners-up considered (kept for future reference): CONVINCIMI, AUT AUT,
HO RAGIONE IO!, BIVIO, FACCIA A FACCIA.

## Logo concept

Wordmark **split down the middle by a white lightning bolt** — left half blue,
right half yellow.

- The split = the dilemma (two opposing sides). The bolt = party energy + the
  friendly clash.
- Palette (user-chosen "blu elettrico vs giallo"):
  - Blue `#4F8DFF` — matches the app's `--faction-a` (`#4F8CFF`) almost exactly,
    so the logo harmonises with the existing theme.
  - Yellow `#FFD23F` — a distinct brand pop. (Note: in-game side B is orange
    `--faction-b #FF8C4F`; the logo yellow is a deliberate brand accent, not the
    side-B colour.)
  - Panel / background `#0E1020` — exactly the app's `--bg`, so the panel blends
    into any screen.
- Typography: heavy system stack (`Arial Black`/`Helvetica`, weight 900) for
  punch and zero-dependency rendering. The app's display font is Space Grotesk;
  a branded redraw in a condensed black face is a possible future upgrade.

## Assets (`brand/`)

- `schierati-logo.svg` — primary lockup: dark panel + wordmark + payoff. For the
  `/host` lobby header, social, splash.
- `schierati-logo-transparent.svg` — wordmark only, transparent (for placing on
  arbitrary dark surfaces).
- `schierati-icon.svg` — square icon (blue/yellow split + white bolt) for the
  favicon / app icon. SVG favicon, no PNG needed.

## In-app wiring

1. `client/index.html` — `<title>SCHIERATI</title>` + SVG favicon link.
2. Copy `schierati-icon.svg` and `schierati-logo.svg` into `client/public/` so
   Vite serves them at the site root.
3. `HostApp.tsx` lobby — replace the `<h1>Dibattiti tra amici</h1>` with the
   logo `<img>`.
4. `Landing.tsx` — replace the `<h1>Dibattiti tra amici</h1>` with the logo
   `<img>` (keep the existing tagline + steps).

Out of scope: renaming the npm package (`dibattiti-tra-amici`) and the project
codename in CLAUDE.md — internal only, no user impact. Can follow later.

## Verification

- `npm run typecheck` · `npm run lint` · `npm run build` stay green.
- Visual check: favicon, page title, and both headers render the logo on the
  dark theme without a visible panel seam.
