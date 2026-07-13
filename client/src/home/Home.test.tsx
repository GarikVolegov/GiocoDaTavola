// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// With the DB down behind the API, /casa must fail fast and honestly: a clear
// outage line, NOT the first-timer welcome card (misleading for a returning
// user whose data simply didn't load) and NOT an endless skeleton.

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'tok' }),
  useUser: () => ({ user: null }),
}));

import Home from './Home';

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

const OUTAGE = /momentaneamente non disponibile/i;

describe('Home (/casa) con il backend degradato', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('su 503 mostra il messaggio di disservizio e NON la card "Si comincia!"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'db-unavailable' }), { status: 503 })),
    );
    renderHome();
    expect(await screen.findByText(OUTAGE)).toBeInTheDocument();
    expect(screen.queryByText('Si comincia!')).toBeNull();
  });

  it('resta usabile durante il disservizio: Crea partita e Partecipa presenti', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'db-unavailable' }), { status: 503 })),
    );
    renderHome();
    await screen.findByText(OUTAGE);
    expect(screen.getByText('Crea partita')).toBeInTheDocument();
    expect(screen.getByText('Partecipa')).toBeInTheDocument();
  });

  it('su timeout (AbortError) stesso messaggio, niente skeleton infinito', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );
    const { container } = renderHome();
    expect(await screen.findByText(OUTAGE)).toBeInTheDocument();
    // Lo skeleton è un <div aria-hidden> (il Logo è un <svg aria-hidden>, che resta).
    expect(container.querySelector('div[aria-hidden="true"]')).toBeNull();
  });
});
