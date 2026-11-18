import { useState } from 'react';
import { isMuted, setMuted } from './audio/engine';
import styles from './MuteButton.module.css';

export interface MuteButtonProps {
  /** When true, renders inline inside a flex header instead of fixed top-left corner. */
  inline?: boolean;
}

// A discreet sound toggle for host (fixed corner) or mobile topbar (inline). The engine
// persists the choice, so it survives reloads; local state just mirrors it for the icon.
export function MuteButton({ inline = false }: MuteButtonProps = {}) {
  const [muted, setMutedState] = useState(isMuted());
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };
  return (
    <button
      type="button"
      className={inline ? styles.btnInline : styles.btn}
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Riattiva audio' : 'Silenzia audio'}
      title={muted ? 'Riattiva audio' : 'Silenzia audio'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
