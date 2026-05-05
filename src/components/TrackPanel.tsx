import { useEffect, useRef, useState } from 'react';
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
  const tracks = useAppStore((s) => s.tracks);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const setActiveTrackId = useAppStore((s) => s.setActiveTrackId);
  const createTrack = useAppStore((s) => s.createTrack);
  const deleteTrack = useAppStore((s) => s.deleteTrack);
  const renameTrack = useAppStore((s) => s.renameTrack);
  const markActiveTrackSaved = useAppStore((s) => s.markActiveTrackSaved);

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
      {/* Selected track — label acts as panel heading */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-text-primary">Selected track</label>

        {!isRenaming ? (
          <div className="flex items-center gap-2">
            <select
              className="flex-1 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              value={dropdownValue}
              onChange={(e) => setActiveTrackId(e.target.value)}
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
              <span aria-hidden="true">✏️</span>
            </button>
            <button
              type="button"
              className="rounded-default border border-border-subtle bg-surface-raised px-2 py-2 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete clip"
              aria-label="Delete clip"
              onClick={handleDelete}
              disabled={deleteDisabled}
            >
              <span aria-hidden="true">🗑️</span>
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
          className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary hover:bg-white/10"
          onClick={() => createTrack()}
        >
          + Create clip
        </button>
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <label className="text-sm text-text-secondary">Mode</label>
        <select
          className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'edit' | 'view')}
          disabled={modeDisabled}
        >
          <option value="edit">Edit</option>
          <option value="view">View</option>
        </select>
      </div>

      <div className="border-t border-border-subtle" />

      {/* Clip range — read-only display */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-text-primary">Clip range</div>
        {hasActive ? (
          <div className="flex items-center gap-4 py-1.5 text-sm text-text-primary">
            <span>
              <span className="text-text-secondary">In:</span>{' '}
              <span className="font-mono">{formatMmSs(activeRange.inTime)}</span>
            </span>
            <span>
              <span className="text-text-secondary">Out:</span>{' '}
              <span className="font-mono">{formatMmSs(activeRange.outTime)}</span>
            </span>
          </div>
        ) : (
          <div className="py-1.5 text-sm text-text-secondary italic">No clip selected</div>
        )}

        {/* Action buttons row */}
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
            className="flex-1 rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium uppercase tracking-button text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => window.alert('Export not available in POC')}
            disabled={exportDisabled}
          >
            Export clip
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
