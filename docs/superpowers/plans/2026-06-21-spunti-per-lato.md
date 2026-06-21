# Spunti per lato (Lotto 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni dilemma offre 2–3 argomenti per lato (A/B), mostrati a chi deve difendere quel lato (sul suo telefono e sulla TV), per rendere le difese più ricche.

**Architecture:** Gli spunti sono dati statici nel deck (`server/data/dilemmas.json`). Il server li seleziona in base al lato dello speaker corrente e li include in `DefenseState` (già parte di `game:state`, che tutti ricevono). Nessun nuovo evento Socket.IO.

**Tech Stack:** TypeScript (server CJS + client ESM), Socket.IO, React, Vitest.

## Global Constraints

- **Voti segreti:** solo conteggi aggregati lasciano il server. Gli spunti riguardano il *lato* del difensore, già pubblico mentre parla — nessuna violazione.
- **Timer server-authoritative:** invariati; questo lotto non tocca le fasi.
- Niente `any` (errore di lint); prefissa con `_` gli argomenti inutilizzati.
- Server CJS / client ESM separati.
- `npm run typecheck && npm run lint && npm test && npm run build` tutti verdi prima di ogni commit.
- Questo lotto è **indipendente** dagli altri due (phone-first, punti ciechi): può essere eseguito in qualsiasi ordine.

## File Structure

- Modify `server/src/game/deck.ts` — `Dilemma` guadagna `spuntiA: string[]` e `spuntiB: string[]`.
- Modify `server/data/dilemmas.json` — aggiunge `spuntiA`/`spuntiB` a tutti i 60 dilemmi.
- Modify `server/src/game/rooms.ts` — `DefenseState` guadagna `spunti: string[] | null`; `publicDefense` lo popola dal lato dello speaker.
- Modify `client/src/shared/events.ts` — mirror di `DefenseState.spunti`.
- Modify `client/src/player/PlayerApp.tsx` — mostra gli spunti nel turno del difensore.
- Modify `client/src/host/HostApp.tsx` — mostra gli spunti accanto allo speaker.
- Test: `server/src/game/__tests__/deck.test.ts` (integrità dati), `server/src/game/__tests__/rooms.test.ts` (selezione spunti per lato).

---

### Task 1: Spunti nei dati e nel tipo `Dilemma`

**Files:**
- Modify: `server/src/game/deck.ts:11-18` (interface `Dilemma`)
- Modify: `server/data/dilemmas.json` (tutti i 60 dilemmi)
- Test: `server/src/game/__tests__/deck.test.ts`
- Modify (fixtures, per typecheck): `server/src/game/__tests__/rooms.test.ts:24-31`, `server/src/game/__tests__/deck.test.ts:6-10`

**Interfaces:**
- Produces: `interface Dilemma { id; text; optionA; optionB; register; spuntiA: string[]; spuntiB: string[] }`

- [ ] **Step 1: Scrivi il test di integrità (fallisce)**

In `server/src/game/__tests__/deck.test.ts`, dentro il `describe('loadDilemmas ...')`, aggiungi:

```ts
it('every dilemma has at least two non-empty spunti per side', () => {
  for (const d of loadDilemmas()) {
    expect(d.spuntiA.length).toBeGreaterThanOrEqual(2);
    expect(d.spuntiB.length).toBeGreaterThanOrEqual(2);
    for (const s of [...d.spuntiA, ...d.spuntiB]) {
      expect(s.trim()).not.toBe('');
    }
  }
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisce**

Run: `npx vitest run server/src/game/__tests__/deck.test.ts`
Expected: FAIL — `d.spuntiA` è `undefined` (proprietà mancante), oppure errore di typecheck nel passo successivo.

- [ ] **Step 3: Aggiungi i campi al tipo `Dilemma`**

In `server/src/game/deck.ts`, l'interface diventa:

```ts
export interface Dilemma {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** Which content register this dilemma belongs to. */
  register: 'vita' | 'business';
  /** 2–3 talking points for someone defending side A (optionA). */
  spuntiA: string[];
  /** 2–3 talking points for someone defending side B (optionB). */
  spuntiB: string[];
}
```

- [ ] **Step 4: Popola tutti i 60 dilemmi in `dilemmas.json`**

Per ogni oggetto dilemma aggiungi `spuntiA` e `spuntiB` (2–3 voci ciascuno), coerenti col tono esistente. Esempi (primi due dilemmi):

```json
{
  "id": "d01",
  "text": "Hai un'idea geniale ma rischiosa. Cosa fai?",
  "optionA": "Mollo tutto e ci punto al 100%",
  "optionB": "La porto avanti la sera, tenendo il lavoro sicuro",
  "register": "vita",
  "spuntiA": [
    "Il costo di non provarci è il rimpianto",
    "Sul campo impari più in fretta",
    "La finestra giusta non torna sempre"
  ],
  "spuntiB": [
    "Riduci il rischio, non il sogno",
    "Un reddito sicuro ti dà lucidità",
    "Validare prima costa molto meno"
  ]
},
{
  "id": "d02",
  "text": "Un socio ti propone di gonfiare i numeri per chiudere un investimento.",
  "optionA": "Lo faccio: i soldi servono ora",
  "optionB": "Mai: la reputazione vale più dei soldi",
  "register": "business",
  "spuntiA": [
    "Senza cassa non arrivi a domani",
    "Tutti aggiustano un po' la narrazione",
    "Chiudi il round, poi rimetti i conti a posto"
  ],
  "spuntiB": [
    "Una bugia ai numeri non si recupera più",
    "Gli investitori seri fanno due diligence",
    "La fiducia persa costa più di un round saltato"
  ]
}
```

Compila i rimanenti 58 nello stesso stile. Il test dello Step 1 garantisce che nessuno resti vuoto.

- [ ] **Step 5: Aggiorna le fixture dei test (typecheck)**

`Dilemma` ora richiede `spuntiA`/`spuntiB`: le fixture inline devono fornirli.

In `server/src/game/__tests__/rooms.test.ts`, la `DILEMMA_FIXTURE`:

```ts
const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 6 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [`pro A${i + 1} #1`, `pro A${i + 1} #2`],
  spuntiB: [`pro B${i + 1} #1`, `pro B${i + 1} #2`],
}));
```

In `server/src/game/__tests__/deck.test.ts`, la fixture in cima (`fixture: Dilemma[]`): aggiungi a ciascun oggetto `spuntiA: ['x', 'y'], spuntiB: ['x', 'y']`.

- [ ] **Step 6: Esegui typecheck + test, verifica che passano**

Run: `npm run typecheck && npx vitest run server/src/game/__tests__/deck.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/game/deck.ts server/data/dilemmas.json server/src/game/__tests__/deck.test.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(spunti): per-side talking points on every dilemma"
```

---

### Task 2: `publicDefense` espone gli spunti del lato che parla

**Files:**
- Modify: `server/src/game/rooms.ts:110-122` (interface `DefenseState`), `server/src/game/rooms.ts:668-679` (`publicDefense`)
- Test: `server/src/game/__tests__/rooms.test.ts`

**Interfaces:**
- Consumes: `Dilemma.spuntiA` / `Dilemma.spuntiB` (Task 1), `makeFixtureDeck` + `defenseRoom` helpers (esistenti in `rooms.test.ts`).
- Produces: `DefenseState` guadagna `spunti: string[] | null`.

- [ ] **Step 1: Scrivi il test (fallisce)**

In `server/src/game/__tests__/rooms.test.ts`, nel `describe` che contiene `defenseRoom`, aggiungi:

```ts
it("exposes the speaking side's spunti during DEFENSE", () => {
  const store = new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);
  const code = defenseRoom(store, ['A', 'B', 'B']); // defenders: A=sock-0, B=sock-1
  // First DEFENSE turn speaks side A -> d1.spuntiA.
  expect(store.publicDefense(code)?.spunti).toEqual(['pro A1 #1', 'pro A1 #2']);
  store.advancePhase(code); // next DEFENSE turn -> side B
  expect(store.publicDefense(code)?.spunti).toEqual(['pro B1 #1', 'pro B1 #2']);
});
```

- [ ] **Step 2: Esegui il test, verifica che fallisce**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "spunti"`
Expected: FAIL — `spunti` è `undefined`.

- [ ] **Step 3: Aggiungi il campo e popolalo**

In `server/src/game/rooms.ts`, l'interface `DefenseState` guadagna in fondo:

```ts
  /** Talking points for the current speaker's side; null outside DEFENSE/no speaker. */
  spunti: string[] | null;
```

In `publicDefense`, prima del `return`:

```ts
    const spunti =
      speaker && room.currentDilemma
        ? speaker.side === 'A'
          ? room.currentDilemma.spuntiA
          : room.currentDilemma.spuntiB
        : null;
    return {
      speaker,
      turn: totalTurns === 0 ? 0 : room.defenseTurnIndex + 1,
      totalTurns,
      argument: room.defenseArgument,
      spunti,
    };
```

- [ ] **Step 4: Esegui il test, verifica che passa**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "spunti"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(spunti): expose speaking side's spunti in publicDefense"
```

---

### Task 3: Mostra gli spunti su telefono (difensore) e TV

**Files:**
- Modify: `client/src/shared/events.ts:204-214` (interface `DefenseState`)
- Modify: `client/src/player/PlayerApp.tsx:327-339` (ramo DEFENSE, `myTurn`)
- Modify: `client/src/host/HostApp.tsx` (ramo `phase === 'DEFENSE' && defense`, ~riga 335)

**Interfaces:**
- Consumes: `game.defense.spunti` da `GameStatePayload` (Task 2).

> Nota: il client non ha test runner (Vitest copre solo `server/**`). La verifica è `typecheck`/`lint`/`build` + prova manuale.

- [ ] **Step 1: Mirror del tipo nel client**

In `client/src/shared/events.ts`, l'interface `DefenseState` guadagna in fondo:

```ts
  /** Talking points for the current speaker's side; null outside DEFENSE. */
  spunti: string[] | null;
```

- [ ] **Step 2: PlayerApp — spunti nel turno del difensore**

In `client/src/player/PlayerApp.tsx`, nel ramo `phase === 'DEFENSE'`, dentro il blocco `myTurn ? ( ... )`, dopo il paragrafo «Difendi …» aggiungi:

```tsx
{game?.defense?.spunti && game.defense.spunti.length > 0 && (
  <div style={{ width: 'min(90vw, 22rem)', textAlign: 'left' }}>
    <p style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.8, margin: '0 0 0.3rem' }}>
      Spunti per te:
    </p>
    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {game.defense.spunti.map((s) => (
        <li key={s} style={{ fontSize: '0.95rem', opacity: 0.9 }}>{s}</li>
      ))}
    </ul>
  </div>
)}
```

(Gli altri telefoni — ramo `else` «Sta parlando X» — NON mostrano gli spunti.)

- [ ] **Step 3: HostApp — spunti accanto allo speaker**

In `client/src/host/HostApp.tsx`, nel blocco `phase === 'DEFENSE' && defense`, dopo il nome dello speaker corrente, aggiungi la stessa lista letta da `defense.spunti`:

```tsx
{defense.spunti && defense.spunti.length > 0 && (
  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.4rem', textAlign: 'left', display: 'inline-flex', flexDirection: 'column', gap: '0.3rem' }}>
    {defense.spunti.map((s) => (
      <li key={s} style={{ fontSize: '1.1rem', opacity: 0.85 }}>{s}</li>
    ))}
  </ul>
)}
```

- [ ] **Step 4: typecheck / lint / build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: tutto verde.

- [ ] **Step 5: Verifica manuale**

Run: `npm run dev`. Apri `/host`, crea/avvia una partita con 3 telefoni (o usa "Gioca anche tu" + 2 telefoni), vota in modo da avere difensori su entrambi i lati. In DEFENSE:
- Il telefono del difensore di turno mostra «Spunti per te:» con la lista del SUO lato.
- La TV mostra gli stessi spunti accanto a chi parla.
- Gli altri telefoni NON mostrano spunti.
Avanzando il turno, gli spunti cambiano lato.

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/events.ts client/src/player/PlayerApp.tsx client/src/host/HostApp.tsx
git commit -m "feat(spunti): show per-side spunti to the defender and on the TV"
```

---

## Self-Review

- **Spec coverage:** spunti per lato nei dati (Task 1) ✓, visibili solo al difensore di quel lato + TV (Task 2/3) ✓, dentro `DefenseState`/`game:state` senza nuovi eventi (Task 2) ✓.
- **Placeholder scan:** Step 4 di Task 1 è autoria di contenuto (dati), vincolata dal test dello Step 1 — non è un placeholder di codice.
- **Type consistency:** `spunti: string[] | null` identico in `rooms.ts` (Task 2) e `events.ts` (Task 3); fixture aggiornate (Task 1 Step 5) prima dei test che le usano (Task 2).
