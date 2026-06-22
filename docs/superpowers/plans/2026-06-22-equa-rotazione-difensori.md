# Equa rotazione dei difensori — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che chi non ha ancora difeso abbia priorità nella scelta del difensore, così su una partita tutti ottengono un turno, invece di una scelta puramente casuale.

**Architecture:** Aggiungiamo un contatore per-giocatore `Room.defenseCounts` e modifichiamo `RoomStore.selectDefenders` perché, tra i votanti di un lato, scelga sempre chi ha difeso meno volte (pareggio risolto con l'rng iniettabile). Il contatore si azzera a inizio partita, come `stats`.

**Tech Stack:** Node + TypeScript (CommonJS), Vitest. Logica in `server/src/game/rooms.ts`, test in `server/src/game/__tests__/rooms.test.ts`.

## Global Constraints

- **Voti segreti:** mai esporre voti individuali; solo identità dei difensori scelti (già pubbliche) lasciano il server. `defenseCounts` resta lato server.
- **No `any`** (errore di lint). Variabili/argomenti volutamente inutilizzati prefissati con `_`.
- **Moduli separati:** server CJS, non importare codice client.
- **Gate verde obbligatorio prima di ogni commit:** `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.
- **A fine lavoro:** `git push` del branch corrente sul remoto.
- Ambito: modalità `gruppo` (classica + percorso, che condividono `selectDefenders`). `duello` non toccato.

---

### Task 1: Rotazione equa dei difensori (campo + selezione)

**Files:**
- Modify: `server/src/game/rooms.ts` — interfaccia `Room` (~L324), literal di creazione stanza (~L898), reset in `startGame` (~L1020), metodo `selectDefenders` (L610–632).
- Test: `server/src/game/__tests__/rooms.test.ts` (nuovo `describe` + un helper).

**Interfaces:**
- Consumes: niente di nuovo. Usa lo stato esistente `room.votes` e `this.rng()`.
- Produces:
  - `Room.defenseCounts: Map<string, number>` — quante volte ogni `playerId` è stato scelto difensore nella partita corrente. Inizializzata vuota alla creazione e azzerata in `startGame`.
  - `selectDefenders(room: Room): Defender[]` (firma invariata) ora deterministicamente preferisce i votanti con `defenseCounts` minimo e incrementa il contatore del giocatore scelto.

- [ ] **Step 1: Scrivi il test (e l'helper) che fallisce**

In `server/src/game/__tests__/rooms.test.ts`, aggiungi questo helper subito sotto l'helper `defenseRoom` (intorno a L51):

```ts
// From a DEFENSE state, walk to the NEXT round's DEFENSE, re-casting VOTE_1
// votes for sock-0..n (votes are cleared each DILEMMA_REVEAL, so re-vote).
function nextDefense(store: RoomStore, code: string, sides: VoteChoice[]) {
  let g = 0;
  while (store.get(code)?.phase !== 'VOTE_1' && g++ < 50) store.advancePhase(code);
  sides.forEach((side, i) => store.vote(code, `sock-${i}`, side));
  while (store.get(code)?.phase !== 'DEFENSE' && g++ < 50) store.advancePhase(code);
}
```

Poi aggiungi un nuovo blocco in fondo al file:

```ts
describe('RoomStore defense — equa rotazione difensori', () => {
  it('dà priorità a chi non ha ancora difeso un lato rispetto a chi lo ha già fatto', () => {
    // rng=()=>0.999 mette il round Avvocato del Diavolo ULTIMO (round 3), così i
    // round 1-2 sono normali (nessun ribaltamento di lato), e a parità il
    // tiebreak pesca l'ultimo candidato (come fa già il test US-010 esistente).
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.999);
    const code = defenseRoom(store, ['A', 'B', 'B']); // round 1
    expect(store.get(code)?.defenders.find((d) => d.side === 'B')?.id).toBe('sock-2');

    nextDefense(store, code, ['A', 'B', 'B']); // round 2 (normale)
    // sock-2 ha già difeso B (count 1); sock-1 non ha mai parlato (count 0):
    // tocca a sock-1, anche se l'rng da solo ripescherebbe sock-2.
    expect(store.get(code)?.defenders.find((d) => d.side === 'B')?.id).toBe('sock-1');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisce**

Run: `npm test -w server -- rooms.test.ts -t "equa rotazione"`
Expected: FAIL — sotto il codice attuale il difensore di B al round 2 è di nuovo `sock-2` (oppure errore perché `defenseCounts` non esiste ancora se referenziato).

- [ ] **Step 3: Aggiungi il campo `defenseCounts` all'interfaccia `Room`**

In `server/src/game/rooms.ts`, subito dopo il campo `speakerVotes` (chiusura dell'interfaccia `Room`, ~L324):

```ts
  /**
   * Quante volte ogni player (per id) è stato scelto come difensore nella
   * partita corrente. Guida l'equa rotazione in `selectDefenders` (priorità a
   * chi ha difeso meno). Vuota alla creazione, azzerata a `startGame`. Resta
   * lato server: è solo un conteggio, non espone voti.
   */
  defenseCounts: Map<string, number>;
```

- [ ] **Step 4: Inizializza `defenseCounts` alla creazione della stanza**

Nel literal di creazione stanza, subito dopo `speakerVotes: new Map(),` (~L898):

```ts
      defenseCounts: new Map(),
```

- [ ] **Step 5: Azzera `defenseCounts` in `startGame`**

In `startGame`, subito dopo `room.stats = new Map();` (~L1020):

```ts
    room.defenseCounts = new Map();
```

- [ ] **Step 6: Modifica `selectDefenders` perché scelga il meno-utilizzato**

Sostituisci il corpo del `for` in `selectDefenders` (L613–630). La versione attuale:

```ts
    for (const side of ['A', 'B'] as const) {
      const voters = [...room.votes.entries()]
        .filter(([, choice]) => choice === side)
        .map(([id]) => id);
      if (voters.length === 0) continue; // side with no votes -> no defender
      const chosen = voters[Math.floor(this.rng() * voters.length)];
      const player = room.players.get(chosen);
      if (!player) continue;
      if (devil) {
```

diventa:

```ts
    for (const side of ['A', 'B'] as const) {
      const voters = [...room.votes.entries()]
        .filter(([, choice]) => choice === side)
        .map(([id]) => id);
      if (voters.length === 0) continue; // side with no votes -> no defender
      // Equità: tra i votanti di questo lato scegli SEMPRE chi ha difeso meno
      // volte finora, così su una partita tutti ottengono un turno. Un lato può
      // essere difeso solo da chi l'ha votato: si pesca il meno-utilizzato tra
      // loro, con pareggio risolto dall'rng iniettabile (resta imprevedibile e
      // riproduce il vecchio comportamento quando i conteggi sono pari).
      const min = Math.min(...voters.map((id) => room.defenseCounts.get(id) ?? 0));
      const candidates = voters.filter((id) => (room.defenseCounts.get(id) ?? 0) === min);
      const chosen = candidates[Math.floor(this.rng() * candidates.length)];
      const player = room.players.get(chosen);
      if (!player) continue;
      room.defenseCounts.set(chosen, (room.defenseCounts.get(chosen) ?? 0) + 1);
      if (devil) {
```

(Il resto del metodo — branch `devil`/`else`, `defenders.push`, `return` — resta invariato.)

- [ ] **Step 7: Esegui il nuovo test e verifica che passa**

Run: `npm test -w server -- rooms.test.ts -t "equa rotazione"`
Expected: PASS.

- [ ] **Step 8: Verifica che i test esistenti dei difensori restino verdi**

Run: `npm test -w server -- rooms.test.ts -t "defense"`
Expected: PASS — in particolare i test "US-010" (a parità di conteggio, primo round, i candidati coincidono con tutti i votanti, quindi la scelta è identica a prima): `() => 0` → primo votante, `() => 0.99` → ultimo votante.

- [ ] **Step 9: Gate verde completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto verde.

- [ ] **Step 10: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(difesa): priorità a chi non ha ancora difeso (equa rotazione)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Coverage casi limite + push

**Files:**
- Test: `server/src/game/__tests__/rooms.test.ts` (stesso `describe` del Task 1).

**Interfaces:**
- Consumes: `Room.defenseCounts`, `selectDefenders`, helper `defenseRoom` e `nextDefense` del Task 1, helper `reachDevilDefense` (lo reimplementiamo localmente qui sotto, non importabile da un altro file di test).
- Produces: nessuna nuova API.

- [ ] **Step 1: Scrivi i test dei casi limite**

Aggiungi, dentro il `describe('RoomStore defense — equa rotazione difensori', ...)` del Task 1:

```ts
  it('continua a scegliere l’unico votante di un lato a ogni round', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0.999);
    const code = defenseRoom(store, ['A', 'B', 'B']); // solo sock-0 vota A
    expect(store.get(code)?.defenders.find((d) => d.side === 'A')?.id).toBe('sock-0');
    nextDefense(store, code, ['A', 'B', 'B']);
    expect(store.get(code)?.defenders.find((d) => d.side === 'A')?.id).toBe('sock-0');
  });

  it('conta anche il turno nel round Avvocato del Diavolo', () => {
    // rng=()=>0 -> devilRoundIndex=2. Round 1 senza voti (nessun difensore),
    // round 2 (devil) con voti: chi è scelto a difendere DEVE incrementare il
    // contatore anche se argomenta il lato opposto.
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    let g = 0;
    while (store.get(code)!.dilemmaIndex !== 2 && g++ < 50) store.advancePhase(code);
    store.advancePhase(code); // VOTE_1 (round 2 = devil)
    (['A', 'B', 'B'] as VoteChoice[]).forEach((side, i) => store.vote(code, `sock-${i}`, side));
    while (store.get(code)?.phase !== 'DEFENSE' && g++ < 50) store.advancePhase(code);
    const counts = store.get(code)!.defenseCounts;
    // A-voter (sock-0) e il primo B-voter (sock-1) sono stati scelti: count 1 ciascuno.
    expect(counts.get('sock-0')).toBe(1);
    expect(counts.get('sock-1')).toBe(1);
  });

  it('parte da conteggi vuoti quando inizia la partita', () => {
    const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
    const { code } = store.create();
    expect(store.get(code)!.defenseCounts.size).toBe(0); // alla creazione
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)!.defenseCounts.size).toBe(0); // appena avviata, prima di ogni DEFENSE
  });
```

- [ ] **Step 2: Esegui i nuovi test**

Run: `npm test -w server -- rooms.test.ts -t "equa rotazione"`
Expected: PASS (tutti e quattro i casi del describe).

- [ ] **Step 3: Gate verde completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tutto verde.

- [ ] **Step 4: Commit**

```bash
git add server/src/game/__tests__/rooms.test.ts
git commit -m "test(difesa): casi limite equa rotazione (unico votante, devil, reset)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push del branch sul remoto**

```bash
git push
```
(Se manca l'upstream: `git push -u origin $(git rev-parse --abbrev-ref HEAD)`. Se il push è rifiutato, segnalalo — non forzare con `--force`.)

---

## Self-Review

**1. Spec coverage:**
- Garanzia rigida (meno-utilizzato + tiebreak rng) → Task 1 Step 6 + Step 1 test. ✓
- "Cosa conta" = turni da difensore, devil incluso → incremento in `selectDefenders`; Task 2 test devil. ✓
- Contatore dedicato `defenseCounts` → Task 1 Steps 3–6. ✓
- Ambito gruppo (classica+percorso), duello invariato → `selectDefenders` è condiviso da gruppo/percorso; il duello non lo chiama (codice invariato). ✓
- Numero difensori invariato (uno per lato) → la struttura del `for` su `['A','B']` non cambia → `SPEAKER_VOTE` e fasi a valle intatte. ✓
- Stato/reset (creazione + startGame, come `stats`) → Steps 4–5; Task 2 test "parte da conteggi vuoti". ✓
- Voti segreti, no `any` → nessun voto esposto, niente `any` nel codice aggiunto. ✓
- Test elencati nello spec (priorità, tiebreak, unico votante, 0 voti, devil, reset): priorità (T1), tiebreak+0-voti (coperti dai test US-010 esistenti, mantenuti verdi in T1 Step 8), unico votante / devil / reset (T2). ✓

**2. Placeholder scan:** nessun TBD/TODO; ogni step ha codice o comando concreto con output atteso. ✓

**3. Type consistency:** `defenseCounts: Map<string, number>` usato coerentemente (interfaccia, init ×2, letture `.get(...) ?? 0`, scrittura `.set(...)`); helper `nextDefense(store, code, sides: VoteChoice[])` usato in T1 e T2. ✓
