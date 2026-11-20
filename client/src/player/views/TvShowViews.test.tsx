// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import GhigliottinaView from './GhigliottinaView';
import StimaView from './StimaView';
import BufalaView from './BufalaView';
import IntesaView from './IntesaView';

afterEach(cleanup);

describe('TV Show online player views', () => {
  it('GhigliottinaView lets player pick among 4 choices (+100) or type freely (+150), and renders reveal connections', () => {
    const onSubmit = vi.fn();
    render(
      <GhigliottinaView
        phase="GHIGLIOTTINA"
        state={{
          puzzleId: 'gh01',
          clues: ['SCENA', 'FULMINE', 'GRAZIA', 'STATO', 'STOMACO'],
          choices: ['COLPO', 'TAGLIO', 'PASSO', 'GIRO'],
          submittedCount: 0,
          totalPlayers: 2,
          missingNicknames: ['Marco', 'Sara'],
        }}
        submittedGuess={null}
        onSubmit={onSubmit}
        skipButton={null}
      />,
    );

    expect(screen.getByText('SCENA')).toBeInTheDocument();
    expect(screen.getByText('STOMACO')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'COLPO' }));
    expect(onSubmit).toHaveBeenCalledWith('COLPO', true);

    const input = screen.getByLabelText(/oppure scrivi la parola/i);
    fireEvent.change(input, { target: { value: 'colpo' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('COLPO', false);

    cleanup();
    render(
      <GhigliottinaView
        phase="GHIGLIOTTINA_REVEAL"
        state={{
          puzzleId: 'gh01',
          clues: ['SCENA', 'FULMINE', 'GRAZIA', 'STATO', 'STOMACO'],
          choices: ['COLPO', 'TAGLIO', 'PASSO', 'GIRO'],
          submittedCount: 2,
          totalPlayers: 2,
          missingNicknames: [],
          answer: 'COLPO',
          connections: [
            'Colpo di scena',
            'Colpo di fulmine',
            'Colpo di grazia',
            'Colpo di stato',
            'Colpo allo stomaco',
          ],
          results: [
            {
              playerId: 'p1',
              nickname: 'Marco',
              guess: 'COLPO',
              correct: true,
              usedChoices: false,
              pointsAwarded: 150,
            },
          ],
        }}
        submittedGuess="COLPO"
        onSubmit={onSubmit}
        skipButton={null}
      />,
    );

    expect(screen.getAllByText('COLPO').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Colpo di fulmine')).toBeInTheDocument();
    expect(screen.getByText(/\+150 pt/i)).toBeInTheDocument();
  });

  it('StimaView adjusts slider draft with +/- steps and renders precision on reveal', () => {
    const onSubmit = vi.fn();
    render(
      <StimaView
        phase="STIMA_GUESS"
        state={{
          questionId: 'st02',
          prompt: 'In che anno fu inviato il primo SMS?',
          unit: 'anno',
          min: 1980,
          max: 2005,
          step: 1,
          submittedCount: 0,
          totalPlayers: 1,
          missingNicknames: ['Solo'],
        }}
        submittedValue={1990}
        onSubmit={onSubmit}
        skipButton={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /aggiorna stima \(1991 anno\)/i }));
    expect(onSubmit).toHaveBeenCalledWith(1991);

    cleanup();
    render(
      <StimaView
        phase="STIMA_REVEAL"
        state={{
          questionId: 'st02',
          prompt: 'In che anno fu inviato il primo SMS?',
          unit: 'anno',
          min: 1980,
          max: 2005,
          step: 1,
          submittedCount: 1,
          totalPlayers: 1,
          missingNicknames: [],
          answer: 1992,
          funFact: 'Nel 1992!',
          soloPrecisionPct: 96,
        }}
        submittedValue={1991}
        onSubmit={onSubmit}
        skipButton={null}
      />,
    );

    expect(screen.getAllByText(/1992/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/96%/)).toBeInTheDocument();
    expect(screen.getByText(/Nel 1992!/i)).toBeInTheDocument();
  });

  it('BufalaView toggles between È Vero / È una Bufala and shows explanation on reveal', () => {
    const onVote = vi.fn();
    render(
      <BufalaView
        phase="BUFALA_VOTE"
        state={{
          questionId: 'bf01',
          statement: 'Oxford è più antica dell’Impero Azteco.',
          category: 'Storia',
          submittedCount: 0,
          totalPlayers: 2,
          missingNicknames: [],
        }}
        submittedVote={null}
        onVote={onVote}
        skipButton={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /✅ è vero!/i }));
    expect(onVote).toHaveBeenCalledWith(true);

    cleanup();
    render(
      <BufalaView
        phase="BUFALA_REVEAL"
        state={{
          questionId: 'bf01',
          statement: 'Oxford è più antica dell’Impero Azteco.',
          category: 'Storia',
          submittedCount: 2,
          totalPlayers: 2,
          missingNicknames: [],
          isTrue: true,
          explanation: 'VERO! 1096 vs 1325.',
        }}
        submittedVote={true}
        onVote={onVote}
        skipButton={null}
      />,
    );

    expect(screen.getByText(/VERO! 1096 vs 1325./i)).toBeInTheDocument();
  });

  it('IntesaView shows target word + forbidden words ONLY to the speaker and lets guesser controls work', () => {
    const players = [
      { id: 'p1', nickname: 'Alice', avatar: '🦊', isBot: false, connected: true, role: 'giocatore' as const },
      { id: 'p2', nickname: 'Bob', avatar: '🐙', isBot: false, connected: true, role: 'giocatore' as const },
    ];
    const onResolve = vi.fn();
    const state = {
      cardId: 'in01',
      category: 'Cucina',
      speakerId: 'p1',
      speakerName: 'Alice',
      outcome: 'pending' as const,
      winnerId: null,
      winnerName: null,
    };

    // Guesser perspective (p2): secret is null, word never appears
    render(
      <IntesaView
        phase="INTESA_PLAY"
        state={state}
        secret={null}
        myId="p2"
        isLeader={false}
        players={players}
        onResolve={onResolve}
        skipButton={null}
      />,
    );
    expect(screen.queryByText('CARBONARA')).toBeNull();
    expect(screen.getByText(/DESCRIVE ALICE/i)).toBeInTheDocument();

    cleanup();

    // Speaker perspective (p1): sees target word + 4 forbidden words + resolution buttons
    render(
      <IntesaView
        phase="INTESA_PLAY"
        state={state}
        secret={{
          cardId: 'in01',
          word: 'CARBONARA',
          forbidden: ['PASTA', 'UOVO', 'GUANCIALE', 'PECORINO'],
          category: 'Cucina',
          round: 1,
        }}
        myId="p1"
        isLeader={true}
        players={players}
        onResolve={onResolve}
        skipButton={null}
      />,
    );
    expect(screen.getByText('CARBONARA')).toBeInTheDocument();
    expect(screen.getByText(/🚫 GUANCIALE/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /✓ Bob/i }));
    expect(onResolve).toHaveBeenCalledWith('guessed', 'p2');
  });
});
