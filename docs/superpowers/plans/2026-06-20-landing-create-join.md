# Landing page Crea / Partecipa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire l'ingresso su `/` (oggi form di join nudo) con una landing che introduce il gioco e instrada verso "Crea una partita" (`/host`) o "Partecipa" (`/join`).

**Architecture:** Intervento solo-client. Si introduce `react-router-dom` con tre route (`/` landing, `/host`, `/join`); un nuovo componente presentazionale `Landing` usa `useNavigate`. L'URL del QR passa a `/join?room=CODE` così il deep-link salta la landing. Nessuna modifica al server o agli eventi socket.

**Tech Stack:** React 18 + Vite (TS ESM), `react-router-dom` ^6, design system interno (`Stage`, `Button`, token CSS).

**Spec di riferimento:** `docs/superpowers/specs/2026-06-20-landing-create-join-design.md`

## Global Constraints

- Quality gate VERDE da repo root prima di ogni commit: `npm run typecheck && npm run lint && npm test && npm run build`.
- Nessun nuovo evento socket; il server NON si tocca. `npm test` (test server) deve restare verde, intoccato.
- Niente test runner client in questo progetto: la verifica del client è typecheck/lint/build + check manuale. NON aggiungere un framework di test client.
- Niente `any` (errore di lint). Prefissa con `_` variabili/argomenti intenzionalmente inutilizzati.
- Viste e nuovi componenti: comporre i componenti del design system (`Stage`, `Button`) e riferire colori/spazi via `var(--token)`. Niente hex hardcoded né re-inline di stili di bottone. Stili inline one-off di puro layout sono ok solo se riferiscono token.
- `react-router-dom` versione `^6`.
- Commit con PATH ESPLICITI (un loop Ralph parallelo gira sullo stesso tree e usa `git add -A`). MAI `git add -A`. Non mettere in stage `.claude/`.
- Nessun browser tooling in questo ambiente: i check visivi/browser vanno eseguiti dall'utente; se non eseguibili qui, marcali come "pending (verifica visiva utente)".

---

### Task 1: Componente `Landing` + dipendenza router

**Files:**
- Create: `client/src/landing/Landing.tsx`
- Modify: `client/package.json` (+ `package-lock.json` di root) tramite `npm install`

**Interfaces:**
- Consumes: `Stage`, `Button` da `client/src/shared/ui` (barrel `index.ts`); `useNavigate` da `react-router-dom`.
- Produces: `export default function Landing(): JSX.Element` — componente presentazionale senza props, montato in Task 2 sulla route `/`. Naviga a `/host` (Crea) e `/join` (Partecipa).

- [ ] **Step 1: Installare `react-router-dom`**

Run (da repo root):
```bash
npm install react-router-dom@^6 --workspace client
```
Atteso: `react-router-dom` compare in `client/package.json` → `dependencies`; `package-lock.json` aggiornato. (react-router-dom porta i propri type: nessun `@types/...` separato.)

- [ ] **Step 2: Creare il componente `Landing`**

Create `client/src/landing/Landing.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { Stage, Button } from '../shared/ui';

// "Come si gioca" mostrato come introduzione leggera sulla landing.
const STEPS = ['Vota un dilemma', 'Ascolta le difese', 'Cambia idea (o no!)'];

// Schermata d'ingresso su `/`: introduce il gioco e instrada verso lo schermo
// condiviso (`/host`, "Crea una partita") o il telefono (`/join`, "Partecipa").
export default function Landing() {
  const navigate = useNavigate();
  return (
    <Stage variant="player">
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', margin: 0 }}>
        Dibattiti tra amici
      </h1>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-md)',
          margin: 0,
          maxWidth: '28rem',
        }}
      >
        Il party game dove voti, difendi e cambi idea… se ti convincono. 🎭
      </p>

      <ol
        aria-label="Come si gioca"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          color: 'var(--text-muted)',
        }}
      >
        {STEPS.map((step, i) => (
          <li key={step} style={{ fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{i + 1}</span> · {step}
          </li>
        ))}
      </ol>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          width: 'min(90vw, 22rem)',
        }}
      >
        <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => navigate('/host')}>
          Crea una partita
        </Button>
        <Button variant="ghost" size="lg" style={{ width: '100%' }} onClick={() => navigate('/join')}>
          Partecipa
        </Button>
      </div>

      <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-xs)', margin: 0 }}>
        3–8 giocatori · dal vivo
      </p>
    </Stage>
  );
}
```

- [ ] **Step 3: Verificare il gate qualità**

Run (da repo root):
```bash
npm run typecheck && npm run lint && npm run build
```
Atteso: tutti e tre PASS. (Il componente compila anche se non ancora montato; `useNavigate` non viene invocato a build-time.) `npm test` non necessario qui — nessun file server toccato.

- [ ] **Step 4: Commit**

```bash
git add client/src/landing/Landing.tsx client/package.json package-lock.json
git commit -m "feat: landing component (Crea/Partecipa) con react-router-dom

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Routing, URL del QR e intestazione join

**Files:**
- Modify: `client/src/App.tsx` (riscrittura completa: da split-su-pathname a router)
- Modify: `client/src/host/HostApp.tsx:83` (`joinUrl` → `/join?room=CODE`)
- Modify: `client/src/player/PlayerApp.tsx:297-298` (alleggerimento intestazione iniziale)

**Interfaces:**
- Consumes: `Landing` (default export) da Task 1; `HostApp`, `PlayerApp` (default export) esistenti.
- Produces: route attive `/` → `Landing`, `/host` → `HostApp`, `/join` → `PlayerApp`. Deep-link `/join?room=CODE` precompila il codice via `initialCode()` esistente (invariata).

- [ ] **Step 1: Riscrivere `App.tsx` con il router**

Replace l'intero contenuto di `client/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './landing/Landing';
import HostApp from './host/HostApp';
import PlayerApp from './player/PlayerApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<HostApp />} />
        <Route path="/join" element={<PlayerApp />} />
      </Routes>
    </BrowserRouter>
  );
}
```
(Rimuove `currentView()` e `type View`: non più usati.)

- [ ] **Step 2: Aggiornare l'URL del QR in `HostApp`**

In `client/src/host/HostApp.tsx`, alla riga 83, sostituire:
```tsx
  const joinUrl = code ? `${window.location.origin}/?room=${code}` : '';
```
con:
```tsx
  const joinUrl = code ? `${window.location.origin}/join?room=${code}` : '';
```

- [ ] **Step 3: Alleggerire l'intestazione iniziale di `PlayerApp`**

In `client/src/player/PlayerApp.tsx`, nel `return` finale (intestazione sopra il form), sostituire:
```tsx
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Dibattiti tra amici</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>Entra nella stanza dal tuo telefono.</p>
```
con:
```tsx
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Entra nella partita</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>Inserisci il codice e il tuo nome.</p>
```

- [ ] **Step 4: Verificare il gate qualità completo**

Run (da repo root):
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Atteso: tutti e quattro PASS (server test inclusi e invariati).

- [ ] **Step 5: Verifica manuale (browser)**

Run (da repo root): `npm run dev`, poi apri `http://localhost:5173/`. Controlla:
- `/` mostra titolo + tagline + 3 step + "Crea una partita" / "Partecipa".
- "Crea una partita" → `/host` con codice + QR (stanza creata).
- Back del browser → landing; "Partecipa" → `/join` con il form (codice vuoto).
- Apri `http://localhost:5173/join?room=ABCD` (usa il codice mostrato dall'host): il codice è precompilato e la landing è saltata.
- Refresh su `/host` e su `/join`: la route si rimonta correttamente (Vite historyApiFallback).

Se l'ambiente non ha browser tooling, marca questo step come **pending (verifica visiva utente)** e procedi.

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/host/HostApp.tsx client/src/player/PlayerApp.tsx
git commit -m "feat: routing landing -> /host | /join; QR punta a /join?room=CODE

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Landing una-schermata con intro + Crea/Partecipa → Task 1 (componente) + Task 2 Step 1 (route `/`). ✓
- "Crea" = schermo condiviso (`/host`) → Task 1 `navigate('/host')` + route. ✓
- Routing con `react-router-dom` → Task 1 Step 1, Task 2 Step 1. ✓
- QR → `/join?room=CODE` → Task 2 Step 2. ✓
- `PlayerApp` su `/join`, intro alleggerita, `initialCode()` invariata → Task 2 Step 1 + Step 3. ✓
- Casi limite (deep-link salta landing, refresh regge) → Task 2 Step 5. ✓
- Solo-client, niente DB, niente nuovi eventi socket → Global Constraints + nessun file server nei task. ✓
- Nota produzione/Postgres = deferita → fuori dal piano per design (registrata nella spec). ✓

**Placeholder scan:** nessun TBD/TODO; ogni step ha codice o comando concreto. ✓

**Type consistency:** `Landing` default export consumato da `App.tsx`; `Button`/`Stage` props (`variant`, `size`, `style` via passthrough) coerenti con le firme in `client/src/shared/ui`; `joinUrl` e `initialCode()` allineati su `/join?room=`. ✓
