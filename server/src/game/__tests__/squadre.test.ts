import { describe, it, expect } from 'vitest';
import { RoomStore, generateRoomCode } from '../rooms';
import { type PlayerStats } from '../awards';
import { Deck, type Dilemma, type ContentRegister } from '../deck';

const DILEMMA_FIXTURE: Dilemma[] = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i + 1}`,
  text: `Dilemma ${i + 1}?`,
  optionA: `A${i + 1}`,
  optionB: `B${i + 1}`,
  register: 'vita' as const,
  spuntiA: [],
  spuntiB: [],
}));
const makeFixtureDeck = (_register: ContentRegister) => new Deck(DILEMMA_FIXTURE, () => 0);
const makeStore = (rng: () => number) =>
  new RoomStore(generateRoomCode, () => 0, makeFixtureDeck, rng);

function baseStats(over: Partial<PlayerStats> = {}): PlayerStats {
  return {
    rounds: 1, changedCount: 0, majorityCount: 0, minorityCount: 0,
    persuasion: 0, defendedCount: 0, ...over,
  };
}

describe('Squadre', () => {
  it('splits players into two alternating teams', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, true);
    const teams = store.get(code)!.teams;
    expect(teams.get('sock-0')).toBe('blu');
    expect(teams.get('sock-1')).toBe('arancio');
    expect(teams.get('sock-2')).toBe('blu');
    expect(teams.get('sock-3')).toBe('arancio');
  });

  it('rejects Squadre with fewer than 4 players', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 3; i++) store.join(code, `p${i}`, `P${i}`);
    expect(store.startGame(code, 3, 'misto', 'gruppo', false, true)).toEqual({
      ok: false,
      error: 'SQUADRE_NEEDS_PLAYERS',
    });
  });

  it('leaves teams empty when not enabled', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3);
    expect(store.get(code)?.teams.size).toBe(0);
    expect(store.publicTeams(code)).toBeNull();
  });

  it('scores teams by the sum of members\' persuasion', () => {
    const store = makeStore(() => 0);
    const { code } = store.create();
    for (let i = 0; i < 4; i++) store.join(code, `sock-${i}`, `P${i}`);
    store.startGame(code, 3, 'misto', 'gruppo', false, true);
    const room = store.get(code)!;
    room.stats.set('sock-0', baseStats({ persuasion: 3 })); // blu
    room.stats.set('sock-1', baseStats({ persuasion: 1 })); // arancio
    room.stats.set('sock-2', baseStats({ persuasion: 2 })); // blu
    const t = store.publicTeams(code)!;
    expect(t.scores).toEqual({ blu: 5, arancio: 1 });
    expect(t.assignments).toHaveLength(4);
  });
});
