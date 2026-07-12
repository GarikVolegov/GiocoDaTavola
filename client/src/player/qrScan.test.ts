import { describe, it, expect } from 'vitest';
import { parseRoomFromQr } from './qrScan';

describe('parseRoomFromQr', () => {
  it('extracts the room code from a join URL (?room=CODE), uppercased', () => {
    expect(parseRoomFromQr('https://schierati.app/join?room=WXYZ')).toBe('WXYZ');
    expect(parseRoomFromQr('http://localhost:5173/join?room=abcd')).toBe('ABCD');
  });

  it('also accepts a legacy ?code= param', () => {
    expect(parseRoomFromQr('https://schierati.app/join?code=abcd')).toBe('ABCD');
  });

  it('accepts a bare code, trimmed and uppercased', () => {
    expect(parseRoomFromQr('abcd')).toBe('ABCD');
    expect(parseRoomFromQr('  WxYz ')).toBe('WXYZ');
  });

  it('returns null for a URL without a room, and for junk', () => {
    expect(parseRoomFromQr('https://example.com/other')).toBeNull();
    expect(parseRoomFromQr('not a code at all')).toBeNull();
    expect(parseRoomFromQr('')).toBeNull();
  });
});
