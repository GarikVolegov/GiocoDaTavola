// Shared screen (TV / tablet / laptop). Lobby, dilemmas, timers and awards
// are added in later stories.
export default function HostApp() {
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
      }}
    >
      <h1 style={{ fontSize: '3rem', margin: 0 }}>Dibattiti tra amici</h1>
      <p style={{ opacity: 0.7 }}>Schermo comune (host)</p>
    </main>
  );
}
