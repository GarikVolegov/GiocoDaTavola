# Inoltra link invito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the leader forward the room's join link (via the native share sheet or clipboard) from the lobby screen shown right after creating a game.

**Architecture:** One new presentational component, `ShareInviteButton`, added to `client/src/shared/ui/` alongside the existing `JoinQr`/`RoomCodeChip`. It builds the same `/join?room=CODE` URL `JoinQr` already builds, tries `navigator.share`, falls back to `navigator.clipboard.writeText`, and falls back again to a plain selectable link. Wired into the existing lobby view in `PlayerApp.tsx` — no server changes, no URL scheme changes.

**Tech Stack:** React 18 + TypeScript (client, ESM), Vitest + @testing-library/react for tests, existing `Button` component from `client/src/shared/ui/Button.tsx`.

## Global Constraints

- Client is TypeScript ESM; avoid `any` (lint error); prefix intentionally-unused args with `_`.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (run from repo root) must all stay green before considering any task done.
- Shared join URL format (do not change): `${window.location.origin}/join?room=${code}` (see `client/src/shared/ui/JoinQr.tsx:31`).
- Share text (from spec, exact copy): `'Unisciti alla mia partita su Schierati!'`.
- Feedback copy (from spec, exact copy): `'✓ Link copiato'`.
- Feature is scoped to the post-creation lobby view only (`PlayerApp.tsx`, `joinedCode` branch) — no changes to `/host` or `RoomCodeChip` in this plan.
- Commit with targeted `git add <path>` (never `-A`/`.`); push the branch when done (existing repo convention — see recent commits on `ralph/skeleton-dilemma`).

---

### Task 1: `ShareInviteButton` component (share → clipboard → raw-link fallback chain)

**Files:**
- Create: `client/src/shared/ui/ShareInviteButton.tsx`
- Create: `client/src/shared/ui/ShareInviteButton.module.css`
- Test: `client/src/shared/ui/ShareInviteButton.test.tsx`

**Interfaces:**
- Consumes: `Button` from `./Button` (props: `variant?: 'primary' | 'ghost'`, plus all native `<button>` props via `ButtonHTMLAttributes`).
- Produces: `ShareInviteButton({ code }: { code: string })` — a React component. `code` is the same 4-letter room code prop `JoinQr` takes (`client/src/shared/ui/JoinQr.tsx:20-24`). No other exports.

- [ ] **Step 1: Write the failing tests**

Create `client/src/shared/ui/ShareInviteButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ShareInviteButton } from './ShareInviteButton';

describe('ShareInviteButton', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // @ts-expect-error - test-only cleanup of a property we defined per-test
    delete navigator.share;
    // @ts-expect-error - test-only cleanup of a property we defined per-test
    delete navigator.clipboard;
  });

  it('calls navigator.share with the room join link when available', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Schierati',
      text: 'Unisciti alla mia partita su Schierati!',
      url: `${window.location.origin}/join?room=ABCD`,
    });
  });

  it('falls back to clipboard and shows a transient confirmation when share is unavailable', async () => {
    vi.useFakeTimers();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(writeTextSpy).toHaveBeenCalledTimes(1));

    expect(writeTextSpy).toHaveBeenCalledWith(
      `Unisciti alla mia partita su Schierati!\n${window.location.origin}/join?room=ABCD`,
    );
    expect(screen.getByText('✓ Link copiato')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.queryByText('✓ Link copiato')).not.toBeInTheDocument();
  });

  it('falls back to a plain selectable link when neither share nor clipboard exist', async () => {
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));

    expect(
      await screen.findByText(`${window.location.origin}/join?room=ABCD`),
    ).toBeInTheDocument();
  });

  it('does nothing when the user dismisses the native share sheet', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const shareSpy = vi.fn().mockRejectedValue(abortError);
    const writeTextSpy = vi.fn();
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });
    render(<ShareInviteButton code="ABCD" />);

    fireEvent.click(screen.getByRole('button', { name: /inoltra invito/i }));
    await vi.waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    expect(writeTextSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('✓ Link copiato')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from repo root): `npm test -- ShareInviteButton`
Expected: FAIL — `Cannot find module './ShareInviteButton'` (component doesn't exist yet). Note: the root `npm test` is `vitest run` over both `server/` and `client/` per `vitest.config.ts`; passing a name filter like `ShareInviteButton` scopes it to matching test files.

- [ ] **Step 3: Write the CSS module**

Create `client/src/shared/ui/ShareInviteButton.module.css`:

```css
.wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.feedback {
  margin: 0;
  font-weight: 700;
  font-size: 0.85rem;
  opacity: 0.85;
}
.rawLink {
  margin: 0;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  user-select: text;
  word-break: break-all;
  text-align: center;
  opacity: 0.8;
}
```

- [ ] **Step 4: Write the component**

Create `client/src/shared/ui/ShareInviteButton.tsx`:

```tsx
import { useState } from 'react';
import { Button } from './Button';
import styles from './ShareInviteButton.module.css';

interface ShareInviteButtonProps {
  /** room code to build the join link from — same prop JoinQr takes */
  code: string;
}

const SHARE_TEXT = 'Unisciti alla mia partita su Schierati!';
const COPIED_FEEDBACK_MS = 2000;

function buildJoinUrl(code: string): string {
  return `${window.location.origin}/join?room=${code}`;
}

export function ShareInviteButton({ code }: ShareInviteButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showRawLink, setShowRawLink] = useState(false);
  const url = buildJoinUrl(code);

  async function copyToClipboard() {
    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return;
      } catch {
        // permission denied or unsupported context — fall through
      }
    }
    setShowRawLink(true);
  }

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Schierati', text: SHARE_TEXT, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await copyToClipboard();
  }

  return (
    <div className={styles.wrap}>
      <Button type="button" variant="ghost" onClick={handleClick}>
        Inoltra invito
      </Button>
      {copied && <p className={styles.feedback}>✓ Link copiato</p>}
      {showRawLink && <p className={styles.rawLink}>{url}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- ShareInviteButton`
Expected: PASS (4 tests).

- [ ] **Step 6: Export it from the shared/ui barrel**

`client/src/shared/ui/index.ts` re-exports every component in this directory (e.g. `export { JoinQr } from './JoinQr';`). Add a matching line:

```ts
export { ShareInviteButton } from './ShareInviteButton';
```

Place it near the `JoinQr`/`RoomCodeChip` export lines.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/shared/ui/ShareInviteButton.tsx client/src/shared/ui/ShareInviteButton.module.css client/src/shared/ui/ShareInviteButton.test.tsx client/src/shared/ui/index.ts
git commit -m "feat(lobby): add ShareInviteButton (share/clipboard/raw-link fallback chain)"
```

---

### Task 2: Wire `ShareInviteButton` into the post-creation lobby view

**Files:**
- Modify: `client/src/player/PlayerApp.tsx:972-992` (the `joinedCode` lobby view)
- Test: `client/src/player/PlayerApp.test.tsx` (add one test near the existing lobby-view tests)

**Interfaces:**
- Consumes: `ShareInviteButton` from the `../shared/ui` barrel (`client/src/shared/ui/index.ts`, exported in Task 1 Step 6), props `{ code: string }`. `PlayerApp.tsx:57` already imports other components from this same barrel: `import { Card, JoinQr, Button, Field, TextInput, Alert } from '../shared/ui';` — add `ShareInviteButton` to that same import list, don't create a new import line.
- Produces: nothing new — this task only changes rendered markup.

- [ ] **Step 1: Write the failing test**

Add to `client/src/player/PlayerApp.test.tsx`, in the `describe` block that covers the lobby/`joinedCode` view (search the file for the existing test that asserts on `Sei nella stanza` or `JoinQr` rendering to place this test nearby):

```tsx
it('shows a share-invite button in the post-creation lobby', () => {
  render(<PlayerApp />);
  act(() => {
    serverEmit('player:joined', {
      code: 'ABCD',
      token: 'tok',
      player: { id: 'p1', nickname: 'Alice' },
    });
  });
  expect(screen.getByRole('button', { name: /inoltra invito/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- PlayerApp -t "share-invite button"`
Expected: FAIL — no element with role `button` named `/inoltra invito/i`.

- [ ] **Step 3: Add the import and render the button**

In `client/src/player/PlayerApp.tsx`, change line 57 from:

```tsx
import { Card, JoinQr, Button, Field, TextInput, Alert } from '../shared/ui';
```

to:

```tsx
import { Card, JoinQr, Button, Field, TextInput, Alert, ShareInviteButton } from '../shared/ui';
```

Then modify the lobby view block (currently `client/src/player/PlayerApp.tsx:987-992`):

```tsx
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
          <JoinQr code={joinedCode} />
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
            Fai inquadrare il QR per entrare — oppure detta il codice
          </p>
          <ShareInviteButton code={joinedCode} />
        </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- PlayerApp -t "share-invite button"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (no regressions in other `PlayerApp.test.tsx` lobby-view assertions).

- [ ] **Step 6: Commit**

```bash
git add client/src/player/PlayerApp.tsx client/src/player/PlayerApp.test.tsx
git commit -m "feat(lobby): wire ShareInviteButton into the post-creation lobby view"
```

---

### Task 3: Full verification gate and push

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full project gate from repo root**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all four succeed with zero errors/failures.

- [ ] **Step 2: Manually sanity-check the feature (see `verify`/`run` skills if a dev server is needed)**

Run: `npm run dev`, open the client, create a room, confirm the "Inoltra invito" button appears under the QR code in the lobby and that clicking it either opens a native share sheet (if the test browser supports it) or falls back sensibly. Stop the dev server after checking.

- [ ] **Step 3: Push the branch**

Run: `git push`
Expected: pushes the two feature commits from Tasks 1–2 to `origin/ralph/skeleton-dilemma`. If rejected (remote advanced), stop and report — do not force-push.

---

## Self-Review Notes

- **Spec coverage:** share→clipboard→raw-link fallback chain (Task 1, all 4 tests), integration point in the lobby view only (Task 2), exact copy strings (`SHARE_TEXT`, `'✓ Link copiato'`) match the spec verbatim, join URL format unchanged (`buildJoinUrl` mirrors `JoinQr.tsx:31`). No `/host`/`RoomCodeChip` changes, matching the spec's explicit out-of-scope note.
- **Type consistency:** `ShareInviteButtonProps.code: string` matches `JoinQr`'s `code: string` prop and the `joinedCode` variable's type in `PlayerApp.tsx`. `Button` is consumed with only props it already supports (`type`, `variant`, `onClick`, children) — no new props added to `Button`.
- **Placeholder scan:** no TBD/TODO; every step has full code and exact commands.
