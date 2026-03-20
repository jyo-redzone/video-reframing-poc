import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';

const FPS = 29.97;
const FRAME_DURATION = 1 / FPS;

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(Math.floor(s)).padStart(2, '0');
  const ms = String(Math.floor((s - Math.floor(s)) * 1000)).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

export default function PlaybackControls() {
  const videoRef = useVideoRef();
  const currentTime = useAppStore((s) => s.currentTime);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handlePrevFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    }

    const newTime = Math.max(0, video.currentTime - FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleNextFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    }

    const newTime = Math.min(video.duration || Infinity, video.currentTime + FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          className="rounded-default border border-border-subtle px-3 py-2 text-sm text-text-primary hover:bg-white/10"
          title="Prev frame"
          onClick={handlePrevFrame}
        >
          ⏮
        </button>
        <button
          className="rounded-default border border-border-subtle px-3 py-2 text-sm text-text-primary hover:bg-white/10"
          title="Play/Pause"
          onClick={handlePlayPause}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="rounded-default border border-border-subtle px-3 py-2 text-sm text-text-primary hover:bg-white/10"
          title="Next frame"
          onClick={handleNextFrame}
        >
          ⏭
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-text-secondary">Time</span>
        <span className="rounded-default bg-white/10 px-2 py-1 font-mono text-sm text-text-primary">
          {formatTimecode(currentTime)}
        </span>
      </div>
    </div>
  );
}
