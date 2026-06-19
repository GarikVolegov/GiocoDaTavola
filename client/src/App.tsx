import HostApp from './host/HostApp';
import PlayerApp from './player/PlayerApp';

type View = 'host' | 'player';

function currentView(): View {
  return window.location.pathname.startsWith('/host') ? 'host' : 'player';
}

export default function App() {
  return currentView() === 'host' ? <HostApp /> : <PlayerApp />;
}
