// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// A fake shared socket the test can drive: the component registers handlers via
// `.on`, the test pushes server events via `serverEmit`. Built in vi.hoisted so
// it exists when the (hoisted) vi.mock factory runs.
const { fakeSocket, serverEmit, resetHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  const socket = {
    on(event: string, h: (p: unknown) => void) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(h);
      return socket;
    },
    off(event: string, h: (p: unknown) => void) {
      handlers.get(event)?.delete(h);
      return socket;
    },
    once() {
      return socket;
    },
    emit() {
      return socket;
    },
    connected: true,
  };
  return {
    fakeSocket: socket,
    serverEmit: (event: string, payload: unknown) => {
      handlers.get(event)?.forEach((h) => h(payload));
    },
    resetHandlers: () => handlers.clear(),
  };
});

vi.mock('../shared/socket', () => ({ getSocket: () => fakeSocket }));
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: false, getToken: async () => null }),
  Show: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SignInButton: () => null,
}));

import PlayerApp from './PlayerApp';

describe('PlayerApp', () => {
  beforeEach(() => resetHandlers());

  it('shows the join screen before joining', () => {
    render(<PlayerApp />);
    expect(screen.getByText('Entra nella partita')).toBeInTheDocument();
  });

  it('renders the dilemma options at VOTE_1 after joining', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: null,
      });
    });
    expect(screen.getByText('Mare')).toBeInTheDocument();
    expect(screen.getByText('Montagna')).toBeInTheDocument();
  });

  it('shows the confirm affordance at VOTE_2', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'VOTE_2',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        confirmedCount: 0,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hai sentito le difese/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confermo/i })).toBeInTheDocument();
  });

  it('lists the other defenders to vote at SPEAKER_VOTE (excluding self)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'SPEAKER_VOTE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        speakerCandidates: [
          { id: 'p1', side: 'A', nickname: 'Alice' }, // self — filtered out
          { id: 'p2', side: 'A', nickname: 'Bea' },
          { id: 'p3', side: 'B', nickname: 'Carlo' },
        ],
        leaderId: null,
      });
    });
    expect(screen.getByText('Chi è stato più convincente?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bea/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Carlo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alice/ })).toBeNull();
  });
});
