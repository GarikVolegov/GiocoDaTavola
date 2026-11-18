import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import ErrorBoundary from './shared/ErrorBoundary';
import { BivioBackdrop } from './shared/ui';
import { useOnlineStatus } from './shared/useOnlineStatus';

// Per-route code-splitting: a phone opening `/join` shouldn't download the
// host/landing/profile code, and vice versa. Each view becomes its own chunk.
const Landing = lazy(() => import('./landing/Landing'));
const HostApp = lazy(() => import('./host/HostApp'));
const PlayerApp = lazy(() => import('./player/PlayerApp'));
const PassAndPlayApp = lazy(() => import('./passAndPlay/PassAndPlayApp'));
const Profile = lazy(() => import('./profile/Profile'));
const Home = lazy(() => import('./home/Home'));
const Settings = lazy(() => import('./settings/Settings'));
const AuthPage = lazy(() => import('./auth/AuthPage'));
// Realtime-connection banner, shown only on the socket-backed routes (/host, /join).
const ConnectionBanner = lazy(() => import('./shared/ConnectionBanner'));

// Root `/`: signed-in users get their dashboard (/casa); everyone else sees the
// marketing landing. If offline or Clerk takes >1.5s to load, fall back to
// Landing immediately instead of leaving the screen blank.
function RootRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const online = useOnlineStatus();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const id = window.setTimeout(() => setTimedOut(true), 1500);
    return () => window.clearTimeout(id);
  }, [isLoaded]);

  if (!isLoaded && online && !timedOut) return null;
  return isLoaded && isSignedIn ? <Navigate to="/casa" replace /> : <Landing />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<><BivioBackdrop variant="landing" /><RootRoute /></>} />
            <Route path="/casa" element={<><BivioBackdrop variant="dashboard" /><Home /></>} />
            <Route path="/host" element={<><ConnectionBanner /><BivioBackdrop variant="host" /><HostApp /></>} />
            <Route path="/join" element={<><ConnectionBanner /><BivioBackdrop variant="player" /><PlayerApp /></>} />
            <Route path="/passa" element={<><BivioBackdrop variant="player" /><PassAndPlayApp /></>} />
            <Route path="/profilo" element={<><BivioBackdrop variant="dashboard" /><Profile /></>} />
            <Route path="/impostazioni" element={<><BivioBackdrop variant="dashboard" /><Settings /></>} />
            <Route path="/accedi" element={<><BivioBackdrop variant="dashboard" /><AuthPage /></>} />
            <Route path="/registrati" element={<Navigate to="/accedi?tab=registrati" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
