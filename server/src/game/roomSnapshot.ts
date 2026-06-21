// Server-side serialization of a live Room for crash-recovery snapshots. Uses a
// generic JSON replacer/reviver so it is field-agnostic: any Map on the Room
// (current or future) round-trips automatically; only the Deck class instance
// needs a named case. NEVER sent to clients — secret votes stay server-side.
import { Deck } from './deck';
import type { Room } from './rooms';

interface TaggedMap {
  __t: 'Map';
  e: [unknown, unknown][];
}
interface TaggedDeck {
  __t: 'Deck';
  cards: Deck['cards'];
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __t: 'Map', e: [...value.entries()] } satisfies TaggedMap;
  if (value instanceof Deck) return { __t: 'Deck', cards: value.cards } satisfies TaggedDeck;
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__t' in value) {
    const tag = value as { __t: string };
    if (tag.__t === 'Map') return new Map((value as TaggedMap).e);
    if (tag.__t === 'Deck') return new Deck((value as TaggedDeck).cards);
  }
  return value;
}

/** Serialize a Room to a JSON string (Maps + Deck preserved). */
export function serializeRoom(room: Room): string {
  return JSON.stringify(room, replacer);
}

/** Reconstruct a Room from a snapshot JSON string (real Maps + Deck restored). */
export function deserializeRoom(json: string): Room {
  return JSON.parse(json, reviver) as Room;
}
