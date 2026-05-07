import { useCallback, useEffect, useRef, useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { containerToSource } from '../../utils/coordinates';
import type { Keyframe } from '../../types';

const EMPTY_KEYFRAMES: Keyframe[] = [];

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
  const viewportRect = useAppStore((s) => s.viewportRect);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const keyframes = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? EMPTY_KEYFRAMES,
  );

  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const drawingRef = useRef<DrawState | null>(null);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerBounds = containerRef.current.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(e.clientX - containerBounds.left, containerBounds.width));
      const clampedY = Math.max(0, Math.min(e.clientY - containerBounds.top, containerBounds.height));

      let cx = clampedX;
      let cy = clampedY;
      if (e.shiftKey && drawingRef.current) {
        const meta = useAppStore.getState().videoMetadata;
        if (meta) {
          const aspect = meta.width / meta.height;
          const { startX, startY } = drawingRef.current;
          const dx = cx - startX;
          const dy = cy - startY;
          const wantedH = Math.abs(dx) / aspect;
          if (Math.abs(dy) >= wantedH) {
            cx = startX + Math.sign(dx || 1) * Math.abs(dy) * aspect;
          } else {
            cy = startY + Math.sign(dy || 1) * Math.abs(dx) / aspect;
          }
          cx = Math.max(0, Math.min(cx, containerBounds.width));
          cy = Math.max(0, Math.min(cy, containerBounds.height));
        }
      }
      setDrawing((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));
    },
    [containerRef],
  );

  const handleMouseUp = useCallback(() => {
    const prev = drawingRef.current;
    setDrawing(null);

    if (!prev || !containerRef.current || !videoMetadata) return;

    const drawnRect = getDrawnRect(prev);
    if (drawnRect.width < 20 || drawnRect.height < 20) return;

    const containerBounds = containerRef.current.getBoundingClientRect();
    const sourceRect = containerToSource(
      drawnRect,
      containerBounds.width,
      containerBounds.height,
      videoMetadata.width,
      videoMetadata.height,
    );

    setViewportRect(sourceRect);
  }, [containerRef, videoMetadata, setViewportRect]);

  useEffect(() => {
    if (!drawing) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawing, handleMouseMove, handleMouseUp]);

  if (activeTrackId === '') return null;
  if (mode !== 'edit') return null;
  if (viewportRect !== null || keyframes.length > 0) return null;

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
