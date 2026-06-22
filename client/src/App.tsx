import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Landing from './landing/Landing';
import HostApp from './host/HostApp';
import PlayerApp from './player/PlayerApp';
import Profile from './profile/Profile';
import Home from './home/Home';
import ErrorBoundary from './shared/ErrorBoundary';

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
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/casa" element={<Home />} />
          <Route path="/host" element={<HostApp />} />
          <Route path="/join" element={<PlayerApp />} />
          <Route path="/profilo" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
