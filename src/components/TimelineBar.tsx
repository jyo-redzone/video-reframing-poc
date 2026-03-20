import { useCallback, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveSegments } from '../engine/cre';
import { useVideoRef } from './VideoRefContext';

const TL_X0 = 40;
const TL_X1 = 960;
const TL_Y = 35;

function xForTime(time: number, duration: number): number {
  return TL_X0 + (time / duration) * (TL_X1 - TL_X0);
}


function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(Math.floor(s)).padStart(2, '0');
  const ms = String(Math.floor((s - Math.floor(s)) * 1000)).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

function getTickInterval(duration: number): number {
  if (duration <= 60) return 10;
  if (duration <= 300) return 30;
  if (duration <= 600) return 60;
  return 120;
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

  const segments = deriveSegments(keyframes);

  const tickInterval = getTickInterval(duration);
  const ticks: number[] = [];
  for (let t = tickInterval; t < duration; t += tickInterval) {
    ticks.push(t);
  }

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inverse = ctm.inverse();

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(inverse);

      const ratio = (svgPt.x - TL_X0) / (TL_X1 - TL_X0);
      const time = Math.max(0, Math.min(duration, ratio * duration));

      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      setCurrentTime(time);
    },
    [duration, setCurrentTime, videoRef],
  );

  const playheadX = xForTime(currentTime, duration);

  return (
    <div className="shrink-0 rounded-default border border-border-subtle bg-surface-raised overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 1000 75"
        className="w-full"
        onClick={handleSvgClick}
      >
        {/* 1. Axis line */}
        <line
          x1={TL_X0}
          y1={TL_Y}
          x2={TL_X1}
          y2={TL_Y}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={2}
        />

        {/* 2. Time ticks + labels */}
        {ticks.map((t) => {
          const x = xForTime(t, duration);
          return (
            <g key={t}>
              <line x1={x} y1={29} x2={x} y2={41} stroke="rgba(255,255,255,0.2)" />
            </g>
          );
        })}

        {/* 3. Segment bars */}
        {segments.map((seg) => {
          const x1 = xForTime(seg.startTime, duration);
          const x2 = xForTime(seg.endTime, duration);
          const w = Math.max(2, x2 - x1);
          const segKey = `${seg.startKeyframe.id}|${seg.endKeyframe.id}`;
          return (
            <g key={segKey}>
              <rect
                x={x1}
                y={25}
                width={w}
                height={20}
                rx={2}
                fill={seg.transition === 'cut' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)'}
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  selectSegment(segKey);
                  const midTime = (seg.startTime + seg.endTime) / 2;
                  setCurrentTime(midTime);
                  if (videoRef.current) {
                    videoRef.current.currentTime = midTime;
                  }
                }}
              />
              <text
                x={x1 + w / 2}
                y={39}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.7)"
                pointerEvents="none"
              >
                {seg.transition}
              </text>
            </g>
          );
        })}

        {/* 4. Keyframe diamonds */}
        {keyframes.map((kf) => {
          const cx = xForTime(kf.time, duration);
          const cy = TL_Y;
          return (
            <polygon
              key={kf.id}
              points={`${cx},${cy - 10} ${cx - 5},${cy} ${cx},${cy + 10} ${cx + 5},${cy}`}
              fill="#E4022C"
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                selectKeyframe(kf.id);
                setCurrentTime(kf.time);
                if (videoRef.current) {
                  videoRef.current.currentTime = kf.time;
                }
                setViewportRect(kf.sourceRect);
              }}
            />
          );
        })}

        {/* 5. Playhead */}
        <line
          x1={playheadX}
          y1={4}
          x2={playheadX}
          y2={58}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2}
        />

        {/* 6. Current timecode below playhead */}
        <text
          x={playheadX}
          y={70}
          textAnchor="middle"
          fontSize={10}
          fill="#E4022C"
          fontWeight={600}
        >
          {formatTimecode(currentTime)}
        </text>
      </svg>
    </div>
  );
}

