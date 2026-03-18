import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';

export default function KeyframeDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedKeyframeId = useAppStore((s) => s.selectedKeyframeId);
  const getActiveKeyframes = useAppStore((s) => s.getActiveKeyframes);
  const updateKeyframe = useAppStore((s) => s.updateKeyframe);
  const deleteKeyframe = useAppStore((s) => s.deleteKeyframe);
  const selectKeyframe = useAppStore((s) => s.selectKeyframe);
  const setViewportRect = useAppStore((s) => s.setViewportRect);

  const [t, setT] = useState('');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [w, setW] = useState('');
  const [h, setH] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selectedKeyframeId !== null) {
      const kf = getActiveKeyframes().find((k) => k.id === selectedKeyframeId);
      if (!kf) {
        selectKeyframe(null);
        return;
      }
      setT(String(kf.time));
      setX(String(kf.sourceRect.x));
      setY(String(kf.sourceRect.y));
      setW(String(kf.sourceRect.width));
      setH(String(kf.sourceRect.height));
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [selectedKeyframeId, getActiveKeyframes, selectKeyframe]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      selectKeyframe(null);
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [selectKeyframe]);

  const handleSave = () => {
    if (selectedKeyframeId === null) return;
    const kf = getActiveKeyframes().find((k) => k.id === selectedKeyframeId);
    if (!kf) return;

    const parsedT = parseFloat(t);
    const parsedX = parseFloat(x);
    const parsedY = parseFloat(y);
    const parsedW = parseFloat(w);
    const parsedH = parseFloat(h);

    const newTime = Number.isNaN(parsedT) ? kf.time : parsedT;
    const newX = Number.isNaN(parsedX) ? kf.sourceRect.x : parsedX;
    const newY = Number.isNaN(parsedY) ? kf.sourceRect.y : parsedY;
    const newW = Number.isNaN(parsedW) ? kf.sourceRect.width : parsedW;
    const newH = Number.isNaN(parsedH) ? kf.sourceRect.height : parsedH;

    const sourceRect = { x: newX, y: newY, width: newW, height: newH };
    updateKeyframe(selectedKeyframeId, { time: newTime, sourceRect });
    setViewportRect(sourceRect);
    selectKeyframe(null);
  };

  const handleDelete = () => {
    if (selectedKeyframeId === null) return;
    deleteKeyframe(selectedKeyframeId);
    selectKeyframe(null);
  };

  const handleCancel = () => {
    selectKeyframe(null);
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(520px,92vw)] rounded-2xl border bg-white p-0 shadow-xl"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">
              Keyframe {selectedKeyframeId}
            </div>
            <div className="text-xs text-slate-500">t, x, y, w, h</div>
          </div>
          <button
            className="rounded-lg border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={handleCancel}
          >
            &#10005;
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">t (sec)</span>
            <input
              type="number"
              step="0.001"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              value={t}
              onChange={(e) => setT(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">x</span>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              value={x}
              onChange={(e) => setX(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">y</span>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              value={y}
              onChange={(e) => setY(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">w</span>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              value={w}
              onChange={(e) => setW(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">h</span>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
              value={h}
              onChange={(e) => setH(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
