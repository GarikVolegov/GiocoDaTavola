# Sfondo "bivio in prospettiva" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire lo sfondo navy piatto del gioco con una scena "bivio in prospettiva" (due corsie A blu / B terracotta), piena sul `/host` e accennata sui telefoni, reattiva al voto aggregato alla rivelazione del risultato.

**Architecture:** Un componente decorativo `BivioBackdrop` (layer `position: fixed`, `aria-hidden`, dietro al contenuto) montato una volta per route in `App.tsx` — così copre tutte le fasi senza toccare i molti `return` di host/player. La reattività al `SPLIT_REVEAL` passa per una CSS custom property globale `--bivio-lean` (0–100, default 50) che `HostApp` imposta dal voto aggregato; il componente resta "muto" e legge solo la variabile.

**Tech Stack:** React + TypeScript ESM (client), Vite, Vitest + @testing-library/react (jsdom), CSS Modules. Token di colore in `client/src/shared/ui/tokens.css`.

## Global Constraints

- Client è **TypeScript ESM**; non mescolare col server CJS.
- **Vietato `any`** (errore di lint). Prefissare con `_` gli arg intenzionalmente inutilizzati.
- **Voti segreti**: nessuna reattività dello sfondo durante `VOTE_1`/`VOTE_2`; solo a `SPLIT_REVEAL` (dato aggregato già pubblico).
- Niente file raster / asset esterni: scena interamente CSS/SVG coi token `--faction-a` (#5486C4), `--faction-b` (#C77A45), `--gold` (#C9A35A), `--bg` (#0B0E1A).
- Gate completo verde prima di ogni commit: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.
- Test client: file `*.test.tsx` con header `// @vitest-environment jsdom`, import da `vitest` e `@testing-library/react`, `afterEach(() => cleanup())`.

---

### Task 1: helper puro `leanFromSplit`

**Files:**
- Create: `client/src/shared/ui/BivioBackdrop.tsx`
- Test: `client/src/shared/ui/BivioBackdrop.test.tsx`

**Interfaces:**
- Consumes: `VoteSplit` da `../events` (forma `{ A: number; B: number }`).
- Produces: `export function leanFromSplit(split: VoteSplit): number` — percentuale di voti sul lato A (0–100), arrotondata; `50` quando non ci sono voti (`A + B === 0`).

- [ ] **Step 1: Write the failing test**

In `client/src/shared/ui/BivioBackdrop.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { leanFromSplit } from './BivioBackdrop';

afterEach(() => cleanup());

describe('leanFromSplit', () => {
  it('returns 50 (neutral) when there are no votes', () => {
    expect(leanFromSplit({ A: 0, B: 0 })).toBe(50);
  });
  it('returns 100 when every vote is on A', () => {
    expect(leanFromSplit({ A: 3, B: 0 })).toBe(100);
  });
  it('returns 0 when every vote is on B', () => {
    expect(leanFromSplit({ A: 0, B: 4 })).toBe(0);
  });
  it('returns the rounded A-percentage otherwise', () => {
    expect(leanFromSplit({ A: 1, B: 3 })).toBe(25);
    expect(leanFromSplit({ A: 1, B: 2 })).toBe(33);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BivioBackdrop`
Expected: FAIL — `leanFromSplit` non esiste / modulo non risolto.

- [ ] **Step 3: Write minimal implementation**

In `client/src/shared/ui/BivioBackdrop.tsx`:

```tsx
import type { VoteSplit } from '../events';

/**
 * Percentuale di voti sul lato A (0–100). Quando non ci sono voti ritorna 50
 * (neutro). Guida la CSS var --bivio-lean per far "pendere" lo sfondo bivio al
 * SPLIT_REVEAL verso il lato in testa.
 */
export function leanFromSplit(split: VoteSplit): number {
  const total = split.A + split.B;
  if (total === 0) return 50;
  return Math.round((split.A / total) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BivioBackdrop`
Expected: PASS (4 test verdi).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/ui/BivioBackdrop.tsx client/src/shared/ui/BivioBackdrop.test.tsx
git commit -m "feat(ui): leanFromSplit per lo sfondo bivio reattivo"
```

---

### Task 2: componente `BivioBackdrop` + CSS module

**Files:**
- Modify: `client/src/shared/ui/BivioBackdrop.tsx` (aggiungi il componente sotto `leanFromSplit`)
- Create: `client/src/shared/ui/BivioBackdrop.module.css`
- Test: `client/src/shared/ui/BivioBackdrop.test.tsx` (estendi)

**Interfaces:**
- Consumes: `leanFromSplit` (Task 1, stesso file) — non usato qui ma coesiste nel file.
- Produces: `export function BivioBackdrop({ variant }: { variant?: 'host' | 'player' }): JSX.Element` — un layer decorativo `data-testid="bivio-backdrop"`, `aria-hidden="true"`, con CSS var inline `--bivio-k` (`'1'` per host, `'0.4'` per player).

- [ ] **Step 1: Write the failing test**

Prima estendi gli import in cima al file (per non violare `import/first`):
- cambia `import { cleanup } from '@testing-library/react';` in
  `import { cleanup, render, screen } from '@testing-library/react';`
- cambia `import { leanFromSplit } from './BivioBackdrop';` in
  `import { BivioBackdrop, leanFromSplit } from './BivioBackdrop';`

Poi aggiungi in fondo a `client/src/shared/ui/BivioBackdrop.test.tsx`:

```tsx
describe('BivioBackdrop', () => {
  it('renders a decorative, aria-hidden layer', () => {
    render(<BivioBackdrop variant="host" />);
    const el = screen.getByTestId('bivio-backdrop');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses full intensity on host', () => {
    render(<BivioBackdrop variant="host" />);
    expect(screen.getByTestId('bivio-backdrop').style.getPropertyValue('--bivio-k')).toBe('1');
  });

  it('uses reduced intensity on player', () => {
    render(<BivioBackdrop variant="player" />);
    expect(screen.getByTestId('bivio-backdrop').style.getPropertyValue('--bivio-k')).toBe('0.4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BivioBackdrop`
Expected: FAIL — `BivioBackdrop` non è esportato dal modulo.

- [ ] **Step 3: Write minimal implementation**

Aggiungi in cima a `client/src/shared/ui/BivioBackdrop.tsx` l'import del CSS module, e in fondo il componente:

```tsx
import styles from './BivioBackdrop.module.css';
```

```tsx
type BivioBackdropProps = {
  /** host = scena piena; player = scena accennata (UI di gioco leggibile). */
  variant?: 'host' | 'player';
};

/**
 * Sfondo decorativo "bivio in prospettiva": due corsie a ventaglio dal basso
 * (A blu a sinistra, B terracotta a destra) + alone d'orizzonte + velo. Layer
 * fisso dietro al contenuto, aria-hidden e non interattivo. `variant` regola
 * solo l'intensità (--bivio-k). La reattività al reveal arriva dalla CSS var
 * globale --bivio-lean (default 50), impostata da HostApp.
 */
export function BivioBackdrop({ variant = 'player' }: BivioBackdropProps) {
  return (
    <div
      className={styles.backdrop}
      data-testid="bivio-backdrop"
      aria-hidden="true"
      style={{ ['--bivio-k' as never]: variant === 'host' ? '1' : '0.4' }}
    >
      <div className={styles.laneA} />
      <div className={styles.laneB} />
      <div className={styles.veil} />
    </div>
  );
}
```

Crea `client/src/shared/ui/BivioBackdrop.module.css`:

```css
/* Sfondo "bivio in prospettiva". Tutto coi token; nessun raster.
   --bivio-k  : intensità (1 host, 0.4 player), impostata inline dal componente.
   --bivio-lean : 0–100 (% lato A), impostata da HostApp su :root; default 50. */

.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(60% 46% at 50% 0%, rgba(201, 163, 90, calc(0.16 * var(--bivio-k, 1))), transparent 70%),
    var(--bg);
}

/* Due corsie a ventaglio dal centro-basso verso gli angoli alti. L'opacità
   "pende" col lean: a 50 sono pari (0.75); A sale fino a 1 / B scende a 0.5. */
.laneA,
.laneB {
  position: absolute;
  inset: 0;
}
.laneA {
  clip-path: polygon(50% 100%, 43% 100%, 0% 0%, 40% 0%);
  background: linear-gradient(
    to top,
    rgba(84, 134, 196, calc(0.55 * var(--bivio-k, 1))),
    rgba(84, 134, 196, calc(0.04 * var(--bivio-k, 1)))
  );
  opacity: calc(0.5 + var(--bivio-lean, 50) / 200);
}
.laneB {
  clip-path: polygon(50% 100%, 57% 100%, 100% 0%, 60% 0%);
  background: linear-gradient(
    to top,
    rgba(199, 122, 69, calc(0.55 * var(--bivio-k, 1))),
    rgba(199, 122, 69, calc(0.04 * var(--bivio-k, 1)))
  );
  opacity: calc(1 - var(--bivio-lean, 50) / 200);
}

/* Velo: vignettatura in basso per far "sedere" la UI sopra la scena. */
.veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(130% 75% at 50% 125%, transparent 42%, rgba(11, 14, 26, 0.78) 100%);
}

/* Il lean transita dolcemente solo se l'utente non ha chiesto reduced-motion. */
@media (prefers-reduced-motion: no-preference) {
  .laneA,
  .laneB {
    transition: opacity 700ms var(--ease, ease-out);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BivioBackdrop`
Expected: PASS (leanFromSplit + i 3 nuovi test del componente).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/ui/BivioBackdrop.tsx client/src/shared/ui/BivioBackdrop.module.css client/src/shared/ui/BivioBackdrop.test.tsx
git commit -m "feat(ui): componente BivioBackdrop (scena bivio in prospettiva)"
```

---

### Task 3: export dalla UI + montaggio in `App.tsx`

**Files:**
- Modify: `client/src/shared/ui/index.ts` (aggiungi export)
- Modify: `client/src/App.tsx:33-34` (monta il backdrop su `/host` e `/join`)

**Interfaces:**
- Consumes: `BivioBackdrop` (Task 2).
- Produces: nessuna nuova API; il backdrop è ora reso su entrambe le route di gioco.

- [ ] **Step 1: Aggiungi l'export**

In `client/src/shared/ui/index.ts` aggiungi (vicino agli altri export):

```ts
export { BivioBackdrop, leanFromSplit } from './BivioBackdrop';
```

- [ ] **Step 2: Importa e monta in App.tsx**

In `client/src/App.tsx`, aggiungi all'inizio (le altre view sono lazy, ma il backdrop è minuscolo e serve subito su entrambe le route → import statico):

```tsx
import { BivioBackdrop } from './shared/ui';
```

Poi sostituisci le due route `/host` e `/join` (attuali righe 33–34):

```tsx
            <Route path="/host" element={<><ConnectionBanner /><BivioBackdrop variant="host" /><HostApp /></>} />
            <Route path="/join" element={<><ConnectionBanner /><BivioBackdrop variant="player" /><PlayerApp /></>} />
```

- [ ] **Step 3: Verifica gate (typecheck + build)**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: tutti verdi; il bundle costruisce. (Nessun nuovo unit test: è puro wiring di routing, coperto dalla verifica visiva nel Task 4.)

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/ui/index.ts client/src/App.tsx
git commit -m "feat(ui): monta BivioBackdrop su /host (piena) e /join (accennata)"
```

---

### Task 4: reattività al reveal in `HostApp`

**Files:**
- Modify: `client/src/host/HostApp.tsx:19` (aggiungi `leanFromSplit` all'import da `../shared/ui`)
- Modify: `client/src/host/HostApp.tsx:150` (aggiungi un `useEffect` subito dopo `useEffect(() => () => stopAmbient(), []);`)

**Interfaces:**
- Consumes: `leanFromSplit` (Task 1/3) da `../shared/ui`; `phase` (HostApp:123) e `game?.split` (`VoteSplit | null`) già in scope.
- Produces: imposta la CSS var globale `--bivio-lean` su `document.documentElement`; nessuna nuova API.

- [ ] **Step 1: Aggiungi `leanFromSplit` all'import UI**

In `client/src/host/HostApp.tsx` riga 19, aggiungi `leanFromSplit` alla lista destrutturata da `'../shared/ui'`:

```tsx
import { Card, CardGrid, DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, Logo, Swing, Button, TextInput, Alert, Celebration, RoomCodeChip, leanFromSplit } from '../shared/ui';
```

- [ ] **Step 2: Aggiungi l'effetto reattivo**

In `client/src/host/HostApp.tsx`, subito dopo la riga `useEffect(() => () => stopAmbient(), []);` (riga ~150), inserisci:

```tsx
  // Sfondo "bivio": al SPLIT_REVEAL la scena pende verso il lato in testa
  // (voto AGGREGATO — i voti restano segreti, nessun aggancio durante VOTE_*).
  // In ogni altra fase resta neutra (50). La var vive su :root così la legge il
  // BivioBackdrop montato in App.tsx.
  useEffect(() => {
    const root = document.documentElement;
    const lean = phase === 'SPLIT_REVEAL' && game?.split ? leanFromSplit(game.split) : 50;
    root.style.setProperty('--bivio-lean', String(lean));
    return () => {
      root.style.setProperty('--bivio-lean', '50');
    };
  }, [phase, game?.split]);
```

- [ ] **Step 3: Verifica gate completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutti verdi.

- [ ] **Step 4: Verifica visiva manuale**

Run: `npm run dev`
- Apri `http://localhost:5173/host?code=XXXX` → la scena del bivio è **piena** dietro le fasi.
- Apri `http://localhost:5173/join` → la scena è **accennata** (UI di voto perfettamente leggibile).
- Gioca fino a un `SPLIT_REVEAL` con voti sbilanciati → sul host la corsia del lato in testa si illumina/allarga; tornando alle fasi successive torna neutra.
- Verifica che `/`, `/casa`, `/profilo`, `/impostazioni` **non** abbiano lo sfondo bivio (restano com'erano).

- [ ] **Step 5: Commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "feat(host): sfondo bivio reattivo al SPLIT_REVEAL (--bivio-lean)"
```

---

## Note di esecuzione

- A fine lavoro (gate verde + commit) fare `git push` del branch `ralph/skeleton-dilemma` (regola fissa di progetto). Non usare `git add -A`: committare solo i file elencati.
- Non committare la modifica preesistente a `server/.env.example` (estranea a questa feature).

## Self-review (mappatura spec → task)

- Bivio universale / composizione "strada in prospettiva" / solo CSS-SVG → Task 2 (CSS module, clip-path, token).
- Host pieno vs telefono accennato (`--bivio-k` 1 / 0.4) → Task 2 (prop `variant`) + Task 3 (montaggio per route).
- Copertura di tutte le fasi senza refactor delle viste → Task 3 (montaggio in `App.tsx`, `position: fixed`).
- Route non di gioco invariate → Task 3 (il backdrop è solo su `/host` e `/join`).
- Reattività solo a `SPLIT_REVEAL` su dato aggregato, voti segreti rispettati → Task 1 (`leanFromSplit`) + Task 4 (effetto su `phase`/`game.split`).
- `prefers-reduced-motion` → Task 2 (media query sulla transizione).
- Gate verde + verifica visiva → Task 3 e Task 4.
