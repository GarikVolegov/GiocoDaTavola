# Podio dei vincitori — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni partita che termina a FINAL_AWARDS (gruppo: classic/percorso/storia) mostra un podio 🥇🥈🥉 basato sui "Punti Serata", su /host e sul telefono (col piazzamento personale), in aggiunta a premi e consigli.

**Architecture:** Nuovo modulo puro `server/src/game/podium.ts` (gemello di `awards.ts`) che calcola punti e classifica dalle `PlayerStats` esistenti; `RoomStore.publicPodium` gated a FINAL_AWARDS (specchio di `publicAwards`); campo `podium` nel payload `game:state`; componente condiviso `PodiumPanel` in `PublicViews.tsx` usato da HostApp e StatusView.

**Tech Stack:** TypeScript (server CJS, client ESM), vitest, React, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-10-podio-vincitori-design.md`

## Global Constraints

- Voti segreti: mai voti individuali a host/altri — il podio espone solo totali di punti.
- Niente `any` (errore di lint); variabili volutamente inutilizzate prefissate `_`.
- Gate prima di ogni commit: `npm run typecheck && npm run lint && npm test && npm run build` tutti verdi (da root).
- Commit con pathspec espliciti (mai `git add -A`/`.`), push del branch a fine lavoro.
- Formula punti (dalla spec): +1 per round giocato; +2 per voto netto di `persuasion` (mai sotto 0); +2 per `oratorVotes`; +1 per `correctPredictions`, `correctSwingBets`, `knowCorrect`, `authoredSwing`. Ranking "competition" (1,1,3), tie stabile per ordine di join; esclusi i giocatori con `rounds === 0`.

---

### Task 1: modulo puro `podium.ts` (punti + classifica)

**Files:**
- Create: `server/src/game/podium.ts`
- Test: `server/src/game/__tests__/podium.test.ts`

**Interfaces:**
- Consumes: `PlayerStats` da `./awards`, `Room`/`Player` da `./rooms`.
- Produces: `podiumPoints(s: PlayerStats): number`; `computePodium(room: Room): PodiumEntry[]` con `export interface PodiumEntry { player: Player; points: number; rank: number }` (lista COMPLETA ordinata, non solo il podio).

- [ ] **Step 1: test fallente**

```ts
// server/src/game/__tests__/podium.test.ts
import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { podiumPoints, computePodium } from '../podium';
import type { PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = () => new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, () => 0);

// Base stats record with the five required fields (mirrors devilAdvocate.test.ts).
function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return { rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0, persuasion: 0, defendedCount: 0, ...over };
}

describe('podiumPoints — la formula dei Punti Serata', () => {
  it('dà +1 a round giocato', () => {
    expect(podiumPoints(baseStats({ rounds: 3 }))).toBe(3);
  });
  it('dà +2 a voto netto spostato dalle difese', () => {
    expect(podiumPoints(baseStats({ rounds: 1, persuasion: 2 }))).toBe(5);
  });
  it('non manda mai in negativo: persuasion negativa vale 0', () => {
    expect(podiumPoints(baseStats({ rounds: 2, persuasion: -3 }))).toBe(2);
  });
  it('dà +2 a voto "oratore più convincente"', () => {
    expect(podiumPoints(baseStats({ oratorVotes: 2 }))).toBe(5);
  });
  it('dà +1 a pronostico/scommessa/conoscenza/idea-cambiata', () => {
    expect(
      podiumPoints(baseStats({ correctPredictions: 1, correctSwingBets: 1, knowCorrect: 1, authoredSwing: 1 })),
    ).toBe(5);
  });
});

describe('computePodium — la classifica finale', () => {
  function roomWithStats(statsById: Record<string, PlayerStats>) {
    const store = makeStore();
    const { code } = store.create();
    Object.keys(statsById).forEach((id, i) => store.join(code, id, `P${i}`));
    const room = store.get(code)!;
    for (const [id, s] of Object.entries(statsById)) room.stats.set(id, s);
    return room;
  }

  it('ordina per punti decrescenti', () => {
    const room = roomWithStats({
      a: baseStats({ rounds: 1 }),
      b: baseStats({ rounds: 3, persuasion: 2 }),
      c: baseStats({ rounds: 2 }),
    });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['b', 'c', 'a']);
  });

  it('assegna i rank ex aequo in stile competition (1, 1, 3)', () => {
    const room = roomWithStats({
      a: baseStats({ rounds: 2 }),
      b: baseStats({ rounds: 2 }),
      c: baseStats({ rounds: 1 }),
    });
    expect(computePodium(room).map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it('a pari punti mantiene l’ordine di join (tie stabile)', () => {
    const room = roomWithStats({ a: baseStats(), b: baseStats() });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['a', 'b']);
  });

  it('esclude chi non ha giocato nessun round', () => {
    const room = roomWithStats({ a: baseStats(), b: baseStats({ rounds: 0 }) });
    expect(computePodium(room).map((e) => e.player.id)).toEqual(['a']);
  });

  it('riporta punti e nickname', () => {
    const room = roomWithStats({ a: baseStats({ rounds: 2, oratorVotes: 1 }) });
    expect(computePodium(room)[0]).toEqual({ player: { id: 'a', nickname: 'P0' }, points: 4, rank: 1 });
  });
});
```

- [ ] **Step 2: verifica che fallisca** — Run: `npx vitest run src/game/__tests__/podium.test.ts` (cwd `server/`). Expected: FAIL "Cannot find module '../podium'".

- [ ] **Step 3: implementazione minima**

```ts
// server/src/game/podium.ts
// End-of-game podium: the transparent "Punti Serata" score and the full final
// ranking computed from the accumulated PlayerStats. Pure sibling of awards.ts;
// RoomStore gates the public version to FINAL_AWARDS (see publicPodium).

import type { PlayerStats } from './awards';
import type { Room, Player } from './rooms';

/** One row of the final ranking (rank 1..3 stand on the podium). */
export interface PodiumEntry {
  player: Player;
  points: number;
  rank: number;
}

/**
 * The "Punti Serata" formula. Only positive, only merit-based signals already
 * tracked in PlayerStats — never a new per-vote record. devilPersuasion is a
 * subset of persuasion (skipped: double count); reactions are spammable (skipped).
 */
export function podiumPoints(s: PlayerStats): number {
  return (
    s.rounds +
    2 * Math.max(0, s.persuasion) +
    2 * (s.oratorVotes ?? 0) +
    (s.correctPredictions ?? 0) +
    (s.correctSwingBets ?? 0) +
    (s.knowCorrect ?? 0) +
    (s.authoredSwing ?? 0)
  );
}

/**
 * The full final ranking, best first: everyone who played at least one round,
 * competition-ranked (ties share a rank: 1, 1, 3). Ties keep join order (the
 * stats map's insertion order — sort is stable). Ungated — RoomStore.publicPodium
 * applies the FINAL_AWARDS gate.
 */
export function computePodium(room: Room): PodiumEntry[] {
  const ranked: PodiumEntry[] = [];
  for (const [id, s] of room.stats.entries()) {
    if (s.rounds === 0) continue;
    const nickname = room.players.get(id)?.nickname ?? '';
    ranked.push({ player: { id, nickname }, points: podiumPoints(s), rank: 0 });
  }
  ranked.sort((a, b) => b.points - a.points);
  ranked.forEach((e, i) => {
    e.rank = i > 0 && e.points === ranked[i - 1].points ? ranked[i - 1].rank : i + 1;
  });
  return ranked;
}
```

- [ ] **Step 4: verifica verde** — Run: `npx vitest run src/game/__tests__/podium.test.ts` (cwd `server/`). Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add server/src/game/podium.ts server/src/game/__tests__/podium.test.ts
git commit -m "feat(podio): punti serata + classifica finale (modulo puro)"
```

### Task 2: gate FINAL_AWARDS + broadcast nel payload

**Files:**
- Modify: `server/src/game/rooms.ts` (import/re-export vicino alle righe 60-83; nuovo metodo accanto a `publicAwards`, ~riga 2295)
- Modify: `server/src/index.ts` (payload `gameStatePayload`, dopo `namedMoments` ~riga 242)
- Test: `server/src/game/__tests__/podium.test.ts` (nuovo describe)

**Interfaces:**
- Consumes: `computePodium`/`PodiumEntry` dal Task 1.
- Produces: `RoomStore.publicPodium(code: string): PodiumEntry[] | null`; campo `podium: PodiumEntry[] | null` nel payload `game:state`; re-export `export type { PodiumEntry } from './podium'` da rooms.ts.

- [ ] **Step 1: test fallente (gate)** — append a `podium.test.ts`:

```ts
describe('publicPodium — gate FINAL_AWARDS', () => {
  it('è null fuori da FINAL_AWARDS e popolato a FINAL_AWARDS', () => {
    const store = makeStore();
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ rounds: 2 }));
    expect(store.publicPodium(code)).toBeNull();
    let g = 0;
    while (room.phase !== 'FINAL_AWARDS' && g++ < 100) store.advancePhase(code);
    expect(room.phase).toBe('FINAL_AWARDS');
    expect(store.publicPodium(code)?.[0]?.player.id).toBe('sock-0');
  });
});
```

- [ ] **Step 2: verifica che fallisca** — Run: `npx vitest run src/game/__tests__/podium.test.ts` (cwd `server/`). Expected: FAIL "publicPodium is not a function".

- [ ] **Step 3: implementazione** — in `rooms.ts`, sotto gli import esistenti di awards/blindspots:

```ts
import { computePodium, type PodiumEntry } from './podium';
```

accanto agli altri re-export dei tipi (righe ~82-83):

```ts
export type { PodiumEntry } from './podium';
```

e accanto a `publicAwards` (~riga 2300):

```ts
  /**
   * The end-of-game podium (full "Punti Serata" ranking, best first), only at
   * FINAL_AWARDS (null otherwise) — mirrors publicAwards's gate.
   */
  publicPodium(code: string): PodiumEntry[] | null {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'FINAL_AWARDS') return null;
    return computePodium(room);
  }
```

In `index.ts`, nel payload dopo `namedMoments` (~riga 242):

```ts
    // The final "Punti Serata" podium/ranking, gated to FINAL_AWARDS (null
    // otherwise). Point totals only — never individual votes.
    podium: rooms.publicPodium(room.code),
```

- [ ] **Step 4: verifica verde** — Run: `npx vitest run src/game/__tests__/podium.test.ts` poi `npm test` e `npm run typecheck` da root. Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add server/src/game/rooms.ts server/src/index.ts server/src/game/__tests__/podium.test.ts
git commit -m "feat(podio): publicPodium gated a FINAL_AWARDS + campo podium nel game:state"
```

### Task 3: tipi client + `PodiumPanel` condiviso

**Files:**
- Modify: `client/src/shared/events.ts` (tipo dopo `Award` ~riga 580; campo dopo `namedMoments` ~riga 807)
- Modify: `client/src/shared/ui/PublicViews.tsx` (nuovo componente dopo `AwardsPanel`)
- Modify: `client/src/shared/ui/index.ts` (export)
- Test: `client/src/shared/ui/PublicViews.test.tsx` (nuovo)

**Interfaces:**
- Consumes: campo `podium` del payload (Task 2).
- Produces: `export interface PodiumEntry { player: PublicPlayer; points: number; rank: number }` in events.ts; `podium: PodiumEntry[] | null` su `GameStatePayload`; `export function PodiumPanel({ podium, meId }: { podium: PodiumEntry[]; meId?: string | null })`.

- [ ] **Step 1: test fallente**

```tsx
// client/src/shared/ui/PublicViews.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PodiumPanel } from './PublicViews';
import type { PodiumEntry } from '../events';

afterEach(cleanup);

const entry = (id: string, nickname: string, points: number, rank: number): PodiumEntry => ({
  player: { id, nickname },
  points,
  rank,
});

describe('PodiumPanel', () => {
  it('mostra i primi tre con medaglie e punti', () => {
    render(
      <PodiumPanel
        podium={[entry('a', 'Anna', 12, 1), entry('b', 'Bea', 9, 2), entry('c', 'Ciro', 7, 3)]}
      />,
    );
    expect(screen.getByText(/il podio della serata/i)).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText(/12 punti/i)).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('mette gli ex aequo sullo stesso gradino e salta il gradino successivo', () => {
    render(
      <PodiumPanel podium={[entry('a', 'Anna', 9, 1), entry('b', 'Bea', 9, 1), entry('c', 'Ciro', 5, 3)]} />,
    );
    expect(screen.getByText(/anna · bea/i)).toBeInTheDocument();
    expect(screen.queryByText('🥈')).toBeNull();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('elenca chi resta giù dal podio nella classifica completa', () => {
    render(
      <PodiumPanel
        podium={[entry('a', 'Anna', 12, 1), entry('b', 'Bea', 9, 2), entry('c', 'Ciro', 7, 3), entry('d', 'Dino', 3, 4)]}
      />,
    );
    expect(screen.getByText(/4°/)).toBeInTheDocument();
    expect(screen.getByText(/dino/i)).toBeInTheDocument();
  });

  it('evidenzia la propria riga con "(tu)" dato meId', () => {
    render(<PodiumPanel podium={[entry('a', 'Anna', 12, 1), entry('me', 'Gino', 9, 2)]} meId="me" />);
    expect(screen.getByText(/gino \(tu\)/i)).toBeInTheDocument();
  });

  it('non renderizza nulla senza classificati', () => {
    const { container } = render(<PodiumPanel podium={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: verifica che fallisca** — Run: `npx vitest run src/shared/ui/PublicViews.test.tsx` (cwd `client/`). Expected: FAIL (PodiumPanel non esportato).

- [ ] **Step 3: implementazione** — in `events.ts` dopo `Award` (~riga 580):

```ts
/** One row of the final "Punti Serata" ranking (rank 1..3 stand on the podium). */
export interface PodiumEntry {
  player: PublicPlayer;
  points: number;
  rank: number;
}
```

su `GameStatePayload` dopo `namedMoments` (~riga 807):

```ts
  /** The final "Punti Serata" podium/ranking, best first, only in FINAL_AWARDS; null otherwise. */
  podium: PodiumEntry[] | null;
```

in `PublicViews.tsx` (import `PodiumEntry` dal modulo events già importato lì; componente dopo `AwardsPanel`):

```tsx
/**
 * The end-of-game podium: the top-3 "Punti Serata" steps (2° | 1° | 3°, gold
 * center) + the compact full ranking below when more players ranked. Ex-aequo
 * players share a step. `meId` highlights the viewer's own row on phones.
 */
export function PodiumPanel({ podium, meId }: { podium: PodiumEntry[]; meId?: string | null }) {
  if (podium.length === 0) return null;
  const name = (e: PodiumEntry) => (e.player.id === meId ? `${e.player.nickname} (tu)` : e.player.nickname);
  const step = (rank: number) => podium.filter((e) => e.rank === rank);
  const steps = [
    { rank: 2, medal: '🥈', height: '4.5rem' },
    { rank: 1, medal: '🥇', height: '6.5rem' },
    { rank: 3, medal: '🥉', height: '3.2rem' },
  ];
  const offPodium = podium.filter((e) => e.rank > 3);
  return (
    <section aria-label="Il podio della serata" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%', alignItems: 'center' }}>
      <p style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 800, margin: 0 }}>🏆 Il podio della serata</p>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', justifyContent: 'center', width: 'min(92vw, 34rem)' }}>
        {steps.map(({ rank, medal, height }) => {
          const who = step(rank);
          if (who.length === 0) return <div key={rank} style={{ flex: 1 }} />;
          const totale = who[0].points;
          return (
            <div key={rank} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.8rem)' }}>{medal}</span>
              <span style={{ fontWeight: 800, textAlign: 'center', fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: rank === 1 ? 'var(--gold)' : undefined }}>
                {who.map(name).join(' · ')}
              </span>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{totale} {totale === 1 ? 'punto' : 'punti'}</span>
              <div
                style={{
                  width: '100%',
                  minHeight: height,
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  background: rank === 1 ? 'var(--gold-soft)' : 'var(--surface-2, rgba(255,255,255,0.08))',
                  border: '2px solid',
                  borderColor: rank === 1 ? 'var(--gold-line)' : 'var(--line, rgba(255,255,255,0.15))',
                  borderBottom: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  opacity: 0.9,
                }}
              >
                {rank}°
              </div>
            </div>
          );
        })}
      </div>
      {offPodium.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: 'min(92vw, 24rem)' }}>
          {offPodium.map((e) => (
            <p key={e.player.id} style={{ margin: 0, fontSize: '0.95rem', opacity: 0.85, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: e.player.id === meId ? 800 : 500 }}>{e.rank}° {name(e)}</span>
              <span>{e.points} {e.points === 1 ? 'punto' : 'punti'}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
```

in `ui/index.ts` (riga export di PublicViews):

```ts
export { DilemmaCard, SplitBar, ResultsPanel, AwardsPanel, NamedMomentsPanel, PodiumPanel } from './PublicViews';
```

Nota: se `PublicViews.tsx` non usa già `var(--surface-2)`/`var(--line)`, controlla `client/src/shared/ui/tokens.css` e usa i token reali del design system (fallback inline come sopra è accettabile solo se il token non esiste).

- [ ] **Step 4: verifica verde** — Run: `npx vitest run src/shared/ui/PublicViews.test.tsx` (cwd `client/`). Expected: PASS. Poi `npm run typecheck` da root.

- [ ] **Step 5: commit**

```bash
git add client/src/shared/events.ts client/src/shared/ui/PublicViews.tsx client/src/shared/ui/index.ts client/src/shared/ui/PublicViews.test.tsx
git commit -m "feat(podio): tipo PodiumEntry + PodiumPanel condiviso"
```

### Task 4: telefono — piazzamento personale a FINAL_AWARDS

**Files:**
- Modify: `client/src/player/views/StatusView.tsx` (sezione FINAL_AWARDS, prima di `{game?.namedMoments && …}` ~riga 372; aggiungi `PodiumPanel` all'import da `../../shared/ui`)
- Test: `client/src/player/PlayerApp.test.tsx` (nuovo test accanto a quello dei momenti, ~riga 540)

**Interfaces:**
- Consumes: `game.podium` (Task 2/3), `playerId` già prop di StatusView, `PodiumPanel` (Task 3).
- Produces: —

- [ ] **Step 1: test fallente** — in `PlayerApp.test.tsx`:

```tsx
  it('mostra il podio con il proprio piazzamento a FINAL_AWARDS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        podium: [
          { player: { id: 'p2', nickname: 'Bea' }, points: 12, rank: 1 },
          { player: { id: 'p1', nickname: 'Alice' }, points: 9, rank: 2 },
        ],
        awards: [],
        leaderId: null,
      });
    });
    expect(screen.getByText(/il podio della serata/i)).toBeInTheDocument();
    expect(screen.getByText(/il tuo posto: 2°/i)).toBeInTheDocument();
    expect(screen.getByText(/alice \(tu\)/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: verifica che fallisca** — Run: `npx vitest run src/player/PlayerApp.test.tsx -t "podio"` (cwd `client/`). Expected: FAIL.

- [ ] **Step 3: implementazione** — in `StatusView.tsx`, dentro il ramo FINAL_AWARDS prima della riga `{game?.namedMoments && <NamedMomentsPanel …>}`:

```tsx
          {game?.podium && game.podium.length > 0 && (
            <>
              {(() => {
                const me = game.podium.find((e) => e.player.id === playerId);
                return me ? (
                  <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    🏅 Il tuo posto: {me.rank}° · {me.points} {me.points === 1 ? 'punto' : 'punti'}
                  </p>
                ) : null;
              })()}
              <PodiumPanel podium={game.podium} meId={playerId} />
            </>
          )}
```

(aggiungi `PodiumPanel` all'import da `'../../shared/ui'`.)

- [ ] **Step 4: verifica verde** — Run: `npx vitest run src/player/PlayerApp.test.tsx` (cwd `client/`). Expected: PASS (tutti, non solo il nuovo).

- [ ] **Step 5: commit**

```bash
git add client/src/player/views/StatusView.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(podio): piazzamento personale + podio sul telefono a FINAL_AWARDS"
```

### Task 5: /host — podio sul tabellone

**Files:**
- Modify: `client/src/host/HostApp.tsx` (prima della riga `{phase === 'FINAL_AWARDS' && namedMoments && <NamedMomentsPanel …>}` ~riga 583; aggiungi `PodiumPanel` all'import degli UI condivisi)

**Interfaces:**
- Consumes: `game.podium` (Task 2/3), `PodiumPanel` (Task 3).
- Produces: —

- [ ] **Step 1: implementazione** (nessun test host esistente per i pannelli; la copertura è nel test del componente, Task 3):

```tsx
        {phase === 'FINAL_AWARDS' && game.podium && <PodiumPanel podium={game.podium} />}
```

inserita subito PRIMA di `NamedMomentsPanel` (ordine: verdetti Infiltrato/Squadre → podio → momenti → premi).

- [ ] **Step 2: verifica** — Run da root: `npm run typecheck && npm run lint && npm test && npm run build`. Expected: tutti verdi.

- [ ] **Step 3: commit**

```bash
git add client/src/host/HostApp.tsx
git commit -m "feat(podio): podio della serata sul tabellone /host"
```

### Task 6: chiusura

- [ ] **Step 1: gate completo da root** — Run: `npm run typecheck && npm run lint && npm test && npm run build`. Expected: verdi (≈718+ test prima di questo lavoro).
- [ ] **Step 2: self-review del diff** (`git diff main...HEAD` sui file toccati) — segretezza voti intatta (solo totali), niente `any`, copy in italiano coerente.
- [ ] **Step 3: push**

```bash
git push -u origin ralph/skeleton-dilemma
```
