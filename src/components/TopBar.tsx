import useAppStore from '../store/useAppStore';

export default function TopBar() {
  const videoName = useAppStore(
    (s) => s.videoMetadata?.name ?? 'No video loaded',
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Video:</span>
          <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium">
            {videoName}
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <button
            className="rounded px-3 py-1.5 text-sm hover:bg-slate-100"
            onClick={() => window.alert('Video metadata info')}
          >
            Info
          </button>
          <button
            className="rounded px-3 py-1.5 text-sm hover:bg-slate-100"
            onClick={() => window.alert('No jobs')}
          >
            Jobs
          </button>
        </nav>
      </div>
    </header>
  );
}
