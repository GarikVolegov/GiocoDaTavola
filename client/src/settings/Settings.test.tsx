// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// With the DB down the settings page must degrade cleanly: a failed load shows
// an error but leaves the form editable; a failed save says so and re-enables
// the button (never a spinner stuck on "Salvataggio…").

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: async () => 'tok' }),
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

import Settings from './Settings';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

describe('Settings (/impostazioni) con il backend degradato', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('salvataggio con DB giù: messaggio chiaro e bottone riabilitato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT'
          ? new Response(JSON.stringify({ error: 'db-unavailable' }), { status: 503 })
          : new Response(JSON.stringify({ displayName: 'Ann', avatar: null }), { status: 200 }),
      ),
    );
    renderSettings();
    fireEvent.click(await screen.findByText('Salva'));
    expect(await screen.findByText('Salvataggio non disponibile al momento.')).toBeInTheDocument();
    expect(screen.getByText('Salva')).toBeEnabled(); // non resta su "Salvataggio…"
  });

  it('caricamento profilo fallito: errore visibile ma form ancora editabile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'db-unavailable' }), { status: 503 })),
    );
    renderSettings();
    expect(await screen.findByText('Impossibile caricare il profilo.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Come ti chiami in partita')).toBeEnabled();
  });
});
