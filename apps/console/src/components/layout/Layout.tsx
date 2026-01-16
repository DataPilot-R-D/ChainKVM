import { Header } from './Header';
import { VideoPanel } from './VideoPanel';
import { ControlPanel } from './ControlPanel';
import { StatusBar } from './StatusBar';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <Header />
      <main className="layout__main">
        <VideoPanel />
        <ControlPanel />
      </main>
      <StatusBar />
    </div>
  );
}
