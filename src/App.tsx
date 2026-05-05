import { useRef } from 'react';
import TopBar from './components/TopBar';
import TrackPanel from './components/TrackPanel';
import PlayerPanel from './components/PlayerPanel';
import TimelineBar from './components/TimelineBar';
import { VideoRefProvider } from './components/VideoRefContext';
import usePlayback from './hooks/usePlayback';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useRecordingSampler from './hooks/useRecordingSampler';

function AppContent() {
  usePlayback();
  useKeyboardShortcuts();
  useRecordingSampler();

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-bg text-text-primary">
      <TopBar />
      <main className="flex-1 min-h-0 flex gap-2 px-2 py-2">
        {/* Left column: video on top, timeline directly below */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0">
            <PlayerPanel />
          </div>
          <TimelineBar />
        </div>
        {/* Right column: track panel */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border-subtle">
          <TrackPanel />
        </aside>
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
