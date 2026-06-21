# Redesign "elevated night" — applicare l'export di Claude Design a SCHIERATI

**Data:** 2026-06-21
**Branch di lavoro:** `worktree-design+elevated-night` (git worktree isolato)
**Tipo:** redesign **solo visivo** (CSS + markup + asset). Nessun cambio a logica, eventi, timer, payload, test di gioco.

## Contesto

L'utente ha esportato da **Claude Design** un design system per SCHIERATI
(`SCHIERATI Design System.zip`, cartella `handoff/`). L'export porta il brand da
"neon party / giocattolo" a **serio ed editoriale** ("elevated night"):

- ground **navy profondo**, due lati del dilemma **desaturati** (blu `#5486C4` / terracotta `#C77A45`),
  **oro** `#C9A35A` come accento premium;
- titoli in **serif Newsreader** + **Space Grotesk** per la UI;
- marchio **"bivio"** (un quesito → due strade) e motivo **swing** (il gruppo che cambia idea);
- via il fulmine "A vs B" (framing da duello, sbagliato per un gioco di gruppo) e via i glow al neon
  (enfasi = hairline ring + bloom tenue).

Questo redesign **succede** alle spec precedenti `2026-06-21-schierati-brand-design.md`,
`2026-06-20-design-system-design.md` e `2026-06-21-landing-marketing-design.md`: ne è la
versione "v2 elevated night". I valori numerici di verità stanno in `handoff/tokens.css`.

### Materiali dell'export (fonte di verità)
- `handoff/IMPLEMENTATION.md` — istruzioni ordinate (step 1–8).
- `handoff/tokens.css` — token di produzione (la fonte di verità dei valori).
- `handoff/schierati-icon.svg` — nuova icona "bivio" (favicon).
- `handoff/components/Logo.tsx.txt` + `Logo.module.css` — lockup "bivio".
- `handoff/components/Swing.tsx.txt` + `Swing.module.css` — motivo swing.

Estratti in `/tmp/schierati-design/handoff/` per questa sessione.

## Decisioni prese (con l'utente)
1. **Scope:** tutto il redesign (step 1–8), non solo le fondamenta.
2. **Isolamento:** git worktree dedicato (questo), non il branch corrente.
3. **Font Newsreader:** via **Google Fonts `@import`** (non self-hostato). Resta una dipendenza
   di rete al primo caricamento; Space Grotesk resta self-hostato e offline.

## Vincoli (non derogabili)
- **NON toccare** `server/`, eventi Socket.IO, timer, payload, né i test di logica.
- Niente fulmine / framing "A vs B" da duello.
- Niente glow al neon: enfasi = hairline ring + bloom tenue.
- Niente font incorporato dentro SVG usati come `<img>` (il browser non lo carica).
- **Gate di verifica verde:** `npm run typecheck && npm run lint && npm test && npm run build`.
  I 195 test (logica) restano invariati e verdi.

## Lacuna nota
Il handoff §7 cita `ui_kits/landing/index.html` come riferimento visivo esatto della Landing,
ma **non è nell'export** (lo zip contiene solo `handoff/`). Il rework Landing seguirà la
**descrizione testuale del §7 + i token**, poi sarà iterabile a vista.

## Unità di lavoro (mappate ai file del repo)

### A. Token & font (fondamenta — ~80% dell'effetto)
- Sostituire **interamente** `client/src/shared/ui/tokens.css` con `handoff/tokens.css`.
- Correggere l'`url()` `@font-face` di Space Grotesk al path reale del repo:
  `url('../../assets/fonts/space-grotesk-variable.woff2')` (l'handoff ha `../fonts/`).
- Mantenere l'`@import` Newsreader da Google Fonts.
- Verificare che `tokens.css` sia importato una sola volta e prima di `index.css`
  in `client/src/main.tsx` (già così oggi).

### B. Asset / marchio
- Copiare `handoff/schierati-icon.svg` → `client/public/schierati-icon.svg`
  (favicon già linkata in `client/index.html`).

### C. Componenti UI nuovi
- Aggiungere `client/src/shared/ui/Logo.tsx` + `Logo.module.css` (lockup "bivio" inline SVG).
- Aggiungere `client/src/shared/ui/Swing.tsx` + `Swing.module.css` (barra A/B con divisore).
- Esportarli dal barrel `client/src/shared/ui/index.ts`.

### D. Componenti UI esistenti (cosmetici, allineamento ai token)
- **Button:** `.primary` → `background: var(--faction-a); color: var(--text);`
  hover `box-shadow: var(--glow-a)` + `translateY(-2px)`; raggio `var(--radius-md)`.
- **Card:** `border-radius: var(--radius-lg); box-shadow: var(--shadow-card);`
  varianti `.glowA/.glowB/.glowAccent` = ring+bloom tenui.
- **OptionCard:** tint con i nuovi colori.
- **Pill / Field / Countdown / CodeDisplay / Alert:** nessun cambio di logica; CodeDisplay diventa oro.
- **Raggi:** valori "tondi" (0.9rem / 1.25rem) → token `--radius-md` / `--radius-lg`.

### E. Sostituzioni puntuali nel markup
- Le **14 occorrenze** di `rgba` di fazione hardcoded (`84,134,196`/`79,140,255` blu,
  `255,140,79`/`199,122,69` arancio) in `HostApp.tsx`/`PlayerApp.tsx` → `var(--faction-a/-b[-soft])`.
- I **`<img>` logo** (HostApp ×2 alle ~righe 90 e 405, Landing) → `<Logo/>`.

### F. Tipografia editoriale
- Usare `--font-serif` (Newsreader) per **titoli marketing / claim**: Landing (`.title`, `.h2`,
  `.finalH`) e display "da vetrina" dell'host (es. `PHASE_INTRO`).
- Space Grotesk resta per UI di gioco, room code, countdown, label, wordmark.

### G. Landing (rework §7)
- Titoli serif, palette nuova, **nav sticky** translucida col logo bivio.
- **Entrambe le modalità** ben presentate (Gruppo 3–8 **e** 1v1 Duello).
- Icone **a tratto** (stroke 1.6, currentColor, oro su chip) al posto delle emoji nelle feature;
  emoji solo per riconoscimenti/personaggi.
- Motivo **Swing** come tally nello showcase e nella CTA finale.
- **Un solo** bivio decorativo tenue (filigrana) dietro l'eroe.
- Reveal allo scroll (IntersectionObserver) con guardia `@media print` + fallback timeout;
  breakpoint: stack sotto 1024px, nav link nascosti sotto 680px, CTA full-width su mobile.

### H. Motivo Swing in gioco + copy
- `Swing` nell'empty-state lobby ("In attesa di sfidanti…") ed eventualmente nel `SPLIT_REVEAL`.
- Copy: italiano, dà del **"tu"**, considerato/diretto/caldo, **poche emoji**.

## Verifica
1. `npm run typecheck && npm run lint && npm test && npm run build` — tutto verde.
2. Verifica a occhio: favicon + titolo; header host con logo bivio; lobby (codice in oro);
   una schermata di voto (OptionCard nei nuovi colori); Landing su mobile/tablet/desktop.

## Fuori scope
Qualsiasi modifica a `server/`, agli eventi Socket.IO, ai timer o ai payload; reintrodurre
fulmine / framing "A vs B"; glow al neon; self-hosting di Newsreader (rinviato).
