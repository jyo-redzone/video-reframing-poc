import { useRef } from 'react';
import TopBar from './components/TopBar';
import TrackPanel from './components/TrackPanel';
import PlayerPanel from './components/PlayerPanel';
import { VideoRefProvider } from './components/VideoRefContext';
import usePlayback from './hooks/usePlayback';

function AppContent() {
  usePlayback();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar />
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        <section className="col-span-12 lg:col-span-8">
          <PlayerPanel />
        </section>
        <aside className="col-span-12 lg:col-span-4">
          <TrackPanel />
        </aside>
        <section className="col-span-12">
          {/* TimelineBar placeholder */}
          <div className="rounded-2xl border bg-white shadow-sm p-4 h-40 flex items-center justify-center text-slate-400">
            Timeline (Task 006)
          </div>
        </section>
      </main>
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
