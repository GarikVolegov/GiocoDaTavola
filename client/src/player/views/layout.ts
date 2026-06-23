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
