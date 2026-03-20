import useAppStore from '../store/useAppStore';

export default function TopBar() {
  const videoName = useAppStore(
    (s) => s.videoMetadata?.name ?? 'No video loaded',
  );
  const videoMetadata = useAppStore((s) => s.videoMetadata);

  const handleInfoClick = () => {
    if (!videoMetadata) {
      window.alert('No video loaded');
      return;
    }
    const { width, height, duration, fps } = videoMetadata;
    const durMin = Math.floor(duration / 60);
    const durSec = (duration % 60).toFixed(1);
    window.alert(
      `Resolution: ${width}x${height}\nDuration: ${durMin}m ${durSec}s\nFPS: ${fps}`,
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-appbar">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Video:</span>
          <span className="text-sm font-medium text-text-primary">{videoName}</span>
        </div>
        <nav className="flex items-center gap-2">
          <button
            className="rounded-default px-3 py-1.5 text-sm font-medium uppercase tracking-button text-text-primary hover:bg-white/10"
            onClick={handleInfoClick}
          >
            Info
          </button>
          <button
            className="rounded-default px-3 py-1.5 text-sm font-medium uppercase tracking-button text-text-primary hover:bg-white/10"
            onClick={() => window.alert('No jobs')}
          >
            Jobs
          </button>
        </nav>
      </div>
    </header>
  );
}
