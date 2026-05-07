import { useEffect, useState } from 'react';
import type { Track } from '../../types';

interface Props {
  track: Track;
  onClose: () => void;
}

export default function SaveDialog({ track, onClose }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    const json = JSON.stringify(track, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-default border border-border-subtle bg-surface-raised shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Save clip ${track.name}`}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <div className="text-sm font-semibold text-text-primary">
            Save clip — <span className="font-mono">{track.name}</span>
          </div>
          <button
            type="button"
            className="rounded-default px-2 py-1 text-sm text-text-secondary hover:bg-white/10"
            onClick={onClose}
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
            {JSON.stringify(track, null, 2)}
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
              onClick={onClose}
              autoFocus
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
