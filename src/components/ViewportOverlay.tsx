import { useCallback, useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { sourceToPercent, getVideoRenderArea } from '../utils/coordinates';
import type { SourceRect } from '../types';

type Corner = 'nw' | 'ne' | 'sw' | 'se';

type Interaction =
  | { type: 'drag'; startMouse: { x: number; y: number }; startRect: SourceRect }
  | {
      type: 'resize';
      corner: Corner;
      startMouse: { x: number; y: number };
      startRect: SourceRect;
    };

interface ViewportOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ViewportOverlay({ containerRef }: ViewportOverlayProps) {
  const viewportDivRef = useRef<HTMLDivElement>(null);
  const mode = useAppStore((s) => s.mode);
  const viewportRect = useAppStore((s) => s.viewportRect);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const setViewportRect = useAppStore((s) => s.setViewportRect);

  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const videoWidth = videoMetadata?.width ?? 0;
  const videoHeight = videoMetadata?.height ?? 0;

  const isEdit = mode === 'edit';

  const clampRect = useCallback(
    (rect: SourceRect): SourceRect => {
      const minW = videoWidth * 0.1;
      const minH = videoHeight * 0.1;
      const w = Math.min(Math.max(rect.width, minW), videoWidth);
      const h = Math.min(Math.max(rect.height, minH), videoHeight);
      const x = Math.min(Math.max(rect.x, 0), videoWidth - w);
      const y = Math.min(Math.max(rect.y, 0), videoHeight - h);
      return { x, y, width: w, height: h };
    },
    [videoWidth, videoHeight],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!interaction || !containerRef.current) return;

      const containerBounds = containerRef.current.getBoundingClientRect();
      const containerW = containerBounds.width;
      const containerH = containerBounds.height;
      const { renderWidth, renderHeight } = getVideoRenderArea(
        containerW, containerH, videoWidth, videoHeight,
      );

      let dx = e.clientX - interaction.startMouse.x;
      let dy = e.clientY - interaction.startMouse.y;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }

      // Convert pixel deltas to source coords using render dimensions (not container)
      const dxSource = (dx / renderWidth) * videoWidth;
      const dySource = (dy / renderHeight) * videoHeight;

      if (interaction.type === 'drag') {
        const newRect: SourceRect = {
          x: interaction.startRect.x + dxSource,
          y: interaction.startRect.y + dySource,
          width: interaction.startRect.width,
          height: interaction.startRect.height,
        };
        setViewportRect(clampRect(newRect));
      } else if (interaction.type === 'resize') {
        const { corner, startRect } = interaction;
        let newX = startRect.x;
        let newY = startRect.y;
        let newW = startRect.width;
        let newH = startRect.height;

        if (corner === 'nw') {
          newX = startRect.x + dxSource;
          newY = startRect.y + dySource;
          newW = startRect.width - dxSource;
          newH = startRect.height - dySource;
        } else if (corner === 'ne') {
          newY = startRect.y + dySource;
          newW = startRect.width + dxSource;
          newH = startRect.height - dySource;
        } else if (corner === 'sw') {
          newX = startRect.x + dxSource;
          newW = startRect.width - dxSource;
          newH = startRect.height + dySource;
        } else if (corner === 'se') {
          newW = startRect.width + dxSource;
          newH = startRect.height + dySource;
        }

        setViewportRect(clampRect({ x: newX, y: newY, width: newW, height: newH }));
      }
    },
    [interaction, containerRef, videoWidth, videoHeight, setViewportRect, clampRect],
  );

  const handleMouseUp = useCallback(() => {
    // Stash the interaction before clearing so we can compare rects below
    const currentInteraction = interaction;
    setInteraction(null);

    if (currentInteraction === null) return;

    // Gesture-end write: only when recording + paused (not playing)
    const { recordingState, isPlaying, viewportRect: finalRect, currentTime, commitKeyframeAtTime } =
      useAppStore.getState();

    if (recordingState !== 'recording' || isPlaying) return;
    if (finalRect === null) return;

    // No-op if the gesture didn't actually move the rect
    const { startRect } = currentInteraction;
    if (
      finalRect.x === startRect.x &&
      finalRect.y === startRect.y &&
      finalRect.width === startRect.width &&
      finalRect.height === startRect.height
    ) {
      return;
    }

    commitKeyframeAtTime(currentTime, finalRect);
  }, [interaction]);

  // Attach/detach window listeners when interaction starts/ends
  useEffect(() => {
    if (!interaction) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, handleMouseMove, handleMouseUp]);

  // Scroll-to-zoom: attach native wheel listener with { passive: false }
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !isEdit) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = useAppStore.getState().viewportRect;
      const meta = useAppStore.getState().videoMetadata;
      if (!rect || !meta) return;

      const vw = meta.width;
      const vh = meta.height;

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

      // Get mouse position relative to the viewport div as a ratio
      const bounds = el.getBoundingClientRect();
      const mouseXRatio = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
      const mouseYRatio = Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height));

      // Compute new size
      let newW = rect.width * zoomFactor;
      let newH = rect.height * zoomFactor;

      // Clamp size: min 10%, max 100% of video dimensions
      newW = Math.min(Math.max(newW, vw * 0.1), vw);
      newH = Math.min(Math.max(newH, vh * 0.1), vh);

      // Adjust position to keep cursor point stationary
      let newX = rect.x + mouseXRatio * (rect.width - newW);
      let newY = rect.y + mouseYRatio * (rect.height - newH);

      // Clamp position to bounds
      newX = Math.min(Math.max(newX, 0), vw - newW);
      newY = Math.min(Math.max(newY, 0), vh - newH);

      useAppStore.getState().setViewportRect({ x: newX, y: newY, width: newW, height: newH });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isEdit, !!viewportRect, !!videoMetadata]);

  // Early returns after all hooks
  if (mode !== 'edit') return null;
  if (!viewportRect || !videoMetadata) return null;

  const container = containerRef.current;
  if (!container) return null;
  const { width: cW, height: cH } = container.getBoundingClientRect();
  const pct = sourceToPercent(viewportRect, videoWidth, videoHeight, cW, cH);

  const handleDragStart = (e: React.MouseEvent) => {
    // Prevent if clicking on a resize handle
    if ((e.target as HTMLElement).dataset.resizeHandle) return;
    e.stopPropagation();

    setInteraction({
      type: 'drag',
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...viewportRect },
    });
  };

  const handleResizeStart = (corner: Corner, e: React.MouseEvent) => {
    e.stopPropagation();
    setInteraction({
      type: 'resize',
      corner,
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...viewportRect },
    });
  };

  const corners: { corner: Corner; cursor: string; position: React.CSSProperties }[] = [
    {
      corner: 'nw',
      cursor: 'nw-resize',
      position: { top: -4, left: -4 },
    },
    {
      corner: 'ne',
      cursor: 'ne-resize',
      position: { top: -4, right: -4 },
    },
    {
      corner: 'sw',
      cursor: 'sw-resize',
      position: { bottom: -4, left: -4 },
    },
    {
      corner: 'se',
      cursor: 'se-resize',
      position: { bottom: -4, right: -4 },
    },
  ];

  const rectLabel = `${Math.round(viewportRect.width)}x${Math.round(viewportRect.height)}`;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 20, pointerEvents: 'none' }}
    >
      <div
        ref={viewportDivRef}
        className={`absolute border-2 border-brand ${isEdit ? 'cursor-move' : ''}`}
        style={{
          left: `${pct.left}%`,
          top: `${pct.top}%`,
          width: `${pct.width}%`,
          height: `${pct.height}%`,
          pointerEvents: isEdit ? 'auto' : 'none',
        }}
        onMouseDown={isEdit ? handleDragStart : undefined}
      >
        {/* Label */}
        <div
          className="absolute -top-6 left-0 rounded-default bg-brand px-1.5 py-0.5 text-xs text-white whitespace-nowrap"
          style={{ pointerEvents: 'none' }}
        >
          Viewport ({rectLabel})
        </div>

        {/* Corner resize handles (edit mode only) */}
        {isEdit &&
          corners.map(({ corner, cursor, position }) => (
            <div
              key={corner}
              data-resize-handle="true"
              className="absolute bg-brand"
              style={{
                width: 8,
                height: 8,
                cursor,
                pointerEvents: 'auto',
                ...position,
              }}
              onMouseDown={(e) => handleResizeStart(corner, e)}
            />
          ))}
      </div>
    </div>
  );
}
