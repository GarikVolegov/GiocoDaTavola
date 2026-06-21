import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../shared/socket';
import { SocketEvents, type RoomReactionPayload } from '../shared/events';
import styles from './ReactionSwarm.module.css';

interface FloatingReaction {
  id: number;
  emoji: string;
  /** Horizontal position as a viewport-width percentage. */
  left: number;
}

/**
 * Fixed, non-interactive overlay for the shared screen. Listens for the server's
 * `room:reaction` broadcasts and floats each emoji up the screen, then drops it.
 * Pointer-events are disabled so it never blocks the host UI; the CSS degrades to
 * a brief static pop under prefers-reduced-motion.
 */
export default function ReactionSwarm() {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const socket = getSocket();
    const onReaction = ({ emoji }: RoomReactionPayload) => {
      const id = seq.current++;
      const left = 8 + Math.random() * 84; // spread across 8%..92% of the width
      setItems((cur) => [...cur, { id, emoji, left }]);
      // Remove it once the rise animation has finished.
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 1600);
    };
    socket.on(SocketEvents.RoomReaction, onReaction);
    return () => {
      socket.off(SocketEvents.RoomReaction, onReaction);
    };
  }, []);

  return (
    <div className={styles.overlay} aria-hidden="true">
      {items.map((i) => (
        <span key={i.id} className={styles.emoji} style={{ left: `${i.left}%` }}>
          {i.emoji}
        </span>
      ))}
    </div>
  );
}
