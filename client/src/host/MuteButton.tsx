import { useState } from 'react';
import { isMuted, setMuted } from './audio/engine';
import styles from './MuteButton.module.css';

// A discreet corner toggle for the host's sound (musichetta + effects). The engine
// persists the choice, so it survives reloads; local state just mirrors it for the icon.
export function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Riattiva audio' : 'Silenzia audio'}
      title={muted ? 'Riattiva audio' : 'Silenzia audio'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
