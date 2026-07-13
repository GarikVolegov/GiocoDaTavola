import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { io as ioc, type Socket } from 'socket.io-client';
import { httpServer } from '../index';

// End-to-end test of the socket orchestration in index.ts (otherwise untested):
// a real server on an ephemeral port + real socket.io-client phones. Asserts the
// core "secret votes" invariant — only aggregates ever leave the server — and the
// token reconnection path.

interface JoinedPayload {
  code: string;
  token: string;
  player: { id: string; nickname: string };
}
interface GameState {
  phase: string;
  split: { A: number; B: number } | null;
  votedCount: number;
  leaderId: string | null;
  paused: boolean;
}

let port: number;
const clients: Socket[] = [];

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  for (const c of clients) c.disconnect();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

function connect(): Promise<Socket> {
  return new Promise((resolve) => {
    const s = ioc(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
    clients.push(s);
    s.on('connect', () => resolve(s));
  });
}

function once<T>(sock: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve) => {
    sock.once(event, (payload: T) => resolve(payload));
  });
}

function waitForPhase(sock: Socket, phase: string): Promise<GameState> {
  return new Promise<GameState>((resolve) => {
    const handler = (s: GameState) => {
      if (s.phase === phase) {
        sock.off('game:state', handler);
        resolve(s);
      }
    };
    sock.on('game:state', handler);
  });
}

describe('socket integration', () => {
  it('keeps votes secret: split hidden during VOTE_1, only aggregate at SPLIT_REVEAL', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Leader' });
    const leaderJoined = await leaderJoinedP;
    const code = leaderJoined.code;

    const p2 = await connect();
    const p2JoinedP = once<JoinedPayload>(p2, 'player:joined');
    p2.emit('player:join', { code, nickname: 'P2' });
    await p2JoinedP;

    const p3 = await connect();
    const p3JoinedP = once<JoinedPayload>(p3, 'player:joined');
    p3.emit('player:join', { code, nickname: 'P3' });
    await p3JoinedP;

    // start -> PHASE_INTRO
    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'gruppo' });
    await introP;

    // PHASE_INTRO -> DILEMMA_REVEAL -> VOTE_1 (force-advance the timed phases)
    const revealP = waitForPhase(leader, 'DILEMMA_REVEAL');
    leader.emit('leader:advancePhase');
    await revealP;

    const voteP = waitForPhase(leader, 'VOTE_1');
    leader.emit('leader:advancePhase');
    const voteState = await voteP;
    expect(voteState.split).toBeNull(); // secret during the vote
    expect(voteState.votedCount).toBe(0);

    // Everyone votes; VOTE_1 auto-advances to SPLIT_REVEAL once all present voted.
    const splitP = waitForPhase(leader, 'SPLIT_REVEAL');
    leader.emit('player:vote', { choice: 'A' });
    p2.emit('player:vote', { choice: 'B' });
    p3.emit('player:vote', { choice: 'A' });
    const splitState = await splitP;

    // Only the aggregate A/B counts are revealed — never who voted what.
    expect(splitState.split).toEqual({ A: 2, B: 1 });
    expect((splitState as Record<string, unknown>).votes).toBeUndefined();
  }, 15000);

  it('duello Atto I over sockets: duoSync early-advances into the sync reveal', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Ann' });
    const { code } = await leaderJoinedP;

    const bob = await connect();
    const bobJoinedP = once<JoinedPayload>(bob, 'player:joined');
    bob.emit('player:join', { code, nickname: 'Bob' });
    await bobJoinedP;

    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'duello' });
    await introP;

    // Skip the timed intro cards: PHASE_INTRO -> DUO_ACT_INTRO -> DUO_PICK_PREDICT.
    const actIntroP = waitForPhase(leader, 'DUO_ACT_INTRO');
    leader.emit('leader:advancePhase');
    await actIntroP;
    const pickP = waitForPhase(leader, 'DUO_PICK_PREDICT');
    leader.emit('leader:advancePhase');
    const pickState = (await pickP) as GameState & { duoSyncReveal: unknown };
    expect(pickState.duoSyncReveal).toBeNull(); // secret until the reveal

    // Both submit pick+prediction -> the phase early-advances to the reveal.
    const revealP = waitForPhase(leader, 'DUO_SYNC_REVEAL');
    const syncedP = once<{ own: string; predict: string }>(leader, 'player:duoSynced');
    leader.emit('player:duoSync', { own: 'A', predict: 'B' });
    const synced = await syncedP;
    expect(synced).toEqual({ own: 'A', predict: 'B' });
    bob.emit('player:duoSync', { own: 'B', predict: 'B' });
    const revealState = (await revealP) as GameState & {
      duoSyncReveal: { agreed: boolean; picks: unknown[]; predictions: unknown[] } | null;
    };
    expect(revealState.duoSyncReveal?.agreed).toBe(false);
    expect(revealState.duoSyncReveal?.picks).toHaveLength(2);
  }, 15000);

  it('reclaims the same seat on reconnect with the saved token', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Boss' });
    const { code } = await leaderJoinedP;

    const phone = await connect();
    const firstJoinP = once<JoinedPayload>(phone, 'player:joined');
    phone.emit('player:join', { code, nickname: 'Alice' });
    const firstJoin = await firstJoinP;

    // The phone drops, then a fresh socket reconnects with the saved token.
    phone.disconnect();
    const phone2 = await connect();
    const secondJoinP = once<JoinedPayload>(phone2, 'player:joined');
    phone2.emit('player:join', { code, nickname: 'Alice', token: firstJoin.token });
    const secondJoin = await secondJoinP;

    expect(secondJoin.player.id).toBe(firstJoin.player.id); // same seat reclaimed
  }, 15000);

  it('reports health with DB status (disabled when DB-less)', async () => {
    const res = await fetch(`http://localhost:${port}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; db: string };
    expect(body.ok).toBe(true);
    expect(body.db).toBe('disabled'); // no DATABASE_URL in tests
  });

  it('rejects profile reads/writes without a valid bearer token', async () => {
    const get = await fetch(`http://localhost:${port}/api/me/profile`);
    expect(get.status).toBe(401);

    const put = await fetch(`http://localhost:${port}/api/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Ann', avatar: null }),
    });
    expect(put.status).toBe(401);
  });
});

describe('scarta dilemma + voto unanime (socket)', () => {
  interface RichState extends GameState {
    dilemma: { id: string } | null;
    unanimous: { side: 'A' | 'B'; count: number } | null;
  }

  async function threeInRoom() {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Capo' });
    const { code } = await leaderJoinedP;
    const p2 = await connect();
    const p2JoinedP = once<JoinedPayload>(p2, 'player:joined');
    p2.emit('player:join', { code, nickname: 'Due' });
    await p2JoinedP;
    const p3 = await connect();
    const p3JoinedP = once<JoinedPayload>(p3, 'player:joined');
    p3.emit('player:join', { code, nickname: 'Tre' });
    await p3JoinedP;
    return { leader, p2, p3, code };
  }

  it("leader:skipDilemma rimpiazza il dilemma e notifica tutti con room:dilemmaSkipped", async () => {
    const { leader, p2 } = await threeInRoom();
    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'gruppo' });
    await introP;
    const revealP = waitForPhase(leader, 'DILEMMA_REVEAL');
    leader.emit('leader:advancePhase');
    const firstReveal = (await revealP) as RichState;
    const firstId = firstReveal.dilemma?.id;
    expect(firstId).toBeTruthy();

    const skippedP = once(p2, 'room:dilemmaSkipped'); // arriva anche ai non-leader
    const secondRevealP = new Promise<RichState>((resolve) => {
      const handler = (s: RichState) => {
        if (s.phase === 'DILEMMA_REVEAL' && s.dilemma && s.dilemma.id !== firstId) {
          leader.off('game:state', handler);
          resolve(s);
        }
      };
      leader.on('game:state', handler);
    });
    leader.emit('leader:skipDilemma');
    await skippedP;
    const secondReveal = await secondRevealP;
    expect(secondReveal.dilemma!.id).not.toBe(firstId);
  }, 15000);

  it('un VOTE_1 unanime porta a UNANIMOUS_REVEAL con il solo aggregato (side+count)', async () => {
    const { leader, p2, p3 } = await threeInRoom();
    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'gruppo' });
    await introP;
    const revealP = waitForPhase(leader, 'DILEMMA_REVEAL');
    leader.emit('leader:advancePhase');
    await revealP;
    const voteP = waitForPhase(leader, 'VOTE_1');
    leader.emit('leader:advancePhase');
    await voteP;

    const unanimousP = waitForPhase(p2, 'UNANIMOUS_REVEAL');
    leader.emit('player:vote', { choice: 'B' });
    p2.emit('player:vote', { choice: 'B' });
    p3.emit('player:vote', { choice: 'B' });
    const state = (await unanimousP) as RichState;
    expect(state.unanimous).toEqual({ side: 'B', count: 3 });
    expect((state as Record<string, unknown>).votes).toBeUndefined(); // mai identità
  }, 15000);
});

interface Roster {
  players: { id: string; connected?: boolean }[];
}

// Waits for a specific roster CONDITION rather than the next raw event — the
// join and the disconnect each trigger their own lobby:update, and which one
// a bare `.once` catches first is a race. Mirrors `waitForPhase` above.
function waitForRoster(sock: Socket, predicate: (r: Roster) => boolean): Promise<Roster> {
  return new Promise((resolve) => {
    const handler = (r: Roster) => {
      if (predicate(r)) {
        sock.off('lobby:update', handler);
        resolve(r);
      }
    };
    sock.on('lobby:update', handler);
  });
}

describe('rimozione manuale di un giocatore offline (socket)', () => {
  it('leader:removePlayer frees an offline seat for a new join', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Boss' });
    const { code } = await leaderJoinedP;

    const phone = await connect();
    const joinedP = once<JoinedPayload>(phone, 'player:joined');
    phone.emit('player:join', { code, nickname: 'Alice' });
    const { player } = await joinedP;

    // Alice's phone drops — she's now offline (well before the 5-minute grace).
    const offlineRosterP = waitForRoster(
      leader,
      (r) => r.players.find((p) => p.id === player.id)?.connected === false,
    );
    phone.disconnect();
    await offlineRosterP;

    // Leader manually frees her seat instead of waiting.
    const removedRosterP = waitForRoster(leader, (r) => !r.players.find((p) => p.id === player.id));
    leader.emit('leader:removePlayer', { id: player.id });
    await removedRosterP;
  }, 15000);
});

describe('pausa e ripresa del gioco (socket)', () => {
  it('leader:pauseGame blocks phase advancement until leader:resumeGame', async () => {
    const leader = await connect();
    const leaderJoinedP = once<JoinedPayload>(leader, 'player:joined');
    leader.emit('player:createRoom', { nickname: 'Boss' });
    const { code } = await leaderJoinedP;

    const p2 = await connect();
    const p2JoinedP = once<JoinedPayload>(p2, 'player:joined');
    p2.emit('player:join', { code, nickname: 'P2' });
    await p2JoinedP;

    const p3 = await connect();
    const p3JoinedP = once<JoinedPayload>(p3, 'player:joined');
    p3.emit('player:join', { code, nickname: 'P3' });
    await p3JoinedP;

    const introP = waitForPhase(leader, 'PHASE_INTRO');
    leader.emit('leader:startGame', { dilemmaCount: 3, register: 'misto', mode: 'gruppo' });
    await introP;

    const revealP = waitForPhase(leader, 'DILEMMA_REVEAL');
    leader.emit('leader:advancePhase');
    await revealP;

    const voteP = waitForPhase(leader, 'VOTE_1');
    leader.emit('leader:advancePhase');
    await voteP;

    // Pause.
    const pausedP = new Promise<GameState>((resolve) => {
      const h = (s: GameState) => {
        if (s.paused) {
          leader.off('game:state', h);
          resolve(s);
        }
      };
      leader.on('game:state', h);
    });
    leader.emit('leader:pauseGame');
    const pausedState = await pausedP;
    expect(pausedState.phase).toBe('VOTE_1');

    // Force-advance is normally instant; while paused it must have no effect.
    // The emit happens INSIDE the executor, after the listener is armed —
    // emitting after awaiting the promise would race the server's reply.
    const stalled = await new Promise<boolean>((resolve) => {
      const h = (s: GameState) => {
        if (s.phase === 'SPLIT_REVEAL') {
          leader.off('game:state', h);
          clearTimeout(timer);
          resolve(false); // it DID advance — the guard failed
        }
      };
      leader.on('game:state', h);
      const timer = setTimeout(() => {
        leader.off('game:state', h);
        resolve(true); // no advance within the window — the guard held
      }, 500);
      leader.emit('leader:advancePhase');
    });
    expect(stalled).toBe(true);

    // Resume, then the SAME force-advance works again.
    const resumedP = new Promise<GameState>((resolve) => {
      const h = (s: GameState) => {
        if (!s.paused) {
          leader.off('game:state', h);
          resolve(s);
        }
      };
      leader.on('game:state', h);
    });
    leader.emit('leader:resumeGame');
    await resumedP;

    const splitP = waitForPhase(leader, 'SPLIT_REVEAL');
    leader.emit('leader:advancePhase');
    await splitP; // resolves once SPLIT_REVEAL actually arrives
  }, 15000);
});
