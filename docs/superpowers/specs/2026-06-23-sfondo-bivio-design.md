# Sfondo "bivio in prospettiva" — design

**Data:** 2026-06-23
**Branch:** ralph/skeleton-dilemma
**Stato:** approvato in brainstorming, pronto per il piano

## Problema

Durante il gioco lo sfondo è il navy piatto (`body { background: var(--bg) }`,
`#0B0E1A`) che "non rappresenta nulla". Vogliamo uno sfondo **visivo** che mostri
il contesto delle **due strade** del dilemma (le scelte A e B), rendendo lo schermo
condiviso e i telefoni più immersivi e coerenti col brand.

## Decisioni di brainstorming

1. **Cosa mostra:** un **bivio universale** — un'unica scena ambientale riusata per
   tutti i 304 dilemmi (niente immagine per-dilemma, ingestibile a mano). Coerente
   col motivo "bivio" già presente nel logo/landing.
2. **Composizione:** **strada in prospettiva** — sei al bivio, due corsie si aprono
   a ventaglio dal basso: corsia **A blu** a sinistra, corsia **B terracotta** a
   destra, alone d'orizzonte dorato, vignettatura morbida.
3. **Medium:** interamente **CSS/SVG** coi token di colore (`--faction-a/-b/--gold`).
   Nessun file raster → leggero e offline-friendly (il gioco gira su rete locale).
4. **Presenza sui telefoni:** **accennata** (~40% d'intensità) — atmosfera coesa col
   host ma UI di gioco perfettamente leggibile. Sul `/host` (TV) resta **piena**.
5. **Reattività:** **reattiva al reveal**. Durante il voto resta statica (voti
   segreti); alla rivelazione del risultato (`SPLIT_REVEAL`) la corsia del lato in
   testa si illumina/allarga in proporzione al voto **aggregato** — aggancio al
   motivo "swing" del brand.

## Architettura

### Componente `BivioBackdrop`

- File nuovi: `client/src/shared/ui/BivioBackdrop.tsx` + `BivioBackdrop.module.css`;
  export aggiunto a `client/src/shared/ui/index.ts`.
- Render: un layer **`position: fixed; inset: 0; pointer-events: none`**, marcato
  `aria-hidden="true"`, con `z-index` che lo tiene **dietro** al contenuto e sopra
  il `body` navy. Decorativo puro: nessun ruolo semantico, non intercetta input.
- Contenuto scena (mockup A):
  - due corsie a ventaglio via `clip-path` (poligoni che partono dal centro-basso e
    si aprono verso gli angoli alti): sinistra tinta `--faction-a`, destra `--faction-b`;
  - alone d'orizzonte: radial-gradient dorato (`--gold`) in alto-centro;
  - vignettatura: radial-gradient verso il navy ai bordi bassi per far "sedere" la UI.
- **Prop `variant: 'host' | 'player'`** → imposta la sola intensità tramite la
  variabile `--bivio-k` (host = `1`, player = `0.4`). Tutte le opacità delle corsie/
  alone sono `calc(base * var(--bivio-k))`.
- **Reattività via `--bivio-lean`** (numero 0–100, default 50): la larghezza/opacità
  relativa delle due corsie è derivata da questa variabile in CSS. Il componente è
  "muto": non conosce lo stato di gioco, legge solo la variabile dal documento.
- **Accessibilità/motion:** transizione del lean avvolta in
  `@media (prefers-reduced-motion: no-preference)`; con reduced-motion il lean cambia
  senza animazione.

### Montaggio (in `App.tsx`, niente refactor delle viste)

Host e player non usano un wrapper unico: ogni fase/vista ritorna il proprio
`<main>`. Per evitare di toccare i molti `return`, il backdrop si monta una volta per
route, come fratello a livello di `<Route>`:

```tsx
<Route path="/host"  element={<><ConnectionBanner /><BivioBackdrop variant="host"   /><HostApp   /></>} />
<Route path="/join"  element={<><ConnectionBanner /><BivioBackdrop variant="player" /><PlayerApp /></>} />
```

Essendo `position: fixed`, copre tutte le fasi di gioco a prescindere dal `return`
attivo. **Le route non di gioco** (`/`, `/casa`, `/profilo`, `/impostazioni`) **non**
includono il backdrop e restano invariate.

### Segnale reattivo (in `HostApp`)

- Funzione pura `leanFromSplit(split: VoteSplit): number` → percentuale del lato A
  (0–100). Con `A + B === 0` ritorna `50` (neutro). Risultato `clamp(0, x, 100)`.
  Collocazione: accanto al componente o in un piccolo helper UI; con test unitario.
- In `HostApp`, `useEffect` su `[phase, split]`:
  - se `phase === 'SPLIT_REVEAL'` e `split` presente →
    `document.documentElement.style.setProperty('--bivio-lean', String(leanFromSplit(split)))`;
  - altrimenti → reset a `'50'`.
  - cleanup: al dismount riportare a `'50'`.
- **Voti segreti rispettati:** la reattività esiste solo a `SPLIT_REVEAL` (dato
  aggregato già pubblico via `SplitBar`). Nessun aggancio a `VOTE_1/VOTE_2`.

## Z-index e leggibilità

- Il backdrop sta **dietro**; `ConnectionBanner`, `RoomCodeChip` e le viste restano
  sopra. Sul player l'intensità ridotta (`--bivio-k: 0.4`) garantisce contrasto del
  testo (verificato nel mockup "accennata").

## Testing / verifica

- **Unit:** `leanFromSplit` — 0 voti → 50; A only → 100; B only → 0; clamp.
- **Component:** `BivioBackdrop` monta, è `aria-hidden`, non occupa il tab order
  (pointer-events none), accetta `variant`.
- **Gate:** `npm run typecheck` · `lint` · `test` · `build` tutti verdi.
- **Visivo:** `npm run dev` → controllo su `/host` (piena + lean al `SPLIT_REVEAL`) e
  `/join` (accennata, UI leggibile).

## Fuori scope (YAGNI)

- Immagini per-dilemma o per-registro (vita/business).
- File raster / asset esterni.
- Reattività durante il voto (vietata dai voti segreti).
- Modifiche alle route non di gioco.
