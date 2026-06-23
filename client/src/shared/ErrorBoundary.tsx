import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Catches render-time exceptions in any view so a single bug doesn't white-screen
// a phone mid-party. Shows a recover-by-reload fallback.
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
        <div role="alert" style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
          <p>Qualcosa è andato storto.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
