import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './landing/Landing';
import HostApp from './host/HostApp';
import PlayerApp from './player/PlayerApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<HostApp />} />
        <Route path="/join" element={<PlayerApp />} />
      </Routes>
    </BrowserRouter>
  );
}
