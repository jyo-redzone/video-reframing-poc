import { TL_X0, TL_X1, TL_Y } from '../../config';
import { formatTickLabel } from './timelineLayout';

type Props = {
  ticks: { t: number; x: number }[];
  playheadX: number;
  playheadVisible: boolean;
  currentTime: number;
  hoverTime: number | null;
  tooltipX: number;
};

export default function TimelineAxis({
  ticks,
  playheadX,
  playheadVisible,
  currentTime,
  hoverTime,
  tooltipX,
}: Props) {
  return (
    <g>
      {/* Axis line */}
      <line x1={TL_X0} y1={TL_Y} x2={TL_X1} y2={TL_Y} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />

      {/* Tick marks + labels */}
      {ticks.map(({ t, x }) => (
        <g key={t}>
          <line x1={x} y1={29} x2={x} y2={41} stroke="rgba(255,255,255,0.25)" />
          <text x={x} y={20} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" pointerEvents="none">
            {formatTickLabel(t)}
          </text>
        </g>
      ))}

      {/* Playhead */}
      {playheadVisible && (
        <>
          <line x1={playheadX} y1={4} x2={playheadX} y2={58} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
          <text x={playheadX} y={70} textAnchor="middle" fontSize={10} fill="#E4022C" fontWeight={600}>
            {formatTickLabel(currentTime)}
          </text>
        </>
      )}

      {/* Hover tooltip */}
      {hoverTime !== null && (
        <g pointerEvents="none">
          <rect x={tooltipX - 40} y={2} width={80} height={14} rx={2} fill="rgba(0,0,0,0.75)" />
          <text x={tooltipX} y={12} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)">
            {formatTickLabel(hoverTime)}
          </text>
        </g>
      )}
    </g>
  );
}
