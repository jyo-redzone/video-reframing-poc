import { useRef } from 'react';
import TrackPanel from './components/TrackPanel';
import HelpPanel from './components/HelpPanel';
import PlayerPanel from './components/PlayerPanel';
import TimelineBar from './components/TimelineBar';
import LandingScreen from './components/LandingScreen';
import { VideoRefProvider } from './components/VideoRefContext';
import usePlayback from './hooks/usePlayback';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useRecordingSampler from './hooks/useRecordingSampler';
import useAppStore from './store/useAppStore';

function AppContent() {
  usePlayback();
  useKeyboardShortcuts();
  useRecordingSampler();

  const helpPanelOpen = useAppStore((s) => s.helpPanelOpen);
  const toggleHelpPanel = useAppStore((s) => s.toggleHelpPanel);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-bg text-text-primary">
      <main className="flex-1 min-h-0 flex gap-2 px-2 py-2">
        {/* Left column: video on top, timeline directly below */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-0">
            <PlayerPanel />
          </div>
          <TimelineBar />
        </div>
        {/* Right column: track panel + optional help panel */}
        <aside className="w-72 shrink-0 flex flex-col border-l border-border-subtle">
          <div className={`${helpPanelOpen ? 'flex-1 min-h-0' : ''} overflow-y-auto`}>
            <TrackPanel />
          </div>
          {helpPanelOpen && (
            <>
              <div className="border-t border-border-subtle" />
              <div className="max-h-[60%] min-h-0 overflow-y-auto">
                <HelpPanel />
              </div>
            </>
          )}
        </aside>
      </main>

      {/* Floating keyboard shortcuts toggle button */}
      <button
        type="button"
        onClick={toggleHelpPanel}
        aria-label="Toggle keyboard shortcuts"
        title="Toggle keyboard shortcuts"
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-elevation-2 hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="text-lg font-bold leading-none" aria-hidden="true">?</span>
      </button>
    </div>
  );
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = useAppStore((s) => s.videoUrl);

  if (videoUrl === null) {
    return <LandingScreen />;
  }

  return (
    <VideoRefProvider value={videoRef}>
      <AppContent />
    </VideoRefProvider>
  );
}

export default App;
