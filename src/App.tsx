import { useRef } from 'react';
import TopBar from './components/TopBar';
import TrackPanel from './components/TrackPanel';
import PlayerPanel from './components/PlayerPanel';
import TimelineBar from './components/TimelineBar';
import KeyframeDialog from './components/KeyframeDialog';
import SegmentDialog from './components/SegmentDialog';
import { VideoRefProvider } from './components/VideoRefContext';
import usePlayback from './hooks/usePlayback';

function AppContent() {
  usePlayback();

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <TopBar />
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        <section className="col-span-12 lg:col-span-8">
          <PlayerPanel />
        </section>
        <aside className="col-span-12 lg:col-span-4">
          <TrackPanel />
        </aside>
        <section className="col-span-12">
          <TimelineBar />
        </section>
      </main>
      <KeyframeDialog />
      <SegmentDialog />
    </div>
  );
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <VideoRefProvider value={videoRef}>
      <AppContent />
    </VideoRefProvider>
  );
}

export default App;
