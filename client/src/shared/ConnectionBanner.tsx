import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import { useOnlineStatus } from './useOnlineStatus';
import styles from './ConnectionBanner.module.css';

// A non-blocking top banner that appears only after the realtime connection has
// actually dropped (connected once, then lost) or when the device goes offline —
// never during the initial connect, so it doesn't nag.
export default function ConnectionBanner() {
  const socket = getSocket();
  const online = useOnlineStatus();
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

  if (online && (connected || !hadConnection.current)) return null;
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      {online
        ? 'Connessione persa — riconnessione…'
        : 'Sei offline — riconnessione automatica al ritorno della rete (oppure gioca a Passa il telefono)'}
    </div>
  );
}
