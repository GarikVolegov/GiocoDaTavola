# Fase 1 — Robustezza quick-win — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Chiudere tre gap di robustezza: nickname senza cap, nessun rate-limit su create/join, nessun ErrorBoundary client.

**Architecture:** Due interventi pure-logic lato server (TDD con env node esistente) + un modulo limiter riusabile cablato in `index.ts`; un ErrorBoundary React testato con un'infrastruttura jsdom minima (prerequisito anche della Fase 3, anticipato qui perché è il primo codice client che tocchiamo).

**Tech Stack:** TypeScript, vitest, React 18, @testing-library/react, jsdom.

## Global Constraints

- Server CJS / client ESM separati.
- No `any` (lint error). Vars inutilizzate con prefisso `_`.
- I voti/segreti non cambiano: nessun nuovo dato individuale broadcastato.
- Gate verdi (typecheck/lint/test/build) a fine fase.

---

### Task 1: Cap del nickname

**Files:**
- Modify: `server/src/game/rooms.ts` (costanti ~riga 55; `join()` ~riga 2118)
- Test: `server/src/game/__tests__/rooms.test.ts` (accanto al test nickname ~riga 142)

**Interfaces:**
- Produces: `export const NICKNAME_MAX = 24;` — usato dal client in Fase 4 (cap dell'input) e dai test.

- [ ] **Step 1: Test che fallisce** — aggiungere in `rooms.test.ts` accanto al test "trims the nickname":

```ts
import { /* …esistenti… */ NICKNAME_MAX } from '../rooms';

it('caps an over-long nickname to NICKNAME_MAX chars', () => {
  const store = new RoomStore();
  const { code } = store.create();
  const res = store.join(code, 'sock-1', 'x'.repeat(100));
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.player.nickname.length).toBe(NICKNAME_MAX);
});
```

- [ ] **Step 2: Verificare il fallimento**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "caps an over-long"`
Expected: FAIL (`NICKNAME_MAX` non esportato / nickname length 100).

- [ ] **Step 3: Implementare** — in `rooms.ts`, dopo `export const MAX_PLAYERS = 8;`:

```ts
/** Max nickname length (truncated, not rejected, for a forgiving UX). */
export const NICKNAME_MAX = 24;
```

e in `join()` cambiare la riga `const name = nickname.trim();` in:

```ts
const name = nickname.trim().slice(0, NICKNAME_MAX);
```

- [ ] **Step 4: Verificare il passaggio**

Run: `npx vitest run server/src/game/__tests__/rooms.test.ts -t "caps an over-long"`
Expected: PASS. Poi l'intera suite verde: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add server/src/game/rooms.ts server/src/game/__tests__/rooms.test.ts
git commit -m "feat(rooms): cap nickname a NICKNAME_MAX (24) per evitare payload abnormi"
```

---

### Task 2: Rate-limiter create/join

**Files:**
- Create: `server/src/rateLimit.ts`
- Test: `server/src/__tests__/rateLimit.test.ts`
- Modify: `server/src/index.ts` (handler `player:createRoom` ~riga 424, `player:join` ~riga 522)

**Interfaces:**
- Produces: `createRateLimiter(max: number, windowMs: number): { allow(key: string, now?: number): boolean }`

- [ ] **Step 1: Test che fallisce** — `server/src/__tests__/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../rateLimit';

describe('createRateLimiter', () => {
  it('allows up to max within the window then blocks', () => {
    const rl = createRateLimiter(3, 1000);
    expect(rl.allow('k', 0)).toBe(true);
    expect(rl.allow('k', 100)).toBe(true);
    expect(rl.allow('k', 200)).toBe(true);
    expect(rl.allow('k', 300)).toBe(false);
  });
  it('allows again after the window slides past old hits', () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow('k', 0)).toBe(true);
    expect(rl.allow('k', 500)).toBe(false);
    expect(rl.allow('k', 1001)).toBe(true);
  });
  it('keeps keys independent', () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Verificare il fallimento**

Run: `npx vitest run server/src/__tests__/rateLimit.test.ts`
Expected: FAIL (`createRateLimiter` non esiste).

- [ ] **Step 3: Implementare** — `server/src/rateLimit.ts`:

```ts
// Fixed-window per-key rate limiter (sliding by pruning hits older than the
// window). Pure + clock-injectable for deterministic tests. Used to throttle
// room create/join so one socket can't spam the room space.
export interface RateLimiter {
  allow(key: string, now?: number): boolean;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (kept.length >= max) {
        hits.set(key, kept);
        return false;
      }
      kept.push(now);
      hits.set(key, kept);
      return true;
    },
  };
}
```

- [ ] **Step 4: Verificare il passaggio**

Run: `npx vitest run server/src/__tests__/rateLimit.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Cablare in `index.ts`** — dopo `const rooms = new RoomStore();` aggiungere:

```ts
import { createRateLimiter } from './rateLimit';
// Throttle room create/join per socket: at most 10 attempts / 10s.
const joinLimiter = createRateLimiter(10, 10_000);
```

In `player:createRoom`, come PRIMA riga del handler:

```ts
if (!joinLimiter.allow(socket.id)) {
  socket.emit('player:joinError', { error: 'RATE_LIMITED' });
  return;
}
```

In `player:join`, come PRIMA riga del handler:

```ts
if (!joinLimiter.allow(socket.id)) {
  socket.emit('player:joinError', { error: 'RATE_LIMITED' });
  return;
}
```

- [ ] **Step 6: Verificare i gate** — `npm run typecheck && npm test`. Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add server/src/rateLimit.ts server/src/__tests__/rateLimit.test.ts server/src/index.ts
git commit -m "feat(server): rate-limit create/join per socket (10/10s)"
```

---

### Task 3: ErrorBoundary client + infra di test jsdom

**Files:**
- Modify: `client/package.json` (devDeps), `vitest.config.ts`
- Create: `client/vitest.setup.ts`, `client/src/shared/ErrorBoundary.tsx`, `client/src/shared/ErrorBoundary.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: `<ErrorBoundary>` componente che cattura errori di rendering dei figli e mostra un fallback.

- [ ] **Step 1: Installare le devDeps client**

```bash
npm i -D -w client @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Setup di test** — `client/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom';
```

In `vitest.config.ts` aggiungere il setup file (l'env jsdom è scelto per-file dal docblock):

```ts
test: {
  include: ['server/**/*.{test,spec}.ts', 'client/src/**/*.{test,spec}.{ts,tsx}'],
  passWithNoTests: true,
  environment: 'node',
  setupFiles: ['client/vitest.setup.ts'],
},
```

- [ ] **Step 3: Test che fallisce** — `client/src/shared/ErrorBoundary.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when they do not throw', () => {
    render(<ErrorBoundary><span>ciao</span></ErrorBoundary>);
    expect(screen.getByText('ciao')).toBeInTheDocument();
  });

  it('shows a fallback when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/qualcosa è andato storto/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 4: Verificare il fallimento**

Run: `npx vitest run client/src/shared/ErrorBoundary.test.tsx`
Expected: FAIL (`ErrorBoundary` non esiste).

- [ ] **Step 5: Implementare** — `client/src/shared/ErrorBoundary.tsx`:

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

// Catches render-time exceptions in any view so a single bug doesn't white-screen
// a phone mid-party. Shows a recover-by-reload fallback.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui' }}>
          <p>Qualcosa è andato storto.</p>
          <button type="button" onClick={() => window.location.reload()}>Ricarica</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 6: Verificare il passaggio**

Run: `npx vitest run client/src/shared/ErrorBoundary.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 7: Cablare in `App.tsx`** — avvolgere `<BrowserRouter>…</BrowserRouter>` con `<ErrorBoundary>`:

```tsx
import ErrorBoundary from './shared/ErrorBoundary';
// …
return (
  <ErrorBoundary>
    <BrowserRouter>
      {/* …Routes invariati… */}
    </BrowserRouter>
  </ErrorBoundary>
);
```

- [ ] **Step 8: Verificare i gate** — `npm run typecheck && npm test && npm run build`. Expected: verde, build con i chunk attuali.

- [ ] **Step 9: Commit**

```bash
git add client/package.json package-lock.json vitest.config.ts client/vitest.setup.ts client/src/shared/ErrorBoundary.tsx client/src/shared/ErrorBoundary.test.tsx client/src/App.tsx docs/superpowers/plans/2026-06-22-fase1-robustezza.md
git commit -m "feat(client): ErrorBoundary con fallback ricarica + infra test jsdom"
```

- [ ] **Step 10: Push**

```bash
git push
```

---

## Self-Review

- **Spec coverage:** cap nickname ✅, rate-limit create/join ✅, ErrorBoundary ✅. L'infra jsdom (Fase 3 nello spec) è anticipata qui perché prerequisito del test ErrorBoundary — annotato.
- **Placeholder scan:** nessun TBD; ogni step ha codice/comando concreto. ✅
- **Type consistency:** `createRateLimiter(max, windowMs)` e `NICKNAME_MAX` usati coerentemente tra task e test. ✅
