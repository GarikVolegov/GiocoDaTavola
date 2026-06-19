// Per-player phone view. Join form, voting and defense prompts are added in
// later stories.
export default function PlayerApp() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Dibattiti tra amici</h1>
      <p style={{ opacity: 0.7 }}>Apri questa pagina dal tuo telefono per entrare.</p>
    </main>
  );
}
