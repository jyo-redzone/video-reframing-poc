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
    <div className="rounded-2xl border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="font-semibold">Track</div>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => window.alert('Export not available in POC')}
        >
          Export
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Track selector */}
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Selected</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm">
            <option>Ball follow</option>
            <option>Player A</option>
            <option>Player B</option>
          </select>
        </div>

        {/* Mode & View dropdowns */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Mode</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
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
              <label className="text-sm text-slate-600">View</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
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
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold">Export ranges</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">R1:</span>{' '}
                <span className="font-mono">00:10 - 00:20</span>
              </div>
              <button
                className="rounded px-2 py-1 text-sm hover:bg-slate-100"
                title="Edit"
              >
                &#x270E;
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">R2:</span>{' '}
                <span className="font-mono">00:30 - 00:35</span>
              </div>
              <button
                className="rounded px-2 py-1 text-sm hover:bg-slate-100"
                title="Edit"
              >
                &#x270E;
              </button>
            </div>
          </div>
          <button className="mt-3 w-full rounded-lg border px-3 py-2 text-sm hover:bg-white">
            + Add range
          </button>
        </div>

        {/* Output resolution & Auto-keyframe */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Output res</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm">
              <option>1080p</option>
              <option>720p</option>
              <option>Source</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Keyframe capture</label>
            <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                defaultChecked
              />
              Auto
              <span className="group relative ml-auto cursor-help text-slate-400">
                &#x1F6C8;
                <span className="pointer-events-none absolute right-0 top-6 z-50 hidden w-64 rounded-lg border bg-white p-3 text-xs text-slate-700 shadow-lg group-hover:block">
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
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            onClick={handleAddManualKF}
          >
            + Add Manual KF
          </button>
        </div>
      </div>
    </div>
  );
}
