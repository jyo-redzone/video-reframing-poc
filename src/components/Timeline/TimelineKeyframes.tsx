import type { Keyframe } from '../../types';
import { TL_Y } from '../../config';

type Props = {
  items: { kf: Keyframe; cx: number }[];
  onKeyframeClick: (kf: Keyframe) => void;
};

export default function TimelineKeyframes({ items, onKeyframeClick }: Props) {
  return (
    <g>
      {items.map(({ kf, cx }) => (
        <circle
          key={kf.id}
          cx={cx}
          cy={TL_Y}
          r={3}
          fill="#E4022C"
          cursor="pointer"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onKeyframeClick(kf); }}
        />
      ))}
    </g>
  );
}
