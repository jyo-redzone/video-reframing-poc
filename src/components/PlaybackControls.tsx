import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';
import { useHlsControl } from './HlsControlContext';
import { SPEED_OPTIONS } from '../config';

export default function PlaybackControls() {
  const videoRef = useVideoRef();
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const mode = useAppStore((s) => s.mode);
  const recordingState = useAppStore((s) => s.recordingState);
  const viewportRect = useAppStore((s) => s.viewportRect);
  const activeTrackId = useAppStore((s) => s.activeTrackId);
  const startRecording = useAppStore((s) => s.startRecording);
  const pauseRecording = useAppStore((s) => s.pauseRecording);
  const resumeRecording = useAppStore((s) => s.resumeRecording);
  const stopRecording = useAppStore((s) => s.stopRecording);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const { levels, currentLevel, setLevel } = useHlsControl();
  const sortedLevels = [...levels].sort((a, b) => b.height - a.height);
  const showQuality = sortedLevels.length > 1;

  const formatQualityLabel = (height: number, bitrate: number): string => {
    if (height >= 4320) return '8K';
    if (height >= 2160) return '4K';
    if (height > 0) return `${height}p`;
    return `${Math.round(bitrate / 1000)}k`;
  };

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

  const handlePrevSecond = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.max(0, video.currentTime - 1);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleNextSecond = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    const newTime = Math.min(video.duration || Infinity, video.currentTime + 1);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (e: { target: HTMLSelectElement }) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const recButtonClass =
    'rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="relative flex items-center justify-center gap-1">
      {/* Transport controls — kept centered regardless of REC group width */}
      <button
        className="rounded-default px-3 py-1.5 text-sm text-text-primary hover:bg-white/10"
        title="Prev second"
        onClick={handlePrevSecond}
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
        title="Next second"
        onClick={handleNextSecond}
      >
        ⏭
      </button>
      <select
        value={playbackRate}
        onChange={handleRateChange}
        className="ml-2 cursor-pointer rounded-default border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-text-primary outline-none"
        style={{ colorScheme: 'dark' }}
        title="Playback speed"
      >
        {SPEED_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}×</option>
        ))}
      </select>

      {showQuality && (
        <select
          value={currentLevel}
          onChange={(e) => setLevel(parseInt(e.target.value, 10))}
          className="ml-1 cursor-pointer rounded-default border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-text-primary outline-none"
          style={{ colorScheme: 'dark' }}
          title="Stream quality"
        >
          <option value={-1}>Auto</option>
          {sortedLevels.map((l) => (
            <option key={l.index} value={l.index}>
              {formatQualityLabel(l.height, l.bitrate)}
            </option>
          ))}
        </select>
      )}

      {/* REC controls — anchored right, edit mode only */}
      {mode === 'edit' && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {recordingState === 'idle' && (() => {
            const noTrack = activeTrackId === '';
            const noBox = viewportRect === null;
            const recordDisabled = noTrack || noBox;
            const recordTitle = noTrack
              ? 'Select or create a clip first.'
              : noBox
                ? 'Draw a framing box first.'
                : 'Start recording';
            return (
              <button
                className={recButtonClass}
                title={recordTitle}
                onClick={startRecording}
                disabled={recordDisabled}
              >
                ⏺ Record
              </button>
            );
          })()}

          {recordingState !== 'idle' && (
            <>
              {/* Red dot: pulsing when recording, steady when paused */}
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full bg-red-500${recordingState === 'recording' ? ' animate-pulse' : ''}`}
                aria-hidden="true"
              />
              <span className="px-1 text-sm font-semibold text-red-400">REC</span>

              {recordingState === 'recording' && (
                <button
                  className={recButtonClass}
                  title="Pause recording"
                  onClick={pauseRecording}
                >
                  ⏸ Pause
                </button>
              )}

              {recordingState === 'paused' && (
                <button
                  className={recButtonClass}
                  title="Resume recording"
                  onClick={resumeRecording}
                >
                  ⏵ Resume
                </button>
              )}

              <button
                className={recButtonClass}
                title="Stop recording"
                onClick={stopRecording}
              >
                ⏹ Stop
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
