import { describe, it, expect } from 'vitest';
import { pickMusicThemeForGame, pickMusicThemeForPass } from './thematicMusic';
import type { GameStatePayload } from '../../shared/events';

function makeGame(overrides: Partial<GameStatePayload> = {}): GameStatePayload {
  return {
    code: 'ABCD',
    phase: 'LOBBY',
    round: 0,
    totalRounds: 5,
    mode: 'gruppo',
    partyMode: null,
    dilemma: null,
    ...overrides,
  } as GameStatePayload;
}

describe('thematicMusic', () => {
  it('picks lobby in LOBBY and party in FINAL_AWARDS', () => {
    expect(pickMusicThemeForGame(null)).toBe('lobby');
    expect(pickMusicThemeForGame(makeGame({ phase: 'LOBBY' }))).toBe('lobby');
    expect(pickMusicThemeForGame(makeGame({ phase: 'FINAL_AWARDS' }))).toBe('party');
  });

  it('adapts to partyMode (infiltrato -> sneaky, coppie -> chill, flash -> party)', () => {
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'infiltrato' }))).toBe('sneaky');
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'coppie' }))).toBe('chill');
    expect(pickMusicThemeForGame(makeGame({ phase: 'VOTE_1', partyMode: 'flash' }))).toBe('party');
  });

  it('adapts to dilemma complexity', () => {
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd1', text: 'x', optionA: 'a', optionB: 'b', complessita: 'power' },
        }),
      ),
    ).toBe('tension');
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd2', text: 'x', optionA: 'a', optionB: 'b', complessita: 'sorbetto' },
        }),
      ),
    ).toBe('party');
    expect(
      pickMusicThemeForGame(
        makeGame({
          phase: 'VOTE_1',
          dilemma: { id: 'd3', text: 'x', optionA: 'a', optionB: 'b', complessita: 'alto' },
        }),
      ),
    ).toBe('chill');
  });

  it('picks Pass & Play themes by mode and phase', () => {
    expect(pickMusicThemeForPass('infiltrato', 'c1', 'CARD_INTRO')).toBe('sneaky');
    expect(pickMusicThemeForPass('coppie', 'c1', 'CARD_INTRO')).toBe('chill');
    expect(pickMusicThemeForPass('flash', 'c1', 'DEBATE')).toBe('tension');
    expect(pickMusicThemeForPass('flash', 'c1', 'CARD_INTRO')).toBe('party');
  });
});
