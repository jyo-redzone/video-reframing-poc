import useAppStore from '../../store/useAppStore';
import { sourceToPercent } from '../../utils/coordinates';
import useViewportDrag, { type Corner } from './useViewportDrag';

const CORNERS: { corner: Corner; cursor: string; position: React.CSSProperties }[] = [
  { corner: 'nw', cursor: 'nw-resize', position: { top: -4, left: -4 } },
  { corner: 'ne', cursor: 'ne-resize', position: { top: -4, right: -4 } },
  { corner: 'sw', cursor: 'sw-resize', position: { bottom: -4, left: -4 } },
  { corner: 'se', cursor: 'se-resize', position: { bottom: -4, right: -4 } },
];

interface ViewportOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ViewportOverlay({ containerRef }: ViewportOverlayProps) {
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const mode = useAppStore((s) => s.mode);
  const videoMetadata = useAppStore((s) => s.videoMetadata);

  const { displayedRect, handleDragStart, handleResizeStart, viewportDivRef, isEdit } =
    useViewportDrag(containerRef);

  if (activeTrackId === '') return null;
  if (mode !== 'edit') return null;
  if (!videoMetadata || !displayedRect) return null;

  const container = containerRef.current;
  if (!container) return null;
  const { width: cW, height: cH } = container.getBoundingClientRect();
  const pct = sourceToPercent(displayedRect, videoMetadata.width, videoMetadata.height, cW, cH);
  const rectLabel = `${Math.round(displayedRect.width)}x${Math.round(displayedRect.height)}`;

  return (
    <div className="absolute inset-0" style={{ zIndex: 20, pointerEvents: 'none' }}>
      <div
        ref={viewportDivRef}
        className={`absolute border-2 border-brand ${isEdit ? 'cursor-move' : ''}`}
        style={{
          left: `${pct.left}%`,
          top: `${pct.top}%`,
          width: `${pct.width}%`,
          height: `${pct.height}%`,
          pointerEvents: isEdit ? 'auto' : 'none',
        }}
        onMouseDown={isEdit ? handleDragStart : undefined}
      >
        <div
          className="absolute -top-6 left-0 rounded-default bg-brand px-1.5 py-0.5 text-xs text-white whitespace-nowrap"
          style={{ pointerEvents: 'none' }}
        >
          Viewport ({rectLabel})
        </div>
        {isEdit && CORNERS.map(({ corner, cursor, position }) => (
          <div
            key={corner}
            data-resize-handle="true"
            className="absolute bg-brand"
            style={{ width: 8, height: 8, cursor, pointerEvents: 'auto', ...position }}
            onMouseDown={(e) => handleResizeStart(corner, e)}
          />
        ))}
      </div>
    </div>
  );
}
