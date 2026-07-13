// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

// "I miei premi" must never sit on "Carico…" forever: a 503 or a timeout from
// the awards endpoint surfaces as the error line.

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: true, getToken: async () => 'tok' }),
  Show: ({ when, children }: { when: string; children?: ReactNode }) =>
    when === 'signed-in' ? <>{children}</> : null,
  SignInButton: () => null,
}));

import Profile from './Profile';

describe('Profile (premi) con il backend degradato', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('su 503 mostra la riga di errore, non "Carico…" per sempre', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'db-unavailable' }), { status: 503 })),
    );
    render(<Profile />);
    expect(await screen.findByText('Impossibile caricare i premi.')).toBeInTheDocument();
    expect(screen.queryByText('Carico…')).toBeNull();
  });

  it('su timeout (AbortError) stessa riga di errore', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );
    render(<Profile />);
    expect(await screen.findByText('Impossibile caricare i premi.')).toBeInTheDocument();
  });
});
