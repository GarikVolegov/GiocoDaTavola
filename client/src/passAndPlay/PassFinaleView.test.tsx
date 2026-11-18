// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PassFinaleView from './PassFinaleView';
import {
  createInitialPassState,
  passReducer,
  type PassPlayer,
} from './passAndPlayEngine';
import { FALLBACK_DECKS } from './fallbackDeck';

afterEach(cleanup);

const PLAYERS: PassPlayer[] = [
  { id: 'p1', name: 'Gere', avatar: '🦊' },
  { id: 'p2', name: 'Marco', avatar: '🐙' },
  { id: 'p3', name: 'Luca', avatar: '🦁' },
];

function buildFinishedState() {
  let s = createInitialPassState();
  s = passReducer(s, {
    type: 'START_GAME',
    mode: 'flash',
    players: PLAYERS,
    cards: FALLBACK_DECKS.flash.slice(0, 2),
  });
  s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'SPLIT' });
  s = passReducer(s, { type: 'RESOLVE_FLASH', result: 'UNANIMOUS' });
  return s;
}

describe('PassFinaleView', () => {
  it('renders hero verdict, thermometer, MVP, awards for all players, and saved code chip', () => {
    const state = buildFinishedState();
    render(
      <PassFinaleView
        state={state}
        recordSavedCode="PNP-MWIK3OAK"
        onReplay={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByText(/gran finale/i)).toBeInTheDocument();
    expect(screen.getByText(/salvata · pnp-mwik3oak/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /indice di sintonia/i })).toBeInTheDocument();
    expect(screen.getByText(/protagonista della serata/i)).toBeInTheDocument();
    expect(screen.getByText(/sfida della staffa/i)).toBeInTheDocument();

    // All 3 players appear on the Premi tab
    expect(screen.getAllByText('Gere').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Marco').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Luca').length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Premi, Pagelle, and Momenti tabs and steps through player dossiers', () => {
    const state = buildFinishedState();
    render(
      <PassFinaleView
        state={state}
        recordSavedCode={null}
        onReplay={() => {}}
        onHome={() => {}}
      />,
    );

    // Switch to Pagelle
    fireEvent.click(screen.getByRole('tab', { name: /pagelle/i }));
    expect(screen.getByText(/nella vita vera/i)).toBeInTheDocument();
    // Click next player quick-stepper to inspect Marco
    fireEvent.click(screen.getByRole('button', { name: /pagella di 🐙 marco/i }));
    expect(screen.getByRole('button', { name: /pagella di 🦁 luca/i })).toBeInTheDocument();

    // Switch to Momenti
    fireEvent.click(screen.getByRole('tab', { name: /momenti/i }));
    expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.getByText(/plebiscito totale/i)).toBeInTheDocument();
  });

  it('fires replay, home, and share/clipboard actions', async () => {
    const onReplay = vi.fn();
    const onHome = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });

    render(
      <PassFinaleView
        state={buildFinishedState()}
        recordSavedCode={null}
        onReplay={onReplay}
        onHome={onHome}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /rigioca con gli stessi amici/i }));
    expect(onReplay).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /torna alla home/i }));
    expect(onHome).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /condividi verdetto/i }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('SCHIERATI');
  });
});
