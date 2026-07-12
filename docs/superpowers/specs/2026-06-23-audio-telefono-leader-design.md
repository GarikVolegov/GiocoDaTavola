# Audio sul telefono del leader, narrazione testuale per tutti

Data: 2026-06-23 · Branch: `ralph/skeleton-dilemma`

## Contesto e problema

Oggi tutto l'audio (musichetta, effetti, voce narrante TTS) vive **solo su `/host`**, lo
schermo "TV" spettatore. Ma il gioco si gioca **dai telefoni** e una TV normale non può
aprire il gioco: la "modalità TV" è di fatto inutile. Risultato pratico per l'utente:
"non si sente nulla", perché nessuno tiene aperto `/host`. La narrazione testuale completa
delle Storie è anch'essa solo su `/host`; sui telefoni i giocatori vedono solo un riassunto
con scritto "🔊 Ascolta sullo schermo".

Diagnosi confermata: l'engine audio in sé è **sano** (su `/host` reale: `ctx: running`,
48 kHz, 87 voci TTS, voce udita). Non è un bug dell'engine — è nel **posto** in cui l'audio
è montato.

## Obiettivo

- Tutto l'audio (musichetta + effetti + **voce narrante**) esce dal **telefono di chi crea
  la stanza** (il leader). Suona **un solo dispositivo** → niente cacofonia.
- **Tutti** i giocatori vedono la **narrazione completa come testo** sul proprio telefono.
- Voce narrante **meno robotica**.
- La "modalità TV" `/host` smette di produrre audio (rimozione completa rimandata).

## Decisioni (concordate con l'utente)

- Audio solo sul telefono **leader**; gli altri telefoni restano **muti** (solo testo).
- `/host`: **zittita ora** (tolgo il wiring audio), resta mirror silenzioso; rimozione
  completa di rotta + flusso spettatore in un secondo momento.
- QR: aggiungere uno **scanner con fotocamera** in-app (sottosistema indipendente, fatto
  per ultimo).
- Qualità voce: migliorata in questo stesso lavoro.

## Non-goal

- Audio sui telefoni **non**-leader (restano muti, vedono solo testo).
- Rimozione completa della rotta `/host` (solo silenziata, per ora).
- TTS cloud/neurale (resta Web Speech del browser; si sceglie solo la voce migliore disponibile).

## Design

Pezzi piccoli e a responsabilità singola, riusando il modulo `client/src/host/audio/` esistente.

### 1. Hook riutilizzabile `useHostAudio` (estratto da `HostApp`)
Nuovo `client/src/host/audio/useHostAudio.ts`. Estrae l'orchestrazione audio oggi inline in
[HostApp.tsx](client/src/host/HostApp.tsx) (musichetta su fasi d'attesa, ducking, voce sui beat
di storia, effetti sui cambi di fase, tick timer, ding mano alzata, sblocco al gesto).

- Interfaccia: `useHostAudio({ enabled, game }) → { audioReady, activateAudio }`.
- Quando `enabled` è falso non fa nulla (nessun listener, nessun suono).
- Deriva internamente `phase`, `remaining` (via `useCountdown`), `speaking` da `game`.
- Riusa `engine`/`music`/`sfx`/`cues`/`narrator` invariati (a parte la voce, punto 4).

### 2. Montare l'audio sul telefono del leader (`PlayerApp`)
In [PlayerApp.tsx](client/src/player/PlayerApp.tsx): `useHostAudio({ enabled: isLeader, game })`,
con `isLeader` già esistente ([:473](client/src/player/PlayerApp.tsx#L473)). Solo il telefono che
detiene la leadership suona. Sblocco audio: sul **primo gesto** del leader + un piccolo
affordance "🔊 Attiva audio" come fallback (Safari mobile pretende lo `speak()`/start dentro il
gesto → si chiama `unlockAudio()`+`unlockSpeech()` nello stesso handler dei pulsanti del leader,
es. "Avvia"/"Continua").

### 3. Zittire `/host`
In `HostApp` rimuovere l'uso dell'audio (niente `useHostAudio`, niente import audio, niente
`AudioGate`/`MuteButton` legati al suono). La pagina resta un mirror muto. Rotta intatta.

### 4. Narrazione come testo per tutti (`StatusView`)
In [StatusView.tsx](client/src/player/views/StatusView.tsx), fasi `STORY_INTRO` / `SCENE_INTRO` /
`SCENE_CONSEQUENCE` / `STORY_EPILOGUE`: mostrare il **testo completo** già presente in `game.storia`
(`premessa` / `sceneNarration` / `consequence` / `epilogo`) al posto dei placeholder "🔊 …
sullo schermo". Mantenere il pulsante "Continua ▶" del leader. Testo leggibile a telefono
(serif, dimensioni adeguate, scroll se lungo).

### 5. Voce meno robotica (`narrator.ts`)
- `pickBestItalianVoice(voices)` **puro/testabile**: tra le `it-*`, preferire le voci di qualità
  (nomi "enhanced/premium"/locali; lista di preferenze note Apple es. "Alice"), fallback alla
  prima `it-*`, poi a `null` (default browser).
- Spezzare i testi lunghi in **frasi** (`splitIntoSentences`, puro/testabile) e accodarle una per
  una → la voce non si interrompe sui brani lunghi (bug Chrome utterance >~15s); keep-alive
  `pause()/resume()` come rete di sicurezza.
- Taratura `rate`/`pitch` per un parlato più naturale.
- Mantenere l'hardening esistente (unlock nel gesto, cancel solo se `speaking||pending`,
  attesa `voiceschanged`).

### 6. Pulizia artefatti di debug
Rimuovere `client/src/host/AudioDebug.tsx`, `client/public/voce-test.m4a`, e l'aggancio in
[App.tsx](client/src/App.tsx) (import lazy + `<AudioDebug />`). Rimuovere `audioDiag`/`voiceStats`
se non più usati.

### 7. Scanner QR con fotocamera (sottosistema separato, per ultimo)
Il QR generato codifica `${origin}/join?room=CODE` (via `qrcode.react`, sola generazione).
Per **leggere**: aggiungere dipendenza decoder (`jsqr`, puro JS) + `getUserMedia`.
- `parseRoomFromQr(text)` **puro/testabile**: estrae il `room`/code da un URL o da una stringa.
- Componente `QrScanner` isolato: bottone "📷 Scansiona QR" nel form di join → apre la fotocamera,
  decodifica i frame, al match precompila il codice e fa join. Gestione permesso/negazione camera
  e fallback all'inserimento manuale.

## Testing
- Unit (puri, TDD rosso→verde): `pickBestItalianVoice`, `splitIntoSentences`, `parseRoomFromQr`.
- I cue (`cues.ts`) e `narrationFor` restano coperti dai test esistenti.
- Lo hook e l'audio (side-effects Web Audio/Speech) si verificano **a orecchio** (sotto).
- Il resto della suite resta verde (`npm test`).

## Sequenza di implementazione
A) `useHostAudio` (estrazione, refactor neutro). B) Montare su `PlayerApp` (leader) + zittire
`/host`. C) Testo narrazione in `StatusView`. D) Qualità voce. E) Pulizia debug. → **verifica a
orecchio dal telefono leader**. F) Scanner QR (ultimo).

## Verifica end-to-end (a orecchio, da telefono/browser reale)
- Crea stanza (diventi leader) → parte la musichetta; un tocco sblocca l'audio.
- Cambi di fase → effetti; modalità Storie → la **voce** legge ogni beat; la musica fa il duck.
- Un secondo telefono (non leader) → **muto**, ma vede **tutto il testo** della narrazione.
- `/host` aperto → **muto**.
- `npm run typecheck && npm run lint && npm test && npm run build` verdi.
- Commit + `git push` del branch (regola fissa utente).
