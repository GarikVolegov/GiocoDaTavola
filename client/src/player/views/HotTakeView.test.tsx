// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import HotTakeView from './HotTakeView';

describe('HotTakeView', () => {
  afterEach(() => cleanup());

  it('renders quick-tap 1..10 buttons and submits score on tap', () => {
    const onSubmitScore = vi.fn();
    render(
      <HotTakeView
        phase="HOT_TAKE_VOTE"
        prompt={{ id: 'ht01', text: 'Ghostare è legittimo?' }}
        reveal={null}
        remaining={15}
        myScore={null}
        submittedCount={1}
        playerCount={4}
        missingHotTakers={['Marco', 'Giulia']}
        onSubmitScore={onSubmitScore}
        skipButton={null}
      />,
    );
    expect(screen.getByText('Ghostare è legittimo?')).toBeInTheDocument();
    expect(screen.getByText(/Aspettiamo Marco e Giulia/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(onSubmitScore).toHaveBeenCalledWith(9);
  });

  it('renders group average and lowest/highest extremes in HOT_TAKE_REVEAL', () => {
    render(
      <HotTakeView
        phase="HOT_TAKE_REVEAL"
        prompt={null}
        reveal={{
          prompt: { id: 'ht01', text: 'Ghostare è legittimo?' },
          average: 6.5,
          scores: [
            { playerId: '1', nickname: 'Alice', score: 2 },
            { playerId: '2', nickname: 'Bob', score: 10 },
          ],
          lowest: { playerId: '1', nickname: 'Alice', score: 2 },
          highest: { playerId: '2', nickname: 'Bob', score: 10 },
          spread: 8,
        }}
        remaining={12}
        myScore={2}
        submittedCount={2}
        playerCount={2}
        missingHotTakers={null}
        onSubmitScore={() => {}}
        skipButton={null}
      />,
    );
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
