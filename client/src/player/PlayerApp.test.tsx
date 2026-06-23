// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
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
  beforeEach(() => {
    resetHandlers();
    localStorage.clear();
  });
  afterEach(() => cleanup()); // unmount between tests so DOM doesn't leak across them

  it('shows the join screen before joining', () => {
    render(<PlayerApp />);
    expect(screen.getByText('Entra nella partita')).toBeInTheDocument();
  });

  it('stays silent when a stale saved session fails auto-rejoin (no scary error on the form)', () => {
    // A leftover session from a room that no longer exists (server restarted /
    // room expired). On mount the app silently replays it; the failure must NOT
    // surface as a red error on the join/create form — the user never asked for it.
    localStorage.setItem(
      'schierati:session',
      JSON.stringify({ code: 'WXYZ', nickname: 'Vecchio', token: 'staletok' }),
    );
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joinError', { error: 'ROOM_NOT_FOUND' });
    });
    expect(screen.queryByText('Codice stanza non valido')).toBeNull();
    // The form is still there and usable.
    expect(screen.getByText('Entra nella partita')).toBeInTheDocument();
  });

  it('shows the error when the user explicitly submits a bad code', () => {
    render(<PlayerApp />);
    fireEvent.change(screen.getByPlaceholderText('ABCD'), { target: { value: 'WXYZ' } });
    fireEvent.change(screen.getByPlaceholderText('Il tuo nome'), { target: { value: 'Anna' } });
    fireEvent.click(screen.getByRole('button', { name: /entra/i }));
    act(() => {
      serverEmit('player:joinError', { error: 'ROOM_NOT_FOUND' });
    });
    expect(screen.getByText('Codice stanza non valido')).toBeInTheDocument();
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

  it('lists the other players to accuse at ACCUSE (excluding self)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
          { id: 'p3', nickname: 'Carlo' },
        ],
      });
      serverEmit('game:state', {
        phase: 'ACCUSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    expect(screen.getByText(/chi ha cercato di ribaltare/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bea/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Carlo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alice/ })).toBeNull();
  });

  it('shows the speaker + raise-hand for a spectator at DEFENSE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: { speakerId: 'p2', speaker: { id: 'p2', nickname: 'Bea', side: 'A' } },
        leaderId: null,
      });
    });
    expect(screen.getByText(/sta parlando/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alza la mano/i })).toBeInTheDocument();
  });

  it('shows the finish affordance when it is your turn at DEFENSE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: { speakerId: 'p1', speaker: { id: 'p1', nickname: 'Alice', side: 'A' }, startedAt: Date.now() },
        leaderId: null,
      });
    });
    expect(screen.getByText(/tocca a te/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeInTheDocument();
  });

  it('shows prediction + swing bet at PREDICT (no know-pair)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PREDICT',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        knowPairs: null,
        leaderId: null,
      });
    });
    expect(screen.getByText(/chi vincerà/i)).toBeInTheDocument();
    expect(screen.getByText(/ci sarà un ribaltone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /REGGE/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RIBALTA/ })).toBeInTheDocument();
  });

  it('shows the "quanto mi conosci" guess at PREDICT when assigned', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PREDICT',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        knowPairs: [{ guesserId: 'p1', guesserNickname: 'Alice', targetId: 'p2', targetNickname: 'Bea' }],
        leaderId: null,
      });
    });
    expect(screen.getByText(/quanto mi conosci/i)).toBeInTheDocument();
    expect(screen.getByText('Bea')).toBeInTheDocument(); // the target to guess
  });

  it('shows who is arguing for a spectator at DUEL_ARGUE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DUEL_ARGUE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duelTurn: { speaker: { id: 'p2', nickname: 'Bea', side: 'A' }, turn: 1, totalTurns: 4 },
        leaderId: null,
      });
    });
    expect(screen.getByText(/sta argomentando/i)).toBeInTheDocument();
    expect(screen.getByText('Bea')).toBeInTheDocument();
  });

  it('shows the dilemma at DILEMMA_REVEAL (status view)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DILEMMA_REVEAL',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/mare o montagna/i)).toBeInTheDocument();
  });

  it('points to the shared screen at FINAL_DUEL (status view)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_DUEL',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    expect(screen.getByText(/guarda il risultato sullo schermo/i)).toBeInTheDocument();
  });

  it('shows the lobby with the add-dilemma card after joining (no game state yet)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', { players: [{ id: 'p1', nickname: 'Alice' }] });
    });
    expect(screen.getByText(/sei nella stanza/i)).toBeInTheDocument();
    expect(screen.getByText(/aggiungi un dilemma/i)).toBeInTheDocument();
  });

  it('shows group voting progress on the phone at VOTE_1', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
          { id: 'p3', nickname: 'Carlo' },
        ],
      });
      serverEmit('game:state', {
        phase: 'VOTE_1',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 2,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hanno votato 2\/3/i)).toBeInTheDocument();
  });

  it('gives personal feedback after confirming the second vote', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
        ],
      });
      serverEmit('game:state', {
        phase: 'VOTE_2',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 2,
        confirmedCount: 0,
        leaderId: null,
      });
    });
    // Before confirming there is no personal "you confirmed" state.
    expect(screen.queryByText(/aspettiamo gli altri/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /confermo/i }));
    expect(screen.getByText(/aspettiamo gli altri/i)).toBeInTheDocument();
  });

  it('explains the minimum speaking time while the finish button is locked (DEFENSE)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          speakerId: 'p1',
          speaker: { id: 'p1', nickname: 'Alice', side: 'A' },
          startedAt: Date.now(),
          minEndsAt: Date.now() + 30000,
        },
        leaderId: null,
      });
    });
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeDisabled();
    expect(screen.getByText(/parla ancora/i)).toBeInTheDocument();
  });

  it('hints spectators they can raise their hand to intervene later (DEFENSE)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: { speakerId: 'p2', speaker: { id: 'p2', nickname: 'Bea', side: 'A' } },
        leaderId: null,
      });
    });
    expect(screen.getByText(/per intervenire dopo/i)).toBeInTheDocument();
  });

  it('confirms to a spectator that their hand is raised (DEFENSE)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: { speakerId: 'p2', speaker: { id: 'p2', nickname: 'Bea', side: 'A' } },
        leaderId: null,
      });
    });
    act(() => {
      serverEmit('player:handRaised', { raised: true });
    });
    expect(screen.getByText(/mano alzata/i)).toBeInTheDocument();
  });

  it('cues the next step at DILEMMA_REVEAL (status view)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'DILEMMA_REVEAL',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/tra poco si vota/i)).toBeInTheDocument();
  });

  it('cues the next step at SPLIT_REVEAL (status view)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'SPLIT_REVEAL',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/ora si difende/i)).toBeInTheDocument();
  });

  it('shows group prediction progress at PREDICT', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
          { id: 'p3', nickname: 'Carlo' },
        ],
      });
      serverEmit('game:state', {
        phase: 'PREDICT',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        knowPairs: null,
        predictedCount: 1,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hanno pronosticato 1\/3/i)).toBeInTheDocument();
  });

  it('shows group speaker-vote progress at SPEAKER_VOTE', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [
          { id: 'p1', nickname: 'Alice' },
          { id: 'p2', nickname: 'Bea' },
          { id: 'p3', nickname: 'Carlo' },
        ],
      });
      serverEmit('game:state', {
        phase: 'SPEAKER_VOTE',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        speakerCandidates: [
          { id: 'p2', side: 'A', nickname: 'Bea' },
          { id: 'p3', side: 'B', nickname: 'Carlo' },
        ],
        speakerVotedCount: 2,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hanno votato 2\/3/i)).toBeInTheDocument();
  });

  it('asks for confirmation before leaving the room', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', { players: [{ id: 'p1', nickname: 'Alice' }] });
    });
    // One tap only arms the confirmation — it must NOT leave the room.
    fireEvent.click(screen.getByRole('button', { name: /^esci dalla stanza$/i }));
    expect(screen.getByText(/sei nella stanza/i)).toBeInTheDocument();
    // Confirming actually leaves, back to the join form.
    fireEvent.click(screen.getByRole('button', { name: /esci davvero/i }));
    expect(screen.getByText(/entra nella partita/i)).toBeInTheDocument();
  });

  it('shows the leader setup panel when you are the leader', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', { players: [{ id: 'p1', nickname: 'Alice' }] });
      serverEmit('game:state', {
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    expect(screen.getByText(/componi la serata/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /avvia partita/i })).toBeInTheDocument();
  });
});
