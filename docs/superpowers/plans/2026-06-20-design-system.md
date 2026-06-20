# Design System ("Neon party night") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the client a cohesive dark "Neon party night" visual identity via design tokens + a small reusable component layer, and refactor both views (host + player) onto it.

**Architecture:** CSS custom properties (design tokens) in a global `tokens.css`, a thin React component layer in `client/src/shared/ui/` with co-located CSS Modules, and a self-hosted display font. No server changes. No new npm dependencies.

**Tech Stack:** React 18 + Vite (TypeScript ESM), CSS Modules (native in Vite), CSS custom properties, self-hosted Space Grotesk (woff2).

## Global Constraints

- Client is **TypeScript ESM**; server is CommonJS — never mix them. This work touches `client/` only.
- **No new npm dependencies.** CSS Modules are native to Vite; the font is a bundled static asset.
- Quality gate must stay green: `npm run typecheck && npm run lint && npm test && npm run build` (run from repo root).
- Avoid `any` (lint error). Prefix intentionally-unused vars/args with `_`.
- No client test framework exists (vitest includes `server/**` only); the spec keeps it that way. **Per-task verification is the quality gate (typecheck/lint/build), not unit tests.** Real-browser visual verification is *pending browser tooling* (project norm).
- Preserve all existing behavior, Italian copy, Socket.IO event usage, and `aria-*`/`role` semantics — this is a visual + structural refactor only.
- Single **dark** theme — do not reintroduce `color-scheme: light dark`.
- Reuse `getSocket()` and `useCountdown()` unchanged.
- Do NOT commit unrelated working-tree changes (`server/src/game/rooms.ts`, `rooms.test.ts` are already modified by other work) — `git add` only the exact paths each step lists.

---

### Task 1: Foundations — font, tokens, global CSS

**Files:**
- Create: `client/src/assets/fonts/space-grotesk-variable.woff2` (binary, downloaded)
- Create: `client/src/assets/fonts/LICENSE.txt`
- Create: `client/src/shared/ui/tokens.css`
- Modify: `client/src/index.css` (full rewrite)
- Modify: `client/src/main.tsx:4` (add tokens import before `./index.css`)

**Interfaces:**
- Produces: global CSS custom properties on `:root` (names listed below) consumed by every component module in Task 2; `--font-display` / `--font-body` / `--font-mono` font stacks.

- [ ] **Step 1: Download the self-hosted display font (with safe fallback)**

```bash
mkdir -p client/src/assets/fonts
curl -fsSL -o client/src/assets/fonts/space-grotesk-variable.woff2 \
  "https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk:vf@latest/latin-wght-normal.woff2"
ls -l client/src/assets/fonts/space-grotesk-variable.woff2
```

Expected: a woff2 file of ~30–60 KB.
**If the download fails or the file is missing/0 bytes (no network):** skip creating the file, and in Step 3 OMIT the `@font-face` block entirely. `--font-display` already falls back to `system-ui`, so the build stays green. Note "font self-host deferred (no network)" in the commit body.

- [ ] **Step 2: Record the font license note**

Create `client/src/assets/fonts/LICENSE.txt`:

```
Space Grotesk — SIL Open Font License 1.1 (OFL-1.1)
Source: https://github.com/floriankarsten/space-grotesk
Distributed via Fontsource (https://fontsource.org/fonts/space-grotesk).
Bundled here as a self-hosted variable woff2 to avoid a runtime CDN dependency.
```

- [ ] **Step 3: Create the design tokens**

Create `client/src/shared/ui/tokens.css`:

```css
/* Self-hosted display font (omit this block if the woff2 wasn't downloaded). */
@font-face {
  font-family: 'Space Grotesk';
  src: url('../../assets/fonts/space-grotesk-variable.woff2') format('woff2');
  font-weight: 300 700;
  font-display: swap;
  font-style: normal;
}

:root {
  /* Color */
  --bg: #0E1020;
  --surface: #1A1D33;
  --surface-2: #242846;
  --border: rgba(242, 243, 255, 0.12);

  --text: #F2F3FF;
  --text-muted: rgba(242, 243, 255, 0.65);
  --text-faint: rgba(242, 243, 255, 0.45);

  --faction-a: #4F8CFF;
  --faction-a-soft: rgba(79, 140, 255, 0.18);
  --faction-b: #FF8C4F;
  --faction-b-soft: rgba(255, 140, 79, 0.18);

  --accent: #C04FFF;
  --danger: #FF6B6B;
  --success: #52E0A0;

  /* Spacing (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;

  /* Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.9rem;
  --radius-lg: 1.25rem;
  --radius-pill: 999px;

  /* Shadow / glow */
  --shadow-card: 0 8px 28px rgba(0, 0, 0, 0.45);
  --glow-a: 0 0 0 2px rgba(79, 140, 255, 0.5), 0 0 24px rgba(79, 140, 255, 0.35);
  --glow-b: 0 0 0 2px rgba(255, 140, 79, 0.5), 0 0 24px rgba(255, 140, 79, 0.35);
  --glow-accent: 0 0 24px rgba(192, 79, 255, 0.45);

  /* Typography */
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  --text-xs: 0.85rem;
  --text-sm: 1rem;
  --text-md: 1.25rem;
  --text-lg: clamp(1.5rem, 4vw, 2.4rem);
  --text-xl: clamp(2rem, 8vw, 3rem);
  --text-2xl: clamp(3rem, 12vw, 6rem);

  /* Motion */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 120ms;
  --dur-med: 260ms;
}
```

- [ ] **Step 4: Rewrite the global stylesheet**

Replace the entire contents of `client/src/index.css` with:

```css
:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
}

#root {
  min-height: 100vh;
}

h1,
h2 {
  font-family: var(--font-display);
  margin: 0;
  line-height: 1.15;
}
```

- [ ] **Step 5: Import the tokens globally**

In `client/src/main.tsx`, add the tokens import on the line **above** `import './index.css';` (so it is line 4, pushing the index.css import to line 5):

```tsx
import './shared/ui/tokens.css';
import './index.css';
```

- [ ] **Step 6: Verify build + typecheck**

Run: `npm run typecheck && npm run build`
Expected: both PASS; Vite bundles `space-grotesk-variable.woff2` (or, if the font was deferred, no `@font-face` and still PASS). No "Failed to resolve" errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/assets/fonts client/src/shared/ui/tokens.css client/src/index.css client/src/main.tsx
git commit -m "feat(ui): design tokens + self-hosted display font + dark global styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: UI component library

**Files:**
- Create: `client/src/shared/ui/Stage.tsx` + `Stage.module.css`
- Create: `client/src/shared/ui/Button.tsx` + `Button.module.css`
- Create: `client/src/shared/ui/Card.tsx` + `Card.module.css`
- Create: `client/src/shared/ui/OptionCard.tsx` + `OptionCard.module.css`
- Create: `client/src/shared/ui/Pill.tsx` + `Pill.module.css`
- Create: `client/src/shared/ui/Countdown.tsx` + `Countdown.module.css`
- Create: `client/src/shared/ui/CodeDisplay.tsx` + `CodeDisplay.module.css`
- Create: `client/src/shared/ui/Field.tsx` + `Field.module.css`
- Create: `client/src/shared/ui/TextInput.tsx` + `TextInput.module.css`
- Create: `client/src/shared/ui/Alert.tsx` + `Alert.module.css`
- Create: `client/src/shared/ui/index.ts` (barrel)

**Interfaces — Produces (exact signatures consumed by Tasks 3 & 4):**
- `Stage({ variant?: 'host' | 'player'; children })` → `<main>`
- `Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost'; size?: 'md' | 'lg' })`
- `Card(props: HTMLAttributes<HTMLDivElement> & { glow?: 'a' | 'b' | 'accent' })`
- `OptionCard({ faction: 'a' | 'b'; letter: string; label: string })`
- `Pill({ selected?: boolean; onClick?: () => void; 'aria-label'?: string; children })` — renders `<button>` when `onClick` is set (with `aria-pressed={selected}`), else `<span>`
- `Countdown({ seconds: number | null })` — returns `null` when `seconds == null`
- `CodeDisplay({ code: string })`
- `Field({ label: string; children })` → `<label>`
- `TextInput(props: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean })`
- `Alert({ tone?: 'danger'; children })` → `<p role="alert">`

> CSS Module class names are camelCase (`glowA`, not `glow-a`) to keep `styles.x` access simple. `import styles from './X.module.css'` is typed by `vite/client` (already in `client/tsconfig.json` `types`).

- [ ] **Step 1: Stage**

`client/src/shared/ui/Stage.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './Stage.module.css';

type StageProps = { variant?: 'host' | 'player'; children: ReactNode };

export function Stage({ variant = 'player', children }: StageProps) {
  return <main className={`${styles.stage} ${styles[variant]}`}>{children}</main>;
}
```

`client/src/shared/ui/Stage.module.css`:

```css
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}
.player { padding: var(--space-5); gap: var(--space-4); }
.host { padding: var(--space-6); gap: var(--space-5); }
```

- [ ] **Step 2: Button**

`client/src/shared/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'lg';
};

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
  return <button className={cls} {...rest} />;
}
```

`client/src/shared/ui/Button.module.css`:

```css
.btn {
  font-family: var(--font-display);
  font-weight: 700;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: transform var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease), filter var(--dur-fast) var(--ease);
}
.btn:disabled { cursor: not-allowed; opacity: 0.5; }
.md { font-size: var(--text-md); padding: var(--space-3) var(--space-6); }
.lg { font-size: var(--text-lg); padding: var(--space-4) var(--space-7); }
.primary { background: var(--faction-a); color: #08122e; }
.primary:not(:disabled):hover { box-shadow: var(--glow-a); transform: translateY(-2px); }
.primary:not(:disabled):active { transform: translateY(0) scale(0.98); }
.ghost { background: var(--surface-2); color: var(--text); }
.ghost:not(:disabled):hover { filter: brightness(1.2); transform: translateY(-2px); }
@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
  .btn:hover, .btn:active { transform: none; }
}
```

- [ ] **Step 3: Card**

`client/src/shared/ui/Card.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

type CardProps = HTMLAttributes<HTMLDivElement> & { glow?: 'a' | 'b' | 'accent' };

const glowClass = { a: 'glowA', b: 'glowB', accent: 'glowAccent' } as const;

export function Card({ glow, className, ...rest }: CardProps) {
  const cls = [styles.card, glow && styles[glowClass[glow]], className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}
```

`client/src/shared/ui/Card.module.css`:

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
}
.glowA { box-shadow: var(--shadow-card), var(--glow-a); }
.glowB { box-shadow: var(--shadow-card), var(--glow-b); }
.glowAccent { box-shadow: var(--shadow-card), var(--glow-accent); }
```

- [ ] **Step 4: OptionCard**

`client/src/shared/ui/OptionCard.tsx`:

```tsx
import styles from './OptionCard.module.css';

type OptionCardProps = { faction: 'a' | 'b'; letter: string; label: string };

export function OptionCard({ faction, letter, label }: OptionCardProps) {
  return (
    <div className={`${styles.option} ${styles[faction]}`}>
      <span className={styles.letter}>{letter}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
```

`client/src/shared/ui/OptionCard.module.css`:

```css
.option {
  flex: 1 1 14rem;
  min-width: 12rem;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-align: left;
  transition: transform var(--dur-med) var(--ease);
}
.a { background: var(--faction-a-soft); border: 2px solid var(--faction-a); box-shadow: var(--glow-a); }
.b { background: var(--faction-b-soft); border: 2px solid var(--faction-b); box-shadow: var(--glow-b); }
.letter { font-family: var(--font-display); font-size: var(--text-lg); font-weight: 800; }
.a .letter { color: var(--faction-a); }
.b .letter { color: var(--faction-b); }
.label { font-size: var(--text-md); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .option { transition: none; } }
```

- [ ] **Step 5: Pill**

`client/src/shared/ui/Pill.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './Pill.module.css';

type PillProps = {
  selected?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  children: ReactNode;
};

export function Pill({ selected, onClick, children, ...aria }: PillProps) {
  const cls = [styles.pill, selected && styles.selected].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected} {...aria}>
        {children}
      </button>
    );
  }
  return <span className={cls} {...aria}>{children}</span>;
}
```

`client/src/shared/ui/Pill.module.css`:

```css
.pill {
  display: inline-block;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  border: 2px solid transparent;
  color: var(--text);
  font-weight: 600;
  font-size: var(--text-sm);
}
button.pill { cursor: pointer; font-family: var(--font-display); transition: transform var(--dur-fast) var(--ease), filter var(--dur-fast) var(--ease); }
button.pill:hover { transform: translateY(-1px); filter: brightness(1.15); }
.selected { border-color: var(--faction-a); background: var(--faction-a-soft); box-shadow: var(--glow-a); }
@media (prefers-reduced-motion: reduce) {
  button.pill { transition: none; }
  button.pill:hover { transform: none; }
}
```

- [ ] **Step 6: Countdown**

`client/src/shared/ui/Countdown.tsx`:

```tsx
import styles from './Countdown.module.css';

type CountdownProps = { seconds: number | null };

export function Countdown({ seconds }: CountdownProps) {
  if (seconds == null) return null;
  const cls = `${styles.countdown} ${seconds <= 10 ? styles.urgent : ''}`.trim();
  return (
    <div aria-label="Tempo rimanente" className={cls}>
      {seconds}s
    </div>
  );
}
```

`client/src/shared/ui/Countdown.module.css`:

```css
.countdown {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.urgent { color: var(--danger); animation: pulse 1s var(--ease) infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .urgent { animation: none; } }
```

- [ ] **Step 7: CodeDisplay**

`client/src/shared/ui/CodeDisplay.tsx`:

```tsx
import styles from './CodeDisplay.module.css';

export function CodeDisplay({ code }: { code: string }) {
  return <div className={styles.code}>{code}</div>;
}
```

`client/src/shared/ui/CodeDisplay.module.css`:

```css
.code {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: 0.4rem;
  line-height: 1;
  color: var(--accent);
  text-shadow: var(--glow-accent);
}
```

- [ ] **Step 8: Field + TextInput**

`client/src/shared/ui/Field.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './Field.module.css';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
```

`client/src/shared/ui/TextInput.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

export function TextInput({ mono, className, ...rest }: TextInputProps) {
  const cls = [styles.input, mono && styles.mono, className].filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
```

`client/src/shared/ui/Field.module.css`:

```css
.field { display: flex; flex-direction: column; gap: var(--space-2); text-align: left; }
.label { color: var(--text-muted); font-size: var(--text-sm); }
.input {
  font-size: var(--text-md);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.input:focus { outline: none; border-color: var(--faction-a); box-shadow: var(--glow-a); }
.mono {
  font-family: var(--font-mono);
  letter-spacing: 0.3rem;
  text-align: center;
  text-transform: uppercase;
}
```

- [ ] **Step 9: Alert**

`client/src/shared/ui/Alert.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './Alert.module.css';

export function Alert({ tone = 'danger', children }: { tone?: 'danger'; children: ReactNode }) {
  return (
    <p role="alert" className={`${styles.alert} ${styles[tone]}`}>
      {children}
    </p>
  );
}
```

`client/src/shared/ui/Alert.module.css`:

```css
.alert { margin: 0; font-weight: 600; }
.danger { color: var(--danger); }
```

- [ ] **Step 10: Barrel export**

`client/src/shared/ui/index.ts`:

```ts
export { Stage } from './Stage';
export { Button } from './Button';
export { Card } from './Card';
export { OptionCard } from './OptionCard';
export { Pill } from './Pill';
export { Countdown } from './Countdown';
export { CodeDisplay } from './CodeDisplay';
export { Field } from './Field';
export { TextInput } from './TextInput';
export { Alert } from './Alert';
```

- [ ] **Step 11: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS. (The components are not consumed yet; this confirms they compile, lint clean, and CSS Modules resolve.)

- [ ] **Step 12: Commit**

```bash
git add client/src/shared/ui
git commit -m "feat(ui): reusable themed component layer (Stage/Button/Card/OptionCard/Pill/Countdown/CodeDisplay/Field/TextInput/Alert)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Refactor HostApp onto the component layer

**Files:**
- Modify: `client/src/host/HostApp.tsx` (full rewrite of JSX + remove the `screen` style object; effects/handlers/state unchanged)

**Interfaces:**
- Consumes: all components from Task 2 (`../shared/ui`), plus `getSocket`, `useCountdown`, and the existing `events.ts` exports (unchanged).

- [ ] **Step 1: Replace HostApp.tsx with the refactored version**

Replace the entire contents of `client/src/host/HostApp.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import { Stage, Button, OptionCard, Pill, Countdown, CodeDisplay, Alert } from '../shared/ui';
import {
  SocketEvents,
  DILEMMA_COUNT_OPTIONS,
  MIN_PLAYERS_TO_START,
  START_ERROR_MESSAGES,
  PHASE_LABELS,
  type RoomCreatedPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type HostStartErrorPayload,
  type PublicPlayer,
} from '../shared/events';

// Shared screen (TV / tablet / laptop). On open it asks the server for a room
// and shows the join code large + a QR pointing phones at the join URL.
export default function HostApp() {
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);
  const [chosenCount, setChosenCount] = useState<number>(DILEMMA_COUNT_OPTIONS[0]);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onRoomCreated = ({ code }: RoomCreatedPayload) => setCode(code);
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => {
      setGame(payload);
      setStartError(null);
    };
    const onStartError = ({ error }: HostStartErrorPayload) =>
      setStartError(START_ERROR_MESSAGES[error] ?? 'Impossibile avviare la partita');
    socket.on(SocketEvents.HostRoomCreated, onRoomCreated);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    socket.on(SocketEvents.HostStartError, onStartError);
    socket.emit(SocketEvents.HostCreateRoom);
    return () => {
      socket.off(SocketEvents.HostRoomCreated, onRoomCreated);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
      socket.off(SocketEvents.HostStartError, onStartError);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  const startGame = () => {
    setStartError(null);
    getSocket().emit(SocketEvents.HostStartGame, { dilemmaCount: chosenCount });
  };

  const advance = () => getSocket().emit(SocketEvents.HostAdvancePhase);

  const canStart = players.length >= MIN_PLAYERS_TO_START;
  const joinUrl = code ? `${window.location.origin}/?room=${code}` : '';

  // In-game: every phase past the lobby shows its label + a server-driven
  // countdown. Detailed per-phase content arrives in later stories; the host
  // can always force-advance.
  if (phase !== 'LOBBY' && game) {
    const inDilemma = game.dilemmaIndex >= 1 && game.dilemmaCount != null;
    // Bind to a local const so the non-null narrowing survives inside the
    // option-mapping closure below (TS drops it for the mutable game.dilemma).
    const dilemma = game.dilemma;
    return (
      <Stage variant="host">
        {inDilemma && (
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 'var(--text-md)' }}>
            Dilemma {game.dilemmaIndex}/{game.dilemmaCount}
          </p>
        )}
        <h1 style={{ fontSize: 'var(--text-xl)' }}>{PHASE_LABELS[phase]}</h1>

        {phase === 'PHASE_INTRO' && (
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)', margin: 0, maxWidth: '40rem' }}>
            Vi mostreremo {game.dilemmaCount} dilemmi. Votate, ascoltate le difese e
            cambiate idea… se vi convincono!
          </p>
        )}

        {dilemma && (
          <section style={{ width: 'min(92vw, 50rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
              {dilemma.text}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <OptionCard faction="a" letter="A" label={dilemma.optionA} />
              <OptionCard faction="b" letter="B" label={dilemma.optionB} />
            </div>
          </section>
        )}

        <Countdown seconds={remaining} />

        {phase !== 'FINAL_AWARDS' && (
          <Button variant="primary" size="md" onClick={advance}>
            Avanti ⏭
          </Button>
        )}
      </Stage>
    );
  }

  return (
    <Stage variant="host">
      <h1 style={{ fontSize: 'var(--text-xl)' }}>Dibattiti tra amici</h1>

      {code ? (
        <>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Entra da <strong>{window.location.host}</strong> con il codice
          </p>
          <CodeDisplay code={code} />
          <div style={{ background: '#fff', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>
            <QRCodeSVG value={joinUrl} size={220} />
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Inquadra il QR per entrare dal telefono</p>

          <section style={{ marginTop: 'var(--space-2)', width: 'min(90vw, 36rem)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)' }}>
              Giocatori ({players.length}/8)
            </h2>
            {players.length === 0 ? (
              <p style={{ color: 'var(--text-faint)', margin: 0 }}>In attesa di giocatori…</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  justifyContent: 'center',
                }}
              >
                {players.map((p) => (
                  <li key={p.id}>
                    <Pill>{p.nickname}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ width: 'min(90vw, 36rem)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Quanti dilemmi?</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }} role="group" aria-label="Numero di dilemmi">
              {DILEMMA_COUNT_OPTIONS.map((n) => (
                <Pill
                  key={n}
                  selected={chosenCount === n}
                  onClick={() => setChosenCount(n)}
                  aria-label={`${n} dilemmi`}
                >
                  {n}
                </Pill>
              ))}
            </div>
            <Button variant="primary" size="lg" onClick={startGame} disabled={!canStart}>
              Inizia la partita
            </Button>
            {!canStart && (
              <p style={{ color: 'var(--text-faint)', margin: 0 }}>
                Servono almeno {MIN_PLAYERS_TO_START} giocatori per iniziare.
              </p>
            )}
            {startError && <Alert>{startError}</Alert>}
          </section>
        </>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Creazione stanza…</p>
      )}
    </Stage>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS. No unused-import warnings (every imported component is used: Stage, Button, OptionCard, Pill, Countdown, CodeDisplay, Alert).

- [ ] **Step 3: Commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "refactor(host): move HostApp onto the design-system components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Refactor PlayerApp onto the component layer

**Files:**
- Modify: `client/src/player/PlayerApp.tsx` (full rewrite of JSX + remove the `wrap` style object; effects/handlers/state unchanged)

**Interfaces:**
- Consumes: `Stage`, `Button`, `Pill`, `Countdown`, `CodeDisplay`, `Field`, `TextInput`, `Alert` from `../shared/ui`.

- [ ] **Step 1: Replace PlayerApp.tsx with the refactored version**

Replace the entire contents of `client/src/player/PlayerApp.tsx` with:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { getSocket } from '../shared/socket';
import { useCountdown } from '../shared/useCountdown';
import { Stage, Button, Pill, Countdown, CodeDisplay, Field, TextInput, Alert } from '../shared/ui';
import {
  SocketEvents,
  JOIN_ERROR_MESSAGES,
  PHASE_LABELS,
  type PlayerJoinedPayload,
  type PlayerJoinErrorPayload,
  type LobbyUpdatePayload,
  type GameStatePayload,
  type PublicPlayer,
} from '../shared/events';

// Read a prefilled room code from the QR join URL (`/?room=CODE`).
function initialCode(): string {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
}

// Per-player phone view. Shows a join form (code + nickname); once joined,
// shows the realtime lobby roster.
export default function PlayerApp() {
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [game, setGame] = useState<GameStatePayload | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onJoined = ({ code }: PlayerJoinedPayload) => {
      setJoinedCode(code);
      setError(null);
      setSubmitting(false);
    };
    const onJoinError = ({ error }: PlayerJoinErrorPayload) => {
      setError(JOIN_ERROR_MESSAGES[error] ?? 'Errore durante l’accesso');
      setSubmitting(false);
    };
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    const onGameState = (payload: GameStatePayload) => setGame(payload);
    socket.on(SocketEvents.PlayerJoined, onJoined);
    socket.on(SocketEvents.PlayerJoinError, onJoinError);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.on(SocketEvents.GameState, onGameState);
    return () => {
      socket.off(SocketEvents.PlayerJoined, onJoined);
      socket.off(SocketEvents.PlayerJoinError, onJoinError);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
      socket.off(SocketEvents.GameState, onGameState);
    };
  }, []);

  const phase = game?.phase ?? 'LOBBY';
  const remaining = useCountdown(game?.phaseExpiresAt ?? null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedNick = nickname.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedNick) {
      setError(JOIN_ERROR_MESSAGES.NICKNAME_REQUIRED);
      return;
    }
    setError(null);
    setSubmitting(true);
    getSocket().emit(SocketEvents.PlayerJoin, { code: trimmedCode, nickname: trimmedNick });
  };

  if (joinedCode && phase !== 'LOBBY') {
    return (
      <Stage variant="player">
        <h1 style={{ fontSize: 'var(--text-lg)' }}>{PHASE_LABELS[phase]}</h1>
        <Countdown seconds={remaining} />
        <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)', margin: 0 }}>
          Guarda lo schermo condiviso 👀
        </p>
      </Stage>
    );
  }

  if (joinedCode) {
    return (
      <Stage variant="player">
        <h1 style={{ fontSize: 'var(--text-md)' }}>Sei nella stanza</h1>
        <CodeDisplay code={joinedCode} />
        <h2 style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          Giocatori ({players.length}/8)
        </h2>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            width: 'min(90vw, 22rem)',
          }}
        >
          {players.map((p) => (
            <li key={p.id}>
              <Pill>{p.nickname}</Pill>
            </li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>In attesa che l’host avvii la partita…</p>
      </Stage>
    );
  }

  return (
    <Stage variant="player">
      <h1 style={{ fontSize: 'var(--text-lg)' }}>Dibattiti tra amici</h1>
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>Entra nella stanza dal tuo telefono.</p>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 'min(90vw, 22rem)' }}
      >
        <Field label="Codice stanza">
          <TextInput
            mono
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
          />
        </Field>
        <Field label="Nickname">
          <TextInput
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Il tuo nome"
            maxLength={20}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? 'Entro…' : 'Entra'}
        </Button>
      </form>
    </Stage>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all PASS. Every imported component is used (Stage, Button, Pill, Countdown, CodeDisplay, Field, TextInput, Alert).

- [ ] **Step 3: Commit**

```bash
git add client/src/player/PlayerApp.tsx
git commit -m "refactor(player): move PlayerApp onto the design-system components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Final quality gate + progress note

**Files:**
- Modify: `progress.txt` (append a Codebase Patterns line for the design system)

- [ ] **Step 1: Run the full quality gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: ALL green. (`npm test` runs the existing server vitest suite — it must still pass, unaffected by client changes.)

- [ ] **Step 2: Record the design-system pattern for future stories**

Append to the `## Codebase Patterns` section of `progress.txt` (keep the existing bullet style):

```
- Client design system (US-design): design tokens are CSS custom properties in client/src/shared/ui/tokens.css (imported once in main.tsx before index.css); reusable themed components live in client/src/shared/ui/*.tsx with co-located *.module.css (CSS Modules, no deps) and a barrel index.ts. Single DARK theme ("Neon party night"): factions A=blue/B=orange, accent violet. Build views by composing Stage/Button/Card/OptionCard/Pill/Countdown/CodeDisplay/Field/TextInput/Alert; reference colors/spacing via var(--token) (no hardcoded hex in views). Display font Space Grotesk is self-hosted (client/src/assets/fonts) — no runtime CDN. Respect prefers-reduced-motion. No client test runner: verify with typecheck/lint/build; real-browser visual check still pending.
```

- [ ] **Step 3: Commit**

```bash
git add progress.txt
git commit -m "docs: record design-system pattern in progress.txt

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes on intentional inline styles

The refactor keeps a *few* inline styles for **one-off layout** (flex containers unique to a screen, `maxWidth`, the QR white-background box) and for one-off text color/size that pulls from tokens via `var(--…)`. This is deliberate: the design system owns the **themed, repeated elements** (buttons, cards, pills, inputs, countdown, code, option cards, alerts, stage), not every unique layout wrapper. All color/spacing values reference design tokens — there are no hardcoded hex values left in the views.
