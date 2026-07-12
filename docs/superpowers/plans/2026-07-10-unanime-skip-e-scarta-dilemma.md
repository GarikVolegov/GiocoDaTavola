# Voto unanime salta il dibattito + "Scarta dilemma" del leader

## Context

Due punti morti della serata nel formato dilemma (gruppo/classic):
1. Quando **tutti votano lo stesso lato** al primo voto, il dibattito non ha senso ma il gioco lo fa svolgere lo stesso → tempi morti.
2. Il **creatore della stanza** non può scartare un dilemma che non gli piace: se esce una domanda sbagliata per il gruppo, va subita.

Scelte confermate dall'utente:
- Unanime ⇒ **mini-reveal celebrativo** ("Tutti d'accordo! 🎉", ~4.5s, sting audio) poi dritti a un nuovo dilemma. Solo unanimità **100%** (un 7-1 resta un dibattito valido).
- Leader può scartare durante **DILEMMA_REVEAL e VOTE_1** (2-tap di conferma se qualcuno ha già votato); dopo il reveal non più.
- In entrambi i casi il dilemma è **rimpiazzato nello stesso round** (dilemmaIndex invariato, pesca dal deck); deck esaurito ⇒ si avanza normalmente.
- **Solo formato classic**: percorso ha `deck = null` (nessun rimpiazzo possibile) e contatori di tappa a PHASE_RESULTS; storia deve sempre produrre una decisione. Il duello ha già il suo ramo `agreed`.

Piano dettagliato completo (decisioni verificate nel codice, righe precise): `/Users/gazz/.claude/plans/nei-momenti-in-cui-snappy-lighthouse-agent-a2d280dcd0a6613d0.md`.

## Architettura (sintesi)

- **Nuova fase `UNANIMOUS_REVEAL`** (4.5s in `PHASE_DURATIONS_MS`), inserita da `advancePhase` come GROUP_MIND/ACCUSE, non nella sequenza pura. I `Record<GamePhase,…>` esaustivi (durations server, `PHASE_LABELS` client) fanno da checklist a compile-time. Stats/premi/votes1/swing/cadence GROUP_MIND restano puliti by-construction: si popolano solo entrando in VOTE_2/PHASE_RESULTS, che il round rimpiazzato non attraversa mai.
- **Detection unanime** in un solo punto — `RoomStore.advancePhase` (rooms.ts ~1485), dopo `step()`: se `phase==='VOTE_1' && transition==='SPLIT_REVEAL' && format==='classic' && unanimousSide(tally(votes))` ⇒ override a UNANIMOUS_REVEAL. Copre tutti i percorsi di chiusura di VOTE_1 (early-advance, roster change, soft-timeout, leader:advancePhase). Floor: **≥ 2 voti effettivi** (una "Salta ▶" con 0-1 voti non è unanimità).
- **Uscita condivisa**: da UNANIMOUS_REVEAL, `advancePhase` chiama `replaceCurrentDilemma(room)` → nuovo `DILEMMA_REVEAL` stesso indice (reset voti/mani/bot gratis nel blocco entry esistente), oppure fallback `step('PHASE_RESULTS', idx)` se deck vuoto (round successivo / FINAL_AWARDS, detour ACCUSE preservato).
- **`leader:skipDilemma`** riusa la stessa uscita: `RoomStore.skipDilemma` valida (fase ∈ {DILEMMA_REVEAL, VOTE_1}, classic) poi assegna sinteticamente `phase = 'UNANIMOUS_REVEAL'` (mai broadcastata) e delega ad `advancePhase` — zero duplicazione. Broadcast `room:dilemmaSkipped` per toast + sting su tutti i telefoni.
- **`replaceCurrentDilemma(room)`** in dilemmaPlan.ts: `deck.draw()` (già filtrato per mood/register/exclude) rispettando la regola famiglia con set-aside + backfill (mirror `buildClassicPlan`); nuovo `Deck.putBack()` per i set-aside (mai `new Deck` — perderebbe l'rng iniettato); id scartato in `excludeDilemmaIds` (per il rematch); splice in `plannedDilemmas[idx-1]`.
- **Audio**: `SfxName` `'unanimous'` via `sfxForTransition` (arriva su ogni telefono col cambio fase); `'discard'` suonato dal listener di `room:dilemmaSkipped` (il re-reveal è same-phase ⇒ il transition-sting non scatta).

## Task (TDD, test prima di ogni implementazione)

| # | Cosa | File |
|---|------|------|
| T1 | `unanimousSide(tally)` (floor ≥2) + reader `publicUnanimous` gated sulla fase | `server/src/game/voting.ts` + `__tests__/voting.test.ts` |
| T2 | Fase `UNANIMOUS_REVEAL` + durata 4500ms | `server/src/game/phases.ts` + `__tests__/phases.test.ts` |
| T3 | `Deck.putBack()` + `replaceCurrentDilemma()` (famiglia, backfill, deck vuoto ⇒ false) | `deck.ts`, `dilemmaPlan.ts` + test |
| T4 | Detection VOTE_1 + uscita UNANIMOUS_REVEAL in `advancePhase`; regressioni split/percorso; bot ri-votano; deck esausto; stats pulite; cadence GROUP_MIND intatto | `server/src/game/rooms.ts` + `__tests__/rooms.test.ts` |
| T5 | `RoomStore.skipDilemma` + handler socket `leader:skipDilemma` (gating `leaderCodeFor`, errori NOT_SKIPPABLE_PHASE/NOT_CLASSIC) + broadcast `room:dilemmaSkipped` | `rooms.ts`, `server/src/index.ts` + test |
| T6 | Payload `unanimous: {side, count} \| null` in `game:state` | `server/src/index.ts` |
| T7 | Mirror client: `GamePhase`, `PHASE_LABELS`, `SocketEvents.LeaderSkipDilemma/RoomDilemmaSkipped`, tipo payload | `client/src/shared/events.ts` |
| T8 | Sting `unanimous` (fanfara breve) in `sfxForTransition` + ricetta `discard` (whoosh) | `client/src/host/audio/cues.ts`, `sfx.ts` + `cues.test.ts` |
| T9 | Schermata "Tutti d'accordo! 🎉" su telefono e TV (opzione vincente + "nuovo dilemma in arrivo…") | `client/src/player/views/StatusView.tsx`, `client/src/host/HostApp.tsx` + `PlayerApp.test.tsx` |
| T10 | Bottone leader "🗑️ Scarta dilemma" (1 tap in DILEMMA_REVEAL, 2-tap in VOTE_1 se `votedCount>0`, stato `confirmingDiscard` separato) + toast/sting su `room:dilemmaSkipped` | `client/src/player/PlayerApp.tsx` + test |

Edge case coperti nei test: floor <2 voti, late joiner, deck esausto sull'ultimo round (⇒ FINAL_AWARDS), infiltrato (detour ACCUSE), catena di unanimità coi bot (termina consumando il deck), percorso/storia esclusi, non-leader/fase sbagliata rifiutati.

## Processo

- Branch di lavoro: `ralph/skeleton-dilemma` (branch attivo; attenzione: Ralph può committare in parallelo — usare pathspec espliciti, eventualmente stash-isolate).
- Copia del piano in `docs/superpowers/plans/2026-07-10-unanime-skip-e-scarta-dilemma.md` + commit docs all'inizio.
- Commit semantici per gruppi di task (server core / socket+payload / client), sempre con pathspec espliciti.

## Verifica

1. `npm run typecheck && npm run lint && npm test && npm run build` — tutto verde (i Record esaustivi confermano i punti toccati).
2. Smoke manuale (`npm run dev`, partita classic 1 umano + 2 bot):
   - votare col lato dei bot fino a unanimità ⇒ schermata 4.5s + sting ⇒ nuovo dilemma, stesso numero di round;
   - "Scarta dilemma" in DILEMMA_REVEAL (1 tap) e in VOTE_1 coi bot che hanno votato (2 tap) ⇒ toast + sting + nuovo dilemma;
   - in percorso: nessun bottone scarta, unanimità mostra il normale SPLIT_REVEAL.
3. A gate verde: commit + `git push` (regola fissa).
