import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { getVideoRenderArea } from '../../utils/coordinates';
import { resolve } from '../../engine/cre';
import type { SourceRect } from '../../types';
import { selectActiveKeyframes } from '../../store/selectors';

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

type Interaction =
  | { type: 'drag'; startMouse: { x: number; y: number }; startRect: SourceRect }
  | { type: 'resize'; corner: Corner; startMouse: { x: number; y: number }; startRect: SourceRect };

export default function useViewportDrag(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mode = useAppStore((s) => s.mode);
  const viewportRect = useAppStore((s) => s.viewportRect);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const currentTime = useAppStore((s) => s.currentTime);
  const keyframes = useAppStore(selectActiveKeyframes);

  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [wheelActive, setWheelActive] = useState(false);
  const wheelTimerRef = useRef<number | null>(null);
  const viewportDivRef = useRef<HTMLDivElement>(null);

  const videoWidth = videoMetadata?.width ?? 0;
  const videoHeight = videoMetadata?.height ?? 0;
  const isEdit = mode === 'edit';

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

  const clampRectAspect = useCallback(
    (rect: SourceRect): SourceRect => {
      const minW = videoWidth * 0.1;
      const minH = videoHeight * 0.1;
      const ratios: number[] = [1];
      if (rect.width > videoWidth) ratios.push(videoWidth / rect.width);
      if (rect.height > videoHeight) ratios.push(videoHeight / rect.height);
      if (rect.width < minW) ratios.push(minW / rect.width);
      if (rect.height < minH) ratios.push(minH / rect.height);
      const shrink = ratios.filter((r) => r <= 1);
      const grow = ratios.filter((r) => r >= 1);
      let scale = 1;
      if (shrink.length > 1) scale = Math.min(...shrink);
      else if (grow.length > 1) scale = Math.max(...grow);
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
      const { renderWidth, renderHeight } = getVideoRenderArea(
        containerBounds.width, containerBounds.height, videoWidth, videoHeight,
      );

      const dx = e.clientX - interaction.startMouse.x;
      const dy = e.clientY - interaction.startMouse.y;
      const dxSource = (dx / renderWidth) * videoWidth;
      const dySource = (dy / renderHeight) * videoHeight;

      if (interaction.type === 'drag') {
        setViewportRect(clampRect({
          x: interaction.startRect.x + dxSource,
          y: interaction.startRect.y + dySource,
          width: interaction.startRect.width,
          height: interaction.startRect.height,
        }));
      } else if (interaction.type === 'resize') {
        const { corner, startRect } = interaction;

        if (e.shiftKey) {
          const signX = corner === 'nw' || corner === 'sw' ? -1 : 1;
          const signY = corner === 'nw' || corner === 'ne' ? -1 : 1;
          const dxNorm = (dxSource * signX) / startRect.width;
          const dyNorm = (dySource * signY) / startRect.height;
          const scale = Math.abs(dxNorm) >= Math.abs(dyNorm) ? 1 + dxNorm : 1 + dyNorm;
          const newW = startRect.width * scale;
          const newH = startRect.height * scale;
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
          setViewportRect(clampRectAspect({ x: newX, y: newY, width: newW, height: newH }));
        } else {
          let newX = startRect.x, newY = startRect.y;
          let newW = startRect.width, newH = startRect.height;
          if (corner === 'nw') {
            newX = startRect.x + dxSource; newY = startRect.y + dySource;
            newW = startRect.width - dxSource; newH = startRect.height - dySource;
          } else if (corner === 'ne') {
            newY = startRect.y + dySource;
            newW = startRect.width + dxSource; newH = startRect.height - dySource;
          } else if (corner === 'sw') {
            newX = startRect.x + dxSource;
            newW = startRect.width - dxSource; newH = startRect.height + dySource;
          } else if (corner === 'se') {
            newW = startRect.width + dxSource; newH = startRect.height + dySource;
          }
          setViewportRect(clampRect({ x: newX, y: newY, width: newW, height: newH }));
        }
      }
    },
    [interaction, containerRef, videoWidth, videoHeight, setViewportRect, clampRect, clampRectAspect],
  );

  const handleMouseUp = useCallback(() => {
    const currentInteraction = interaction;
    setInteraction(null);
    if (currentInteraction === null) return;

    const { recordingState, isPlaying, viewportRect: finalRect, currentTime, commitKeyframeAtTime } =
      useAppStore.getState();

    if (recordingState !== 'recording' || isPlaying) return;
    if (finalRect === null) return;

    const { startRect } = currentInteraction;
    if (
      finalRect.x === startRect.x &&
      finalRect.y === startRect.y &&
      finalRect.width === startRect.width &&
      finalRect.height === startRect.height
    ) return;

    commitKeyframeAtTime(currentTime, finalRect);
  }, [interaction]);

  useEffect(() => {
    if (!interaction) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interaction, handleMouseMove, handleMouseUp]);

  // Non-passive wheel handler; re-attaches only when edit mode or rect presence changes
  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || !isEdit) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = displayedRectRef.current;
      const meta = useAppStore.getState().videoMetadata;
      if (!rect || !meta) return;

      const vw = meta.width, vh = meta.height;
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const bounds = el.getBoundingClientRect();
      const mouseXRatio = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
      const mouseYRatio = Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height));

      const newW = Math.min(Math.max(rect.width * zoomFactor, vw * 0.1), vw);
      const newH = Math.min(Math.max(rect.height * zoomFactor, vh * 0.1), vh);
      const newX = Math.min(Math.max(rect.x + mouseXRatio * (rect.width - newW), 0), vw - newW);
      const newY = Math.min(Math.max(rect.y + mouseYRatio * (rect.height - newH), 0), vh - newH);

      useAppStore.getState().setViewportRect({ x: newX, y: newY, width: newW, height: newH });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, !!viewportRect, !!videoMetadata]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!displayedRect) return;
    if ((e.target as HTMLElement).dataset.resizeHandle) return;
    e.stopPropagation();
    setViewportRect({ ...displayedRect });
    setInteraction({ type: 'drag', startMouse: { x: e.clientX, y: e.clientY }, startRect: { ...displayedRect } });
  };

  const handleResizeStart = (corner: Corner, e: React.MouseEvent) => {
    if (!displayedRect) return;
    e.stopPropagation();
    setViewportRect({ ...displayedRect });
    setInteraction({ type: 'resize', corner, startMouse: { x: e.clientX, y: e.clientY }, startRect: { ...displayedRect } });
  };

  return { displayedRect, handleDragStart, handleResizeStart, viewportDivRef, isEdit };
}
