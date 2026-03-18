import { useCallback, useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { containerToSource } from '../utils/coordinates';

interface BoundingBoxToolProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

function getDrawnRect(state: DrawState) {
  const x = Math.min(state.startX, state.currentX);
  const y = Math.min(state.startY, state.currentY);
  const w = Math.abs(state.currentX - state.startX);
  const h = Math.abs(state.currentY - state.startY);
  return { x, y, width: w, height: h };
}

export default function BoundingBoxTool({ containerRef }: BoundingBoxToolProps) {
  const mode = useAppStore((s) => s.mode);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const currentTime = useAppStore((s) => s.currentTime);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const addKeyframe = useAppStore((s) => s.addKeyframe);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const selectKeyframe = useAppStore((s) => s.selectKeyframe);

  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const drawingRef = useRef<DrawState | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerBounds = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - containerBounds.left, containerBounds.width));
      const y = Math.max(0, Math.min(e.clientY - containerBounds.top, containerBounds.height));

      setDrawing((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
    },
    [containerRef],
  );

  const handleMouseUp = useCallback(() => {
    const prev = drawingRef.current;
    setDrawing(null);

    if (!prev || !containerRef.current || !videoMetadata) return;

    const drawnRect = getDrawnRect(prev);

    // Minimum draw size: 20px container pixels
    if (drawnRect.width < 20 || drawnRect.height < 20) return;

    const containerBounds = containerRef.current.getBoundingClientRect();
    const sourceRect = containerToSource(
      drawnRect,
      containerBounds.width,
      containerBounds.height,
      videoMetadata.width,
      videoMetadata.height,
    );

    const newId = `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    addKeyframe({
      id: newId,
      trackId: activeTrackId,
      time: currentTime,
      sourceRect,
      transitionToNext: 'smooth',
    });

    setViewportRect(sourceRect);
    selectKeyframe(newId);
  }, [
    containerRef,
    videoMetadata,
    activeTrackId,
    currentTime,
    addKeyframe,
    setViewportRect,
    selectKeyframe,
  ]);

  // Attach window listeners when drawing
  useEffect(() => {
    if (!drawing) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawing, handleMouseMove, handleMouseUp]);

  // Early return after all hooks
  if (mode !== 'edit') return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const containerBounds = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerBounds.left;
    const y = e.clientY - containerBounds.top;

    setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const drawnRect = drawing ? getDrawnRect(drawing) : null;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 10, cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
    >
      {drawnRect && drawnRect.width > 0 && drawnRect.height > 0 && (
        <div
          className="absolute border-2 border-dashed border-white/80 bg-white/10"
          style={{
            left: drawnRect.x,
            top: drawnRect.y,
            width: drawnRect.width,
            height: drawnRect.height,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
