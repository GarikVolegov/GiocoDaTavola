# Avvocato del Diavolo — design

**Data:** 2026-06-21 · **Branch base:** `ralph/skeleton-dilemma` · **Stato:** approvato, in implementazione

## Sintesi

Un *twist a sorpresa* sulla modalità Gruppo: in **un round garantito a partita**
(casuale, mai il primo) i difensori devono argomentare il **lato opposto** a quello
che hanno votato. Il tavolo lo sa (versione **pubblica**): è una performance comica e
una sfida di pura retorica. Nuovo premio finale **🎭 Il Voltagabbana**.

Non è una modalità a sé, non cambia la sequenza delle fasi, e si applica solo a
`mode === 'gruppo'` (il Duello è invariato).

## L'intuizione di design (perché costa poco)

Oggi `selectDefenders` registra `Defender.side` = il lato **votato** dal difensore,
che coincide con quello che difende. **Tutto** il resto del gioco si appoggia a quel
campo: difese dei bot (`botDefenseArgument(persona, dilemma, side)`), difese AI
(`botDefenderContext.side`), attribuzione dei voti e `persuasion`
(`netSwing[d.side]`), display pubblico (`publicDefense`, `publicSwing`).

> **Mossa chiave:** nel round-twist, `selectDefenders` pesca un votante del lato X ma
> registra `side = opposto(X)` (il lato da **difendere**) e un flag `devil: true`.
> Così difese, attribuzione e persuasione lavorano **già** sul lato argomentato senza
> riscritture. Il vero voto del difensore = `opposto(side)`.

## Comportamento

### 1. Scelta del round (server, a `startGame`)
- `Room.devilRoundIndex: number | null` = intero casuale in `[2 .. dilemmaCount]`
  (mai 1), via l'`rng` iniettabile → deterministico nei test.
- `null` se `mode !== 'gruppo'` o `dilemmaCount < 2`.
- Helper privato `isDevilRound(room) = devilRoundIndex !== null && dilemmaIndex === devilRoundIndex`.

### 2. Selezione difensori (`selectDefenders`)
- Round normale: invariato (un difensore per lato con voti, A prima di B).
- Round-twist: per ogni lato con voti, pesca un votante e registra
  `side = opposto, devil: true`.
- *Effetto collaterale gradito:* se il gruppo ha votato tutto da un lato, il twist
  **garantisce** che il lato impopolare venga difeso (oggi resterebbe muto).

### 3. Rivelazione anti-spoiler
- I difensori si scelgono **dopo** VOTE_1, quindi il twist è ignoto prima.
- Reso pubblico **solo da DEFENSE in poi** (`DEFENSE | SPEAKER_VOTE | VOTE_2 |
  PHASE_RESULTS`) via reader gated `publicDevilRound(code)`. Prima resta nascosto: il
  primo voto e il pronostico restano "ciechi".

### 4. Premio finale 🎭 Il Voltagabbana
- Nuova stat `PlayerStats.devilPersuasion?: number` = voti guadagnati dal lato difeso
  **nei round-twist** (sottoinsieme di `persuasion`, quindi conta anche per "Il
  Persuasore"). Opzionale, valorizzata solo se > 0 (come `reactionsReceived`).
- Nuovo `AwardId: 'voltagabbana'` → "Ha spostato più voti difendendo il lato che NON
  aveva votato."

## UI

- **Telefono del difensore** (quando `defense.speaker.devil` e sei tu): card speciale
  **"🎭 AVVOCATO DEL DIAVOLO — Hai votato {opposto}, ma ora convinci tutti che {side}
  è giusto!"**.
- **Vista pubblica (TV/host):** badge **"🎭 Round Avvocato del Diavolo — si difende il
  contrario!"** durante DEFENSE; un 🎭 accanto al nome del difensore.

## Bot & AI
Nessuna modifica logica: bot e difese AI argomentano `defender.side`, che ora è il
lato assegnato. (Opzionale, solo flavour: dire all'AI "difendi questo *anche se non è
la tua opinione*".)

## Confini / non-goal
- Solo Gruppo (Duello invariato).
- Esattamente 1 round-twist a partita.
- Versione pubblica (niente variante segreta).
- Nessuna nuova fase nella sequenza.

## Test (TDD)
1. `startGame`: `devilRoundIndex ∈ [2..dilemmaCount]`, mai 1 (rng pinnato); `null` in duello.
2. `selectDefenders`: nel round-twist inverte `side` e marca `devil`; round normale invariato.
3. `recordRoundStats`: accredita `devilPersuasion` solo nel round-twist, come sottoinsieme di `persuasion`.
4. `computeAwards`: restituisce "Il Voltagabbana" quando `devilPersuasion > 0`.
5. `publicDevilRound`: `false` prima di DEFENSE, `true` da DEFENSE a PHASE_RESULTS nel solo round-twist.
