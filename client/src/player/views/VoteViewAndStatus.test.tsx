// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VoteView from './VoteView';
import StatusView from './StatusView';
import CruciverbaView from './CruciverbaView';
import GroupMindView from './GroupMindView';
import type { GameStatePayload, CruciverbaStatePayload } from '../../shared/events';

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

describe('Solo & Cruciverba scelte online views', () => {
  it('CruciverbaView in mode scelte hides clues and text input, disables wrongChoices, and calls onAttempt on click', () => {
    const onAttempt = vi.fn();
    const state: CruciverbaStatePayload = {
      boardId: 'cb1',
      theme: 'Spritz',
      mode: 'scelte',
      rows: 2,
      cols: 6,
      activePlayerId: 'p1',
      activePlayerName: 'Solo',
      activeWordId: 'w1',
      turnsTaken: 0,
      maxTurns: 12,
      words: [
        {
          id: 'w1',
          number: 1,
          direction: 'H',
          row: 0,
          col: 0,
          length: 6,
          clue: '',
          choices: ['SPRITZ', 'SPAGHI', 'CALICE', 'TONICA'],
          wrongChoices: ['TONICA'],
          status: 'pending',
          solvedByName: null,
        },
      ],
      cells: [
        [
          { letter: 'S', wordNumbers: [1] },
          { letter: '', wordNumbers: [] },
          { letter: '', wordNumbers: [] },
          { letter: '', wordNumbers: [] },
          { letter: '', wordNumbers: [] },
          { letter: '', wordNumbers: [] },
        ],
        [null, null, null, null, null, null],
      ],
    };

    render(
      <CruciverbaView
        phase="CRUCIVERBA"
        state={state}
        myId="p1"
        onAttempt={onAttempt}
        onPassHint={vi.fn()}
        skipButton={null}
      />,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/definizione/i)).toBeNull();
    expect(screen.getByText(/🎯 4 scelte/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TONICA' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'SPRITZ' }));
    expect(onAttempt).toHaveBeenCalledWith('SPRITZ', 'w1');
  });

  it('GroupMindView and StatusView hide group prediction and show Domanda Lampo in solo mode', () => {
    const onAnswer = vi.fn();
    render(
      <GroupMindView
        question={{
          id: 'sq01',
          prompt: 'Spegni o riaccendi il tempo?',
          optionA: 'Sì',
          optionB: 'No',
        }}
        answer={null}
        guess={null}
        onAnswer={onAnswer}
        onGuess={vi.fn()}
        progress={{ done: 0, total: 1, missingNicknames: [] }}
        isSolo={true}
        lastSoloFeedback={{ prompt: 'Prev', chosenLabel: 'Prima', crowdPct: 62 }}
        skipButton={null}
      />,
    );

    expect(screen.getByText(/domanda lampo/i)).toBeInTheDocument();
    expect(screen.queryByText(/cosa risponderà la maggioranza del gruppo/i)).toBeNull();
    expect(screen.getByText(/62% come te/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sì' }));
    expect(onAnswer).toHaveBeenCalledWith('A');

    cleanup();

    const gmRevealGame: GameStatePayload = {
      code: 'SOLO',
      phase: 'GROUP_MIND_REVEAL',
      dilemmaIndex: 1,
      dilemmaCount: 3,
      format: 'classic',
      phaseExpiresAt: null,
      dilemma: null,
      split: null,
      votedCount: 1,
      confirmedCount: 0,
      leaderId: 'p1',
      players: [],
      groupMindQuestion: {
        id: 'sq01',
        prompt: 'Spegni o riaccendi il tempo?',
        optionA: 'Sì',
        optionB: 'No',
      },
      groupMindTally: { A: 1, B: 0, correctGuessers: 1 },
    };

    render(
      <MemoryRouter>
        <StatusView
          phase="GROUP_MIND_REVEAL"
          game={gmRevealGame}
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
          skipButton={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/tu vs la bussola del mondo/i)).toBeInTheDocument();
    expect(screen.queryByText(/letto bene il gruppo/i)).toBeNull();
  });
});
