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
});
