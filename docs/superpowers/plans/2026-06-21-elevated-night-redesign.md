# Redesign "elevated night" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Applicare l'export di Claude Design ("elevated night") a SCHIERATI — un travaso **solo visivo** (CSS + markup + asset).

**Architecture:** L'80% dell'effetto arriva sostituendo `tokens.css`: i `*.module.css` usano già `var(--…)`, quindi si ricolorano da soli. Sopra ci sono: nuovo brand "bivio" (icona + componente `Logo`), componente `Swing`, ritocchi cosmetici puntuali, sostituzione dei colori di fazione hardcoded, tipografia serif editoriale e il rework della Landing.

**Tech Stack:** React 18 + Vite (ESM, TypeScript), CSS Modules + CSS custom properties. Font: Space Grotesk (self-hostato woff2) + Newsreader (Google Fonts `@import`).

## Global Constraints

- **NON toccare** `server/`, eventi Socket.IO, timer, payload, né i test di logica. *(verbatim dalla spec)*
- Niente fulmine `⚡` / framing "A vs B" da duello.
- Niente glow al neon: enfasi = hairline ring + bloom tenue (già nei nuovi token).
- Niente font incorporato dentro SVG usati come `<img>`.
- Newsreader resta via **Google Fonts `@import`** (no self-host in questo intervento).
- Colori di fazione: **A = `84,134,196`** (blu), **B = `199,122,69`** (terracotta).
- **Gate di verifica (deve restare verde):** `npm run typecheck && npm run lint && npm test && npm run build`. I 195 test di logica non cambiano.
- Branch di lavoro: `worktree-design+elevated-night` (worktree isolato già attivo).
- Fonte di verità dei valori: `docs/superpowers/specs/handoff-elevated-night/` (handoff committato).

> **Nota sui "test" delle task:** è un redesign visivo; non si scrivono unit test nuovi. Il ciclo di ogni task è: applica → `npm run typecheck && npm run lint && npm run build` verde (più `npm test` dove tocchiamo `.tsx`) → commit. La verifica visiva è manuale (`npm run dev`) ed è elencata nella task finale.

## File Structure

| File | Responsabilità | Azione |
|------|----------------|--------|
| `client/src/shared/ui/tokens.css` | token di design (la base) | **Replace** |
| `client/public/schierati-icon.svg` | favicon / marchio bivio | **Replace** |
| `client/src/shared/ui/Logo.tsx` + `.module.css` | lockup "bivio" | **Create** |
| `client/src/shared/ui/Swing.tsx` + `.module.css` | motivo swing A/B | **Create** |
| `client/src/shared/ui/index.ts` | barrel export | **Modify** |
| `client/src/shared/ui/Button.module.css` | colore testo primario | **Modify** |
| `client/src/shared/ui/CodeDisplay.module.css` | text-shadow non-neon | **Modify** |
| `client/src/host/HostApp.tsx` | rgba fazione + `<img>`→`<Logo>` + serif titoli | **Modify** |
| `client/src/player/PlayerApp.tsx` | rgba fazione | **Modify** |
| `client/src/shared/ui/PublicViews.tsx` | rgba fazione | **Modify** |
| `client/src/landing/Landing.tsx` + `.module.css` | nav sticky, brand bivio, serif, watermark, reveal | **Modify** |
| `client/src/landing/sections/*.tsx` | togli `⚡`, icone a tratto, Swing tally | **Modify** |

---

### Task 1: Token foundation

**Files:**
- Modify: `client/src/shared/ui/tokens.css` (replace whole file)
- Reference: `docs/superpowers/specs/handoff-elevated-night/tokens.css`

**Interfaces:**
- Produces: tutte le custom properties `--bg, --surface, --surface-2, --text, --faction-a/-b(+-soft/-line), --gold, --accent(=gold), --font-serif, --font-display, --radius-md/-lg, --glow-a/-b/-accent, --ring-*, --shadow-card, --bg-ambient`. Le task successive vi si appoggiano.

- [ ] **Step 1: Sostituisci il file token**

```bash
cp docs/superpowers/specs/handoff-elevated-night/tokens.css client/src/shared/ui/tokens.css
```

- [ ] **Step 2: Correggi il path del font self-hostato**

Nel blocco `@font-face` di Space Grotesk, l'handoff ha `url('../fonts/space-grotesk-variable.woff2')`. Nel repo il font sta in `client/src/assets/fonts/`. Da `tokens.css` (in `client/src/shared/ui/`) il path relativo corretto è `../../assets/fonts/`. Modifica la riga:

```css
  src: url('../../assets/fonts/space-grotesk-variable.woff2') format('woff2');
```

- [ ] **Step 3: Verifica import order**

`client/src/main.tsx` deve importare `./shared/ui/tokens.css` **prima** di `./index.css` (già così alle righe 5–6). Nessuna modifica attesa; conferma solo.

- [ ] **Step 4: Verifica gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (CSS compila; nessun errore TS/lint).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/ui/tokens.css
git commit -m "feat(design): token 'elevated night' (navy + blu/terracotta + oro)"
```

---

### Task 2: Brand asset (icona bivio)

**Files:**
- Modify: `client/public/schierati-icon.svg` (replace)
- Reference: `docs/superpowers/specs/handoff-elevated-night/schierati-icon.svg`

- [ ] **Step 1: Sostituisci la favicon**

```bash
cp docs/superpowers/specs/handoff-elevated-night/schierati-icon.svg client/public/schierati-icon.svg
```

(`client/index.html:6` la linka già; nessun'altra modifica.)

- [ ] **Step 2: Verifica gate**

Run: `npm run build`
Expected: PASS. Verifica a occhio in dev che la favicon sia il nuovo bivio.

- [ ] **Step 3: Commit**

```bash
git add client/public/schierati-icon.svg
git commit -m "feat(design): nuova favicon 'bivio'"
```

---

### Task 3: Componenti Logo + Swing

**Files:**
- Create: `client/src/shared/ui/Logo.tsx`, `client/src/shared/ui/Logo.module.css`
- Create: `client/src/shared/ui/Swing.tsx`, `client/src/shared/ui/Swing.module.css`
- Modify: `client/src/shared/ui/index.ts`
- Reference: `docs/superpowers/specs/handoff-elevated-night/components/`

**Interfaces:**
- Produces:
  - `Logo({ size?: number; payoff?: boolean; panel?: boolean })` — lockup bivio.
  - `Swing({ width?: number; height?: number; split?: number; labels?: boolean; animated?: boolean })` — barra A/B.

- [ ] **Step 1: Copia i componenti (rinominando `.tsx.txt` → `.tsx`)**

```bash
cp docs/superpowers/specs/handoff-elevated-night/components/Logo.tsx.txt   client/src/shared/ui/Logo.tsx
cp docs/superpowers/specs/handoff-elevated-night/components/Logo.module.css client/src/shared/ui/Logo.module.css
cp docs/superpowers/specs/handoff-elevated-night/components/Swing.tsx.txt   client/src/shared/ui/Swing.tsx
cp docs/superpowers/specs/handoff-elevated-night/components/Swing.module.css client/src/shared/ui/Swing.module.css
```

- [ ] **Step 2: Esporta dal barrel**

In `client/src/shared/ui/index.ts`, aggiungi in fondo:

```ts
export { Logo } from './Logo';
export { Swing } from './Swing';
```

- [ ] **Step 3: Verifica gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. (I componenti usano `['--logo-size' as never]` per le CSS var inline — compatibile con la regola no-`any`.)

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/ui/Logo.tsx client/src/shared/ui/Logo.module.css client/src/shared/ui/Swing.tsx client/src/shared/ui/Swing.module.css client/src/shared/ui/index.ts
git commit -m "feat(design): componenti Logo (bivio) e Swing"
```

---

### Task 4: Ritocchi cosmetici componenti

**Files:**
- Modify: `client/src/shared/ui/Button.module.css:13`
- Modify: `client/src/shared/ui/CodeDisplay.module.css:8`

> Gli altri `.module.css` (Card, OptionCard, Pill, Field, Countdown, Alert) usano già solo token e si ricolorano da soli: **nessuna modifica**.

- [ ] **Step 1: Button — testo primario chiaro**

In `Button.module.css`, riga 13, cambia il colore hardcoded:

```css
.primary { background: var(--faction-a); color: var(--text); }
```

- [ ] **Step 2: CodeDisplay — text-shadow non-neon valido**

In `CodeDisplay.module.css`, riga 8: `var(--glow-accent)` è un `box-shadow` (con spread `1.5px`) **non valido** come `text-shadow`. Sostituisci con un'ombra oro tenue e valida:

```css
  text-shadow: 0 2px 18px var(--gold-soft);
```

- [ ] **Step 3: Verifica gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/ui/Button.module.css client/src/shared/ui/CodeDisplay.module.css
git commit -m "feat(design): Button testo chiaro + CodeDisplay oro non-neon"
```

---

### Task 5: Colori di fazione hardcoded + logo `<img>`→`<Logo>`

**Files:**
- Modify: `client/src/host/HostApp.tsx` (rgba alle righe 232, 234, 278, 325, 326; `<img>` alle ~90 e ~405)
- Modify: `client/src/player/PlayerApp.tsx` (rgba alle righe 452, 631, 690)
- Modify: `client/src/shared/ui/PublicViews.tsx` (rgba alle righe 27, 28)

**Interfaces:**
- Consumes: `Logo` da `../shared/ui` (Task 3).

- [ ] **Step 1: Sostituisci le triplette rgb di fazione (A blu, B terracotta)**

Sostituzione testuale in tutti e tre i file: `79,140,255` → `84,134,196` e `255,140,79` → `199,122,69` (mantieni gli alpha esistenti). Comando:

```bash
for f in client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx client/src/shared/ui/PublicViews.tsx; do
  perl -0pi -e 's/79,\s*140,\s*255/84,134,196/g; s/255,\s*140,\s*79/199,122,69/g' "$f"
done
```

Poi verifica che non resti nessuna vecchia tripletta:

```bash
grep -rn -E "79, ?140, ?255|255, ?140, ?79" client/src   # atteso: solo eventuali in tokens.css? no — atteso: nessun risultato
```

- [ ] **Step 2: Sostituisci i due `<img>` logo dell'host con `<Logo>`**

In `client/src/host/HostApp.tsx`, importa `Logo` dal barrel (`import { …, Logo } from '../shared/ui';` — verifica l'import esistente) e rimpiazza **entrambi** i blocchi:

```tsx
        <img
          src="/schierati-logo.svg"
          alt="SCHIERATI — il gioco dei dilemmi tra amici"
          style={{ width: 'min(82vw, 34rem)', height: 'auto' }}
        />
```

con:

```tsx
        <Logo size={64} payoff />
```

- [ ] **Step 3: Verifica gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS (195 test invariati).

- [ ] **Step 4: Commit**

```bash
git add client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx client/src/shared/ui/PublicViews.tsx
git commit -m "feat(design): colori fazione via nuovi valori + logo bivio nell'host"
```

---

### Task 6: Tipografia editoriale (serif) sull'host

**Files:**
- Modify: `client/src/host/HostApp.tsx` (titolo display di `PHASE_INTRO` e claim "da vetrina")

**Interfaces:**
- Consumes: token `--font-serif` (Task 1).

- [ ] **Step 1: Applica `--font-serif` ai titoli da vetrina dell'host**

Individua il titolo grande della fase `PHASE_INTRO` (intorno a `client/src/host/HostApp.tsx:159`) e i grandi claim editoriali; imposta `fontFamily: 'var(--font-serif)'` sullo stile del titolo (NON su room code, countdown, label: quelli restano Space Grotesk). Esempio di stile da applicare al titolo:

```tsx
style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: 'var(--tracking-serif)' }}
```

- [ ] **Step 2: Verifica gate**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "feat(design): titoli host in serif Newsreader"
```

---

### Task 7: Rework Landing (§7)

**Files:**
- Modify: `client/src/landing/Landing.tsx`
- Modify: `client/src/landing/Landing.module.css`
- Modify: `client/src/landing/sections/Hero.tsx`, `FinalCta.tsx`, `Features.tsx`, `Modes.tsx`

> **Nota:** l'HTML `ui_kits/landing` non è nell'export; questa task segue la descrizione testuale del §7 + i token. È la task più "a vista" — iterabile dopo con screenshot.

**Interfaces:**
- Consumes: `Logo`, `Swing` da `../shared/ui` (Task 3).

- [ ] **Step 1: Brand bivio + nav sticky in `Landing.tsx`**

Sostituisci il brand col fulmine (riga 25) con `<Logo size={26} />` e aggiungi la classe sticky al `<nav>`:

```tsx
import { Logo } from '../shared/ui';
// …
      <nav className={styles.nav}>
        <Logo size={26} />
        <div className={styles.navLinks}>
          {/* invariato */}
        </div>
      </nav>
```

- [ ] **Step 2: `Landing.module.css` — nav sticky translucida, serif, watermark, reveal**

a) Nav sticky translucida:

```css
.nav { position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1080px; margin: 0 auto; padding: var(--space-5);
  backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  border-bottom: 1px solid var(--border); }
```

b) Titoli serif — cambia `font-family` di `.title`, `.h2`, `.finalH` da `var(--font-display)` a `var(--font-serif)` e i pesi a 500.

c) Rimuovi il viola neon residuo: in `.stepN` (riga ~82) sostituisci `background: rgba(192, 79, 255, .18);` con `background: var(--gold-soft);`.

d) Un solo bivio filigrana dietro l'eroe: aggiungi a `.page` (o a `.hero`) un `::before` con l'icona bivio molto tenue, position absolute, `opacity: .05`, niente puntini sparsi. Rimuovi gli ambient blob doppi se troppo carichi (lascia `--bg-ambient` dei token).

e) Reveal allo scroll via IntersectionObserver: tieni l'attuale `@keyframes rise` come fallback, ma aggiungi una classe `.reveal`/`.in` e un piccolo hook (vedi Step 3). Guardia `@media print { .reveal { opacity: 1 } }`.

f) Breakpoint §7: stack sotto **1024px** (porta i `@media (max-width: 780px)` di hero/steps/feat/modes a `1024px` dove serve), nav link nascosti sotto **680px**, CTA full-width su mobile (`.ctaRow > * { flex: 1 1 100% }` sotto 680px).

- [ ] **Step 3: Scroll reveal hook in `Landing.tsx`**

Aggiungi un `useEffect` con `IntersectionObserver` che aggiunge la classe `in` alle sezioni `.reveal` quando entrano in viewport, con fallback `setTimeout` che le rivela tutte dopo 1.2s:

```tsx
import { useEffect } from 'react';
// dentro il componente:
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add('in')), 1200);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
```

(Aggiungi `data-reveal` alle sezioni che vuoi animare.)

- [ ] **Step 4: Togli i `⚡` dai bottoni e dai entrambe le modalità + Swing tally**

- `Hero.tsx:27` e `FinalCta.tsx:15`: cambia `⚡ Crea una partita` → `Crea una partita`.
- In `Modes.tsx` assicurati che **entrambe** le modalità (Gruppo 3–8 **e** 1v1 Duello) siano ben presentate (il 1v1 oggi è poco visibile).
- In `Features.tsx`: sostituisci le emoji-icona (`.cardIc`) con **icone a tratto** inline SVG (stroke 1.6, `currentColor`, colore oro su chip). Emoji solo per riconoscimenti/personaggi (sezione Awards invariata).
- Aggiungi un `<Swing split={…} labels />` come tally nello showcase dell'hero e/o nella CTA finale.

- [ ] **Step 5: Verifica gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/landing
git commit -m "feat(design): rework Landing 'elevated night' (serif, bivio, swing, 2 modalità)"
```

---

### Task 8: Swing in lobby + copy pass + verifica finale

**Files:**
- Modify: `client/src/host/HostApp.tsx` (empty-state lobby)
- Modify: vari (copy/tono dove serve)

- [ ] **Step 1: Swing nell'empty-state della lobby**

Nell'host, dove la lobby mostra "In attesa di sfidanti…" (o equivalente), aggiungi `<Swing animated />` come visual d'attesa.

- [ ] **Step 2: Copy pass**

Scorri host/player/landing: italiano, dà del **"tu"**, poche emoji (solo riconoscimenti/bot persona). Rimuovi eventuali emoji superflue introdotte e frasi tipo "Benvenuto, effettua il login".

- [ ] **Step 3: Gate completo verde**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto PASS, 195 test.

- [ ] **Step 4: Verifica visiva manuale**

`npm run dev`, poi controlla:
- favicon + titolo tab;
- header host con logo bivio;
- lobby (room code in oro) + Swing in attesa;
- una schermata di voto (OptionCard nei nuovi colori blu/terracotta);
- Landing su mobile (<680), tablet (<1024) e desktop: nav sticky, serif, due modalità, Swing tally, reveal allo scroll.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(design): Swing in lobby + copy pass + verifica finale"
```

---

## Self-Review (esito)

- **Copertura spec:** A→Task1, B→Task2, C→Task3, D→Task4, E→Task5, F→Task6, G→Task7, H→Task8. ✓
- **Placeholder:** nessun TBD/TODO; i comandi e gli snippet sono concreti. La Landing (Task 7) ha alcune scelte "a vista" dichiarate (lacuna ui_kits) ma con direttive e codice puntuale. ✓
- **Coerenza tipi:** `Logo`/`Swing` con firme identiche tra Task 3 (definizione), Task 5/7/8 (uso). Valori fazione `84,134,196` / `199,122,69` usati coerentemente. ✓
