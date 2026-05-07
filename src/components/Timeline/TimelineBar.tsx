import { useEffect, useRef, useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { deriveSegments, resolve } from '../../engine/cre';
import { useVideoRef } from '../VideoRefContext';
import type { Keyframe } from '../../types';
import { selectActiveKeyframes, selectActiveClipRange } from '../../store/selectors';
import { TL_X0, TL_X1, TIMELINE_POPOVER_WIDTH } from '../../config';
import { xFor, timeFromClientX, getTickInterval } from './timelineLayout';
import TimelineAxis from './TimelineAxis';
import TimelineRange from './TimelineRange';
import TimelineSegments from './TimelineSegments';
import type { SegmentItem } from './TimelineSegments';
import TimelineKeyframes from './TimelineKeyframes';
import TransitionPicker from './TransitionPicker';
import TimelineScrollbar from './TimelineScrollbar';

type DragState =
  | { type: 'pending'; startTime: number; startClientX: number }
  | { type: 'create-range'; startTime: number; currentTime: number }
  | { type: 'resize-handle'; side: 'in' | 'out'; otherEdgeTime: number };

type PickerState = { startKfId: string } | null;

export default function TimelineBar() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useVideoRef();

  const currentTime = useAppStore((s) => s.currentTime);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const keyframes = useAppStore(selectActiveKeyframes);
  const trackRange = useAppStore(selectActiveClipRange);
  const duration = videoMetadata?.duration ?? 60;
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const setTrackRange = useAppStore((s) => s.setTrackRange);
  const setTransition = useAppStore((s) => s.setTransition);
  const zoomLevel = useAppStore((s) => s.timelineZoom);
  const zoomOffset = useAppStore((s) => s.timelineZoomOffset);
  const setZoomLevel = useAppStore((s) => s.setTimelineZoom);
  const setZoomOffset = useAppStore((s) => s.setTimelineZoomOffset);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pickerState, setPickerState] = useState<PickerState>(null);

  const visibleDuration = duration / zoomLevel;
  const visibleStart = Math.max(0, Math.min(zoomOffset, duration - visibleDuration));
  const visibleEnd = visibleStart + visibleDuration;
  const xAt = (t: number) => xFor(t, visibleStart, visibleDuration);

  // Stable ref so window event listeners read current layout without stale closures
  const dragParamsRef = useRef({ visibleStart, visibleDuration, duration, svgRef, zoomOffset });
  dragParamsRef.current = { visibleStart, visibleDuration, duration, svgRef, zoomOffset };

  const getTimeAt = (clientX: number): number => {
    const { svgRef: r, visibleStart: vs, visibleDuration: vd, duration: dur } = dragParamsRef.current;
    return r.current ? timeFromClientX(clientX, r.current, vs, vd, dur) : 0;
  };

  // Window drag listeners — active only while a drag is in progress
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) =>
      setDragState((prev) => {
        if (!prev) return null;
        if (prev.type === 'pending') {
          if (Math.abs(e.clientX - prev.startClientX) > 4)
            return { type: 'create-range', startTime: prev.startTime, currentTime: getTimeAt(e.clientX) };
          return prev;
        }
        if (prev.type === 'create-range') return { ...prev, currentTime: getTimeAt(e.clientX) };
        if (prev.type === 'resize-handle') {
          const t = getTimeAt(e.clientX);
          setTrackRange(prev.side === 'in' ? t : prev.otherEdgeTime, prev.side === 'out' ? t : prev.otherEdgeTime);
          return prev;
        }
        return prev;
      });
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setDragState((prev) => {
        if (!prev) return null;
        if (prev.type === 'pending') {
          const time = prev.startTime;
          if (videoRef.current) videoRef.current.currentTime = time;
          setCurrentTime(time);
          const { tracks, activeTrackId, videoMetadata: meta } = useAppStore.getState();
          const kfs = tracks.find((t) => t.id === activeTrackId)?.keyframes ?? [];
          if (meta && kfs.length > 0) {
            const { sourceRect } = resolve(time, kfs, { width: meta.width, height: meta.height }, meta.fps);
            setViewportRect(sourceRect);
          }
        } else if (prev.type === 'create-range') {
          setTrackRange(prev.startTime, prev.currentTime);
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Non-passive wheel handler for horizontal panning when zoomed
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (zoomLevel <= 1) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      const { visibleDuration: vd, duration: dur, zoomOffset: cur } = dragParamsRef.current;
      setZoomOffset(Math.max(0, Math.min(dur - vd, cur + (delta / 300) * vd)));
      useAppStore.getState().setTimelineFollowPaused(true);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomLevel, visibleDuration, duration]);

  // Auto-follow: keep playhead visible; keyed on currentTime only
  useEffect(() => {
    const { visibleStart: vs, visibleDuration: vd, duration: dur } = dragParamsRef.current;
    if (vd >= dur) return;
    const inView = currentTime >= vs && currentTime <= vs + vd;
    const { timelineFollowPaused, setTimelineFollowPaused } = useAppStore.getState();
    if (inView) { if (timelineFollowPaused) setTimelineFollowPaused(false); return; }
    if (timelineFollowPaused) return;
    setZoomOffset(Math.max(0, Math.min(dur - vd, currentTime - vd * 0.1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  // Close picker on Escape or click outside
  useEffect(() => {
    if (!pickerState) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerState(null); };
    const onDown = (e: MouseEvent) => {
      const popover = document.getElementById('tl-transition-picker');
      if (popover && !popover.contains(e.target as Node)) setPickerState(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [pickerState]);

  const handleZoomIn = () => {
    if (zoomLevel >= 256) return;
    const newZoom = zoomLevel * 2;
    const newVisible = duration / newZoom;
    setZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
    setZoomLevel(newZoom);
  };
  const handleZoomOut = () => {
    if (zoomLevel <= 1) return;
    const newZoom = zoomLevel / 2;
    const newVisible = duration / newZoom;
    setZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
    setZoomLevel(newZoom);
  };

  // Converts a React SVG mouse event to a {svgX, ratio, time} tuple
  const svgPointFromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const ratio = (svgPt.x - TL_X0) / (TL_X1 - TL_X0);
    return { svgX: svgPt.x, ratio, time: visibleStart + ratio * visibleDuration };
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const result = svgPointFromEvent(e);
    if (!result) return;
    setDragState({ type: 'pending', startTime: Math.max(0, Math.min(duration, result.time)), startClientX: e.clientX });
    setPickerState(null);
  };
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const result = svgPointFromEvent(e);
    if (!result) return;
    if (result.ratio >= 0 && result.ratio <= 1) { setHoverTime(result.time); setHoverX(result.svgX); }
    else setHoverTime(null);
  };

  // ── Pre-computed values for sub-components ──────────────────────────────────
  const segments = deriveSegments(keyframes);
  const tickInterval = getTickInterval(visibleDuration);
  const firstTick = Math.ceil(visibleStart / tickInterval) * tickInterval;
  const ticks: { t: number; x: number }[] = [];
  for (let t = firstTick; t < visibleEnd; t += tickInterval) ticks.push({ t, x: xAt(t) });
  const playheadX = xAt(currentTime);
  const playheadVisible = currentTime >= visibleStart && currentTime <= visibleEnd;
  const tooltipX = Math.max(TL_X0 + 40, Math.min(TL_X1 - 40, hoverX));

  const bandRange = dragState?.type === 'create-range'
    ? { inTime: Math.min(dragState.startTime, dragState.currentTime), outTime: Math.max(dragState.startTime, dragState.currentTime), isPreview: true }
    : { inTime: trackRange.inTime, outTime: trackRange.outTime, isPreview: false };
  const rangeCollapsed = bandRange.inTime === bandRange.outTime;
  const bandX1 = Math.max(TL_X0, xAt(Math.max(bandRange.inTime, visibleStart)));
  const bandX2 = Math.min(TL_X1, xAt(Math.min(bandRange.outTime, visibleEnd)));
  const showBand = !rangeCollapsed && bandRange.outTime > visibleStart && bandRange.inTime < visibleEnd;
  const showHandles = videoMetadata !== null && duration > 0 && !rangeCollapsed;

  const segmentItems: SegmentItem[] = segments
    .filter((seg) => seg.endTime >= visibleStart && seg.startTime <= visibleEnd)
    .map((seg) => {
      const x1 = xAt(Math.max(seg.startTime, visibleStart));
      const x2 = xAt(Math.min(seg.endTime, visibleEnd));
      return {
        segKey: `${seg.startKeyframe.id}|${seg.endKeyframe.id}`,
        x1, x2, w: Math.max(2, x2 - x1),
        fill: seg.transition === 'cut' ? 'rgba(251, 146, 60, 0.45)' : 'rgba(56, 189, 248, 0.45)',
        startKfId: seg.startKeyframe.id,
        isActive: pickerState?.startKfId === seg.startKeyframe.id,
        transition: seg.transition,
      };
    });
  const keyframeItems = keyframes
    .filter((kf) => kf.time >= visibleStart && kf.time <= visibleEnd)
    .map((kf): { kf: Keyframe; cx: number } => ({ kf, cx: xAt(kf.time) }));

  const popoverLeft = (() => {
    if (!pickerState || !wrapperRef.current) return 0;
    const seg = segments.find((s) => s.startKeyframe.id === pickerState.startKfId);
    if (!seg) return 0;
    const wrapperW = wrapperRef.current.offsetWidth ?? 200;
    const segCenterPx = (xAt((seg.startTime + seg.endTime) / 2) / 1000) * wrapperW;
    return Math.max(4, Math.min(segCenterPx - TIMELINE_POPOVER_WIDTH / 2, wrapperW - TIMELINE_POPOVER_WIDTH - 4));
  })();
  const popoverArrowLeft = (() => {
    if (!pickerState || !wrapperRef.current) return TIMELINE_POPOVER_WIDTH / 2;
    const seg = segments.find((s) => s.startKeyframe.id === pickerState.startKfId);
    if (!seg) return TIMELINE_POPOVER_WIDTH / 2;
    const wrapperW = wrapperRef.current.offsetWidth ?? 200;
    const segCenterPx = (xAt((seg.startTime + seg.endTime) / 2) / 1000) * wrapperW;
    return Math.max(8, Math.min(segCenterPx - popoverLeft, TIMELINE_POPOVER_WIDTH - 8));
  })();
  const activeTransition = keyframes.find((k) => k.id === pickerState?.startKfId)?.transitionToNext ?? null;

  return (
    <div ref={wrapperRef} className="shrink-0 relative rounded-default border border-border-subtle bg-surface-raised">
      <div className="absolute top-1 right-2 z-10 flex items-center gap-0.5">
        <button onClick={handleZoomOut} disabled={zoomLevel <= 1} className="rounded px-1.5 py-0.5 text-base leading-none text-text-secondary hover:bg-white/10 disabled:opacity-30" title="Zoom out">−</button>
        <span className="w-7 text-center text-xs tabular-nums text-text-disabled">{zoomLevel}×</span>
        <button onClick={handleZoomIn} disabled={zoomLevel >= 256} className="rounded px-1.5 py-0.5 text-base leading-none text-text-secondary hover:bg-white/10 disabled:opacity-30" title="Zoom in">+</button>
      </div>
      <svg ref={svgRef} viewBox="0 0 1000 75" className="w-full"
        onMouseDown={handleSvgMouseDown} onMouseMove={handleSvgMouseMove} onMouseLeave={() => setHoverTime(null)}>
        <TimelineAxis ticks={ticks} playheadX={playheadX} playheadVisible={playheadVisible}
          currentTime={currentTime} hoverTime={hoverTime} tooltipX={tooltipX} />
        <TimelineRange showBand={showBand} bandX1={bandX1} bandX2={bandX2} isPreview={bandRange.isPreview}
          showHandles={showHandles} handleInX={xAt(trackRange.inTime)} handleOutX={xAt(trackRange.outTime)}
          inTime={trackRange.inTime} outTime={trackRange.outTime}
          onInHandleMouseDown={(e) => { e.stopPropagation(); setDragState({ type: 'resize-handle', side: 'in', otherEdgeTime: trackRange.outTime }); }}
          onOutHandleMouseDown={(e) => { e.stopPropagation(); setDragState({ type: 'resize-handle', side: 'out', otherEdgeTime: trackRange.inTime }); }} />
        <TimelineSegments items={segmentItems} isPickerOpen={pickerState !== null}
          onSegmentClick={(id) => setPickerState({ startKfId: id })} />
        <TimelineKeyframes items={keyframeItems} onKeyframeClick={(kf) => {
          setCurrentTime(kf.time);
          if (videoRef.current) videoRef.current.currentTime = kf.time;
          setViewportRect(kf.sourceRect);
        }} />
      </svg>
      {zoomLevel > 1 && (
        <TimelineScrollbar visibleStart={visibleStart} visibleDuration={visibleDuration} duration={duration}
          onSeekOffset={setZoomOffset}
          onPauseFollow={() => useAppStore.getState().setTimelineFollowPaused(true)} />
      )}
      {pickerState && (
        <TransitionPicker activeTransition={activeTransition} popoverLeft={popoverLeft}
          popoverArrowLeft={popoverArrowLeft}
          onSelect={(t) => { setTransition(pickerState.startKfId, t); setPickerState(null); }} />
      )}
    </div>
  );
}
