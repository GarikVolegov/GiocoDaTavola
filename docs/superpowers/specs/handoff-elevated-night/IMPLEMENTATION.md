# Handoff a Claude Code — Applicare il redesign "elevated night" a SCHIERATI

> Incolla questo file (o il suo contenuto) a **Claude Code** mentre lavora in locale sul
> repo `GiocoDaTavola`. È un travaso **solo visivo** (CSS + markup + asset): **non
> toccare** eventi Socket.IO, logica di gioco, payload o `server/`.

## Contesto
Il gioco è SCHIERATI (party game di dilemmi, host su schermo condiviso + player su
telefono). Stiamo portando il brand da "neon party / giocattolo" a **serio ed
editoriale** ("elevated night"): navy profondo, due lati del dilemma desaturati (blu /
terracotta), oro come accento premium, titoli in **serif Newsreader** + Space Grotesk per
la UI, marchio **bivio** (un quesito → due strade) e motivo **swing** (il gruppo che
cambia idea). Niente più fulmine "A vs B" (framing da duello, sbagliato per un gioco di
gruppo) e niente glow al neon (enfasi = hairline ring).

## File di questo handoff
- `handoff/tokens.css` — i token di produzione, già uniti. **È la fonte di verità dei valori.**
- `handoff/schierati-icon.svg` — il nuovo marchio (bivio), path-based, va in `client/public/`.
- `handoff/components/` — componenti React **già pronti** in stile CSS-Modules:
  `Logo.tsx.txt` + `Logo.module.css`, `Swing.tsx.txt` + `Swing.module.css`. Copiali in
  `client/src/shared/ui/` **rinominando** `*.tsx.txt` → `*.tsx` (l'estensione `.txt`
  serve solo a non farli compilare in questo design system), esportali dal barrel
  `index.ts`, e usali come da §5/§6.

---

## Passi (in ordine)

### 1. Token — la base (80% dell'effetto)
- Sostituisci **interamente** il contenuto di `client/src/shared/ui/tokens.css` con
  `handoff/tokens.css`.
- Correggi il path del font self-hosted: nel blocco `@font-face` di Space Grotesk imposta
  `src: url('../assets/fonts/space-grotesk-variable.woff2')` (o il path reale del repo).
- Newsreader arriva via `@import` da Google Fonts (già nel file). Per il fully-offline,
  scarica i woff2 di Newsreader in `client/src/assets/fonts/` e sostituisci l'`@import`
  con `@font-face` locali (pesi 400/500/600 + italic).
- Verifica che `tokens.css` sia importato una sola volta e prima di `index.css` in
  `client/src/main.tsx` (com'è già oggi).

> Già solo questo ricolora host + player perché usano `var(--…)` ovunque.

### 2. Asset / marchio
- Copia `handoff/schierati-icon.svg` in `client/public/schierati-icon.svg` (favicon: già
  linkato in `client/index.html`, nessun'altra modifica).
- Il **wordmark**: NON usare gli SVG con font incorporato (i browser non caricano il font
  dentro `<img>`). Renderizza il lockup in markup: emblema-bivio inline + "SCHIERATI" in
  Space Grotesk 600 + payoff in serif corsivo. Vedi §5 per il componente.

### 3. Componenti UI (`client/src/shared/ui/*.module.css`) — cosmetici
Allinea i `.module.css` ai nuovi token. Modifiche chiave (i nomi delle classi sono già i loro):
- **Button**: `.primary` → `background: var(--faction-a); color: var(--text);` (testo
  chiaro, non scuro). Hover: `box-shadow: var(--glow-a)` (ora è un ring sottile, non neon)
  + `translateY(-2px)`. Raggio `var(--radius-md)` (più piccolo ora). `.ghost` invariato
  salvo token.
- **Card**: `border-radius: var(--radius-lg); box-shadow: var(--shadow-card);` le varianti
  `.glowA/.glowB/.glowAccent` ora rendono ring+bloom tenui (già nei token).
- **OptionCard**: i tint usano i nuovi colori. Dove nel codice ci sono **rgba hardcoded**
  `79,140,255` (blu) e `255,140,79` (arancio) — cercali in `HostApp.tsx`/`PlayerApp.tsx`
  e sostituiscili con `84,134,196` (A) e `199,122,69` (B). Meglio ancora: passa a
  `var(--faction-a/-b)` e `var(--faction-a-soft/-b-soft)`.
- **Pill / Field / Countdown / CodeDisplay / Alert**: nessun cambio di logica; il
  CodeDisplay diventa **oro** (`var(--accent)` ora = gold) — corretto.
- **Raggi**: ovunque tu veda valori di raggio "tondi" (0.9rem / 1.25rem) passa ai token
  `--radius-md (.625) / --radius-lg (.875)`.

### 4. Tipografia editoriale
- Aggiungi un token già presente: `--font-serif` (Newsreader). Usalo per **i titoli
  marketing e i grandi claim**: `Landing` (`.title`, `.h2`, `.finalH`), e i titoli "da
  vetrina" dell'host (es. `PHASE_INTRO`). Mantieni **Space Grotesk** per UI di gioco,
  room code, countdown, label, wordmark.

### 5. Marchio "bivio" + lockup (nuovo)
Crea un componente `client/src/shared/ui/Logo.tsx` (+ `.module.css`) che renda:
- l'**emblema bivio** inline SVG: uno stelo che si biforca in due bracci (sinistro
  `--faction-a`, destro `--faction-b`), nodo `--text` al punto di split;
- accanto, "SCHIERATI" in `--font-display` 600, letter-spacing .02em, colore `--text`;
- opzionale: payoff "il gioco dei dilemmi tra amici" in `--font-serif` corsivo.
Usalo nell'header lobby di `HostApp.tsx` e in `Landing.tsx` al posto dell'`<img>` logo.

Geometria emblema (viewBox `0 0 200 215`, stroke-width 22, linecap round):
- stelo `M100,205 L100,120` stroke `var(--text)`
- braccio A `M100,120 L42,26` stroke `var(--faction-a)`
- braccio B `M100,120 L158,26` stroke `var(--faction-b)`
- nodo `circle cx=100 cy=120 r=12 fill var(--text)`

### 6. Motivo "swing" (nuovo, opzionale ma consigliato)
Crea `Swing.tsx`: una barra arrotondata divisa A (blu) / B (terracotta) con un divisore.
Props `split` (% su A) e `animated` (il divisore oscilla, con guardia
`prefers-reduced-motion`). Usalo nell'empty-state della lobby ("In attesa di sfidanti…")
e, se vuoi, come visual nel `SPLIT_REVEAL`.

### 7. Landing
Porta su `client/src/landing/` lo stile della mia `ui_kits/landing/index.html`:
- titoli **serif**, palette nuova, nav sticky translucida col logo bivio;
- **entrambe le modalità** ben presentate (Gruppo 3–8 **e** 1v1 Duello — oggi il 1v1 è
  poco visibile);
- icone **a tratto** (stroke 1.6, currentColor, oro su chip) al posto delle emoji nelle
  feature; emoji solo per i riconoscimenti/personaggi;
- motivo **Swing** come tally nello showcase e nella CTA finale;
- **un solo** bivio decorativo tenue (filigrana) dietro l'eroe — niente puntini sparsi;
- reveal allo scroll (IntersectionObserver) con guardia `@media print` + fallback
  timeout, e breakpoint: stack sotto i **1024px**, link nav nascosti sotto i 680px, CTA a
  tutta larghezza su mobile.

### 8. Copy & tono
Italiano, dà del **"tu"**, considerato/diretto/caldo, **poche emoji** (solo riconoscimenti
e bot persona). Niente "Benvenuto, effettua il login".

---

## Riferimento visivo
La fonte di verità del look è il design system SCHIERATI (questo progetto): guarda la tab
**Design System** (card Brand/Colors/Type) e i kit in `ui_kits/{landing,host,player}` per
spaziature, dimensioni e composizione esatte. I valori numerici stanno in `handoff/tokens.css`.

## Gate di verifica (deve restare verde)
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Sono solo CSS/markup/asset: nessun test di logica deve cambiare. Verifica a occhio:
favicon e titolo, header host con logo bivio, lobby (codice in oro), una schermata di voto
(OptionCard nei nuovi colori), e la landing su mobile/tablet/desktop.

## Cosa NON fare
- Non toccare `server/`, gli eventi Socket.IO, i timer o i payload.
- Non reintrodurre il fulmine / il framing "A vs B" da duello.
- Non usare glow al neon: enfasi = hairline ring + bloom tenue.
- Non incorporare il font dentro SVG usati come `<img>`.
