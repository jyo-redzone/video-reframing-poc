import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { sourceToPercent, getVideoRenderArea } from '../utils/coordinates';
import { resolve } from '../engine/cre';
import type { Keyframe, SourceRect } from '../types';

const EMPTY_KEYFRAMES: Keyframe[] = [];

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
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const currentTime = useAppStore((s) => s.currentTime);
  const keyframes = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? EMPTY_KEYFRAMES,
  );

  const [interaction, setInteraction] = useState<Interaction | null>(null);
  // Wheel-zoom is event-driven (no mousedown/up), so we treat it as a brief
  // interaction window during which the CRE-follow override is suspended.
  const [wheelActive, setWheelActive] = useState(false);
  const wheelTimerRef = useRef<number | null>(null);

  const videoWidth = videoMetadata?.width ?? 0;
  const videoHeight = videoMetadata?.height ?? 0;

  const isEdit = mode === 'edit';

  // The bbox actually shown on screen. While the user is interacting (drag/resize/wheel),
  // we mirror the live `viewportRect` so gestures feel direct. Otherwise, when
  // keyframes exist, follow the CRE-resolved camera at `currentTime` so the bbox
  // tracks playback, prev/next-second seeks, and recording-while-playing.
  const displayedRect: SourceRect | null = useMemo(() => {
    if (interaction !== null || wheelActive) return viewportRect;
    if (keyframes.length > 0 && videoMetadata) {
      return resolve(
        currentTime,
        keyframes,
        { width: videoMetadata.width, height: videoMetadata.height },
        videoMetadata.fps,
      ).sourceRect;
    }
    return viewportRect;
  }, [interaction, wheelActive, viewportRect, keyframes, currentTime, videoMetadata]);

  // Keep a ref so window event handlers can read the latest displayedRect
  // without re-binding listeners on every change.
  const displayedRectRef = useRef(displayedRect);
  displayedRectRef.current = displayedRect;

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

  /**
   * Aspect-preserving clamp: if a candidate rect violates bounds or size limits,
   * scale both dims uniformly by the most-constrained ratio, then position-clamp x/y.
   * This avoids distorting the aspect ratio by clamping each axis independently.
   */
  const clampRectAspect = useCallback(
    (rect: SourceRect): SourceRect => {
      const minW = videoWidth * 0.1;
      const minH = videoHeight * 0.1;
      // Compute the scale factors needed to bring dims within bounds
      const ratios: number[] = [1];
      if (rect.width > videoWidth) ratios.push(videoWidth / rect.width);
      if (rect.height > videoHeight) ratios.push(videoHeight / rect.height);
      if (rect.width < minW) ratios.push(minW / rect.width);
      if (rect.height < minH) ratios.push(minH / rect.height);
      // Use the most-constrained ratio (min for shrink cases, max for grow cases)
      // We separate: shrink ratios (<=1) and grow ratios (>=1)
      const shrink = ratios.filter((r) => r <= 1);
      const grow = ratios.filter((r) => r >= 1);
      let scale = 1;
      if (shrink.length > 1) scale = Math.min(...shrink);      // must shrink
      else if (grow.length > 1) scale = Math.max(...grow);      // must grow
      const w = rect.width * scale;
      const h = rect.height * scale;
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

      const dx = e.clientX - interaction.startMouse.x;
      const dy = e.clientY - interaction.startMouse.y;

      // Convert pixel deltas to source coords using render dimensions (not container)
      const dxSource = (dx / renderWidth) * videoWidth;
      const dySource = (dy / renderHeight) * videoHeight;

      if (interaction.type === 'drag') {
        // Move is always unconstrained — Shift has no effect on drag
        const newRect: SourceRect = {
          x: interaction.startRect.x + dxSource,
          y: interaction.startRect.y + dySource,
          width: interaction.startRect.width,
          height: interaction.startRect.height,
        };
        setViewportRect(clampRect(newRect));
      } else if (interaction.type === 'resize') {
        const { corner, startRect } = interaction;

        if (e.shiftKey) {
          // Aspect-preserving resize: use start rect's aspect ratio
          const aspect = startRect.width / startRect.height;
          // Compute normalized deltas (positive = growing that axis)
          // Sign convention: nw flips both, ne flips y, sw flips x, se keeps both
          const signX = corner === 'nw' || corner === 'sw' ? -1 : 1;
          const signY = corner === 'nw' || corner === 'ne' ? -1 : 1;
          const dxSigned = dxSource * signX;
          const dySigned = dySource * signY;
          const dxNorm = dxSigned / startRect.width;
          const dyNorm = dySigned / startRect.height;
          // Whichever normalized delta is larger drives the scale
          const scale = Math.abs(dxNorm) >= Math.abs(dyNorm)
            ? 1 + dxNorm
            : 1 + dyNorm;
          const newW = startRect.width * scale;
          const newH = startRect.height * scale;
          // Place rect based on corner's anchor
          let newX = startRect.x;
          let newY = startRect.y;
          if (corner === 'nw') {
            newX = startRect.x + (startRect.width - newW);
            newY = startRect.y + (startRect.height - newH);
          } else if (corner === 'ne') {
            newY = startRect.y + (startRect.height - newH);
          } else if (corner === 'sw') {
            newX = startRect.x + (startRect.width - newW);
          }
          // se: x/y anchored at startRect.x/y (top-left stays fixed)
          setViewportRect(clampRectAspect({ x: newX, y: newY, width: newW, height: newH }));
        } else {
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
      }
    },
    [interaction, containerRef, videoWidth, videoHeight, setViewportRect, clampRect, clampRectAspect],
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

      const rect = displayedRectRef.current;
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

      // Hold the wheel-active flag so the CRE-follow override stays suspended
      // while the user is mid-zoom. Cleared shortly after the last wheel event.
      setWheelActive(true);
      if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = window.setTimeout(() => {
        setWheelActive(false);
        wheelTimerRef.current = null;
      }, 250);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (wheelTimerRef.current !== null) {
        clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };
  }, [isEdit, !!viewportRect, !!videoMetadata]);

  // Early returns after all hooks
  if (activeTrackId === '') return null;
  if (mode !== 'edit') return null;
  if (!videoMetadata || !displayedRect) return null;

  const container = containerRef.current;
  if (!container) return null;
  const { width: cW, height: cH } = container.getBoundingClientRect();
  const pct = sourceToPercent(displayedRect, videoWidth, videoHeight, cW, cH);

  const handleDragStart = (e: React.MouseEvent) => {
    // Prevent if clicking on a resize handle
    if ((e.target as HTMLElement).dataset.resizeHandle) return;
    e.stopPropagation();

    // Seed both the gesture and the store from the rect the user actually sees.
    // If we're following CRE, displayedRect differs from viewportRect.
    setViewportRect({ ...displayedRect });
    setInteraction({
      type: 'drag',
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...displayedRect },
    });
  };

  const handleResizeStart = (corner: Corner, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewportRect({ ...displayedRect });
    setInteraction({
      type: 'resize',
      corner,
      startMouse: { x: e.clientX, y: e.clientY },
      startRect: { ...displayedRect },
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

  const rectLabel = `${Math.round(displayedRect.width)}x${Math.round(displayedRect.height)}`;

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
