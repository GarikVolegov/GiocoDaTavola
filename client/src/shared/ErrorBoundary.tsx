import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Catches render-time exceptions in any view so a single bug doesn't white-screen
// a phone mid-party. Shows a recover-by-reload fallback plus an offline Pass & Play escape hatch.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            background: '#0B0E1A',
            color: '#F1F5F9',
            fontFamily: 'var(--font-body, system-ui, sans-serif)',
          }}
        >
          <div style={{ fontSize: 36 }} aria-hidden="true">
            ⚡
          </div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Qualcosa è andato storto</h1>
          <p style={{ margin: 0, maxWidth: 380, color: '#94A3B8', fontSize: 15 }}>
            Ricarica la pagina per riprendere, oppure passa subito alla modalità offline.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: 'none',
                background: '#FF3E7F',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ricarica
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/passa';
              }}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#F1F5F9',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📱 Passa il telefono (Offline)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
