import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VideoMetadata } from '../../types';

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s`;
}

interface Props {
  videoMetadata: VideoMetadata | null;
}

export default function VideoInfoPopover({ videoMetadata }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rounded-default p-1 text-text-secondary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Video info"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={!videoMetadata}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-icons text-base leading-none align-middle" aria-hidden="true">info</span>
      </button>
      {open && videoMetadata && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Video info"
          className="fixed z-50 w-72 rounded-default border border-border-subtle bg-surface-raised p-3 text-xs text-text-primary shadow-elevation-8"
          style={{ top: pos.top, right: pos.right }}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-text-secondary">URL</dt>
            <dd className="break-all font-mono select-text">{videoMetadata.url}</dd>
            <dt className="text-text-secondary">Resolution</dt>
            <dd className="select-text">{videoMetadata.width}×{videoMetadata.height}</dd>
            <dt className="text-text-secondary">Duration</dt>
            <dd className="select-text">{formatDuration(videoMetadata.duration)}</dd>
            <dt className="text-text-secondary">FPS</dt>
            <dd className="select-text">{videoMetadata.fps}</dd>
          </dl>
        </div>,
        document.body,
      )}
    </>
  );
}
