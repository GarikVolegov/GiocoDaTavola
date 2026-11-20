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

  it('requires even pairs of partners for Coppie (fidanzati) and starts cleanly when paired', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🔥 coppie/i }));
    addPlayers(['Marco', 'Giulia', 'Luca']);

    expect(screen.getByText(/coppie è pensata per fidanzati/i)).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /inizia la partita/i });
    expect(startBtn).toBeDisabled();

    addPlayers(['Elena']);
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

  it('starts solo play (Da solo) in fast 1-tap mode by default, uses 2-choice solo decks, and allows switching to Con riflessione', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));

    // Fast mode is active by default -> tapping an option jumps straight to Round 2 with previous-choice toast
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🔀 preferiresti/i }));

    fireEvent.click(screen.getByRole('button', { name: /opzioni serata/i }));
    fireEvent.click(screen.getByRole('button', { name: /3 round/i }));

    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));
    await waitFor(() => {
      expect(screen.getByText(/round 1\/3/i)).toBeInTheDocument();
    });

    // Solo Preferiresti shows strictly 2 options
    const soloPrefBtns = document.querySelectorAll<HTMLButtonElement>('button[class*="_option_"]');
    expect(soloPrefBtns).toHaveLength(2);
    expect(screen.queryByText(/legge/i)).toBeNull();

    fireEvent.click(soloPrefBtns[0]);
    await waitFor(() => {
      expect(screen.getByText(/round 2\/3/i)).toBeInTheDocument();
      expect(screen.getByTestId('solo-last-toast')).toBeInTheDocument();
    });

    // Leave back to setup and test Con riflessione mode (Bussola + Avvocato del Diavolo + flip)
    fireEvent.click(screen.getByRole('button', { name: /✕ esci/i }));
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));
    fireEvent.click(screen.getByRole('button', { name: /🧭 con riflessione/i }));
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /⚡ flash/i }));

    const startBtn = screen.getByRole('button', { name: /inizia la partita/i });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    await waitFor(() => {
      expect(screen.getByText(/round 1\/3/i)).toBeInTheDocument();
    });

    const firstOpt = document.querySelector<HTMLButtonElement>('button[class*="_option_"]');
    expect(firstOpt).not.toBeNull();
    fireEvent.click(firstOpt!);

    await waitFor(() => {
      expect(screen.getByTestId('solo-crowd-compass')).toBeInTheDocument();
      expect(screen.getByTestId('solo-devils-advocate')).toBeInTheDocument();
    });
    expect(screen.queryByText(/minoranza beve/i)).toBeNull();

    // Test changing mind after reading the counter-argument
    fireEvent.click(screen.getByRole('button', { name: /questa obiezione mi ha convinto/i }));
    expect(screen.getByText(/prospettiva ribaltata/i)).toBeInTheDocument();

    // Finish rounds 2 and 3 -> Solo Finale
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: /prossimo round|scopri il gran finale/i }));
      const opt = document.querySelector<HTMLButtonElement>('button[class*="_option_"]');
      expect(opt).not.toBeNull();
      fireEvent.click(opt!);
    }

    fireEvent.click(screen.getByRole('button', { name: /scopri il gran finale/i }));
    await waitFor(() => {
      expect(screen.getByText(/specchio decisionale/i)).toBeInTheDocument();
      expect(screen.getByText(/il tuo archetipo decisionale/i)).toBeInTheDocument();
    });
  });

  it('runs Solo Cruciverba in 4-scelte mode hiding clues, showing grid + 4 choices, and disabling wrong guesses', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));
    fireEvent.click(screen.getByRole('button', { name: /🧩 cruciverba/i }));

    expect(screen.getByRole('button', { name: /🎯 4 scelte/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));

    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /scelte parola cruciverba/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(/indovinata dal tavolo/i)).toBeNull();
    const choiceBtns = Array.from(
      screen.getByRole('group', { name: /scelte parola cruciverba/i }).querySelectorAll('button'),
    );
    expect(choiceBtns).toHaveLength(4);

    // Clicking a choice either advances to the next word (if right) or disables that wrong button
    const firstLabel = choiceBtns[0].textContent;
    fireEvent.click(choiceBtns[0]);
    const stillVisibleSameBtn = screen
      .getByRole('group', { name: /scelte parola cruciverba/i })
      .querySelectorAll('button');
    if (stillVisibleSameBtn[0]?.textContent === firstLabel) {
      expect(stillVisibleSameBtn[0]).toBeDisabled();
    }
  });

  it('hides group-only Parola Vietata in Solo, shows new TV modes, and plays through Vero o Bufala', async () => {
    renderPassApp();
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));
    fireEvent.click(screen.getByRole('button', { name: /scegli singolo gioco/i }));

    expect(screen.getByRole('button', { name: /🔗 ghigliottina/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /💰 quanto vale\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🎭 vero o bufala\?/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /🚫 parola vietata/i })).toBeNull();

    // Switching back to Gruppo reveals Parola Vietata
    fireEvent.click(screen.getByRole('button', { name: /👥 in gruppo/i }));
    expect(screen.getByRole('button', { name: /🚫 parola vietata/i })).toBeInTheDocument();

    // Switch to Solo and play Vero o Bufala round
    fireEvent.click(screen.getByRole('button', { name: /👤 da solo/i }));
    fireEvent.click(screen.getByRole('button', { name: /🎭 vero o bufala\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /inizia la partita/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /✅ è vero!/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🤡 è una bufala!/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /✅ è vero!/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /era vero!|era una bufala!/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /prossimo round/i })).toBeInTheDocument();
    });
  });
});
