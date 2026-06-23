import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import styles from './ConnectionBanner.module.css';

// A non-blocking top banner that appears only after the realtime connection has
// actually dropped (connected once, then lost) — never during the initial connect,
// so it doesn't nag. Self-contained: reads the shared socket and tracks
// connect/disconnect, so it can be mounted once per realtime route (/host, /join).
export default function ConnectionBanner() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);
  // Once true, a later disconnect is a real drop worth surfacing (not "connecting").
  const hadConnection = useRef(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      hadConnection.current = true;
      setConnected(true);
    };
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  if (connected || !hadConnection.current) return null;
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      Connessione persa — riconnessione…
    </div>
  );
}
