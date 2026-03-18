import { useCallback, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { deriveSegments } from '../engine/cre';
import { useVideoRef } from './VideoRefContext';

const TL_X0 = 40;
const TL_X1 = 960;
const TL_Y = 60;

function xForTime(time: number, duration: number): number {
  return TL_X0 + (time / duration) * (TL_X1 - TL_X0);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 font-semibold">Timeline</div>
      <div className="p-4">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 120"
          className="w-full rounded-lg border bg-white"
          onClick={handleSvgClick}
        >
          {/* 1. Axis line */}
          <line
            x1={TL_X0}
            y1={TL_Y}
            x2={TL_X1}
            y2={TL_Y}
            stroke="#CBD5E1"
            strokeWidth={2}
          />

          {/* 2. Time ticks + labels */}
          {ticks.map((t) => {
            const x = xForTime(t, duration);
            return (
              <g key={t}>
                <line x1={x} y1={54} x2={x} y2={66} stroke="#CBD5E1" />
                <text
                  x={x}
                  y={90}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#475569"
                >
                  {formatTime(t)}
                </text>
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
                  y={50}
                  width={w}
                  height={20}
                  rx={6}
                  fill={seg.transition === 'cut' ? '#E5E7EB' : '#CBD5E1'}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSegment(segKey);
                  }}
                />
                <text
                  x={x1 + w / 2}
                  y={64}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#334155"
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
                points={`${cx},${cy - 14} ${cx - 6},${cy} ${cx},${cy + 14} ${cx + 6},${cy}`}
                fill="#0F172A"
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  selectKeyframe(kf.id);
                }}
              />
            );
          })}

          {/* 5. Playhead */}
          <line
            x1={playheadX}
            y1={20}
            x2={playheadX}
            y2={100}
            stroke="#0F172A"
            strokeWidth={2}
          />
        </svg>
      </div>
    </div>
  );
}
