import useAppStore from '../store/useAppStore';

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
    <div className="rounded-default border border-border-subtle bg-surface shadow-elevation-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="font-semibold text-text-primary">Track</div>
        <button
          className="rounded-default border border-border-subtle px-3 py-1.5 text-sm font-medium uppercase tracking-button text-text-primary hover:bg-white/10"
          onClick={() => window.alert('Export not available in POC')}
        >
          Export
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Track selector */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Selected</label>
          <select className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary">
            <option>Ball follow</option>
            <option>Player A</option>
            <option>Player B</option>
          </select>
        </div>

        {/* Mode & View dropdowns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Mode</label>
            <select
              className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as 'edit' | 'view')
              }
            >
              <option value="edit">Edit</option>
              <option value="view">View</option>
            </select>
          </div>

          {mode === 'view' && (
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">View</label>
              <select
                className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
                value={viewType}
                onChange={(e) =>
                  setViewType(e.target.value as 'source' | 'preview')
                }
              >
                <option value="source">Source</option>
                <option value="preview">Preview</option>
              </select>
            </div>
          )}
        </div>

        {/* Export ranges */}
        <div className="rounded-default border border-border-subtle bg-white/5 p-3">
          <div className="mb-2 text-sm font-semibold text-text-primary">Export ranges</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-default border border-border-subtle bg-surface px-3 py-2">
              <div className="text-sm text-text-primary">
                <span className="font-medium">R1:</span>{' '}
                <span className="font-mono">00:10 - 00:20</span>
              </div>
              <button
                className="rounded-default px-2 py-1 text-sm text-text-secondary hover:bg-white/10"
                title="Edit"
              >
                &#x270E;
              </button>
            </div>
            <div className="flex items-center justify-between rounded-default border border-border-subtle bg-surface px-3 py-2">
              <div className="text-sm text-text-primary">
                <span className="font-medium">R2:</span>{' '}
                <span className="font-mono">00:30 - 00:35</span>
              </div>
              <button
                className="rounded-default px-2 py-1 text-sm text-text-secondary hover:bg-white/10"
                title="Edit"
              >
                &#x270E;
              </button>
            </div>
          </div>
          <button className="mt-3 w-full rounded-default border border-border-subtle px-3 py-2 text-sm font-medium uppercase tracking-button text-text-secondary hover:bg-white/10">
            + Add range
          </button>
        </div>

        {/* Output resolution & Auto-keyframe */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Output res</label>
            <select className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary">
              <option>1080p</option>
              <option>720p</option>
              <option>Source</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Keyframe capture</label>
            <label className="flex items-center gap-2 rounded-default border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-4 w-4"
                defaultChecked
              />
              Auto
              <span className="group relative ml-auto cursor-help text-text-disabled">
                &#x1F6C8;
                <span className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-default border border-border-subtle bg-surface p-3 text-xs text-text-primary shadow-elevation-8 group-hover:block">
                  <div className="mb-1 font-semibold">
                    Auto keyframe capture
                  </div>
                  <div className="mb-1">
                    Key frames are automatically captured at
                  </div>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Start and end of PTZ gesture</li>
                    <li>BBox create</li>
                  </ol>
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Add Manual KF button */}
        <div className="grid grid-cols-2 items-end gap-3">
          <div></div>
          <button
            className="w-full rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/90"
            onClick={handleAddManualKF}
          >
            + Add Manual KF
          </button>
        </div>
      </div>
    </div>
  );
}
