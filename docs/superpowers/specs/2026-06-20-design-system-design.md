# Design System — "Neon party night" — Dibattiti tra amici

**Date:** 2026-06-20
**Status:** Approved (design) — pending implementation plan
**Scope:** Client (`client/`) only. No server changes.

## 1. Goal

Give the game a real, cohesive **playful party-game visual identity** ("Neon party
night") and the lightweight design infrastructure to apply it consistently across the
two surfaces:

- **Host** — shared screen (TV / laptop), everything large, read-at-a-distance.
- **Player** — phone, compact, touch-first.

Today all styling is inline `style={{}}` objects duplicated across
`client/src/host/HostApp.tsx` and `client/src/player/PlayerApp.tsx`, with hardcoded
colors and no shared layer. `client/src/index.css` only does resets + system font +
`color-scheme: light dark`.

### Non-goals (out of scope for this work)

- No server changes; no changes to Socket.IO events, game logic, or payloads.
- No new gameplay screens beyond restyling what already renders (LOBBY, PHASE_INTRO,
  DILEMMA_REVEAL, generic phase + countdown views).
- No light theme / theme switching (single dark theme — see §4).
- No client test framework setup (vitest currently covers `server/**` only).
- No Tailwind / CSS-in-JS dependency.

## 2. Visual direction — "Neon party night"

Dark charcoal-blue background, vibrant electric accents with soft colored glows,
chunky rounded shapes, bold display type. Energetic, reads well on a TV. The game's
A/B dilemma is the central motif: **two factions** (blue vs orange) that visually
face off.

## 3. Architecture decision

**CSS custom properties (design tokens) + CSS Modules + a thin React component layer
in `client/src/shared/ui/`. Zero new dependencies.**

- Tokens are CSS variables in a globally-imported `tokens.css`.
- Components are small React `.tsx` files with **co-located `.module.css`** (scoped,
  native in Vite, no library).
- Both views are refactored off inline styles onto these components.

**Alternatives considered & rejected:**
- *Tailwind CSS* — paradigm shift + config for only two views; conflicts with the
  project's "few dependencies" ethos.
- *styled-components / vanilla-extract* — adds runtime/build dependencies for marginal
  benefit over CSS Modules here.

## 4. Theme

**Single dark theme.** Remove `color-scheme: light dark` from `index.css`. A party game
wants one strong, consistent look on both the TV and the phones. Dropping auto
light/dark also removes a class of contrast bugs (YAGNI on theming).

## 5. Design tokens

Defined on `:root` in `client/src/shared/ui/tokens.css`. Indicative values (final hex
tuned during implementation, but these are the contract):

### Color
```
--bg:            #0E1020   /* app background, charcoal-blue */
--surface:       #1A1D33   /* raised cards/panels */
--surface-2:     #242846   /* nested / hover surface */
--border:        rgba(242,243,255,0.12)

--text:          #F2F3FF   /* near-white */
--text-muted:    rgba(242,243,255,0.65)
--text-faint:    rgba(242,243,255,0.45)

--faction-a:     #4F8CFF   /* option A — electric blue */
--faction-a-soft:rgba(79,140,255,0.18)
--faction-b:     #FF8C4F   /* option B — orange */
--faction-b-soft:rgba(255,140,79,0.18)

--accent:        #C04FFF   /* "vs" / highlights — violet */
--danger:        #FF6B6B
--success:       #52E0A0
```

### Spacing (4px base)
```
--space-1: 0.25rem  --space-2: 0.5rem  --space-3: 0.75rem  --space-4: 1rem
--space-5: 1.5rem   --space-6: 2rem    --space-7: 3rem     --space-8: 4rem
```

### Radius
```
--radius-sm: 0.5rem  --radius-md: 0.9rem  --radius-lg: 1.25rem  --radius-pill: 999px
```

### Shadow / glow
```
--shadow-card:  0 8px 28px rgba(0,0,0,0.45)
--glow-a:       0 0 0 2px rgba(79,140,255,0.5), 0 0 24px rgba(79,140,255,0.35)
--glow-b:       0 0 0 2px rgba(255,140,79,0.5), 0 0 24px rgba(255,140,79,0.35)
--glow-accent:  0 0 24px rgba(192,79,255,0.4)
```

### Typography scale (fluid)
```
--font-display: 'Space Grotesk', system-ui, sans-serif
--font-body:    system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
--font-mono:    ui-monospace, SFMono-Regular, Menlo, monospace

--text-xs:  0.85rem
--text-sm:  1rem
--text-md:  1.25rem
--text-lg:  clamp(1.5rem, 4vw, 2.4rem)
--text-xl:  clamp(2rem, 8vw, 3rem)
--text-2xl: clamp(3rem, 12vw, 6rem)   /* countdown / code on host */
```

### Motion
```
--ease:      cubic-bezier(0.22, 1, 0.36, 1)
--dur-fast:  120ms
--dur-med:   260ms
```

## 6. Typography

- **Display:** Space Grotesk, **self-hosted** (bundled as a static font asset, loaded
  via `@font-face` from `client/src/assets/fonts/`). No runtime CDN — the game is
  played in person, often on a local network, so it must not depend on an external
  font request. Used for headings, the room code, and the countdown.
- **Body:** keep the existing `system-ui` stack.
- **Mono:** room code keeps tabular monospace fallback within the display treatment.
- The license note for the bundled font is recorded next to the asset.

## 7. Component layer (`client/src/shared/ui/`)

Each is a `.tsx` + co-located `.module.css`, exported via a barrel `index.ts`.

| Component | Replaces (today) | Key props |
|-----------|------------------|-----------|
| `Stage` | `screen` / `wrap` flex-center objects | `variant: 'host' \| 'player'`, `children` |
| `Button` | inline buttons (start, advance, join, count) | `variant: 'primary' \| 'ghost'`, `size`, `disabled` |
| `Card` | inline panels / `<section>` wrappers | `glow?: 'a' \| 'b' \| 'accent'` |
| `OptionCard` | A/B dilemma cards in HostApp | `faction: 'a' \| 'b'`, `letter`, `label` |
| `Pill` | player chips, 3/4/5 selector buttons | `selected?`, `as?: 'button'` |
| `Countdown` | inline countdown digits | `seconds: number \| null` (pulses + turns danger < 10s) |
| `CodeDisplay` | giant room-code block | `code: string` |
| `Field` + `TextInput` | join form labels/inputs | label, value, onChange, mono? |
| `Alert` | error `<p role="alert">` | `tone: 'danger'`, children |

- Components are responsive via tokens/`clamp()`; `Stage variant` mainly tunes
  padding/gap density. Host vs player differ by **which** components they compose and
  the variant, not by forked styles.
- `Countdown` owns the urgency behavior (pulse + color shift under 10s) so both
  surfaces get it for free. It still only *renders* the seconds it's given — the
  server stays authoritative about timing (unchanged).

## 8. Motion & accessibility

- Micro-animations: countdown urgency pulse; "pop" on vote/option selection; button &
  option-card hover/press; soft faction glow; screen enter fade/slide.
- All non-essential motion wrapped in `@media (prefers-reduced-motion: reduce)` →
  reduced/none.
- Maintain readable contrast on `--bg` (target WCAG AA for text). Preserve existing
  `aria-label`/`role`/`aria-pressed` semantics when moving markup into components.
- QR code keeps its white background box (required for scannability on dark — existing
  pattern).

## 9. File structure

```
client/src/
  index.css                      # trimmed: reset + body bg/text from tokens (no light/dark)
  assets/fonts/                  # self-hosted Space Grotesk + LICENSE note
  shared/ui/
    tokens.css                   # :root design tokens + @font-face
    index.ts                     # barrel export
    Stage.tsx / Stage.module.css
    Button.tsx / Button.module.css
    Card.tsx / Card.module.css
    OptionCard.tsx / OptionCard.module.css
    Pill.tsx / Pill.module.css
    Countdown.tsx / Countdown.module.css
    CodeDisplay.tsx / CodeDisplay.module.css
    Field.tsx / Field.module.css
    Alert.tsx / Alert.module.css
```

`tokens.css` is imported once at the top of `client/src/main.tsx` (before `index.css`)
so the variables and `@font-face` are global; component modules are imported by their
own `.tsx`.

## 10. Migration plan (high level)

1. Add font asset + `tokens.css`; trim `index.css` to use tokens; drop light/dark.
2. Build the component layer one component at a time.
3. Refactor `HostApp.tsx` onto the components (lobby/code/QR, dilemma-count selector,
   PHASE_INTRO, DILEMMA_REVEAL option cards, countdown, advance button).
4. Refactor `PlayerApp.tsx` onto the components (join form, joined lobby, in-phase view).
5. Delete the now-dead inline `screen`/`wrap` objects and per-element style literals.

Behavior, copy (Italian), events, and `aria` semantics are preserved — this is a visual
+ structural refactor only.

## 11. Verification

- Quality gate stays green: `npm run typecheck && npm run lint && npm test && npm run build`.
- No client test framework exists, so there are no component unit tests; visual
  verification in a real browser is **pending browser tooling** (consistent with prior
  stories' notes). `build` guarantees everything compiles and CSS Modules resolve.
- Avoid `any`; prefix intentionally-unused vars with `_` (project lint rules).
