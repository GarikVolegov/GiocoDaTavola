# Spec — Audio per la TV /host: musichetta + effetti sonori

**Data:** 2026-06-23 · **Branch:** `ralph/skeleton-dilemma`

## Obiettivo

Arricchire l'esperienza sonora dello schermo condiviso `/host` con:

1. una **musichetta di sottofondo** (background music) durante le attese e i discorsi;
2. **effetti sonori** (SFX) sui momenti salienti della partita.

Tutto **sintetizzato via Web Audio** (nessun file binario, nessuna licenza), **solo su
`/host`** (un'unica sorgente sonora, niente cacofonia da più telefoni). Scelte confermate
in brainstorming.

## Stato attuale

`client/src/host/ambient.ts` genera già un *bed* ambient sintetizzato (drone a 3 voci +
LFO sul gain) che parte nelle fasi d'attesa (`isWaitingPhase`) ed è sbloccato al primo
gesto utente (autoplay policy). Host-only. Nessun asset binario. Nessun SFX.

## Architettura — nuovo modulo `client/src/host/audio/`

Assorbe e sostituisce `ambient.ts`. Cinque file con responsabilità singola:

- **`engine.ts`** — un solo `AudioContext` condiviso da musica e SFX (i browser limitano
  il numero di context), `master` gain, `unlock()` (resume dopo gesto), `setMuted(bool)` /
  `isMuted()` persistito in `localStorage` (`schierati.audio.muted`). Quando muto, il
  master gain va a 0 (la musica continua a girare ma silenziosa; gli SFX no-op).
  No-op sicuro quando `AudioContext` non è disponibile (SSR/test).

- **`sequence.ts`** *(PURO, testato)* — la "musichetta" come **dati**: progressione di
  accordi in la minore (es. Am–F–C–G) con una linea di arpeggio. Funzione pura
  `noteAt(step: number): NoteEvent[]` che, dato l'indice di passo (modulo la lunghezza del
  loop), ritorna le note da suonare (frequenza, durata, gain relativo). Nessuna dipendenza
  da Web Audio → unit-testabile.

- **`music.ts`** — scheduler look-ahead (pattern Web Audio standard: `setInterval` che
  guarda avanti ~100ms e accoda note con `osc.start(when)`), legge `sequence.ts`, suona il
  loop a volume basso (bed). `startMusic()` / `stopMusic()`. Espone un livello
  **attenuato durante i discorsi** (DEFENSE/INTERVENTI) per non coprire chi parla:
  `setMusicIntensity('full' | 'soft')`.

- **`cues.ts`** *(PURO, testato)* — mappa evento→suono senza toccare Web Audio:
  `sfxForTransition(prev: GamePhase | null, next: GamePhase, game): SfxName | null`.
  Decide quale sting suonare a ogni cambio fase. Testabile su tutte le transizioni.

- **`sfx.ts`** — stinger sintetici fire-and-forget che usano `engine`: `play(name: SfxName)`
  con un piccolo dizionario di ricette (frequenze/inviluppi) per ciascun `SfxName`.

### `SfxName` e mappatura eventi (host)

| Trigger | `SfxName` | Suono |
| --- | --- | --- |
| → `SPLIT_REVEAL`, `DUEL_REVEAL`, `DILEMMA_REVEAL` | `reveal` | chime di rivelazione |
| → `PHASE_RESULTS` con `swing.switched > 0` | `swing` | sting drammatico (ribaltone) |
| → `PHASE_RESULTS` senza ribaltone | `reveal` | chime |
| → `DUEL_RESULT` con `duelResult.convinced.length > 0` | `win` | fanfaretta |
| → `FINAL_AWARDS`, → `FINAL_DUEL` | `awards` | arpeggio celebrativo |
| Timer countdown in scadenza (ultimi ~10s, ogni secondo) | `timerWarn` | tick/avviso soft |
| Nuova mano alzata in `INTERVENTI` (coda cresce) | `handRaise` | "ding" |

`reveal` è il fallback "neutro" per le rivelazioni; `timerWarn` e `handRaise` non sono
transizioni di fase ma delta di stato, gestiti da effetti dedicati in `HostApp`.

## Musichetta — quando suona

Riusa `isWaitingPhase(phase)` (già esistente): attese + discorsi. Intensità `full` di
default, `soft` durante `DEFENSE`/`INTERVENTI`. Fuori dalle fasi d'attesa: stop.

## Controllo utente

Pulsante **mute** 🔊/🔇 su `/host` (angolo, discreto), persistito in `localStorage`.
Rispetta la policy autoplay esistente (sblocco al primo gesto già presente).

## Test (TDD)

- `sequence.ts` → la struttura del loop (lunghezza, note per step, range frequenze).
- `cues.ts` → ogni transizione mappa al suono atteso (incluso ribaltone vs no, duello
  vinto vs pareggio, nessun suono per transizioni non sonore).
- Il glue Web Audio (`engine`/`music`/`sfx`) resta minimale e no-op senza `AudioContext`,
  come `ambient.ts` oggi — non unit-testato (side-effect puri sul device audio).

## Slice di implementazione

1. **Slice 1:** `engine.ts` + `sequence.ts` (+test) + `music.ts` (musichetta che
   sostituisce ambient) + `cues.ts` (+test) + `sfx.ts` + wiring SFX di transizione in
   `HostApp`.
2. **Slice 2:** SFX `timerWarn` + `handRaise` (effetti su delta di stato) + pulsante mute
   su `/host` + rifiniture (mix dei volumi, attenuazione discorsi).

## Non in scope (YAGNI)

- Audio sui telefoni `/`.
- File audio binari / asset pipeline.
- Impostazioni di volume granulari (solo mute on/off).
