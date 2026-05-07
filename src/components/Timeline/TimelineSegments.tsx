export type SegmentItem = {
  segKey: string;
  x1: number;
  x2: number;
  w: number;
  fill: string;
  startKfId: string;
  isActive: boolean;
  transition: 'smooth' | 'cut';
};

type Props = {
  items: SegmentItem[];
  isPickerOpen: boolean;
  onSegmentClick: (startKfId: string) => void;
};

export default function TimelineSegments({ items, isPickerOpen, onSegmentClick }: Props) {
  return (
    <g>
      {items.map(({ segKey, x1, w, fill, startKfId, isActive, transition }) => (
        <g key={segKey}>
          <rect
            x={x1}
            y={25}
            width={w}
            height={20}
            rx={2}
            fill={fill}
            opacity={isPickerOpen && !isActive ? 0.5 : 1}
            stroke={isActive ? 'rgba(255,255,255,0.85)' : 'none'}
            strokeWidth={isActive ? 1.5 : 0}
            cursor="pointer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSegmentClick(startKfId); }}
          >
            <title>{transition}</title>
          </rect>
        </g>
      ))}
    </g>
  );
}
