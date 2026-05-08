import { useEffect, useRef, useState } from 'react';
import type { ClipRange, Track } from '../../types';
import { parseTrackFile } from '../../utils/trackFile';

function formatHhMmSs(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

interface Props {
  tracks: Track[];
  activeTrackId: string;
  hasActive: boolean;
  activeRange: ClipRange;
  currentVideoUrl: string | null;
  onSelectTrack: (id: string) => void;
  onRenameTrack: (id: string, name: string) => void;
  onDeleteTrack: () => void;
  onCreateTrack: () => void;
  onImportTrack: (track: Track) => string;
}

export default function TrackSelectorRow({
  tracks, activeTrackId, hasActive, activeRange, currentVideoUrl,
  onSelectTrack, onRenameTrack, onDeleteTrack, onCreateTrack, onImportTrack,
}: Props) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;

  useEffect(() => {
    setIsRenaming(false);
    setRenameError(null);
  }, [activeTrackId]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    if (!activeTrack) return;
    setRenameValue(activeTrack.name);
    setRenameError(null);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameError(null);
  };

  const commitRename = () => {
    if (!activeTrack) return;
    const trimmed = renameValue.trim();
    if (trimmed === '') { setRenameError('Name required'); return; }
    onRenameTrack(activeTrack.id, trimmed);
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleSelectTrack = (id: string) => {
    if (id === activeTrackId) return;
    if (activeTrack?.isDirty) {
      const ok = window.confirm(
        `You have unsaved changes in "${activeTrack.name}". Switch clips and discard them?`,
      );
      if (!ok) return;
    }
    onSelectTrack(id);
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Always reset the input so the same file can be re-selected later.
    const resetInput = () => { input.value = ''; };

    if (!file) { resetInput(); return; }

    if (currentVideoUrl === null) {
      window.alert('Load a video before importing a clip.');
      resetInput();
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      window.alert(`Could not read file: ${msg}`);
      resetInput();
      return;
    }

    const parsed = parseTrackFile(text);
    if (!parsed.ok) {
      window.alert(parsed.error);
      resetInput();
      return;
    }

    if (parsed.videoUrl !== currentVideoUrl) {
      window.alert('This clip belongs to a different video. Import blocked.');
      resetInput();
      return;
    }

    onImportTrack(parsed.track);
    resetInput();
  };

  const dropdownValue = hasActive ? activeTrackId : '';

  return (
    <div className="space-y-2">
      {!isRenaming ? (
        <div className="flex items-center gap-1">
          <select
            className="flex-1 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            value={dropdownValue}
            onChange={(e) => handleSelectTrack(e.target.value)}
            title={
              hasActive
                ? `${formatHhMmSs(activeRange.inTime)} - ${formatHhMmSs(activeRange.outTime)}`
                : undefined
            }
          >
            {!hasActive && <option value="" disabled>Select a clip</option>}
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            type="button"
            className="rounded-default border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Rename clip" aria-label="Rename clip"
            onClick={startRename} disabled={!hasActive}
          >
            <span className="material-icons text-base text-sm leading-none align-middle" aria-hidden="true">edit</span>
          </button>
          <button
            type="button"
            className="rounded-default border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Delete clip" aria-label="Delete clip"
            onClick={onDeleteTrack} disabled={!hasActive}
          >
            <span className="material-icons text-base leading-none align-middle" aria-hidden="true">delete</span>
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              ref={renameInputRef}
              type="text"
              className="flex-1 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
              value={renameValue}
              onChange={(e) => { setRenameValue(e.target.value); if (renameError) setRenameError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
              }}
            />
            <button
              type="button"
              className="rounded-default bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
              onClick={commitRename}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary hover:bg-white/10"
              onClick={cancelRename}
            >
              Cancel
            </button>
          </div>
          {renameError && <div className="text-xs text-red-400">{renameError}</div>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded-default border bg-surface-raised px-3 py-2 text-sm text-text-primary font-medium uppercase hover:bg-white/10"
          onClick={onCreateTrack}
        >
          Create clip
        </button>
        <button
          type="button"
          className="flex-1 rounded-default border bg-surface-raised px-3 py-2 text-sm text-text-primary font-medium uppercase hover:bg-white/10"
          onClick={triggerImport}
        >
          Import clip
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
