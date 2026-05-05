import useAppStore from '../store/useAppStore';

function formatMmSs(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function TrackPanel() {
  const mode = useAppStore((s) => s.mode);
  const viewType = useAppStore((s) => s.viewType);
  const setMode = useAppStore((s) => s.setMode);
  const setViewType = useAppStore((s) => s.setViewType);
  const currentTime = useAppStore((s) => s.currentTime);
  const viewportRect = useAppStore((s) => s.viewportRect);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const addKeyframe = useAppStore((s) => s.addKeyframe);
  const selectKeyframe = useAppStore((s) => s.selectKeyframe);
  const activeTrackRange = useAppStore((s) => {
    const track = s.tracks.find((t) => t.id === s.activeTrackId);
    return track?.range ?? { inTime: 0, outTime: 0 };
  });

  const handleAddManualKF = () => {
    if (!viewportRect) return;

    const newId = `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    addKeyframe({
      id: newId,
      trackId: activeTrackId,
      time: currentTime,
      sourceRect: { ...viewportRect },
      transitionToNext: 'smooth',
    });
    selectKeyframe(newId);
  };

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Selected track — label acts as panel heading */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-text-primary">Selected track</label>
        <select className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary">
          <option>Ball follow</option>
          <option>Player A</option>
          <option>Player B</option>
        </select>
      </div>

      {/* Mode & View */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Mode</label>
          <select
            className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'edit' | 'view')}
          >
            <option value="edit">Edit</option>
            <option value="view">View</option>
          </select>
        </div>

        {mode === 'view' && (
          <div className="space-y-1.5">
            <label className="text-sm text-text-secondary">View</label>
            <select
              className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
              value={viewType}
              onChange={(e) => setViewType(e.target.value as 'source' | 'preview')}
            >
              <option value="source">Source</option>
              <option value="preview">Preview</option>
            </select>
          </div>
        )}
      </div>

      {/* Auto KF + Add Manual KF */}
      <div className="grid grid-cols-2 items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm text-text-secondary">Keyframe capture</label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input type="checkbox" className="h-4 w-4" defaultChecked />
            Auto
            <span className="group relative ml-auto cursor-help text-text-disabled">
              &#x1F6C8;
              <span className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-default border border-border-subtle bg-surface p-3 text-xs text-text-primary shadow-elevation-8 group-hover:block">
                <div className="mb-1 font-semibold">Auto keyframe capture</div>
                <div className="mb-1">Key frames are automatically captured at</div>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Start and end of PTZ gesture</li>
                  <li>BBox create</li>
                </ol>
              </span>
            </span>
          </label>
        </div>
        <button
          className="w-full rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/90"
          onClick={handleAddManualKF}
        >
          + Manual KF
        </button>
      </div>

      <div className="border-t border-border-subtle" />

      {/* Clip range — read-only display */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-text-primary">Clip range</div>
        <div className="flex items-center gap-4 py-1.5 text-sm text-text-primary">
          <span>
            <span className="text-text-secondary">In:</span>{' '}
            <span className="font-mono">{formatMmSs(activeTrackRange.inTime)}</span>
          </span>
          <span>
            <span className="text-text-secondary">Out:</span>{' '}
            <span className="font-mono">{formatMmSs(activeTrackRange.outTime)}</span>
          </span>
        </div>
        <button
          className="w-full rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/90"
          onClick={() => window.alert('Export not available in POC')}
        >
          Export
        </button>
      </div>
    </div>
  );
}
