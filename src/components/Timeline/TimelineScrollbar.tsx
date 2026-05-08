type Props = {
  visibleStart: number;
  visibleDuration: number;
  duration: number;
  onSeekOffset: (offset: number) => void;
  onPauseFollow: () => void;
};

export default function TimelineScrollbar({
  visibleStart,
  visibleDuration,
  duration,
  onSeekOffset,
  onPauseFollow,
}: Props) {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    onPauseFollow();
    const trackEl = e.currentTarget;
    const trackRect = trackEl.getBoundingClientRect();
    const thumbWidthPx = (visibleDuration / duration) * trackRect.width;
    const halfThumb = thumbWidthPx / 2;
    const seekFromClientX = (clientX: number) => {
      const x = clientX - trackRect.left - halfThumb;
      const ratio = Math.max(0, Math.min(x / (trackRect.width - thumbWidthPx), 1));
      onSeekOffset(ratio * (duration - visibleDuration));
    };
    seekFromClientX(e.clientX);
    const onMove = (ev: MouseEvent) => seekFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="mx-2 mb-1 h-1.5 rounded-full bg-white/5" onMouseDown={handleMouseDown}>
      <div
        className="h-full rounded-full bg-white/30"
        style={{
          marginLeft: `${(visibleStart / duration) * 100}%`,
          width: `${(visibleDuration / duration) * 100}%`,
        }}
      />
    </div>
  );
}
