import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveSegments, resolve } from '../engine/cre';
import { useVideoRef } from './VideoRefContext';
import type { Keyframe, ClipRange } from '../types';

const TL_X0 = 40;
const TL_X1 = 960;
const TL_Y = 35;

// Hoisted to module scope so selector fallbacks return stable references — inline literals trigger useSyncExternalStore infinite loops.
const EMPTY_KEYFRAMES: Keyframe[] = [];
const EMPTY_RANGE: ClipRange = { inTime: 0, outTime: 0 };

// Drag-state discriminated union
type DragState =
  | { type: 'pending'; startTime: number; startClientX: number }
  | { type: 'create-range'; startTime: number; currentTime: number }
  | { type: 'resize-handle'; side: 'in' | 'out'; otherEdgeTime: number };

// Picker state: which segment was clicked. Popover X is derived from the segment center.
type PickerState = { startKfId: string } | null;


function formatTickLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTickInterval(visibleDuration: number, targetTicks = 8): number {
  const raw = visibleDuration / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export default function TimelineBar() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useVideoRef();

  const currentTime = useAppStore((s) => s.currentTime);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const keyframes = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? EMPTY_KEYFRAMES,
  );
  const trackRange = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.range ?? EMPTY_RANGE,
  );
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

  // Keep a stable ref to the values needed inside window event listeners so
  // the listeners don't capture stale closure state.
  const dragParamsRef = useRef({ visibleStart, visibleDuration, duration, svgRef, zoomOffset });
  dragParamsRef.current = { visibleStart, visibleDuration, duration, svgRef, zoomOffset };

  const xFor = (time: number) =>
    TL_X0 + ((time - visibleStart) / visibleDuration) * (TL_X1 - TL_X0);

  // Convert a raw clientX coordinate to a timeline time value.
  // Reads live values from dragParamsRef so it's safe inside window listeners.
  const timeFromClientX = (clientX: number): number => {
    const { svgRef: ref, visibleStart: vs, visibleDuration: vd, duration: dur } =
      dragParamsRef.current;
    const svg = ref.current;
    if (!svg) return 0;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 0;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const ratio = (svgPt.x - TL_X0) / (TL_X1 - TL_X0);
    return Math.max(0, Math.min(dur, vs + ratio * vd));
  };

  const svgPointFromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const ratio = (svgPt.x - TL_X0) / (TL_X1 - TL_X0);
    return { svgX: svgPt.x, ratio, time: visibleStart + ratio * visibleDuration };
  };

  // SVG mousedown — empty area only (segments/diamonds/handles call stopPropagation)
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const result = svgPointFromEvent(e);
    if (!result) return;
    const time = Math.max(0, Math.min(duration, result.time));
    setDragState({ type: 'pending', startTime: time, startClientX: e.clientX });
    // Close picker when the user mouses down elsewhere on the SVG
    setPickerState(null);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const result = svgPointFromEvent(e);
    if (!result) return;
    if (result.ratio >= 0 && result.ratio <= 1) {
      setHoverTime(result.time);
      setHoverX(result.svgX);
    } else {
      setHoverTime(null);
    }
  };

  // Window-level mouse listeners active only while a drag is in progress.
  // We depend on `dragState !== null` (boolean) rather than the full object so
  // we add/remove listeners exactly once per drag start/end, not on every move.
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState((prev) => {
        if (!prev) return null;

        if (prev.type === 'pending') {
          if (Math.abs(e.clientX - prev.startClientX) > 4) {
            const t = timeFromClientX(e.clientX);
            return { type: 'create-range', startTime: prev.startTime, currentTime: t };
          }
          return prev;
        }

        if (prev.type === 'create-range') {
          return { ...prev, currentTime: timeFromClientX(e.clientX) };
        }

        if (prev.type === 'resize-handle') {
          const t = timeFromClientX(e.clientX);
          const inTime = prev.side === 'in' ? t : prev.otherEdgeTime;
          const outTime = prev.side === 'out' ? t : prev.otherEdgeTime;
          setTrackRange(inTime, outTime);
          return prev;
        }

        return prev;
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      setDragState((prev) => {
        if (!prev) return null;

        if (prev.type === 'pending') {
          // Short click — seek to the pressed time and sync viewport to the
          // CRE-resolved rect at that moment so the framing box reflects the
          // interpolated position, not the last user-set rect.
          const time = prev.startTime;
          if (videoRef.current) videoRef.current.currentTime = time;
          setCurrentTime(time);
          const { tracks, activeTrackId, videoMetadata: meta } = useAppStore.getState();
          const kfs = tracks.find((t) => t.id === activeTrackId)?.keyframes ?? [];
          if (meta && kfs.length > 0) {
            const { sourceRect } = resolve(
              time,
              kfs,
              { width: meta.width, height: meta.height },
              meta.fps,
            );
            setViewportRect(sourceRect);
          }
        } else if (prev.type === 'create-range') {
          setTrackRange(prev.startTime, prev.currentTime);
        }
        // resize-handle: store already updated live in mousemove

        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

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

  // Non-passive wheel handler for horizontal panning when zoomed
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      if (zoomLevel <= 1) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      const { visibleDuration: vd, duration: dur, zoomOffset: currentOffset } = dragParamsRef.current;
      const timeShift = (delta / 300) * vd;
      setZoomOffset(Math.max(0, Math.min(dur - vd, currentOffset + timeShift)));
      useAppStore.getState().setTimelineFollowPaused(true);
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, visibleDuration, duration]);

  // Auto-follow: keep the playhead inside the visible window when zoomed.
  // Keyed only on currentTime so manual scrolling is preserved until the
  // playhead naturally re-enters the window or until an explicit seek clears
  // the timelineFollowPaused flag.
  useEffect(() => {
    const { visibleStart: vs, visibleDuration: vd, duration: dur } = dragParamsRef.current;
    if (vd >= dur) return;
    const inView = currentTime >= vs && currentTime <= vs + vd;
    const { timelineFollowPaused, setTimelineFollowPaused } = useAppStore.getState();
    if (inView) {
      if (timelineFollowPaused) setTimelineFollowPaused(false);
      return;
    }
    if (timelineFollowPaused) return;
    setZoomOffset(Math.max(0, Math.min(dur - vd, currentTime - vd * 0.1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  // Escape key closes the picker; attached only while picker is open
  useEffect(() => {
    if (!pickerState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerState(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pickerState]);

  // Click outside the popover closes it
  useEffect(() => {
    if (!pickerState) return;
    const handleMouseDown = (e: MouseEvent) => {
      const popover = document.getElementById('tl-transition-picker');
      if (popover && !popover.contains(e.target as Node)) {
        setPickerState(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [pickerState]);

  const segments = deriveSegments(keyframes);

  const tickInterval = getTickInterval(visibleDuration);
  const firstTick = Math.ceil(visibleStart / tickInterval) * tickInterval;
  const ticks: number[] = [];
  for (let t = firstTick; t < visibleEnd; t += tickInterval) ticks.push(t);

  const playheadX = xFor(currentTime);
  const playheadVisible = currentTime >= visibleStart && currentTime <= visibleEnd;
  const tooltipX = Math.max(TL_X0 + 40, Math.min(TL_X1 - 40, hoverX));

  // Determine which band to render: preview during drag, or committed range otherwise
  const bandRange =
    dragState?.type === 'create-range'
      ? {
          inTime: Math.min(dragState.startTime, dragState.currentTime),
          outTime: Math.max(dragState.startTime, dragState.currentTime),
          isPreview: true,
        }
      : {
          inTime: trackRange.inTime,
          outTime: trackRange.outTime,
          isPreview: false,
        };

  const rangeCollapsed = bandRange.inTime === bandRange.outTime;
  const bandX1 = Math.max(TL_X0, xFor(Math.max(bandRange.inTime, visibleStart)));
  const bandX2 = Math.min(TL_X1, xFor(Math.min(bandRange.outTime, visibleEnd)));
  const showBand =
    !rangeCollapsed &&
    bandRange.outTime > visibleStart &&
    bandRange.inTime < visibleEnd;

  // Handles are shown only for the committed (store) range
  const showHandles = videoMetadata !== null && duration > 0 && !rangeCollapsed;
  const handleInX = xFor(trackRange.inTime);
  const handleOutX = xFor(trackRange.outTime);

  // Popover X is anchored to the active segment's pixel center, clamped to wrapper width.
  const POPOVER_WIDTH = 200;
  const popoverLeft = (() => {
    if (!pickerState || !wrapperRef.current) return 0;
    const seg = segments.find((s) => s.startKeyframe.id === pickerState.startKfId);
    if (!seg) return 0;
    const wrapperW = wrapperRef.current.offsetWidth ?? 200;
    const segCenterTime = (seg.startTime + seg.endTime) / 2;
    const segCenterViewbox = xFor(segCenterTime);
    const segCenterPx = (segCenterViewbox / 1000) * wrapperW;
    return Math.max(4, Math.min(segCenterPx - POPOVER_WIDTH / 2, wrapperW - POPOVER_WIDTH - 4));
  })();
  // Where to anchor the chevron tip (segment center, in the popover's local coord space).
  const popoverArrowLeft = (() => {
    if (!pickerState || !wrapperRef.current) return POPOVER_WIDTH / 2;
    const seg = segments.find((s) => s.startKeyframe.id === pickerState.startKfId);
    if (!seg) return POPOVER_WIDTH / 2;
    const wrapperW = wrapperRef.current.offsetWidth ?? 200;
    const segCenterTime = (seg.startTime + seg.endTime) / 2;
    const segCenterPx = (xFor(segCenterTime) / 1000) * wrapperW;
    return Math.max(8, Math.min(segCenterPx - popoverLeft, POPOVER_WIDTH - 8));
  })();

  return (
    // Note: overflow-hidden removed so the picker popover can extend above the bar
    <div ref={wrapperRef} className="shrink-0 relative rounded-default border border-border-subtle bg-surface-raised">
      {/* Zoom controls */}
      <div className="absolute top-1 right-2 z-10 flex items-center gap-0.5">
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 1}
          className="rounded px-1.5 py-0.5 text-base leading-none text-text-secondary hover:bg-white/10 disabled:opacity-30"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-7 text-center text-xs tabular-nums text-text-disabled">{zoomLevel}×</span>
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 256}
          className="rounded px-1.5 py-0.5 text-base leading-none text-text-secondary hover:bg-white/10 disabled:opacity-30"
          title="Zoom in"
        >
          +
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 75"
        className="w-full"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* 1. Axis line */}
        <line
          x1={TL_X0} y1={TL_Y} x2={TL_X1} y2={TL_Y}
          stroke="rgba(255,255,255,0.2)" strokeWidth={2}
        />

        {/* 2. Time ticks + labels */}
        {ticks.map((t) => {
          const x = xFor(t);
          return (
            <g key={t}>
              <line x1={x} y1={29} x2={x} y2={41} stroke="rgba(255,255,255,0.25)" />
              <text x={x} y={20} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" pointerEvents="none">
                {formatTickLabel(t)}
              </text>
            </g>
          );
        })}

        {/* 3. Clip-range band — before segments so segments/keyframes overlay it */}
        {showBand && (
          <rect
            x={bandX1}
            y={20}
            width={Math.max(0, bandX2 - bandX1)}
            height={30}
            rx={3}
            fill={bandRange.isPreview ? 'rgba(228, 2, 44, 0.18)' : 'rgba(228, 2, 44, 0.10)'}
            stroke={bandRange.isPreview ? 'rgba(228, 2, 44, 0.5)' : 'none'}
            strokeWidth={1}
            pointerEvents="none"
          />
        )}

        {/* 4. Segment bars */}
        {segments.map((seg) => {
          if (seg.endTime < visibleStart || seg.startTime > visibleEnd) return null;
          const x1 = xFor(Math.max(seg.startTime, visibleStart));
          const x2 = xFor(Math.min(seg.endTime, visibleEnd));
          const w = Math.max(2, x2 - x1);
          const segKey = `${seg.startKeyframe.id}|${seg.endKeyframe.id}`;
          const segFill =
            seg.transition === 'cut'
              ? 'rgba(251, 146, 60, 0.45)' // orange = cut
              : 'rgba(56, 189, 248, 0.45)'; // sky blue = smooth
          const isActive = pickerState?.startKfId === seg.startKeyframe.id;
          const isPickerOpen = pickerState !== null;
          const segOpacity = isPickerOpen && !isActive ? 0.5 : 1;
          return (
            <g key={segKey}>
              <rect
                x={x1} y={25} width={w} height={20} rx={2}
                fill={segFill}
                opacity={segOpacity}
                stroke={isActive ? 'rgba(255,255,255,0.85)' : 'none'}
                strokeWidth={isActive ? 1.5 : 0}
                cursor="pointer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerState({ startKfId: seg.startKeyframe.id });
                }}
              >
                <title>{seg.transition}</title>
              </rect>
            </g>
          );
        })}

        {/* 5. Range handles — after segments, before diamonds */}
        {showHandles && (
          <>
            <rect
              x={handleInX - 3}
              y={20}
              width={3}
              height={30}
              rx={2}
              fill="#E4022C"
              cursor="ew-resize"
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragState({
                  type: 'resize-handle',
                  side: 'in',
                  otherEdgeTime: trackRange.outTime,
                });
              }}
            />
            <rect
              x={handleOutX - 3}
              y={20}
              width={3}
              height={30}
              rx={2}
              fill="#E4022C"
              cursor="ew-resize"
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragState({
                  type: 'resize-handle',
                  side: 'out',
                  otherEdgeTime: trackRange.inTime,
                });
              }}
            />
          </>
        )}

        {/* 6. Keyframe dots */}
        {keyframes.map((kf) => {
          if (kf.time < visibleStart || kf.time > visibleEnd) return null;
          const cx = xFor(kf.time);
          return (
            <circle
              key={kf.id}
              cx={cx}
              cy={TL_Y}
              r={3}
              fill="#E4022C"
              cursor="pointer"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentTime(kf.time);
                if (videoRef.current) videoRef.current.currentTime = kf.time;
                setViewportRect(kf.sourceRect);
              }}
            />
          );
        })}

        {/* 7. Playhead */}
        {playheadVisible && (
          <line x1={playheadX} y1={4} x2={playheadX} y2={58} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
        )}

        {/* 8. Current timecode below playhead */}
        {playheadVisible && (
          <text x={playheadX} y={70} textAnchor="middle" fontSize={10} fill="#E4022C" fontWeight={600}>
            {formatTickLabel(currentTime)}
          </text>
        )}

        {/* 9. Hover timestamp tooltip */}
        {hoverTime !== null && (
          <g pointerEvents="none">
            <rect x={tooltipX - 40} y={2} width={80} height={14} rx={2} fill="rgba(0,0,0,0.75)" />
            <text x={tooltipX} y={12} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)">
              {formatTickLabel(hoverTime)}
            </text>
          </g>
        )}
      </svg>

      {/* Scrollbar — visible only when zoomed in */}
      {zoomLevel > 1 && (
        <div
          className="mx-2 mb-1 h-1.5 rounded-full bg-white/5"
          onMouseDown={(e) => {
            useAppStore.getState().setTimelineFollowPaused(true);
            const trackEl = e.currentTarget;
            const trackRect = trackEl.getBoundingClientRect();
            const thumbWidthPx = (visibleDuration / duration) * trackRect.width;
            const halfThumb = thumbWidthPx / 2;
            const seekFromClientX = (clientX: number) => {
              const x = clientX - trackRect.left - halfThumb;
              const ratio = Math.max(0, Math.min(x / (trackRect.width - thumbWidthPx), 1));
              setZoomOffset(ratio * (duration - visibleDuration));
            };
            seekFromClientX(e.clientX);
            const onMove = (ev: MouseEvent) => seekFromClientX(ev.clientX);
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          <div
            className="h-full rounded-full bg-white/30"
            style={{
              marginLeft: `${(visibleStart / duration) * 100}%`,
              width: `${(visibleDuration / duration) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Transition picker popover — sits above the timeline bar */}
      {pickerState && (() => {
        const activeTransition =
          keyframes.find((k) => k.id === pickerState.startKfId)?.transitionToNext ?? null;
        const smoothActive = activeTransition === 'smooth';
        const cutActive = activeTransition === 'cut';
        return (
          <div
            id="tl-transition-picker"
            className="absolute z-20 flex items-center gap-2 p-1.5 rounded border border-white/30 bg-[#1f2b3a] shadow-elevation-8 whitespace-nowrap"
            style={{
              left: popoverLeft,
              maxWidth: `calc(100% - ${popoverLeft + 4}px)`,
              bottom: 'calc(100% + 6px)',
            }}
          >
            <span className="px-1 text-xs uppercase tracking-button text-text-secondary">
              Transition
            </span>
            <button
              className={`px-2 py-1 text-xs rounded border ${
                smoothActive
                  ? 'border-sky-400 bg-[rgba(56,189,248,0.45)] text-white font-medium'
                  : 'border-sky-400/40 text-sky-300 hover:bg-sky-400/10'
              }`}
              tabIndex={-1}
              onClick={() => {
                setTransition(pickerState.startKfId, 'smooth');
                setPickerState(null);
              }}
            >
              Smooth
            </button>
            <button
              className={`px-2 py-1 text-xs rounded border ${
                cutActive
                  ? 'border-orange-400 bg-[rgba(251,146,60,0.45)] text-white font-medium'
                  : 'border-orange-400/40 text-orange-300 hover:bg-orange-400/10'
              }`}
              tabIndex={-1}
              onClick={() => {
                setTransition(pickerState.startKfId, 'cut');
                setPickerState(null);
              }}
            >
              Cut
            </button>
            {/* Chevron pointing down to the active segment */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: popoverArrowLeft - 6,
                top: '100%',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid rgba(255,255,255,0.3)',
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: popoverArrowLeft - 5,
                top: '100%',
                marginTop: -1,
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #1f2b3a',
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
