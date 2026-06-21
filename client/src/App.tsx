import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './landing/Landing';
import HostApp from './host/HostApp';
import PlayerApp from './player/PlayerApp';
import Profile from './profile/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<HostApp />} />
        <Route path="/join" element={<PlayerApp />} />
        <Route path="/profilo" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}
