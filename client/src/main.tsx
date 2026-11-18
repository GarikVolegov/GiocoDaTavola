import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './shared/ErrorBoundary';
import './shared/ui/tokens.css';
import './index.css';

// Vite inlines this at build time; set it in .env.local (dev) and as a build-time
// env var on Railway (prod). The publishable key is NOT secret. When it's ABSENT,
// vite.config aliases @clerk/react to an inert stub (keyless boot) so the app still
// renders signed-out instead of crashing — no hard failure on a missing key.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <App />
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  });
}
