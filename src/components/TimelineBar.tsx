import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveSegments } from '../engine/cre';
import { useVideoRef } from './VideoRefContext';

const TL_X0 = 40;
const TL_X1 = 960;
const TL_Y = 35;

// Drag-state discriminated union
type DragState =
  | { type: 'pending'; startTime: number; startClientX: number }
  | { type: 'create-range'; startTime: number; currentTime: number }
  | { type: 'resize-handle'; side: 'in' | 'out'; otherEdgeTime: number };

// Picker state: which segment was clicked and where the popover should appear
type PickerState = { startKfId: string; clientX: number } | null;

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(Math.floor(s)).padStart(2, '0');
  const ms = String(Math.floor((s - Math.floor(s)) * 1000)).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

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
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? [],
  );
  const trackRange = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.range ?? { inTime: 0, outTime: 0 },
  );
  const duration = videoMetadata?.duration ?? 60;
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const setTrackRange = useAppStore((s) => s.setTrackRange);
  const setTransition = useAppStore((s) => s.setTransition);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pickerState, setPickerState] = useState<PickerState>(null);

  const visibleDuration = duration / zoomLevel;
  const visibleStart = Math.max(0, Math.min(zoomOffset, duration - visibleDuration));
  const visibleEnd = visibleStart + visibleDuration;

  // Keep a stable ref to the values needed inside window event listeners so
  // the listeners don't capture stale closure state.
  const dragParamsRef = useRef({ visibleStart, visibleDuration, duration, svgRef });
  dragParamsRef.current = { visibleStart, visibleDuration, duration, svgRef };

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
          // Short click — seek to the pressed time
          const time = prev.startTime;
          if (videoRef.current) videoRef.current.currentTime = time;
          setCurrentTime(time);
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
    if (zoomLevel >= 16) return;
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
      const timeShift = (delta / 300) * visibleDuration;
      setZoomOffset((prev) => Math.max(0, Math.min(duration - visibleDuration, prev + timeShift)));
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, visibleDuration, duration]);

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

  // Popover left position, clamped to keep it within the wrapper width
  const popoverLeft = (() => {
    if (!pickerState || !wrapperRef.current) return 0;
    const rect = wrapperRef.current.getBoundingClientRect();
    const raw = pickerState.clientX - rect.left;
    return Math.max(0, Math.min(raw, (wrapperRef.current.offsetWidth ?? 200) - 120));
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
          disabled={zoomLevel >= 16}
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
          return (
            <g key={segKey}>
              <rect
                x={x1} y={25} width={w} height={20} rx={2}
                fill={seg.transition === 'cut' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)'}
                cursor="pointer"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerState({
                    startKfId: seg.startKeyframe.id,
                    clientX: e.clientX,
                  });
                }}
              />
              <text x={x1 + w / 2} y={39} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" pointerEvents="none">
                {seg.transition}
              </text>
            </g>
          );
        })}

        {/* 5. Range handles — after segments, before diamonds */}
        {showHandles && (
          <>
            <rect
              x={handleInX - 3}
              y={20}
              width={6}
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
              width={6}
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

        {/* 6. Keyframe diamonds */}
        {keyframes.map((kf) => {
          if (kf.time < visibleStart || kf.time > visibleEnd) return null;
          const cx = xFor(kf.time);
          return (
            <polygon
              key={kf.id}
              points={`${cx},${TL_Y - 10} ${cx - 5},${TL_Y} ${cx},${TL_Y + 10} ${cx + 5},${TL_Y}`}
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
              {formatTimecode(hoverTime)}
            </text>
          </g>
        )}
      </svg>

      {/* Transition picker popover — sits above the timeline bar */}
      {pickerState && (
        <div
          id="tl-transition-picker"
          className="absolute z-20 flex gap-1 p-1 rounded border border-border-subtle bg-surface-raised shadow-lg"
          style={{
            left: popoverLeft,
            bottom: 'calc(100% + 4px)',
          }}
        >
          <button
            className="px-2 py-1 text-xs rounded hover:bg-white/10 text-text-secondary"
            tabIndex={-1}
            onClick={() => {
              setTransition(pickerState.startKfId, 'smooth');
              setPickerState(null);
            }}
          >
            Smooth
          </button>
          <button
            className="px-2 py-1 text-xs rounded hover:bg-white/10 text-text-secondary"
            tabIndex={-1}
            onClick={() => {
              setTransition(pickerState.startKfId, 'cut');
              setPickerState(null);
            }}
          >
            Cut
          </button>
        </div>
      )}
    </div>
  );
}
