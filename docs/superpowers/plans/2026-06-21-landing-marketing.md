# Landing marketing SCHIERATI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal `/` chooser with a polished, persuasive marketing landing (showcase layout) that makes people want to play.

**Architecture:** A single scrolling page composed of focused section components under `client/src/landing/`, styled with one co-located CSS Module that references design-system tokens. The CTAs reuse the existing `Button` component and `react-router` navigation (`/host`, `/join`). No server changes.

**Tech Stack:** React + Vite + TypeScript (ESM), `react-router-dom`, CSS Modules, existing design system (`client/src/shared/ui`, `tokens.css`, self-hosted Space Grotesk).

## Global Constraints

- **Copy:** Italian only. Hero title verbatim: `Scegli un lato. Difendilo. Falli cambiare idea.` ("Difendilo" blu, "Falli cambiare idea" arancio). Reuse `OBJECTIVE` and `HOW_TO_PLAY` from `client/src/shared/events.ts`.
- **Colors:** ONLY via `var(--token)` (e.g. `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--text-faint`, `--faction-a`, `--faction-b`, `--accent`, `--radius-*`, `--space-*`, `--font-display`). **No hardcoded hex** in `.tsx` or `.module.css`.
- **CTAs:** use the `Button` component (`variant="primary"|"ghost"`, `size="lg"`) from `../shared/ui`; navigate with `useNavigate()` → `/host` (Crea) and `/join` (Partecipa).
- **Motion:** any entrance animation must be wrapped in `@media (prefers-reduced-motion: no-preference)`. Nothing is required to understand the page.
- **Responsive:** mobile-first; 2-col hero → 1-col under 780px (showcase above text); multi-col grids → 1-col on mobile.
- **No client test runner** (vitest only covers `server/**`). Each task's gate is: `npm run typecheck && npm run lint && npm run build` GREEN, plus a manual visual check. Do NOT add client unit tests.
- **Lint:** avoid `any` (error); prefix intentionally-unused vars/args with `_`.
- **Commits:** stage EXPLICIT paths (never `git add -A` — a parallel agent shares this tree). Commit promptly once green.

---

### Task 1: Hero + scaffolding (replace the landing shell)

Replace `Landing.tsx`, add the CSS Module + a content file, and ship the nav + hero (with device showcase + CTAs). Deliverable: `/` renders the new hero, both CTAs route correctly, gate green.

**Files:**
- Modify (rewrite): `client/src/landing/Landing.tsx`
- Create: `client/src/landing/Landing.module.css`
- Create: `client/src/landing/content.ts`
- Create: `client/src/landing/sections/Hero.tsx`

**Interfaces:**
- Produces: `Landing` (default export, React component) — still the element rendered by `App.tsx` for path `/`. Section components live in `client/src/landing/sections/*` and each `import styles from '../Landing.module.css'`.
- Consumes: `Button` from `../shared/ui`; `useNavigate` from `react-router-dom`; `OBJECTIVE`, `HOW_TO_PLAY` from `../shared/events`.

- [ ] **Step 1: Create the content data file**

Create `client/src/landing/content.ts`:

```ts
// Static marketing content for the landing page. Repeated data lives here so the
// section components stay declarative. Shared copy is reused from events.ts where
// it already exists (HOW_TO_PLAY, OBJECTIVE).

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  { icon: '🗳️', title: '60 dilemmi, mai gli stessi', body: 'Scelte di vita e di business: scomode, divertenti, da litigarci (per gioco).' },
  { icon: '🎯', title: 'Vince chi convince', body: 'Non conta aver ragione: conta far cambiare idea agli altri… e restare pronti a cambiarla tu.' },
  { icon: '🤖', title: 'Anche in pochi', body: 'Pochi amici? Aggiungi dei bot con personalità e giocate lo stesso.' },
  { icon: '🎉', title: 'Nessuno perde', body: 'A fine serata premi simpatici per tutti. Si gioca per ridere, non per vincere.' },
];

export interface Duration {
  nome: string;
  durata: string;
  round: string;
}

export const DURATIONS: Duration[] = [
  { nome: 'Assaggio', durata: '~15 min', round: '3 round' },
  { nome: 'Classica', durata: '~30 min', round: '5 round' },
  { nome: 'Maratona', durata: '~45 min', round: '7 round' },
];

export interface Award {
  emoji: string;
  title: string;
  sub: string;
}

export const AWARDS: Award[] = [
  { emoji: '🏆', title: 'Il Persuasore', sub: 'Ha spostato più voti' },
  { emoji: '🎏', title: 'La Banderuola', sub: 'Cambia idea di continuo' },
  { emoji: '🪨', title: 'Il Roccione', sub: 'Non molla mai' },
  { emoji: '🔮', title: 'In sintonia', sub: 'Sempre con la maggioranza' },
  { emoji: '🦓', title: 'Bastian Contrario', sub: 'Sempre in minoranza' },
];
```

- [ ] **Step 2: Create the CSS Module (base + nav + hero + showcase)**

Create `client/src/landing/Landing.module.css`:

```css
.page {
  min-height: 100vh;
  color: var(--text);
  font-family: var(--font-body);
  background:
    radial-gradient(900px 500px at 80% -10%, var(--faction-b-soft), transparent 60%),
    radial-gradient(900px 600px at 10% 0%, var(--faction-a-soft), transparent 55%),
    var(--bg);
}
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 var(--space-5); }

/* nav */
.nav { display: flex; align-items: center; justify-content: space-between;
  max-width: 1080px; margin: 0 auto; padding: var(--space-5); }
.brand { font-family: var(--font-display); font-weight: 700; font-size: 1.4rem; letter-spacing: .02em; }
.brandA { color: var(--faction-a); } .brandB { color: var(--faction-b); }
.navLinks { display: flex; gap: var(--space-5); align-items: center; }
.navLinks a { color: var(--text-muted); text-decoration: none; font-size: .95rem; }

/* hero */
.hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: var(--space-7);
  align-items: center; padding: var(--space-7) 0 var(--space-6); }
.eyebrow { font-size: .8rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--faction-b); font-weight: 600; margin: 0 0 var(--space-3); }
.title { font-family: var(--font-display); font-size: clamp(2.5rem, 6.5vw, 4.25rem);
  line-height: 1.02; margin: 0 0 var(--space-4); font-weight: 700; letter-spacing: -.01em; }
.title .a { color: var(--faction-a); } .title .b { color: var(--faction-b); }
.lead { font-size: 1.2rem; color: var(--text-muted); margin: 0 0 var(--space-5); max-width: 30ch; }
.ctaRow { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center; }
.meta { margin-top: var(--space-4); color: var(--text-faint); font-size: .9rem; }

/* device showcase */
.stage { position: relative; display: flex; align-items: flex-end; justify-content: center;
  gap: var(--space-3); min-height: 300px; }
.tv { flex: 0 0 64%; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--shadow-card); }
.deviceLab { font-size: .62rem; letter-spacing: .1em; text-transform: uppercase; color: var(--text-faint); }
.tvQ { font-size: .95rem; font-weight: 700; margin: var(--space-1) 0 var(--space-3); }
.opts { display: flex; flex-direction: column; gap: var(--space-2); }
.opt { display: flex; gap: var(--space-2); align-items: center; border-radius: var(--radius-md);
  padding: .55rem .7rem; font-size: .78rem; font-weight: 600; }
.optK { font-weight: 800; font-size: .95rem; opacity: .9; }
.optA { background: var(--faction-a-soft); border: 1.5px solid var(--faction-a); }
.optB { background: var(--faction-b-soft); border: 1.5px solid var(--faction-b); }
.phone { flex: 0 0 22%; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: var(--space-3) var(--space-2); box-shadow: var(--shadow-card); text-align: center; }
.phoneBig { font-size: .8rem; font-weight: 800; margin: var(--space-2) 0; }
.vbtn { border-radius: var(--radius-md); padding: .5rem; margin: var(--space-1) 0; font-weight: 800; }
.vbtnA { background: var(--faction-a-soft); border: 1.5px solid var(--faction-a); }
.vbtnB { background: var(--faction-b-soft); border: 1.5px solid var(--faction-b); }
.mic { font-size: 1.6rem; margin: var(--space-2) 0; }

@media (max-width: 780px) {
  .hero { grid-template-columns: 1fr; }
  .stage { order: -1; }
  .navLinks a { display: none; }
}
```

- [ ] **Step 3: Create the Hero section**

Create `client/src/landing/sections/Hero.tsx`:

```tsx
import { Button } from '../../shared/ui';
import styles from '../Landing.module.css';

interface HeroProps {
  onCreate: () => void;
  onJoin: () => void;
}

// Hero: claim + CTAs on the left, a CSS-built device showcase (phone → TV → phone)
// on the right that mirrors a real moment of play.
export default function Hero({ onCreate, onJoin }: HeroProps) {
  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Party game dal vivo · 3–8 amici</p>
          <h1 className={styles.title}>
            Scegli un lato.<br />
            <span className={styles.a}>Difendilo.</span>{' '}
            <span className={styles.b}>Falli cambiare idea.</span>
          </h1>
          <p className={styles.lead}>
            Dilemmi scomodi di vita e di business. Si vota in segreto, si difende la
            propria scelta, si rivota. Nessun vincitore — solo risate e qualche verità.
          </p>
          <div className={styles.ctaRow}>
            <Button variant="primary" size="lg" onClick={onCreate}>⚡ Crea una partita</Button>
            <Button variant="ghost" size="lg" onClick={onJoin}>Ho un codice · Partecipa</Button>
          </div>
          <p className={styles.meta}>
            Su un solo schermo condiviso + i vostri telefoni · 20–40 min · niente account
          </p>
        </div>

        <div className={styles.stage} aria-hidden="true">
          <div className={styles.phone}>
            <div className={styles.deviceLab}>Il tuo telefono</div>
            <div className={styles.phoneBig}>Tu da che parte stai?</div>
            <div className={`${styles.vbtn} ${styles.vbtnA}`}>A</div>
            <div className={`${styles.vbtn} ${styles.vbtnB}`}>B</div>
          </div>
          <div className={styles.tv}>
            <div className={styles.deviceLab}>Dilemma 2/5 · schermo condiviso</div>
            <div className={styles.tvQ}>
              Un socio ti propone di gonfiare i numeri per chiudere un investimento.
            </div>
            <div className={styles.opts}>
              <div className={`${styles.opt} ${styles.optA}`}>
                <span className={styles.optK}>A</span> Lo faccio: i soldi servono ora
              </div>
              <div className={`${styles.opt} ${styles.optB}`}>
                <span className={styles.optK}>B</span> Mai: la reputazione vale più dei soldi
              </div>
            </div>
          </div>
          <div className={styles.phone}>
            <div className={styles.deviceLab}>Tocca a te</div>
            <div className={styles.mic}>🎤</div>
            <div className={styles.phoneBig} style={{ color: 'var(--faction-b)' }}>Difendi B</div>
            <div className={styles.deviceLab}>30s</div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite Landing.tsx to render nav + Hero**

Replace `client/src/landing/Landing.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui';
import Hero from './sections/Hero';
import styles from './Landing.module.css';

// Marketing landing on `/`: describes the game and funnels to play.
// CTAs route to /host (Crea) and /join (Partecipa) — unchanged targets.
export default function Landing() {
  const navigate = useNavigate();
  const create = () => navigate('/host');
  const join = () => navigate('/join');

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandA}>SCHIE</span>⚡<span className={styles.brandB}>RATI</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#come">Come si gioca</a>
          <a href="#modalita">Modalità</a>
          <Button variant="primary" size="md" onClick={create}>Crea una partita</Button>
        </div>
      </nav>

      <Hero onCreate={create} onJoin={join} />
    </main>
  );
}
```

- [ ] **Step 5: Run the quality gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN (no type errors, no lint errors, client+server build succeed).

- [ ] **Step 6: Visual check**

Run: `npm run dev`, open `http://localhost:5173/`. Expected: dark page, `SCHIE⚡RATI` nav, hero claim with blue "Difendilo" / orange "Falli cambiare idea", device showcase on the right, two CTAs. Click "⚡ Crea una partita" → routes to `/host`; back, click "Partecipa" → `/join`. Narrow the window < 780px: showcase moves above the text, single column. Stop dev (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add client/src/landing/Landing.tsx client/src/landing/Landing.module.css client/src/landing/content.ts client/src/landing/sections/Hero.tsx
git commit -m "feat(landing): marketing hero + device showcase, routing CTAs"
```

---

### Task 2: "Come si gioca" + "Perché ti piacerà" sections

Add the 3-step how-to and the 4-feature grid. Deliverable: both sections render under the hero, gate green.

**Files:**
- Create: `client/src/landing/sections/HowToPlay.tsx`
- Create: `client/src/landing/sections/Features.tsx`
- Modify: `client/src/landing/Landing.module.css` (append section/steps/feature styles)
- Modify: `client/src/landing/Landing.tsx` (render the two sections)

**Interfaces:**
- Consumes: `HOW_TO_PLAY` from `../../shared/events`; `FEATURES` from `../content`; `styles` from `../Landing.module.css`.
- Produces: `HowToPlay`, `Features` default-export components (no props).

- [ ] **Step 1: Append section styles to Landing.module.css**

Append to `client/src/landing/Landing.module.css`:

```css
/* shared section chrome */
.section { padding: var(--space-7) 0; border-top: 1px solid var(--border); }
.kicker { font-size: .8rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; margin: 0 0 var(--space-2); }
.h2 { font-family: var(--font-display); font-size: clamp(1.6rem, 3.6vw, 2.4rem);
  margin: 0 0 var(--space-6); font-weight: 700; letter-spacing: -.01em; }

/* steps */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
.step { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-5); }
.stepN { width: 34px; height: 34px; border-radius: var(--radius-pill); display: grid; place-items: center;
  font-weight: 800; background: rgba(192, 79, 255, .18); color: var(--accent); margin-bottom: var(--space-3); }
.step h3 { margin: 0 0 var(--space-1); font-size: 1.1rem; }
.step p { margin: 0; color: var(--text-muted); font-size: .95rem; }

/* features */
.feat { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.card { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-5); display: flex; gap: var(--space-4); }
.cardIc { font-size: 1.9rem; line-height: 1; }
.card h3 { margin: 0 0 var(--space-1); font-size: 1.1rem; }
.card p { margin: 0; color: var(--text-muted); font-size: .95rem; }

@media (max-width: 780px) {
  .steps { grid-template-columns: 1fr; }
  .feat { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create HowToPlay.tsx**

Create `client/src/landing/sections/HowToPlay.tsx`:

```tsx
import { HOW_TO_PLAY } from '../../shared/events';
import styles from '../Landing.module.css';

const TITLES = ['Voti A o B', 'Si difende', 'Si rivota'];

// 3-step explainer; the short body lines come from the shared HOW_TO_PLAY copy.
export default function HowToPlay() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="come">
      <p className={styles.kicker}>Come si gioca</p>
      <h2 className={styles.h2}>Tre mosse, mille discussioni</h2>
      <div className={styles.steps}>
        {HOW_TO_PLAY.map((line, i) => (
          <div className={styles.step} key={TITLES[i]}>
            <div className={styles.stepN}>{i + 1}</div>
            <h3>{TITLES[i]}</h3>
            <p>{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Features.tsx**

Create `client/src/landing/sections/Features.tsx`:

```tsx
import { FEATURES } from '../content';
import styles from '../Landing.module.css';

export default function Features() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Perché ti piacerà</p>
      <h2 className={styles.h2}>Fatto per accendere il tavolo</h2>
      <div className={styles.feat}>
        {FEATURES.map((f) => (
          <div className={styles.card} key={f.title}>
            <div className={styles.cardIc}>{f.icon}</div>
            <div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Render the two sections in Landing.tsx**

In `client/src/landing/Landing.tsx`, add imports and render after `<Hero ... />`:

```tsx
import HowToPlay from './sections/HowToPlay';
import Features from './sections/Features';
```

```tsx
      <Hero onCreate={create} onJoin={join} />
      <HowToPlay />
      <Features />
```

- [ ] **Step 5: Run the quality gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN.

- [ ] **Step 6: Visual check**

`npm run dev` → `/`: under the hero, a "Come si gioca" row of 3 numbered cards and a "Perché ti piacerà" 2×2 feature grid. On mobile width both stack to one column.

- [ ] **Step 7: Commit**

```bash
git add client/src/landing/sections/HowToPlay.tsx client/src/landing/sections/Features.tsx client/src/landing/Landing.module.css client/src/landing/Landing.tsx
git commit -m "feat(landing): how-to-play steps + features grid"
```

---

### Task 3: "Modalità & durata" + "Cerimonia finale" (premi)

Add the modes/durations band and the awards row. Deliverable: both render, gate green.

**Files:**
- Create: `client/src/landing/sections/Modes.tsx`
- Create: `client/src/landing/sections/Awards.tsx`
- Modify: `client/src/landing/Landing.module.css` (append modes/awards styles)
- Modify: `client/src/landing/Landing.tsx` (render the two sections)

**Interfaces:**
- Consumes: `DURATIONS`, `AWARDS` from `../content`; `styles` from `../Landing.module.css`.
- Produces: `Modes`, `Awards` default-export components (no props).

- [ ] **Step 1: Append modes/awards styles to Landing.module.css**

Append to `client/src/landing/Landing.module.css`:

```css
/* modes */
.modes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
.mode { background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-5); }
.modeT { font-size: 1.25rem; font-weight: 700; }
.modeD { color: var(--text-muted); font-size: .9rem; }
.durs { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip { border: 1px solid var(--border); border-radius: var(--radius-pill);
  padding: .5rem .9rem; font-size: .9rem; color: var(--text-muted); }
.chip b { color: var(--text); }

/* awards */
.awards { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.award { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5); text-align: center; flex: 1 1 160px; }
.awardE { font-size: 1.9rem; }
.awardT { font-weight: 700; margin-top: var(--space-1); font-size: .95rem; }
.awardS { color: var(--text-faint); font-size: .8rem; }

@media (max-width: 780px) {
  .modes { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create Modes.tsx**

Create `client/src/landing/sections/Modes.tsx`:

```tsx
import { DURATIONS } from '../content';
import styles from '../Landing.module.css';

export default function Modes() {
  return (
    <div className={`${styles.wrap} ${styles.section}`} id="modalita">
      <p className={styles.kicker}>Modalità & durata</p>
      <h2 className={styles.h2}>La serata come la vuoi</h2>
      <div className={styles.modes}>
        <div className={styles.mode}>
          <div className={styles.modeT}>👥 Gruppo</div>
          <div className={styles.modeD}>3–8 giocatori · il classico: votate, difendete, cambiate idea.</div>
        </div>
        <div className={styles.mode}>
          <div className={styles.modeT}>⚔️ 1v1 Duello</div>
          <div className={styles.modeD}>In due: testa a testa, chi convince chi.</div>
        </div>
      </div>
      <div className={styles.durs}>
        {DURATIONS.map((d) => (
          <span className={styles.chip} key={d.nome}>
            <b>{d.nome}</b> · {d.durata} · {d.round}
          </span>
        ))}
        <span className={styles.chip}><b>Argomenti:</b> Vita · Business · Misto</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Awards.tsx**

Create `client/src/landing/sections/Awards.tsx`:

```tsx
import { AWARDS } from '../content';
import styles from '../Landing.module.css';

export default function Awards() {
  return (
    <div className={`${styles.wrap} ${styles.section}`}>
      <p className={styles.kicker}>Cerimonia finale</p>
      <h2 className={styles.h2}>Premi per tutti, a modo loro</h2>
      <div className={styles.awards}>
        {AWARDS.map((a) => (
          <div className={styles.award} key={a.title}>
            <div className={styles.awardE}>{a.emoji}</div>
            <div className={styles.awardT}>{a.title}</div>
            <div className={styles.awardS}>{a.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Render the two sections in Landing.tsx**

In `client/src/landing/Landing.tsx`, add imports and render after `<Features />`:

```tsx
import Modes from './sections/Modes';
import Awards from './sections/Awards';
```

```tsx
      <Features />
      <Modes />
      <Awards />
```

- [ ] **Step 5: Run the quality gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN.

- [ ] **Step 6: Visual check**

`npm run dev` → `/`: a "Modalità & durata" band with two mode cards + duration/argument chips, then a "Cerimonia finale" row of 5 award badges. The nav "Modalità" anchor scrolls to the modes section (`id="modalita"`).

- [ ] **Step 7: Commit**

```bash
git add client/src/landing/sections/Modes.tsx client/src/landing/sections/Awards.tsx client/src/landing/Landing.module.css client/src/landing/Landing.tsx
git commit -m "feat(landing): modes/durations band + awards row"
```

---

### Task 4: Final CTA, footer, entrance motion & responsive polish

Add the closing CTA + footer, a reduced-motion-safe entrance animation, and final mobile polish. Deliverable: complete landing, gate green.

**Files:**
- Create: `client/src/landing/sections/FinalCta.tsx`
- Modify: `client/src/landing/Landing.module.css` (append final-cta + motion + mobile padding)
- Modify: `client/src/landing/Landing.tsx` (render FinalCta)

**Interfaces:**
- Consumes: `Button` from `../../shared/ui`; `styles` from `../Landing.module.css`.
- Produces: `FinalCta` default-export component with prop `{ onCreate: () => void }`.

- [ ] **Step 1: Append final-cta + motion styles to Landing.module.css**

Append to `client/src/landing/Landing.module.css`:

```css
/* final CTA */
.final { text-align: center; padding: var(--space-8) var(--space-5); }
.finalH { font-family: var(--font-display); font-size: clamp(1.8rem, 4.4vw, 2.9rem);
  margin: 0 0 var(--space-2); font-weight: 700; }
.finalH .a { color: var(--faction-a); } .finalH .b { color: var(--faction-b); }
.finalP { color: var(--text-muted); margin: 0 0 var(--space-5); }
.foot { color: var(--text-faint); font-size: .8rem; text-align: center; padding: var(--space-5) 0 var(--space-7); }

/* entrance motion — only when the user hasn't asked to reduce motion */
@media (prefers-reduced-motion: no-preference) {
  .hero, .section, .final {
    animation: rise var(--dur-med) var(--ease) both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: none; }
  }
}

@media (max-width: 780px) {
  .wrap { padding: 0 var(--space-4); }
  .section { padding: var(--space-6) 0; }
}
```

- [ ] **Step 2: Create FinalCta.tsx**

Create `client/src/landing/sections/FinalCta.tsx`:

```tsx
import { Button } from '../../shared/ui';
import styles from '../Landing.module.css';

interface FinalCtaProps {
  onCreate: () => void;
}

export default function FinalCta({ onCreate }: FinalCtaProps) {
  return (
    <div className={styles.final}>
      <h2 className={styles.finalH}>
        Pronti a <span className={styles.a}>schierar</span><span className={styles.b}>vi</span>?
      </h2>
      <p className={styles.finalP}>Apri lo schermo grande, fai inquadrare il QR agli amici e via.</p>
      <Button variant="primary" size="lg" onClick={onCreate}>⚡ Crea una partita</Button>
      <p className={styles.foot}>Gratis · niente download · niente account · dal browser</p>
    </div>
  );
}
```

- [ ] **Step 3: Render FinalCta in Landing.tsx**

In `client/src/landing/Landing.tsx`, add the import and render after `<Awards />`:

```tsx
import FinalCta from './sections/FinalCta';
```

```tsx
      <Awards />
      <FinalCta onCreate={create} />
```

- [ ] **Step 4: Run the quality gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all GREEN.

- [ ] **Step 5: Visual check (desktop, mobile, reduced-motion)**

`npm run dev` → `/`: closing "Pronti a schierarvi?" CTA + footer. Sections fade/rise in on load. In the OS "Reduce motion" setting (or DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`), reload: no entrance animation, page fully readable. Narrow to phone width: comfortable padding, everything single-column, CTAs reachable.

- [ ] **Step 6: Final full gate + commit**

```bash
git add client/src/landing/sections/FinalCta.tsx client/src/landing/Landing.module.css client/src/landing/Landing.tsx
git commit -m "feat(landing): final CTA, footer, reduced-motion entrance + mobile polish"
```

---

## Self-Review

**Spec coverage:**
- Routing (replace `/`, CTAs → /host//join) → Task 1 (Landing.tsx + Hero CTAs). ✓
- Sections nav→hero→howto→features→modes→awards→finalCTA → Tasks 1–4. ✓
- Device showcase (phone/TV/phone) → Task 1 Hero. ✓
- Real copy (hero claim verbatim, OBJECTIVE-framed feature, HOW_TO_PLAY, awards) → content.ts + Hero/HowToPlay/Features/Awards. ✓
- Design system: tokens only, Button, Space Grotesk via --font-display, CSS Module → all tasks (Global Constraints + CSS uses var(--token)). ✓
- Responsive + prefers-reduced-motion → Task 1/2/3 media queries + Task 4 motion guard. ✓
- Verification via typecheck/lint/build (no client tests) → every task Step "quality gate". ✓
- A11y: single `h1` (only in Hero; other sections use `.h2`/`h2`), CTAs are real buttons (Button), section `id`s for anchors. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `Feature/Duration/Award` interfaces defined in `content.ts` (Task 1) and consumed in Tasks 2–3 with matching field names (`icon/title/body`, `nome/durata/round`, `emoji/title/sub`). `Hero` & `FinalCta` props (`onCreate`, `onJoin`) match Landing.tsx call sites. Section components are prop-less except Hero/FinalCta. CSS class names referenced in `.tsx` (`styles.x`) are all defined in `Landing.module.css` across the appends. ✓

**Note on `h1`:** only the Hero renders an `h1`; section titles use a `.h2` class on `h2` elements — keeps a single top-level heading.
