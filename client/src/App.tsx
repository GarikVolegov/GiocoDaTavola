import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import ErrorBoundary from './shared/ErrorBoundary';

// Per-route code-splitting: a phone opening `/join` shouldn't download the
// host/landing/profile code, and vice versa. Each view becomes its own chunk.
const Landing = lazy(() => import('./landing/Landing'));
const HostApp = lazy(() => import('./host/HostApp'));
const PlayerApp = lazy(() => import('./player/PlayerApp'));
const Profile = lazy(() => import('./profile/Profile'));
const Home = lazy(() => import('./home/Home'));

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
            <Route path="/host" element={<HostApp />} />
            <Route path="/join" element={<PlayerApp />} />
            <Route path="/profilo" element={<Profile />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
