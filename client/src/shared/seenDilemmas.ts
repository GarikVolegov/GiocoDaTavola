// "Memoria del già-visto" (5.1): the leader's OWN device remembers which
// dilemma ids it has already played, across separate games (not just a
// same-room rematch), so a recurring group avoids déjà-vu even when they
// spin up a fresh room each time. Sent fresh on every leader:startGame;
// the server merges it with the room's own rematch exclusion and falls
// back gracefully if it would ever empty the pool. Best-effort: silently
// no-ops if localStorage is unavailable (private mode).

const KEY = 'schierati:seenDilemmas';
/** Cap so the payload (and localStorage entry) never grows unbounded. */
const MAX_ENTRIES = 500;

export function getSeenDilemmaIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Record newly-seen dilemma ids, de-duplicated, keeping only the most recent MAX_ENTRIES. */
export function addSeenDilemmaIds(ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const existing = getSeenDilemmaIds();
    const merged = [...existing.filter((id) => !ids.includes(id)), ...ids];
    const trimmed = merged.slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable (private mode) — memory just won't persist */
  }
}
