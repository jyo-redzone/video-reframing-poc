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
  const setMode = useAppStore((s) => s.setMode);
  const activeTrackRange = useAppStore((s) => {
    const track = s.tracks.find((t) => t.id === s.activeTrackId);
    return track?.range ?? { inTime: 0, outTime: 0 };
  });

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

      {/* Mode */}
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
          Export selected clip
        </button>
      </div>
    </div>
  );
}
