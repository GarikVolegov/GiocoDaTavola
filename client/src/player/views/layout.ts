import type { CSSProperties } from 'react';

// Shared full-screen centered container used by every phone phase view.
export const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100dvh',
  textAlign: 'center',
  padding: 'var(--space-5)',
  gap: '1rem',
};

/** "Marco" / "Marco e Giulia" / "Marco, Giulia e Luca" — a short, friendly
 * waiting-on list; never used for more than a handful of names (MAX_PLAYERS
 * is 8), so no truncation logic is needed yet. */
export function formatWaitingList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
