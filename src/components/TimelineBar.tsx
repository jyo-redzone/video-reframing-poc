import { useEffect, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveSegments } from '../engine/cre';
import { useVideoRef } from './VideoRefContext';

const TL_X0 = 40;
const TL_X1 = 960;
const TL_Y = 35;

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
  const videoRef = useVideoRef();

  const currentTime = useAppStore((s) => s.currentTime);
  const keyframes = useAppStore(
    (s) => s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? [],
  );
  const duration = useAppStore((s) => s.videoMetadata?.duration) ?? 60;
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const selectKeyframe = useAppStore((s) => s.selectKeyframe);
  const selectSegment = useAppStore((s) => s.selectSegment);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const visibleDuration = duration / zoomLevel;
  const visibleStart = Math.max(0, Math.min(zoomOffset, duration - visibleDuration));
  const visibleEnd = visibleStart + visibleDuration;

  const xFor = (time: number) =>
    TL_X0 + ((time - visibleStart) / visibleDuration) * (TL_X1 - TL_X0);

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

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const result = svgPointFromEvent(e);
    if (!result) return;
    const time = Math.max(0, Math.min(duration, result.time));
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
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

  const segments = deriveSegments(keyframes);

  const tickInterval = getTickInterval(visibleDuration);
  const firstTick = Math.ceil(visibleStart / tickInterval) * tickInterval;
  const ticks: number[] = [];
  for (let t = firstTick; t < visibleEnd; t += tickInterval) ticks.push(t);

  const playheadX = xFor(currentTime);
  const playheadVisible = currentTime >= visibleStart && currentTime <= visibleEnd;
  const tooltipX = Math.max(TL_X0 + 40, Math.min(TL_X1 - 40, hoverX));

  return (
    <div className="shrink-0 relative rounded-default border border-border-subtle bg-surface-raised overflow-hidden">
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
        onClick={handleSvgClick}
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

        {/* 3. Segment bars */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  selectSegment(segKey);
                  const midTime = (seg.startTime + seg.endTime) / 2;
                  setCurrentTime(midTime);
                  if (videoRef.current) videoRef.current.currentTime = midTime;
                }}
              />
              <text x={x1 + w / 2} y={39} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" pointerEvents="none">
                {seg.transition}
              </text>
            </g>
          );
        })}

        {/* 4. Keyframe diamonds */}
        {keyframes.map((kf) => {
          if (kf.time < visibleStart || kf.time > visibleEnd) return null;
          const cx = xFor(kf.time);
          return (
            <polygon
              key={kf.id}
              points={`${cx},${TL_Y - 10} ${cx - 5},${TL_Y} ${cx},${TL_Y + 10} ${cx + 5},${TL_Y}`}
              fill="#E4022C"
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                selectKeyframe(kf.id);
                setCurrentTime(kf.time);
                if (videoRef.current) videoRef.current.currentTime = kf.time;
                setViewportRect(kf.sourceRect);
              }}
            />
          );
        })}

        {/* 5. Playhead */}
        {playheadVisible && (
          <line x1={playheadX} y1={4} x2={playheadX} y2={58} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
        )}

        {/* 6. Current timecode below playhead */}
        {playheadVisible && (
          <text x={playheadX} y={70} textAnchor="middle" fontSize={10} fill="#E4022C" fontWeight={600}>
            {formatTickLabel(currentTime)}
          </text>
        )}

        {/* 7. Hover timestamp */}
        {hoverTime !== null && (
          <g pointerEvents="none">
            <rect x={tooltipX - 40} y={2} width={80} height={14} rx={2} fill="rgba(0,0,0,0.75)" />
            <text x={tooltipX} y={12} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)">
              {formatTimecode(hoverTime)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
