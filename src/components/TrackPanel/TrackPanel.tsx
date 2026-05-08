import useAppStore from '../../store/useAppStore';
import VideoInfoPopover from './VideoInfoPopover';
import TrackSelectorRow from './TrackSelectorRow';
import {
  serializeTrack,
  buildTrackFilename,
  downloadJsonFile,
} from '../../utils/trackFile';

export default function TrackPanel() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const tracks = useAppStore((s) => s.tracks);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const setActiveTrackId = useAppStore((s) => s.setActiveTrackId);
  const createTrack = useAppStore((s) => s.createTrack);
  const importTrack = useAppStore((s) => s.importTrack);
  const deleteTrack = useAppStore((s) => s.deleteTrack);
  const renameTrack = useAppStore((s) => s.renameTrack);
  const markActiveTrackSaved = useAppStore((s) => s.markActiveTrackSaved);
  const videoMetadata = useAppStore((s) => s.videoMetadata);

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  const hasActive = activeTrack !== null;
  const activeRange = activeTrack?.range ?? { inTime: 0, outTime: 0 };

  const handleDelete = () => {
    if (!activeTrack) return;
    const ok = window.confirm(`Delete clip "${activeTrack.name}"? This cannot be undone.`);
    if (ok) deleteTrack(activeTrack.id);
  };

  const handleSave = () => {
    if (!activeTrack || !videoMetadata) return;
    const json = serializeTrack(activeTrack, videoMetadata.url);
    const filename = buildTrackFilename(videoMetadata.name, activeTrack.name);
    downloadJsonFile(filename, json);
    markActiveTrackSaved();
  };

  const videoName = videoMetadata?.name ?? 'No video loaded';
  const saveDisabled = !hasActive || !(activeTrack?.isDirty ?? false) || !videoMetadata;
  const modeDisabled = !hasActive;

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-sm font-medium text-text-primary" title={videoName}>
          {videoName}
        </span>
        <VideoInfoPopover videoMetadata={videoMetadata} />
        <button
          type="button"
          className="rounded-default p-1 text-text-secondary hover:bg-white/10"
          title="Export queue"
          aria-label="Export queue"
          onClick={() => window.alert('No jobs')}
        >
          <span className="material-icons text-base leading-none align-middle" aria-hidden="true">upload</span>
        </button>
      </div>

      <div className="border-t border-border-subtle" />

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary">Selected clip</label>
        <TrackSelectorRow
          tracks={tracks}
          activeTrackId={activeTrackId}
          hasActive={hasActive}
          activeRange={activeRange}
          currentVideoUrl={videoMetadata?.url ?? null}
          onSelectTrack={setActiveTrackId}
          onRenameTrack={renameTrack}
          onDeleteTrack={handleDelete}
          onCreateTrack={createTrack}
          onImportTrack={importTrack}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary">Mode</label>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${mode === 'edit' ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
            Edit
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mode === 'view'}
            aria-label="Toggle mode between Edit and View"
            disabled={modeDisabled}
            onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border-subtle bg-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-brand transition-transform ${
                mode === 'view' ? 'translate-x-6' : 'translate-x-1'
              }`}
              aria-hidden="true"
            />
          </button>
          <span className={`text-sm ${mode === 'view' ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>
            View
          </span>
        </div>
      </div>

      <div className="border-t border-border-subtle" />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/80 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={saveDisabled}
          >
            Save clip
          </button>
          <button
            type="button"
            className="flex-1 rounded-default bg-white px-3 py-2 text-sm font-medium uppercase tracking-button text-black hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => window.alert('Export not available in POC')}
            disabled={!hasActive}
          >
            Export mp4
          </button>
        </div>
      </div>
    </div>
  );
}
