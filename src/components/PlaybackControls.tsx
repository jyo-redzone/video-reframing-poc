import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';

const FPS = 29.97;
const FRAME_DURATION = 1 / FPS;
const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4, 8, 16];

export default function PlaybackControls() {
  const videoRef = useVideoRef();
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const [playbackRate, setPlaybackRate] = useState(1);

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
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.max(0, video.currentTime - FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleNextFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.min(video.duration || Infinity, video.currentTime + FRAME_DURATION);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
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
      <select
        value={playbackRate}
        onChange={handleRateChange}
        className="ml-2 cursor-pointer rounded-default border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-text-primary outline-none hover:bg-white/10"
        style={{ colorScheme: 'dark' }}
        title="Playback speed"
      >
        {SPEED_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}×</option>
        ))}
      </select>
    </div>
  );
}
