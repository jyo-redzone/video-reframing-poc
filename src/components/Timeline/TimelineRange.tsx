type Props = {
  showBand: boolean;
  bandX1: number;
  bandX2: number;
  isPreview: boolean;
  showHandles: boolean;
  handleInX: number;
  handleOutX: number;
  outTime: number;
  inTime: number;
  onInHandleMouseDown: (e: React.MouseEvent) => void;
  onOutHandleMouseDown: (e: React.MouseEvent) => void;
};

export default function TimelineRange({
  showBand,
  bandX1,
  bandX2,
  isPreview,
  showHandles,
  handleInX,
  handleOutX,
  onInHandleMouseDown,
  onOutHandleMouseDown,
}: Props) {
  return (
    <g>
      {showBand && (
        <rect
          x={bandX1}
          y={20}
          width={Math.max(0, bandX2 - bandX1)}
          height={30}
          rx={3}
          fill={isPreview ? 'rgba(228, 2, 44, 0.18)' : 'rgba(228, 2, 44, 0.10)'}
          stroke={isPreview ? 'rgba(228, 2, 44, 0.5)' : 'none'}
          strokeWidth={1}
          pointerEvents="none"
        />
      )}

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
            onMouseDown={onInHandleMouseDown}
          />
          <rect
            x={handleOutX - 3}
            y={20}
            width={3}
            height={30}
            rx={2}
            fill="#E4022C"
            cursor="ew-resize"
            onMouseDown={onOutHandleMouseDown}
          />
        </>
      )}
    </g>
  );
}
