// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false, getToken: async () => null }),
}));

vi.mock('../shared/useOnlineStatus', () => ({
  useOnlineStatus: () => false,
}));

vi.mock('../host/audio/thematicMusic', () => ({
  pickMusicThemeForPass: () => 'lobby',
  setThematicIntensity: () => {},
  startThematicMusic: () => {},
  stopThematicMusic: () => {},
}));

vi.mock('../host/audio/synthSfx', () => ({
  playFanfare: () => {},
  playGong: () => {},
  playSiren: () => {},
  playTick: () => {},
}));

vi.mock('../host/audio/sfx', () => ({
  play: () => {},
}));

vi.mock('../host/audio/engine', () => ({
  unlockAudio: () => {},
  isMuted: () => false,
  setMuted: () => {},
}));

import PassAndPlayApp from './PassAndPlayApp';

function renderPassApp() {
  return render(
    <MemoryRouter>
      <PassAndPlayApp />
    </MemoryRouter>,
  );
}

function addPlayers(names: string[]) {
  const input = screen.getByPlaceholderText(/nome amico/i);
  const addBtn = screen.getByRole('button', { name: /\+ aggiungi/i });
  for (const name of names) {
    fireEvent.change(input, { target: { value: name } });
    fireEvent.click(addBtn);
  }
}

describe('PassAndPlayApp UI', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to Serata Mix with single modes collapsed and starts immediately', async () => {
    renderPassApp();

    const mixBtn = screen.getByRole('button', { name: /serata mix/i });
    expect(mixBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /⚡ flash/i })).toBeNull();

    addPlayers(['Marco', 'Giulia']);
    const startBtn = screen.getByRole('button', { name: /inizia la partita/i });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText(/round 1\/5/i)).toBeInTheDocument();
    });
  });

  it('shows 2-step setup with collapsible Opzioni serata and starts Flash choosing options directly', async () => {
    renderPassApp();

    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /⚡ flash/i }));

    const optsBtn = screen.getByRole('button', { name: /opzioni serata/i });
    expect(optsBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/3 round/i)).toBeNull();

    fireEvent.click(optsBtn);
    expect(optsBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /3 round/i }));

    addPlayers(['Marco', 'Giulia']);
    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));

    await waitFor(() => {
      expect(screen.getByText(/discutete dal vivo e toccate la scelta del tavolo/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/legge/i)).toBeInTheDocument();
    expect(screen.queryByText(/pausa/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /maggioranza a/i })).toBeNull();

    // Resolve 3 rounds directly tapping an option (advancing past any rilancio/penalty card) -> Gran Finale
    for (let i = 0; i < 3; i++) {
      const firstOpt = document.querySelector<HTMLButtonElement>('button[class*="_option_"]');
      expect(firstOpt).not.toBeNull();
      fireEvent.click(firstOpt!);
      const nextBtn = screen.queryByRole('button', { name: /prossimo round|vedi classifica|continua/i });
      if (nextBtn) fireEvent.click(nextBtn);
    }
    await waitFor(() => {
      expect(screen.getByText(/gran finale/i)).toBeInTheDocument();
    });
  });

  it('allows starting Coppie with odd player count (3 players)', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🔥 coppie/i }));
    addPlayers(['Marco', 'Giulia', 'Luca']);

    expect(screen.getByText(/siete in 3 \(dispari\)/i)).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /inizia la partita/i });
    expect(startBtn).not.toBeDisabled();

    fireEvent.click(startBtn);
    await waitFor(() => {
      expect(screen.getByText(/round 1\//i)).toBeInTheDocument();
    });
  });

  it('runs Cruciverba Show vocally without countdown timer and zero text inputs', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🧩 cruciverba/i }));
    addPlayers(['Marco', 'Giulia']);
    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/lettere sbloccate/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('30s')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /indovinata dal tavolo/i }));
    expect(screen.getByText(/chi l’ha detta per primo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /marco/i }));
    expect(screen.getByText(/✓ marco:/i)).toBeInTheDocument();
  });

  it('runs L’Infiltrato with 1 reading loop and 1-tap accusation reveal', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🕵️ l’infiltrato/i }));
    addPlayers(['Marco', 'Giulia', 'Luca']);
    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));

    for (const name of ['Marco', 'Giulia', 'Luca']) {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: new RegExp(`sono ${name}`, 'i') })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`sono ${name}`, 'i') }));
      fireEvent.click(screen.getByRole('button', { name: /fatto, passa a|tutti pronti/i }));
    }

    await waitFor(() => {
      expect(screen.getByText(/tutti rispondono a voce/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /marco/i }));
    await waitFor(() => {
      expect(screen.getByText(/l’infiltrato era/i)).toBeInTheDocument();
      expect(screen.getByText(/domanda del gruppo/i)).toBeInTheDocument();
    });
  });

  it('starts solo play (Da solo) immediately without adding extra players', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));
    const startBtn = screen.getByRole('button', { name: /inizia la partita/i });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    await waitFor(() => {
      expect(screen.getByText(/round 1\/5/i)).toBeInTheDocument();
    });
  });
});
