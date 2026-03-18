import { useCallback, useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { resolve } from '../engine/cre';
import { sourceToPercent } from '../utils/coordinates';
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
  const mode = useAppStore((s) => s.mode);
  const viewType = useAppStore((s) => s.viewType);
  const viewportRect = useAppStore((s) => s.viewportRect);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const currentTime = useAppStore((s) => s.currentTime);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const keyframes = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? [],
  );

  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const videoWidth = videoMetadata?.width ?? 0;
  const videoHeight = videoMetadata?.height ?? 0;

  // Determine which rect to display — cheap computation, no memoization needed
  let displayRect: SourceRect | null;
  if (mode === 'view' && viewType === 'preview') {
    displayRect = null;
  } else if (mode === 'view' && viewType === 'source' && videoMetadata) {
    const bounds = { width: videoMetadata.width, height: videoMetadata.height };
    const resolved = resolve(currentTime, keyframes, bounds, videoMetadata.fps);
    displayRect = resolved.sourceRect;
  } else {
    displayRect = viewportRect;
  }

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

      const dx = e.clientX - interaction.startMouse.x;
      const dy = e.clientY - interaction.startMouse.y;

      // Convert pixel deltas to source coords
      const dxSource = (dx / containerW) * videoWidth;
      const dySource = (dy / containerH) * videoHeight;

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
    setInteraction(null);
  }, []);

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

  // Early returns after all hooks
  if (mode === 'view' && viewType === 'preview') return null;
  if (!displayRect || !videoMetadata) return null;

  const pct = sourceToPercent(displayRect, videoWidth, videoHeight);

  const handleDragStart = (e: React.MouseEvent) => {
    // Prevent if clicking on a resize handle
    if ((e.target as HTMLElement).dataset.resizeHandle) return;
    e.stopPropagation();

    setInteraction({
      type: 'drag',
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...displayRect },
    });
  };

  const handleResizeStart = (corner: Corner, e: React.MouseEvent) => {
    e.stopPropagation();
    setInteraction({
      type: 'resize',
      corner,
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...displayRect },
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

  const rectLabel = `${Math.round(displayRect.width)}x${Math.round(displayRect.height)}`;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 20, pointerEvents: 'none' }}
    >
      <div
        className={`absolute border-2 border-emerald-400/90 ${isEdit ? 'cursor-move' : ''}`}
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
          className="absolute -top-6 left-0 rounded bg-emerald-500 px-1.5 py-0.5 text-xs text-white whitespace-nowrap"
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
              className="absolute bg-emerald-400"
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
