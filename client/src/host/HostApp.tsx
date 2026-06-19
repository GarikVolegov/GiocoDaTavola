import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getSocket } from '../shared/socket';
import {
  SocketEvents,
  type RoomCreatedPayload,
  type LobbyUpdatePayload,
  type PublicPlayer,
} from '../shared/events';

// Shared screen (TV / tablet / laptop). On open it asks the server for a room
// and shows the join code large + a QR pointing phones at the join URL.
export default function HostApp() {
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onRoomCreated = ({ code }: RoomCreatedPayload) => setCode(code);
    const onLobbyUpdate = ({ players }: LobbyUpdatePayload) => setPlayers(players);
    socket.on(SocketEvents.HostRoomCreated, onRoomCreated);
    socket.on(SocketEvents.LobbyUpdate, onLobbyUpdate);
    socket.emit(SocketEvents.HostCreateRoom);
    return () => {
      socket.off(SocketEvents.HostRoomCreated, onRoomCreated);
      socket.off(SocketEvents.LobbyUpdate, onLobbyUpdate);
    };
  }, []);

  const joinUrl = code ? `${window.location.origin}/?room=${code}` : '';

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: '2rem',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Dibattiti tra amici</h1>

      {code ? (
        <>
          <p style={{ opacity: 0.7, margin: 0 }}>
            Entra da <strong>{window.location.host}</strong> con il codice
          </p>
          <div
            style={{
              fontSize: 'clamp(4rem, 18vw, 9rem)',
              fontWeight: 800,
              letterSpacing: '0.4rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: 1,
            }}
          >
            {code}
          </div>
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '1rem' }}>
            <QRCodeSVG value={joinUrl} size={220} />
          </div>
          <p style={{ opacity: 0.7, margin: 0 }}>Inquadra il QR per entrare dal telefono</p>

          <section style={{ marginTop: '0.5rem', width: 'min(90vw, 36rem)' }}>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem' }}>
              Giocatori ({players.length}/8)
            </h2>
            {players.length === 0 ? (
              <p style={{ opacity: 0.6, margin: 0 }}>In attesa di giocatori…</p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'center',
                }}
              >
                {players.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '999px',
                      background: 'rgba(127,127,127,0.18)',
                      fontWeight: 600,
                    }}
                  >
                    {p.nickname}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p style={{ opacity: 0.7 }}>Creazione stanza…</p>
      )}
    </main>
  );
}
