import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode, type BotPersona } from '../rooms';
import { castBotFirstVotes, applyBotSecondVotes } from '../botVotes';

// A room with two humans + one bot of the given persona, for testing the bot vote
// helpers in isolation with a deterministic rng.
function roomWithBot(persona: BotPersona) {
  const store = new RoomStore(generateRoomCode, () => 0, undefined, () => 0);
  const { code } = store.create();
  store.join(code, 'h1', 'H1');
  store.join(code, 'h2', 'H2');
  const room = store.get(code)!;
  room.players.set('b1', { id: 'b1', nickname: 'Bot', isBot: true, persona });
  return room;
}

describe('botVotes', () => {
  it('castBotFirstVotes gives every bot a vote', () => {
    const room = roomWithBot('roccione');
    castBotFirstVotes(room, () => 0); // rng 0 -> 'A'
    expect(room.votes.get('b1')).toBe('A');
  });

  it('roccione never changes its second vote', () => {
    const room = roomWithBot('roccione');
    room.votes1.set('h1', 'A');
    room.votes1.set('h2', 'A'); // majority A
    room.votes.set('b1', 'B');
    applyBotSecondVotes(room, () => 0);
    expect(room.votes.get('b1')).toBe('B');
  });

  it('gregge drifts from the minority to the majority', () => {
    const room = roomWithBot('gregge');
    room.votes1.set('h1', 'A');
    room.votes1.set('h2', 'A'); // majority A, minority B
    room.votes.set('b1', 'B'); // bot is in the minority
    applyBotSecondVotes(room, () => 0);
    expect(room.votes.get('b1')).toBe('A');
  });

  it('bastian drifts from the majority to the minority', () => {
    const room = roomWithBot('bastian');
    room.votes1.set('h1', 'A');
    room.votes1.set('h2', 'A'); // majority A, minority B
    room.votes.set('b1', 'A'); // bot is in the majority
    applyBotSecondVotes(room, () => 0);
    expect(room.votes.get('b1')).toBe('B');
  });
});
