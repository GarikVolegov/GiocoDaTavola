# Spec — Modalità "Percorso" (sessioni lunghe a tappe, stile Gioco della Vita)

Data: 2026-06-22 · Branch: `ralph/skeleton-dilemma`

## Problema / motivazione

Oggi il gioco gira su sessioni brevi: **3 / 5 / 7 dilemmi** (~15/30/45 min), con contenuti
**piatti** (60 dilemmi divisi solo per `register` `vita`/`business`/`misto`, nessuna
difficoltà/ordine/progressione) pescati a caso senza ripetizioni.

Si vuole poter giocare **sessioni lunghe (2–3 ore)** strutturate come un percorso "alla
Gioco della Vita": **tappe di vita** che, salendo, diventano **più profonde e ad alta posta
emotiva**. L'host **sceglie la tappa di partenza** e il gruppo **scala fino in cima**.

## Decisioni (brainstorming con l'utente)

- **Asse del percorso:** tappe di vita **+** profondità crescente (tema e intensità salgono insieme).
- **Struttura:** **integrare** nella modalità Gruppo esistente (no gioco nuovo): riusa il
  loop dilemma e tutte le modalità (Avvocato del Diavolo, Squadre, Infiltrato, ecc.).
- **Durata:** preset **~1h / ~2h / ~3h** (target; il sistema distribuisce i dilemmi sulle tappe rimanenti).
- **Stacchi:** **carta "nuova tappa"** all'ingresso + **mini-recap/pausa** a fine tappa.
- **Contenuti:** **re-tag** dei dilemmi `vita` esistenti nelle tappe **+** scrittura di nuovi.

## Le tappe (la salita) — 4 livelli

| # | key | Tappa | Capitolo di vita | Profondità |
|---|-----|-------|------------------|------------|
| 1 | `basi`    | 🌱 Le Basi   | Giovinezza, indipendenza, prime scelte | leggero / quotidiano |
| 2 | `bivi`    | 🔀 I Bivi    | Carriera, soldi, relazioni serie       | medio |
| 3 | `legami`  | 🤝 I Legami  | Famiglia, impegni, sacrifici           | personale |
| 4 | `bilanci` | 🌅 I Bilanci | Mezza età, eredità, senso              | profondo / esistenziale |

Preset durata → budget di dilemmi (costanti tunabili): `corto`→10 (~1h), `medio`→20 (~2h),
`lungo`→30 (~3h) — ~5–6 min/dilemma. L'host sceglie tappa di partenza (1–4) e durata: si
gioca da quella tappa fino alla 4ª. Il budget si distribuisce sulle tappe rimanenti (gli
extra alle tappe più profonde), limitato dai dilemmi disponibili; partire in alto = salita
più corta (l'host vede la stima reale di dilemmi/ore).

## Architettura (componenti isolati)

### Contenuti / dati
- `server/src/game/deck.ts`: campo opzionale `tappa?: 1|2|3|4` su `Dilemma`; helper
  `dilemmasForTappa(all, t)`. La modalità classica ignora `tappa`.
- `server/data/dilemmas.json`: re-tag dei ~30 `vita` + nuovi dilemmi → **≥10 per tappa
  (~44 totali)**. I `business` restano senza `tappa` (solo classica).

### Pianificazione percorso (puro, testabile)
- `server/src/game/percorso.ts` (**nuovo**): `TAPPE` (metadati), `DURATA_BUDGET`, type `Durata`;
  `buildPercorsoPlan(all, startTappa, durata, rng) → { dilemmas: Dilemma[]; tappe: number[] }`
  (distribuzione budget su `[startTappa..4]`, pescaggio per tappa senza ripetizioni, ordine
  ascendente, cap per disponibilità; array paralleli).

### Macchina a stati
- `server/src/game/phases.ts`: fasi `TAPPA_INTRO` (timer 8s) e `TAPPA_RECAP` (no timer →
  pausa, l'host preme "Continua ▶"); funzione pura `nextPercorsoPhase(current, dilemmaIndex,
  plannedTappe)`. `nextPhase` (classica) intatta.
  - `PHASE_INTRO → {TAPPA_INTRO, 0}`
  - `TAPPA_INTRO → {DILEMMA_REVEAL, idx+1}`
  - in-sequenza (`VOTE_1`…`SPEAKER_VOTE`) → step `DILEMMA_SEQUENCE` (idx invariato)
  - `PHASE_RESULTS →` stessa tappa: `{DILEMMA_REVEAL, idx+1}`; cambio tappa o fine: `{TAPPA_RECAP, idx}`
  - `TAPPA_RECAP →` restano dilemmi: `{TAPPA_INTRO, idx}`; altrimenti: `{FINAL_AWARDS, idx}`

### Stato di gioco
- `server/src/game/rooms.ts`: su `Room` aggiungere `format: 'classic'|'percorso'`,
  `startTappa`, `durata`, `plannedDilemmas`, `plannedTappe`, `currentTappa`, e accumulatore
  recap (`tappaDilemmas`, `tappaSwings`). `startGame` riceve un parametro opzionale finale
  `percorso?: { startTappa; durata }` (presenza ⇒ `format='percorso'`): costruisce il piano,
  `dilemmaCount = plannedDilemmas.length` (così terminazione + devil/know continuano a
  funzionare). `advancePhase`: usa `nextPercorsoPhase` in percorso; restano i detour
  `ACCUSE`/`DEFENSE`/`SPEAKER_VOTE<2`/`FINAL_AWARDS→ACCUSE`; a `DILEMMA_REVEAL` pesca da
  `plannedDilemmas[idx-1]`; aggiorna `currentTappa`.

### Rete / payload
- `server/src/index.ts`: `leader:startGame` accetta `format`/`startTappa`/`durata`;
  `gameStatePayload` espone una vista percorso **read-only e secret-safe** (format,
  currentTappa, startTappa, durata, totalDilemmas, dilemmaIndex, tappe[{id,total,done}],
  tappaSwings) — nessun voto individuale.

### Client
- `client/src/shared/events.ts`: mirror `TAPPE`/`DURATE`/`DURATA_LABELS`/`Durata`, nuove
  fasi, tipi payload estesi.
- Host setup: toggle Classica vs Percorso; se Percorso, selettore tappa di partenza + durata
  con stima live.
- Host gioco: viste `TAPPA_INTRO`, `TAPPA_RECAP` (recap + "Continua ▶") e **mappa-salita**.
- Phone: banner tappa + schermate semplici `TAPPA_INTRO`/`TAPPA_RECAP`.

## Invarianti di sicurezza (non derogabili)
I voti restano **segreti**: a host/altri solo conteggi aggregati. Nessun dato per-giocatore
nelle viste percorso/recap. Timer server-authoritative.

## Testing (TDD)
- `percorso.test.ts`: distribuzione budget, cap, ordine ascendente, determinismo con rng seedato.
- `phases` (`nextPercorsoPhase`): tutte le transizioni incl. confini tappa e fine.
- `rooms`: `startGame` percorso (piano + dilemmaCount + currentTappa); cammino completo di
  `advancePhase` fino a `FINAL_AWARDS`; detour infiltrato dall'ultimo `TAPPA_RECAP`;
  invarianti segretezza.
- contenuti: ogni tappa ≥10 dilemmi; ogni dilemma con `tappa` ha spunti A/B non vuoti.
- Gate: `npm run typecheck` · `lint` · `test` · `build` verdi.
- Manuale: `npm run dev` → host Percorso → 3 telefoni → carta tappa → loop → recap/pausa →
  tappa successiva → premi finali; provare start alto (salita corta) e Infiltrato.

## Note
- Lavorare nel **repo principale**, NON in worktree (bug noto: vite serve bundle stale in `.claude/worktrees/`).
- `startGame` cresce: un refactor a oggetto-opzioni è un follow-up ragionevole (fuori scope qui).
