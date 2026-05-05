import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4, 8, 16];

export default function PlaybackControls() {
  const videoRef = useVideoRef();
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const videoMetadata = useAppStore((s) => s.videoMetadata);
  const [playbackRate, setPlaybackRate] = useState(1);

  const fps = videoMetadata?.fps ?? null;
  const frameDuration = fps != null ? 1 / fps : null;
  const frameStepDisabled = frameDuration === null;

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
    if (frameStepDisabled) return;
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.max(0, video.currentTime - frameDuration);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleNextFrame = () => {
    if (frameStepDisabled) return;
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.min(video.duration || Infinity, video.currentTime + frameDuration);
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
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Prev frame"
        onClick={handlePrevFrame}
        disabled={frameStepDisabled}
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
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Next frame"
        onClick={handleNextFrame}
        disabled={frameStepDisabled}
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
