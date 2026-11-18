// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VoteView from './VoteView';
import StatusView from './StatusView';
import type { GameStatePayload } from '../../shared/events';

afterEach(cleanup);

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: false }),
  Show: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('VoteView UX improvements', () => {
  it('renders voting options centrally without dimming or locking during flash mode', () => {
    const onVote = vi.fn();
    render(
      <VoteView
        phase="VOTE_1"
        dilemma={{ text: 'Domanda test?', optionA: 'Scelta A', optionB: 'Scelta B' }}
        remaining={5}
        vote={null}
        voteError={null}
        onVote={onVote}
        onConfirm={vi.fn()}
        confirmed={false}
        votedCount={0}
        confirmedCount={0}
        playerCount={3}
        missingVoters={null}
        skipButton={null}
        partyCard={{
          mode: 'flash',
          penalty: 'La minoranza beve!',
        }}
      />,
    );

    expect(screen.queryByText(/lettura protetta/i)).not.toBeInTheDocument();

    const optA = screen.getByRole('button', { name: /scelta a/i });
    const optB = screen.getByRole('button', { name: /scelta b/i });
    const group = screen.getByRole('group', { name: /il tuo voto/i });
    expect(group.style.opacity).not.toBe('0.45');
    expect(group.style.pointerEvents).not.toBe('none');

    fireEvent.click(optA);
    expect(onVote).toHaveBeenCalledWith('A');
    fireEvent.click(optB);
    expect(onVote).toHaveBeenCalledWith('B');
  });

  it('renders the compact audio player with play, restart, and speed controls', () => {
    render(
      <VoteView
        phase="VOTE_1"
        dilemma={{ text: 'Domanda audio?', optionA: 'A', optionB: 'B' }}
        remaining={15}
        vote={null}
        voteError={null}
        onVote={vi.fn()}
        onConfirm={vi.fn()}
        confirmed={false}
        votedCount={0}
        confirmedCount={0}
        playerCount={2}
        missingVoters={null}
        skipButton={null}
      />,
    );

    expect(screen.getByRole('region', { name: /lettore audio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ascolta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /riparti da capo/i })).toBeInTheDocument();
    const speedBtn = screen.getByRole('button', { name: /velocità 1x/i });
    expect(speedBtn).toBeInTheDocument();

    fireEvent.click(speedBtn);
    expect(screen.getByRole('button', { name: /velocità 1.25x/i })).toBeInTheDocument();
  });
});

describe('StatusView SPLIT_REVEAL UX improvements', () => {
  it('shows only the vote split bar without repeating the dilemma card', () => {
    const game: GameStatePayload = {
      code: 'ABCD',
      phase: 'SPLIT_REVEAL',
      dilemmaIndex: 1,
      dilemmaCount: 3,
      format: 'classic',
      phaseExpiresAt: null,
      dilemma: {
        id: 'd1',
        text: 'Dilemma che non deve ripetersi nella split',
        optionA: 'Opzione Alpha',
        optionB: 'Opzione Beta',
        register: 'vita',
        complessita: 'sorbetto',
      },
      split: { A: 2, B: 1 },
      votedCount: 3,
      confirmedCount: 0,
      leaderId: 'p1',
      players: [],
    };

    render(
      <MemoryRouter>
        <StatusView
          phase="SPLIT_REVEAL"
          game={game}
          remaining={3}
          playerId="p1"
          isLeader={true}
          players={[]}
          onAdvance={vi.fn()}
          onRematch={vi.fn()}
          infiltratoRole={null}
          predictionResult={null}
          swingBetResult={null}
          knowResult={null}
          groupMindResult={null}
          blindSpot={null}
          skipButton={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Opzione Alpha · 2 voti/i)).toBeInTheDocument();
    expect(screen.getByText(/1 voto · Opzione Beta/i)).toBeInTheDocument();
    expect(screen.queryByText(/dilemma che non deve ripetersi nella split/i)).not.toBeInTheDocument();
  });

  it('shows Bussola del Mondo and Avvocato del Diavolo in SPLIT_REVEAL when playing Solo (1 player)', () => {
    const soloGame: GameStatePayload = {
      code: 'SOLO',
      phase: 'SPLIT_REVEAL',
      dilemmaIndex: 1,
      dilemmaCount: 3,
      format: 'classic',
      phaseExpiresAt: null,
      dilemma: {
        id: 'd_solo',
        text: 'Dilemma in solitaria?',
        optionA: 'Scelta Audace',
        optionB: 'Scelta Sicura',
        spuntiA: ['Spunto A'],
        spuntiB: ['Spunto B contro-argomento'],
        register: 'vita',
        complessita: 'sorbetto',
      },
      split: { A: 1, B: 0 },
      votedCount: 1,
      confirmedCount: 0,
      leaderId: 'p1',
      players: [],
    };

    render(
      <MemoryRouter>
        <StatusView
          phase="SPLIT_REVEAL"
          game={soloGame}
          remaining={null}
          playerId="p1"
          isLeader={true}
          players={[{ id: 'p1', nickname: 'Solo', avatar: '🦊', isBot: false, connected: true, role: 'giocatore' }]}
          onAdvance={vi.fn()}
          onRematch={vi.fn()}
          infiltratoRole={null}
          predictionResult={null}
          swingBetResult={null}
          knowResult={null}
          groupMindResult={null}
          blindSpot={null}
          myVote="A"
          skipButton={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/l’avvocato del diavolo/i)).toBeInTheDocument();
    expect(screen.getByText(/spunto b contro-argomento/i)).toBeInTheDocument();
    expect(screen.queryByText(/ecco come si è diviso il gruppo/i)).toBeNull();
  });
});
