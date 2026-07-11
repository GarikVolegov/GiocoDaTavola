// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, fireEvent, within } from '@testing-library/react';
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
import { WRONG_PREDICTION_TITLES, WRONG_SWING_BET_TITLES, WRONG_KNOW_TITLES } from '../shared/ironicTitles';

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

  it('shows a share-invite button in the post-creation lobby', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
    });
    expect(screen.getByRole('button', { name: /inoltra invito/i })).toBeInTheDocument();
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
    expect(screen.getByText(/chi ti ha strappato l'applauso/i)).toBeInTheDocument();
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

  it('shows the dilemma and defended side to a listener (not just the speaker) at DEFENSE', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        leaderId: null,
      });
    });
    expect(screen.getByText('Mare o montagna?')).toBeInTheDocument();
    expect(screen.getByText(/difendendo.*mare/i)).toBeInTheDocument();
  });

  it('shows the absurd defense constraint to a listener at DEFENSE', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        absurdConstraint: 'Difendila come un venditore di materassi',
        leaderId: null,
      });
    });
    expect(screen.getByText(/vincolo.*venditore di materassi/i)).toBeInTheDocument();
  });

  it('shows the absurd defense constraint to the speaker at DEFENSE', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p1', nickname: 'Alice', side: 'A' },
          speakerId: 'p1',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        absurdConstraint: 'Come se fossi un pirata',
        leaderId: null,
      });
    });
    expect(screen.getByText(/vincolo.*pirata/i)).toBeInTheDocument();
  });

  it('shows no absurd constraint banner when the round drew none', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        absurdConstraint: null,
        leaderId: null,
      });
    });
    expect(screen.queryByText(/vincolo/i)).toBeNull();
  });

  it('shows the surprise twist banner at DEFENSE when this round drew one (4.3)', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        twist: { id: 'difesa-lampo', label: '⚡ Difesa lampo', description: 'Difesa in 30 secondi netti!' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/difesa lampo/i)).toBeInTheDocument();
    expect(screen.getByText(/30 secondi netti/i)).toBeInTheDocument();
  });

  it('hides the raise-hand affordance during an "interventi-vietati" twist round (4.3)', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        twist: { id: 'interventi-vietati', label: '🤐 Niente interventi', description: 'Questo round si difende senza interruzioni.' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/niente interventi/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /alza la mano/i })).toBeNull();
  });

  it('lets the infiltrator seed a decoy spunto during DEFENSE (4.5)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('player:infiltratoRole', { mission: 'Fai ribaltare il gruppo.' });
      serverEmit('game:state', {
        phase: 'DEFENSE',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        infiltratoToolUsed: false,
        leaderId: null,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /semina un dubbio/i }));
    expect(emitSpy).toHaveBeenCalledWith('player:infiltratoTool');
  });

  it('never shows the sabotage button to a non-infiltrator', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        infiltratoToolUsed: false,
        leaderId: null,
      });
    });
    expect(screen.queryByRole('button', { name: /semina un dubbio/i })).toBeNull();
  });

  it('shows the tool-use "replay" count in the Infiltrato reveal at FINAL_AWARDS (4.5)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        infiltratoResult: {
          infiltratorId: 'p2',
          infiltratorNickname: 'Bea',
          flips: 1,
          caught: false,
          won: true,
          votesAgainst: 0,
          toolUses: 2,
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/seminato dubbi in 2 round/i)).toBeInTheDocument();
  });

  it('shows "I momenti della serata" before the awards at FINAL_AWARDS (5.5)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        namedMoments: [
          { kind: 'plebiscito', dilemmaIndex: 1, title: 'Plebiscito!', description: 'Tutti dalla stessa parte.', emoji: '🙌' },
          { kind: 'triplaPersuasione', dilemmaIndex: 2, title: 'Tripla Persuasione!', description: 'Bea ha convinto 3 persone.', emoji: '🎯', playerId: 'p2', playerNickname: 'Bea' },
        ],
        awards: [],
        leaderId: null,
      });
    });
    expect(screen.getByText(/i momenti della serata/i)).toBeInTheDocument();
    expect(screen.getByText('Plebiscito!')).toBeInTheDocument();
    expect(screen.getByText('Tripla Persuasione!')).toBeInTheDocument();
    expect(screen.getByText(/bea ha convinto 3 persone/i)).toBeInTheDocument();
  });

  it('mostra il podio con il proprio piazzamento a FINAL_AWARDS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        podium: [
          { player: { id: 'p2', nickname: 'Bea' }, points: 12, rank: 1 },
          { player: { id: 'p1', nickname: 'Alice' }, points: 9, rank: 2 },
        ],
        awards: [],
        leaderId: null,
      });
    });
    expect(screen.getByText(/il podio della serata/i)).toBeInTheDocument();
    expect(screen.getByText(/il tuo posto: 2°/i)).toBeInTheDocument();
    expect(screen.getByText(/alice \(tu\)/i)).toBeInTheDocument();
  });

  it('renders nothing for "I momenti della serata" when the game produced none', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        namedMoments: [],
        awards: [],
        leaderId: null,
      });
    });
    expect(screen.queryByText(/i momenti della serata/i)).toBeNull();
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

  // ---- Percorso in 2 (duello) -------------------------------------------

  const duoJoin = () => {
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
  };

  it('shows who is arguing (a parti invertite) for the listener at DUO_ARGUE', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_ARGUE',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoTurn: {
          speaker: { id: 'p2', nickname: 'Bea', side: 'A', inverted: true, advocate: false },
          listenerId: 'p1',
          turn: 1,
          totalTurns: 2,
          minEndsAt: null,
          canFinish: true,
          startedAt: Date.now(),
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/sta argomentando/i)).toBeInTheDocument();
    expect(screen.getByText('Bea')).toBeInTheDocument();
    expect(screen.getByText(/parti invertite/i)).toBeInTheDocument();
  });

  it('shows the assigned-side banner to the arguer and enables the finish once the floor lifts', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_ARGUE',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoTurn: {
          speaker: { id: 'p1', nickname: 'Alice', side: 'B', inverted: true, advocate: false },
          listenerId: 'p2',
          turn: 1,
          totalTurns: 2,
          minEndsAt: null,
          canFinish: true,
          startedAt: Date.now(),
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/non è il tuo/i)).toBeInTheDocument(); // "difendi il lato B (non è il tuo!)"
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeEnabled();
  });

  it('locks the finish button before the floor lifts and flags the devil advocate', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_ARGUE',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoAdvocateId: 'p1',
        duoTurn: {
          speaker: { id: 'p1', nickname: 'Alice', side: 'B', inverted: false, advocate: true },
          listenerId: 'p2',
          turn: 1,
          totalTurns: 1,
          minEndsAt: Date.now() + 15_000,
          canFinish: false,
          startedAt: Date.now(),
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/avvocato del diavolo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ho finito/i })).toBeDisabled();
  });

  it('DUO_PICK_PREDICT: emits player:duoSync only once BOTH selections are in (any order)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_PICK_PREDICT',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoSyncedCount: 0,
        leaderId: null,
      });
    });
    // Two selection groups: my own pick, and my prediction of Bea's pick.
    const ownGroup = screen.getByRole('group', { name: /la tua scelta/i });
    const predictGroup = screen.getByRole('group', { name: /cosa sceglie bea/i });
    emitSpy.mockClear();
    fireEvent.click(within(ownGroup).getByText('Mare'));
    expect(emitSpy).not.toHaveBeenCalledWith('player:duoSync', expect.anything());
    fireEvent.click(within(predictGroup).getByText('Montagna'));
    expect(emitSpy).toHaveBeenCalledWith('player:duoSync', { own: 'A', predict: 'B' });
    // The server echo flips the view into "sent, changeable" feedback.
    act(() => {
      serverEmit('player:duoSynced', { own: 'A', predict: 'B' });
    });
    expect(screen.getByText(/✓ inviato/i)).toBeInTheDocument();
    emitSpy.mockRestore();
  });

  it('renders the vote screen with duo subtitles at DUO_SIDE_PICK and DUO_PICK', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_SIDE_PICK',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        dilemma: { id: 'd3', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText('Da che parte stai?')).toBeInTheDocument();
    act(() => {
      serverEmit('game:state', {
        phase: 'DUO_PICK',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        dilemma: { id: 'd4', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText('Schierati')).toBeInTheDocument();
  });

  it('DUO_REPICK: the listener confirms; the devil advocate only waits', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_REPICK',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        dilemma: { id: 'd4', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoAdvocateId: null,
        leaderId: null,
      });
    });
    expect(screen.getByRole('button', { name: /confermo/i })).toBeInTheDocument();
    // Same phase, but I argued as the devil's advocate: nothing to re-pick.
    act(() => {
      serverEmit('game:state', {
        phase: 'DUO_REPICK',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        dilemma: { id: 'd4', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        duoAdvocateId: 'p1',
        leaderId: null,
      });
    });
    expect(screen.queryByRole('button', { name: /confermo/i })).toBeNull();
    expect(screen.getByText(/bea/i)).toBeInTheDocument(); // "ora decide Bea…"
  });

  it('DUO_WAVER: three ratings normally, two in the twist, none for the advocate', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_WAVER',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        duoAdvocateId: null,
        duoWaverCount: 0,
        leaderId: null,
      });
    });
    expect(screen.getByText(/ti ha fatto vacillare/i)).toBeInTheDocument();
    emitSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /🤯/ }));
    expect(emitSpy).toHaveBeenCalledWith('player:duoWaver', { rating: 2 });
    // Twist: I'm the listener — the 🤯 is reserved for a real flip (max 1).
    act(() => {
      serverEmit('game:state', {
        phase: 'DUO_WAVER',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoAdvocateId: 'p2',
        duoWaverCount: 0,
        leaderId: null,
      });
    });
    expect(screen.queryByRole('button', { name: /🤯/ })).toBeNull();
    expect(screen.getByRole('button', { name: /🤔/ })).toBeInTheDocument();
    // Twist again, but I'm the advocate: I only wait for the verdict.
    act(() => {
      serverEmit('game:state', {
        phase: 'DUO_WAVER',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoAdvocateId: 'p1',
        duoWaverCount: 0,
        leaderId: null,
      });
    });
    expect(screen.queryByRole('button', { name: /🤔/ })).toBeNull();
    emitSpy.mockRestore();
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

  it('DUO_ACT_INTRO announces the coming act phone-first', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_ACT_INTRO',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 2,
        phaseExpiresAt: null,
        duoAct: { act: 2, roundInAct: 0, roundsInAct: 1, totalActs: 3 },
        leaderId: null,
      });
    });
    expect(screen.getByText(/a parti invertite/i)).toBeInTheDocument();
  });

  it('DUO_SYNC_REVEAL shows both picks and the prediction hits', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_SYNC_REVEAL',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        duoSyncReveal: {
          picks: [
            { id: 'p1', nickname: 'Alice', choice: 'A' },
            { id: 'p2', nickname: 'Bea', choice: 'B' },
          ],
          predictions: [
            { id: 'p1', nickname: 'Alice', predicted: 'B', correct: true },
            { id: 'p2', nickname: 'Bea', predicted: 'B', correct: false },
          ],
          agreed: false,
          agreements: 0,
          truePicks: 1,
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/non siete d'accordo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/alice/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ci ha visto giusto/i)).toBeInTheDocument(); // Alice's correct call
  });

  it('DUO_REVEAL shows the picks and announces the twist on agreement', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_REVEAL',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoSyncReveal: {
          picks: [
            { id: 'p1', nickname: 'Alice', choice: 'A' },
            { id: 'p2', nickname: 'Bea', choice: 'A' },
          ],
          predictions: [],
          agreed: true,
          agreements: 2,
          truePicks: 3,
        },
        dilemma: { id: 'd4', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(screen.getByText(/siete d'accordo/i)).toBeInTheDocument();
    expect(screen.getByText(/avvocato del diavolo/i)).toBeInTheDocument(); // il twist in arrivo
  });

  it('DUO_ROUND_RESULT shows ribaltoni and running totals', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_ROUND_RESULT',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoRoundResult: {
          act: 3,
          advocacy: true,
          vacillare: [],
          convinced: [
            {
              persuader: { id: 'p1', nickname: 'Alice' },
              convinced: { id: 'p2', nickname: 'Bea' },
              ribaltone: true,
            },
          ],
          scores: [
            { id: 'p1', nickname: 'Alice', total: 4 },
            { id: 'p2', nickname: 'Bea', total: 3 },
          ],
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/ribaltone/i)).toBeInTheDocument();
    expect(screen.getAllByText(/alice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bea/i).length).toBeGreaterThan(0);
  });

  it('DUO_PORTRAIT shows the couple portrait and lets the leader rematch', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_PORTRAIT',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoPortrait: {
          sintoniaPct: 67,
          agreements: 2,
          truePicks: 3,
          tiConosco: [
            { id: 'p1', nickname: 'Alice', hits: 2 },
            { id: 'p2', nickname: 'Bea', hits: 1 },
          ],
          scores: [
            { id: 'p1', nickname: 'Alice', total: 6 },
            { id: 'p2', nickname: 'Bea', total: 5 },
          ],
          winnerId: 'p1',
          momento: { emoji: '🎭', title: 'Ribaltone!', description: 'Alice ha ribaltato Bea' },
          titoli: [
            { playerId: 'p1', nickname: 'Alice', emoji: '🎯', title: 'Il Persuasore', description: 'x' },
            { playerId: 'p1', nickname: 'Alice', emoji: '🔮', title: 'Il Telepate', description: 'y' },
            { playerId: 'p2', nickname: 'Bea', emoji: '✨', title: "L'Incantatore", description: 'z' },
            { playerId: 'p2', nickname: 'Bea', emoji: '⚔️', title: 'Il Duellante', description: 'w' },
          ],
        },
        leaderId: 'p1',
      });
    });
    expect(screen.getByText(/67%/)).toBeInTheDocument();
    expect(screen.getByText(/l'ha spuntata/i)).toBeInTheDocument(); // il micro-verdetto
    expect(screen.getByText(/il persuasore/i)).toBeInTheDocument();
    expect(screen.getByText('Ribaltone!')).toBeInTheDocument();
    emitSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /giocate ancora/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:rematch');
    emitSpy.mockRestore();
  });

  it('DUO_PORTRAIT declares the perfect tie instead of a winner', () => {
    render(<PlayerApp />);
    act(() => {
      duoJoin();
      serverEmit('game:state', {
        phase: 'DUO_PORTRAIT',
        mode: 'duello',
        dilemmaCount: 4,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        duoPortrait: {
          sintoniaPct: 100,
          agreements: 3,
          truePicks: 3,
          tiConosco: [],
          scores: [
            { id: 'p1', nickname: 'Alice', total: 4 },
            { id: 'p2', nickname: 'Bea', total: 4 },
          ],
          winnerId: null,
          momento: null,
          titoli: [],
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/pareggio/i)).toBeInTheDocument();
  });

  it('shows "Giocate ancora" to the leader at FINAL_AWARDS and emits leader:rematch', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        awards: [],
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /giocate ancora/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:rematch');
  });

  it('does not show "Giocate ancora" to a non-leader at FINAL_AWARDS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'FINAL_AWARDS',
        dilemmaCount: 3,
        dilemmaIndex: 3,
        phaseExpiresAt: null,
        awards: [],
        leaderId: 'p2',
      });
    });
    expect(screen.queryByRole('button', { name: /giocate ancora/i })).toBeNull();
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

  it('badges a Pubblico player in the lobby roster (3.1)', () => {
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
          { id: 'p2', nickname: 'Bea', role: 'pubblico' },
        ],
      });
    });
    expect(screen.getByText(/🎟️/)).toBeInTheDocument();
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

  it('shows who is missing instead of the counter at VOTE_1', () => {
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
        missingVoters: ['Marco', 'Giulia'],
        leaderId: null,
      });
    });
    expect(screen.getByText(/aspettiamo marco e giulia/i)).toBeInTheDocument();
    expect(screen.queryByText(/hanno votato/i)).toBeNull();
  });

  it('falls back to the counter at VOTE_1 when nobody is missing yet (list not sent)', () => {
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
        missingVoters: null,
        leaderId: null,
      });
    });
    expect(screen.getByText(/hanno votato 2\/3/i)).toBeInTheDocument();
  });

  it('shows who is missing instead of the counter at PREDICT', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        predictedCount: 1,
        missingPredictors: ['Marco'],
        leaderId: null,
      });
    });
    expect(screen.getByText(/aspettiamo marco/i)).toBeInTheDocument();
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

  it('hides the raise-hand affordance for a Pubblico member at DEFENSE (3.1)', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('lobby:update', {
        players: [{ id: 'p1', nickname: 'Alice', role: 'pubblico' }],
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
    expect(screen.queryByRole('button', { name: /alza la mano/i })).toBeNull();
    expect(screen.queryByText(/per intervenire dopo/i)).toBeNull();
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

  it('shows "coda piena" when the hand-raise queue is full (DEFENSE)', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p2', nickname: 'Bea', side: 'A' },
          speakerId: 'p2',
          turn: 1,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 3,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        leaderId: null,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /alza la mano/i }));
    act(() => {
      serverEmit('player:raiseHandError', { error: 'QUEUE_FULL' });
    });
    expect(screen.getByText(/coda piena/i)).toBeInTheDocument();
  });

  it('shows the applausometro for the just-finished speaker at the start of the next DEFENSE turn', () => {
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
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: {
          kind: 'defense',
          speaker: { id: 'p3', nickname: 'Carlo', side: 'B' },
          speakerId: 'p3',
          turn: 2,
          totalTurns: 2,
          argument: null,
          spunti: null,
          raisedCount: 0,
          queue: null,
          minEndsAt: null,
          canFinish: true,
          startedAt: null,
        },
        lastTurnApplause: { speakerId: 'p2', nickname: 'Bea', tally: { '👏': 8, '🔥': 5 } },
        leaderId: null,
      });
    });
    expect(screen.getByText(/bea/i)).toBeInTheDocument();
    expect(screen.getByText(/👏.*8/)).toBeInTheDocument();
    expect(screen.getByText(/🔥.*5/)).toBeInTheDocument();
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

  it('buzzes when the phase timer is in its last 5 seconds', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true });
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
        phaseExpiresAt: Date.now() + 5_000,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(vibrateSpy).toHaveBeenCalled();
  });

  it('does not buzz for the countdown when there is more than 5s left', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true });
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
        phaseExpiresAt: Date.now() + 30_000,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        leaderId: null,
      });
    });
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('shows a 3-2-1 suspense countdown in the first seconds of SPLIT_REVEAL, before the split', () => {
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
        phaseExpiresAt: Date.now() + 9_000, // just entered: 3s of suspense left
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        split: { A: 2, B: 1 },
        leaderId: null,
      });
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText(/ora si difende/i)).toBeNull();
  });

  it('cues the next step at SPLIT_REVEAL once the suspense countdown ends (status view)', () => {
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

  it('confirms the swing bet after you place it at PREDICT', () => {
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
        phase: 'PREDICT',
        dilemmaCount: 3,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        dilemma: { id: 'd1', text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        knowPairs: null,
        predictedCount: 0,
        leaderId: null,
      });
    });
    expect(screen.queryByText(/hai scommesso/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /REGGE/ }));
    expect(screen.getByText(/hai scommesso/i)).toBeInTheDocument();
  });

  it('submits both parts together at GROUP_MIND (4.1), only once both are chosen', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'GROUP_MIND',
        dilemmaCount: 5,
        dilemmaIndex: 2,
        phaseExpiresAt: null,
        groupMindQuestion: { id: 'gm01', prompt: 'Cosa sceglie la maggioranza?', optionA: 'Mare', optionB: 'Montagna' },
        groupMindProgress: { done: 0, total: 2, missingNicknames: ['Bea'] },
        leaderId: null,
      });
    });
    const answerGroup = screen.getByRole('group', { name: 'La tua risposta' });
    const guessGroup = screen.getByRole('group', { name: 'La tua previsione sulla maggioranza' });
    fireEvent.click(within(answerGroup).getByRole('button', { name: /Mare/ }));
    expect(emitSpy).not.toHaveBeenCalledWith('player:groupMind', expect.anything()); // only one part chosen so far
    fireEvent.click(within(guessGroup).getByRole('button', { name: /Montagna/ }));
    expect(emitSpy).toHaveBeenCalledWith('player:groupMind', { answer: 'A', guess: 'B' });
  });

  it('reveals the tally + a private correct/wrong result at GROUP_MIND_REVEAL', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'GROUP_MIND_REVEAL',
        dilemmaCount: 5,
        dilemmaIndex: 2,
        phaseExpiresAt: null,
        groupMindQuestion: { id: 'gm01', prompt: 'Cosa sceglie la maggioranza?', optionA: 'Mare', optionB: 'Montagna' },
        groupMindTally: { A: 2, B: 1, correctGuessers: 2 },
        leaderId: null,
      });
    });
    act(() => {
      // Separate act(): the dilemmaIndex-keyed reset effect runs in the same
      // batch as the initial game:state (dilemmaIndex undefined -> 2) and would
      // otherwise clobber this private result if emitted alongside it.
      serverEmit('player:groupMindResult', { correct: true, guess: 'A', actual: 'A' });
    });
    expect(screen.getByText(/cosa sceglie la maggioranza/i)).toBeInTheDocument();
    expect(screen.getByText(/2 hanno letto bene il gruppo/i)).toBeInTheDocument();
    expect(screen.getByText(/hai letto bene il gruppo/i)).toBeInTheDocument();
  });

  it('submits a written answer at WRITE (4.2)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'WRITE',
        dilemmaCount: 5,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        writePrompt: { id: 'wp01', text: 'La tua filosofia di vita in uno slogan da maglietta.' },
        writeProgress: { done: 0, total: 2, missingNicknames: ['Bea'] },
        leaderId: null,
      });
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'La tua risposta' }), { target: { value: 'Vivi e lascia vivere' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));
    expect(emitSpy).toHaveBeenCalledWith('player:write', { text: 'Vivi e lascia vivere' });
  });

  it('votes for an answer at WRITE_VOTE, excluding its own entry (4.2)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'WRITE_VOTE',
        dilemmaCount: 5,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        writePrompt: { id: 'wp01', text: 'La tua filosofia di vita in uno slogan da maglietta.' },
        writtenAnswers: [
          { id: 'p1', text: 'La mia risposta' },
          { id: 'p2', text: 'La risposta di Bea' },
        ],
        writeVoteProgress: { done: 0, total: 2, missingNicknames: ['Bea'] },
        leaderId: null,
      });
    });
    expect(screen.queryByText('La mia risposta')).toBeNull(); // own entry filtered out
    fireEvent.click(screen.getByRole('button', { name: 'La risposta di Bea' }));
    expect(emitSpy).toHaveBeenCalledWith('player:writeVote', { votedForId: 'p2' });
  });

  it('reveals each answer with its author + vote count at WRITE_REVEAL', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'WRITE_REVEAL',
        dilemmaCount: 5,
        dilemmaIndex: 4,
        phaseExpiresAt: null,
        writePrompt: { id: 'wp01', text: 'La tua filosofia di vita in uno slogan da maglietta.' },
        writeReveal: [
          { id: 'p1', text: 'La mia risposta', authorNickname: 'Alice', votes: 1 },
          { id: 'p2', text: 'La risposta di Bea', authorNickname: 'Bea', votes: 2 },
        ],
        leaderId: null,
      });
    });
    expect(screen.getByText(/la risposta di bea/i)).toBeInTheDocument();
    expect(screen.getByText(/Bea · 2 voti/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice · 1 voto/i)).toBeInTheDocument();
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

  it('asks "chi ti ha strappato l\'applauso" instead of a verdict at SPEAKER_VOTE', () => {
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
          { id: 'p2', side: 'A', nickname: 'Bea' },
          { id: 'p3', side: 'B', nickname: 'Carlo' },
        ],
        speakerVotedCount: 0,
        leaderId: null,
      });
    });
    expect(screen.getByText(/chi ti ha strappato l'applauso/i)).toBeInTheDocument();
  });

  it('auto-submits the speaker vote when only one target is possible (no forced tap)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        speakerCandidates: [{ id: 'p2', side: 'A', nickname: 'Bea' }],
        speakerVotedCount: 0,
        leaderId: null,
      });
    });
    expect(emitSpy).toHaveBeenCalledWith('player:voteSpeaker', { defenderId: 'p2' });
  });

  it('reveals the dilemma author at PHASE_RESULTS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemmaAuthor: 'Sara',
        leaderId: null,
      });
    });
    expect(screen.getByText(/sara/i)).toBeInTheDocument();
  });

  it('does not reveal an author at PHASE_RESULTS for a deck dilemma', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        dilemmaAuthor: null,
        leaderId: null,
      });
    });
    expect(screen.queryByText(/indovinate chi l'ha scritto/i)).toBeNull();
  });

  it('names the ribaltone hero at PHASE_RESULTS when the lead flips', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        swing: {
          first: { A: 1, B: 2 },
          second: { A: 2, B: 1 },
          switched: 1,
          netSwing: { A: 1, B: -1 },
          leadFlipped: true,
          attribution: [{ defender: { id: 'p2', nickname: 'Marco', side: 'A' }, votes: 1 }],
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/il ribaltone di marco/i)).toBeInTheDocument();
  });

  it('names the ribaltone hero at PHASE_RESULTS when 2+ voters switch, even without a lead flip', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        swing: {
          first: { A: 3, B: 2 },
          second: { A: 5, B: 0 },
          switched: 2,
          netSwing: { A: 2, B: -2 },
          leadFlipped: false,
          attribution: [{ defender: { id: 'p2', nickname: 'Giulia', side: 'A' }, votes: 2 }],
        },
        leaderId: null,
      });
    });
    expect(screen.getByText(/il ribaltone di giulia/i)).toBeInTheDocument();
  });

  it('does not name a ribaltone hero for a single switch that does not flip the lead', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        swing: {
          first: { A: 3, B: 2 },
          second: { A: 4, B: 1 },
          switched: 1,
          netSwing: { A: 1, B: -1 },
          leadFlipped: false,
          attribution: [{ defender: { id: 'p2', nickname: 'Luca', side: 'A' }, votes: 1 }],
        },
        leaderId: null,
      });
    });
    expect(screen.queryByText(/il ribaltone/i)).toBeNull();
  });

  it('gives a wrong prediction an ironic title instead of a flat X', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      // A separate act() lets the "new dilemmaIndex -> clear predictionResult"
      // effect settle BEFORE the private result event below, mirroring the
      // real server (the private emit only fires once results are already in).
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    act(() => {
      serverEmit('player:predictionResult', { correct: false, predicted: 'A', actual: 'B' });
    });
    const matched = WRONG_PREDICTION_TITLES.some((t) => screen.queryByText(t) != null);
    expect(matched).toBe(true);
    expect(screen.queryByText('❌ Stavolta non ci hai preso.')).toBeNull();
  });

  it('gives a wrong swing bet an ironic title instead of a flat loss message', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    act(() => {
      serverEmit('player:swingBetResult', { correct: false, bet: 'ribalta', flipped: false });
    });
    const matched = WRONG_SWING_BET_TITLES.some((t) => screen.queryByText(t) != null);
    expect(matched).toBe(true);
  });

  it('gives a wrong "quanto mi conosci" guess an ironic title', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    act(() => {
      serverEmit('player:knowGuessResult', { correct: false, guess: 'A', actual: 'B', targetId: 'p2' });
    });
    const matched = WRONG_KNOW_TITLES.some((t) => screen.queryByText(t) != null);
    expect(matched).toBe(true);
  });

  it('keeps the plain success message for a correct prediction', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: null,
      });
    });
    act(() => {
      serverEmit('player:predictionResult', { correct: true, predicted: 'A', actual: 'A' });
    });
    expect(screen.getByText('✅ Pronostico azzeccato!')).toBeInTheDocument();
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

  it('hides an in-game exit behind the ⋮ menu with a two-tap confirm', () => {
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
    // In-game the exit is hidden until you deliberately open the menu.
    expect(screen.queryByRole('button', { name: /esci dalla partita/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /menu della partita/i }));
    // One tap on the exit only arms it — it must NOT leave the game.
    fireEvent.click(screen.getByRole('button', { name: /^esci dalla partita$/i }));
    expect(screen.getByText('Mare')).toBeInTheDocument();
    // Confirming actually leaves, back to the join form.
    fireEvent.click(screen.getByRole('button', { name: /esci davvero/i }));
    expect(screen.getByText(/entra nella partita/i)).toBeInTheDocument();
  });

  it('the in-game ⋮ menu can be dismissed without leaving', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /menu della partita/i }));
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));
    // Menu closed, exit hidden again, still in the game.
    expect(screen.queryByRole('button', { name: /esci dalla partita/i })).toBeNull();
    expect(screen.getByText('Mare')).toBeInTheDocument();
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

  it('lets the leader pick a mood + delicate-theme opt-in and sends both when starting', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /leggera/i }));
    fireEvent.click(screen.getByText(/altre opzioni/i));
    fireEvent.click(screen.getByRole('button', { name: /temi delicati/i }));
    fireEvent.click(screen.getByRole('button', { name: /avvia partita/i }));
    expect(emitSpy).toHaveBeenCalledWith(
      'leader:startGame',
      expect.objectContaining({ mood: 'leggera', delicatoOptIn: true }),
    );
  });

  it('lets the leader opt into "serata lunga" (3.3) and sends it when starting', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByText(/altre opzioni/i));
    fireEvent.click(screen.getByRole('button', { name: /serata lunga/i }));
    fireEvent.click(screen.getByRole('button', { name: /avvia partita/i }));
    expect(emitSpy).toHaveBeenCalledWith(
      'leader:startGame',
      expect.objectContaining({ serataLunga: true }),
    );
  });

  it('lets the leader pick a caos level (4.3) and sends it when starting', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /alto.*twist quasi ogni round/i }));
    fireEvent.click(screen.getByRole('button', { name: /avvia partita/i }));
    expect(emitSpy).toHaveBeenCalledWith(
      'leader:startGame',
      expect.objectContaining({ caos: 'alto' }),
    );
  });

  it('offers Duello as a first-level "Tipo di partita" pill, no 2-human hint needed (4.4)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    const tipoGroup = screen.getByRole('group', { name: 'Tipo di partita' });
    fireEvent.click(within(tipoGroup).getByRole('button', { name: /1v1 duello/i }));
    fireEvent.click(screen.getByRole('button', { name: /avvia partita/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:startGame', expect.objectContaining({ mode: 'duello' }));
  });

  it('warns that Percorso/Storie discard the group\'s written dilemmas (4.4)', () => {
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
        submittedCount: 2,
      });
    });
    expect(screen.queryByText(/non usa i 2 dilemmi/i)).toBeNull(); // Gruppo plays them: no warning
    const tipoGroup = screen.getByRole('group', { name: 'Tipo di partita' });
    fireEvent.click(within(tipoGroup).getByRole('button', { name: /percorso/i }));
    expect(screen.getByText(/percorso non usa i 2 dilemmi/i)).toBeInTheDocument();
  });

  it('shows the real story genres on the Storie pill, not a generic placeholder (4.4)', () => {
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
        storieCatalog: [
          { id: 's1', title: 'Storia A', genre: 'giallo', emoji: '🕵️', hook: 'h', durataStimaMin: 30, scene: 4 },
          { id: 's2', title: 'Storia B', genre: 'dramma', emoji: '🎭', hook: 'h', durataStimaMin: 30, scene: 4 },
        ],
      });
    });
    expect(screen.getByText('Mistero · Dramma umano')).toBeInTheDocument();
    expect(screen.queryByText(/racconti sci-fi/i)).toBeNull();
  });

  it('offers the "2 umani + 2 bot" preset with exactly 2 humans and adds two bots', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        phase: 'LOBBY',
        dilemmaCount: 0,
        dilemmaIndex: 0,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /preset: 2 umani \+ 2 bot/i }));
    const addBotCalls = emitSpy.mock.calls.filter(([event]) => event === 'leader:addBot');
    expect(addBotCalls).toHaveLength(2);
  });

  it('lets the leader add a bot mid-game at PHASE_RESULTS via the ⋮ menu (3.5)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    fireEvent.click(screen.getByRole('button', { name: /aggiungi bot/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:addBot');
  });

  it('does not offer "aggiungi bot" in the ⋮ menu to a non-leader at PHASE_RESULTS', () => {
    render(<PlayerApp />);
    act(() => {
      serverEmit('player:joined', {
        code: 'ABCD',
        token: 'tok',
        player: { id: 'p1', nickname: 'Alice' },
      });
      serverEmit('game:state', {
        phase: 'PHASE_RESULTS',
        dilemmaCount: 3,
        dilemmaIndex: 1,
        phaseExpiresAt: null,
        leaderId: 'p2',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu della partita' }));
    expect(screen.queryByRole('button', { name: /aggiungi bot/i })).toBeNull();
  });

  it('requires a second tap of "Salta" during a secret-vote phase (VOTE_1)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        votedCount: 0,
        leaderId: 'p1', // I'm the leader
      });
    });
    const skip = screen.getByRole('button', { name: /salta/i });
    fireEvent.click(skip);
    expect(emitSpy).not.toHaveBeenCalledWith('leader:advancePhase');
    fireEvent.click(screen.getByRole('button', { name: /salta/i })); // 2nd tap, now confirming
    expect(emitSpy).toHaveBeenCalledWith('leader:advancePhase');
  });

  it('advances on a single tap of "Salta" during a speaking-turn phase (DEFENSE)', () => {
    const emitSpy = vi.spyOn(fakeSocket, 'emit');
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
        dilemmaIndex: 1,
        phaseExpiresAt: 9_999_999_999_999,
        dilemma: { text: 'Mare o montagna?', optionA: 'Mare', optionB: 'Montagna' },
        defense: null,
        leaderId: 'p1',
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /salta/i }));
    expect(emitSpy).toHaveBeenCalledWith('leader:advancePhase');
  });
});
