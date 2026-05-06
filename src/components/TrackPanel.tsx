import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';

function formatHhMmSs(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function TrackPanel() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const tracks = useAppStore((s) => s.tracks);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const setActiveTrackId = useAppStore((s) => s.setActiveTrackId);
  const createTrack = useAppStore((s) => s.createTrack);
  const deleteTrack = useAppStore((s) => s.deleteTrack);
  const renameTrack = useAppStore((s) => s.renameTrack);
  const markActiveTrackSaved = useAppStore((s) => s.markActiveTrackSaved);
  const videoMetadata = useAppStore((s) => s.videoMetadata);

  const videoName = videoMetadata?.name ?? 'No video loaded';
  const infoTooltip = videoMetadata
    ? `Resolution: ${videoMetadata.width}×${videoMetadata.height}\nDuration: ${Math.floor(videoMetadata.duration / 60)}m ${(videoMetadata.duration % 60).toFixed(1)}s\nFPS: ${videoMetadata.fps}`
    : 'No video loaded';

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  const hasActive = activeTrack !== null;
  const activeRange = activeTrack?.range ?? { inTime: 0, outTime: 0 };

  // ── Inline rename state ───────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Exit rename mode if the active track changes or disappears
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
    if (trimmed === '') {
      setRenameError('Name required');
      return;
    }
    renameTrack(activeTrack.id, trimmed);
    setIsRenaming(false);
    setRenameError(null);
  };

  // ── Delete confirm ────────────────────────────────────────────────
  const handleDelete = () => {
    if (!activeTrack) return;
    const ok = window.confirm(`Delete clip "${activeTrack.name}"? This cannot be undone.`);
    if (ok) deleteTrack(activeTrack.id);
  };

  // ── Save dialog state ─────────────────────────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Close dialog if active track disappears
  useEffect(() => {
    if (!hasActive) setShowSaveDialog(false);
  }, [hasActive]);

  const openSaveDialog = () => {
    if (!activeTrack) return;
    setCopyState('idle');
    setShowSaveDialog(true);
  };

  const closeSaveDialog = () => {
    setShowSaveDialog(false);
    setCopyState('idle');
    markActiveTrackSaved();
  };

  // Esc-to-close for the dialog
  useEffect(() => {
    if (!showSaveDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSaveDialog();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSaveDialog]);

  const handleCopy = async () => {
    if (!activeTrack) return;
    const json = JSON.stringify(activeTrack, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  };

  const saveDisabled = !hasActive || !(activeTrack?.isDirty ?? false);
  const exportDisabled = !hasActive;
  const renameDisabled = !hasActive;
  const deleteDisabled = !hasActive;
  const modeDisabled = !hasActive;

  const dropdownValue = hasActive ? activeTrackId : '';

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Video header — name, info tooltip, jobs */}
      <div className="flex items-center gap-2">
        <span
          className="flex-1 truncate text-sm font-medium text-text-primary"
          title={videoName}
        >
          {videoName}
        </span>
        <button
          type="button"
          className="rounded-default p-1 text-text-secondary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          title={infoTooltip}
          aria-label="Video info"
          disabled={!videoMetadata}
        >
          <span className="material-icons text-base leading-none align-middle" aria-hidden="true">info</span>
        </button>
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

      {/* Selected track — label acts as panel heading */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary">Selected clip</label>

        {!isRenaming ? (
          <div className="flex items-center gap-1">
            <select
              className="flex-1 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              value={dropdownValue}
              onChange={(e) => setActiveTrackId(e.target.value)}
              title={
                hasActive
                  ? `${formatHhMmSs(activeRange.inTime)} - ${formatHhMmSs(activeRange.outTime)}`
                  : undefined
              }
            >
              {!hasActive && (
                <option value="" disabled>
                  Select a clip
                </option>
              )}
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-default border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Rename clip"
              aria-label="Rename clip"
              onClick={startRename}
              disabled={renameDisabled}
            >
              <span className="material-icons text-base text-sm leading-none align-middle" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              className="rounded-default border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete clip"
              aria-label="Delete clip"
              onClick={handleDelete}
              disabled={deleteDisabled}
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
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  if (renameError) setRenameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
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
            {renameError && (
              <div className="text-xs text-red-400">{renameError}</div>
            )}
          </div>
        )}

        <button
          type="button"
          className="w-full rounded-default border bg-surface-raised px-3 py-2 text-sm text-text-primary font-medium uppercase hover:bg-white/10"
          onClick={() => createTrack()}
        >
          Create clip
        </button>
      </div>

      {/* Mode */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-text-primary">Mode</label>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm ${mode === 'edit' ? 'font-medium text-text-primary' : 'text-text-secondary'}`}
          >
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
          <span
            className={`text-sm ${mode === 'view' ? 'font-medium text-text-primary' : 'text-text-secondary'}`}
          >
            View
          </span>
        </div>
      </div>

      <div className="border-t border-border-subtle" />

      {/* Action buttons row */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={openSaveDialog}
            disabled={saveDisabled}
          >
            Save clip
          </button>
          <button
            type="button"
            className="flex-1 rounded-default bg-white px-3 py-2 text-sm font-medium uppercase tracking-button text-black hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => window.alert('Export not available in POC')}
            disabled={exportDisabled}
          >
            Export mp4
          </button>
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && activeTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={(e) => {
            // Backdrop click closes; clicks inside the dialog body should not bubble here.
            if (e.target === e.currentTarget) closeSaveDialog();
          }}
        >
          <div
            className="w-full max-w-2xl rounded-default border border-border-subtle bg-surface-raised shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label={`Save clip ${activeTrack.name}`}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
              <div className="text-sm font-semibold text-text-primary">
                Save clip — <span className="font-mono">{activeTrack.name}</span>
              </div>
              <button
                type="button"
                className="rounded-default px-2 py-1 text-sm text-text-secondary hover:bg-white/10"
                onClick={closeSaveDialog}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <pre
                className="overflow-auto rounded-default border border-border-subtle bg-appbar p-3 text-xs text-text-primary font-mono"
                style={{ maxHeight: '60vh' }}
              >
                {JSON.stringify(activeTrack, null, 2)}
              </pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary hover:bg-white/10"
                  onClick={handleCopy}
                >
                  {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
                </button>
                <button
                  type="button"
                  className="rounded-default bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
                  onClick={closeSaveDialog}
                  autoFocus
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
