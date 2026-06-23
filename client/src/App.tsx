import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import ErrorBoundary from './shared/ErrorBoundary';
import { BivioBackdrop } from './shared/ui';

// Per-route code-splitting: a phone opening `/join` shouldn't download the
// host/landing/profile code, and vice versa. Each view becomes its own chunk.
const Landing = lazy(() => import('./landing/Landing'));
const HostApp = lazy(() => import('./host/HostApp'));
const PlayerApp = lazy(() => import('./player/PlayerApp'));
const Profile = lazy(() => import('./profile/Profile'));
const Home = lazy(() => import('./home/Home'));
const Settings = lazy(() => import('./settings/Settings'));
// Realtime-connection banner, shown only on the socket-backed routes (/host, /join).
const ConnectionBanner = lazy(() => import('./shared/ConnectionBanner'));

// Root `/`: signed-in users get their dashboard (/casa); everyone else sees the
// marketing landing. Gating on isLoaded avoids a landing flash before redirect.
function RootRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Navigate to="/casa" replace /> : <Landing />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/casa" element={<Home />} />
            <Route path="/host" element={<><ConnectionBanner /><BivioBackdrop variant="host" /><HostApp /></>} />
            <Route path="/join" element={<><ConnectionBanner /><BivioBackdrop variant="player" /><PlayerApp /></>} />
            <Route path="/profilo" element={<Profile />} />
            <Route path="/impostazioni" element={<Settings />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
