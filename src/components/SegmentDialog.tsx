import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveIntent } from '../engine/cre';

export default function SegmentDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedSegmentKey = useAppStore((s) => s.selectedSegmentKey);
  const getActiveKeyframes = useAppStore((s) => s.getActiveKeyframes);
  const setTransition = useAppStore((s) => s.setTransition);
  const selectSegment = useAppStore((s) => s.selectSegment);

  const [transition, setTransitionLocal] = useState<'smooth' | 'cut'>('smooth');
  const [intentText, setIntentText] = useState('');
  const [startId, setStartId] = useState('');
  const [endId, setEndId] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selectedSegmentKey !== null) {
      const [sId, eId] = selectedSegmentKey.split('|');
      const keyframes = getActiveKeyframes();
      const startKf = keyframes.find((k) => k.id === sId);
      const endKf = keyframes.find((k) => k.id === eId);

      if (!startKf || !endKf) {
        selectSegment(null);
        return;
      }

      setStartId(sId);
      setEndId(eId);
      setTransitionLocal(startKf.transitionToNext ?? 'smooth');
      setIntentText(deriveIntent(startKf.sourceRect, endKf.sourceRect));
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [selectedSegmentKey, getActiveKeyframes, selectSegment]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      selectSegment(null);
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [selectSegment]);

  const handleSave = () => {
    if (!startId) return;
    setTransition(startId, transition);
    selectSegment(null);
  };

  const handleCancel = () => {
    selectSegment(null);
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(560px,92vw)] rounded-default border border-border-dialog bg-surface p-0 shadow-elevation-8"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-text-primary">
              Segment {startId} &rarr; {endId}
            </div>
            <div className="text-xs text-text-secondary">
              interval transition + derived ops (display-only)
            </div>
          </div>
          <button
            className="rounded-default border border-border-subtle px-2 py-1 text-sm text-text-primary hover:bg-white/10"
            onClick={handleCancel}
          >
            &#10005;
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Transition style</span>
            <select
              className="w-full rounded-default border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary"
              value={transition}
              onChange={(e) =>
                setTransitionLocal(e.target.value as 'smooth' | 'cut')
              }
            >
              <option value="smooth">smooth</option>
              <option value="cut">cut</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Derived operations</span>
            <textarea
              className="min-h-[84px] w-full rounded-default border border-border-subtle bg-readonly-bg px-3 py-2 font-mono text-sm text-readonly-text cursor-not-allowed"
              readOnly
              value={intentText}
            />
            <div className="text-xs text-text-secondary">
              Derived ops are heuristic UI hints; not authoritative data.
            </div>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-default border border-border-subtle px-3 py-2 text-sm font-medium uppercase tracking-button text-text-primary hover:bg-white/10"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-default bg-brand px-3 py-2 text-sm font-medium uppercase tracking-button text-white hover:bg-brand/90"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
