# Landing marketing SCHIERATI — design

**Data:** 2026-06-21
**Stato:** approvato (mockup validato; in attesa di review della spec scritta)
**Tipo:** front-end (client). Nuova pagina marketing che descrive il gioco e spinge a provarlo.
**Mockup di riferimento:** `.superpowers/brainstorm/31199-1782010659/content/landing-showcase-v1.html`

## Obiettivo

Sostituire l'attuale `/` (oggi un semplice selettore Crea/Partecipa) con una **landing
marketing curata** che: descriva il gioco, faccia appassionare e dia voglia di provarlo,
incanalando verso "Crea una partita". Stile "pagina prodotto" (impianto **Showcase**
scelto dall'utente).

## Scope & routing

- `/` → **nuova landing marketing** (sostituisce l'attuale `Landing.tsx`).
- CTA della landing: **"Crea una partita" → `/host`**, **"Partecipa" → `/join`** (target
  invariati rispetto a oggi). La schermata d'ingresso col **codice** resta `/join`: la
  landing è "separata" da essa (richiesta dell'utente).
- `/host` e `/join` **non cambiano**.
- Nessuna nuova rotta: è una sostituzione in-place del componente su `/`.

## Struttura (ordine sezioni, approvato)

1. **Nav** minimale: wordmark `SCHIE⚡RATI` a sinistra; a destra ancore ("Come si gioca",
   "Modalità") + bottone "Crea una partita".
2. **Hero** (2 colonne, impila su mobile):
   - Sinistra: eyebrow "Party game dal vivo · 3–8 amici"; titolo
     **"Scegli un lato. Difendilo. Falli cambiare idea."** (con "Difendilo" blu,
     "Falli cambiare idea" arancio); lead; due CTA (primario "⚡ Crea una partita",
     ghost "Ho un codice · Partecipa"); meta "Su un solo schermo + i vostri telefoni ·
     20–40 min · niente account".
   - Destra: **showcase dispositivi** — telefono (vota A/B) · TV (dilemma reale + opzioni
     A/B colorate) · telefono ("Tocca a te 🎤 · Difendi B · 30s"). Su mobile va sopra il testo.
3. **Come si gioca** — 3 step (Voti A o B → Si difende → Si rivota), copy dai 3 passi reali.
4. **Perché ti piacerà** — griglia 4 feature: 60 dilemmi; "Vince chi convince"
   (= OBJECTIVE); "Anche in pochi" (bot/solo); "Nessuno perde" (premi per tutti).
5. **Modalità & durata** — Gruppo 3–8 / 1v1 Duello; chip Assaggio/Classica/Maratona +
   "Argomenti: Vita · Business · Misto".
6. **Cerimonia finale** — i 5 premi reali (Persuasore 🏆, Banderuola 🎏, Roccione 🪨,
   In sintonia 🔮, Bastian 🦓) con descrizione.
7. **CTA finale** — "Pronti a schierarvi?" + bottone "⚡ Crea una partita" + footer
   "Gratis · niente download · niente account · dal browser".

Tutta la copy è quella validata nel mockup (riusa costanti reali dove esistono:
`OBJECTIVE`, `HOW_TO_PLAY`, `MODE_LABELS`, `FORMAT_LABELS`, `REGISTER_LABELS`, i premi).

## Visual & design system

- Riusa il design system "Neon party night": **tema scuro**, colori via `var(--token)`
  (`--bg`, `--surface`, `--surface-2`, `--faction-a` blu, `--faction-b` arancio,
  `--accent` viola, `--text`/`--text-muted`/`--text-faint`), font display **Space Grotesk**
  (`--font-display`, già self-hosted). **Niente hex hardcoded** nel codice: solo token.
- Bagliori/gradienti dell'hero costruiti dai colori fazione (coerenti con `--glow-a/--glow-b`).
- Bottoni CTA = componente **`Button`** esistente (`variant primary`/`ghost`, `size lg`).
- Le sezioni e lo showcase dispositivi sono **layout one-off** → CSS Module co-locato
  (`Landing.module.css`) che referenzia i token (consentito dalle convenzioni).
- **Responsive**: hero 2-col → 1-col sotto ~780px (showcase sopra il testo); griglie
  3/4-col → 1-col su mobile. Mobile-first leggibile (è probabile che la aprano dal telefono).
- **Motion**: animazioni d'ingresso leggere (fade/translate) **solo** se rispettano
  `prefers-reduced-motion` (i componenti del DS già lo fanno). Niente è obbligatorio per capire la pagina.
- **A11y**: gerarchia heading corretta (un solo `h1`), CTA come veri `<a>`/`<button>`,
  contrasto adeguato sul tema scuro, ancore con `id` sulle sezioni.

## Isolamento dei componenti

`Landing.tsx` orchestra sezioni piccole e focalizzate (così il file resta leggibile e
testabile a vista):

- `landing/sections/Hero.tsx` (+ device showcase, eventualmente `DeviceShowcase.tsx`)
- `landing/sections/HowToPlay.tsx`
- `landing/sections/Features.tsx`
- `landing/sections/Modes.tsx`
- `landing/sections/Awards.tsx`
- `landing/sections/FinalCta.tsx`
- `landing/Landing.module.css` (stili di sezione, via token)

I dati ripetuti (3 passi, 4 feature, 3 durate, 5 premi) vivono come piccoli array locali
alla landing; dove esiste già una costante condivisa (`OBJECTIVE`, `HOW_TO_PLAY`,
`MODE_LABELS`, `FORMAT_LABELS`, `REGISTER_LABELS`) la si riusa.

## File previsti

- `client/src/landing/Landing.tsx` — **riscritto**: compone le sezioni; CTA → `/host` e `/join`.
- `client/src/landing/Landing.module.css` — **nuovo**: layout sezioni + showcase (token-based).
- `client/src/landing/sections/*.tsx` — **nuovi**: Hero, HowToPlay, Features, Modes, Awards, FinalCta.
- (Eventuale) `client/src/landing/content.ts` — array locali (feature, durate, premi) per la landing.
- Nessun cambiamento server. `App.tsx` invariato (la rotta `/` resta, cambia il componente).

## Testing / verifica

- Nessun test runner client → gate **`typecheck` + `lint` + `build`** verde.
- Verifica visiva manuale (desktop + mobile width) e che le due CTA instradino a `/host` e
  `/join`; rapido smoke che `/` renderizzi senza errori.
- Non si rompe nulla a valle (host/join/realtime invariati).

## Non-obiettivi (YAGNI)

- Niente i18n/multilingua (resta in italiano).
- Niente sezione "dicono di noi"/social proof inventata.
- Niente CMS o contenuti dinamici: copy statica nel codice.
- Niente nuovo routing oltre la sostituzione di `/`.
- Niente immagini/asset pesanti esterni: lo showcase è costruito in CSS (device "finti").
