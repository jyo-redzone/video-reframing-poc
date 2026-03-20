import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';

const FPS = 29.97;
const FRAME_DURATION = 1 / FPS;

export default function PlaybackControls() {
  const videoRef = useVideoRef();
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
    <div className="flex items-center justify-center gap-1">
      <button
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10"
        title="Prev frame"
        onClick={handlePrevFrame}
      >
        ⏮
      </button>
      <button
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10"
        title="Play/Pause"
        onClick={handlePlayPause}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10"
        title="Next frame"
        onClick={handleNextFrame}
      >
        ⏭
      </button>
    </div>
  );
}
