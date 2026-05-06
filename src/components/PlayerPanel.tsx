import { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';
import ViewportOverlay from './ViewportOverlay';
import BoundingBoxTool from './BoundingBoxTool';
import PreviewCanvas from './PreviewCanvas';
import PlaybackControls from './PlaybackControls';

export default function PlayerPanel() {
  const videoRef = useVideoRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const setVideoMetadata = useAppStore((s) => s.setVideoMetadata);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const mode = useAppStore((s) => s.mode);
  const videoUrl = useAppStore((s) => s.videoUrl);
  const videoMeta = useAppStore((s) => s.videoMetadata);
  const showPreview = mode === 'view';

  const [hlsError, setHlsError] = useState<string | null>(null);

  // Attach HLS source to the video element whenever the URL changes.
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoUrl) return;

    setHlsError(null);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(videoUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setHlsError('Failed to load video');
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS — Safari
      videoEl.src = videoUrl;
    } else {
      setHlsError('HLS not supported in this browser');
    }
  }, [videoUrl, videoRef]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const { videoWidth, videoHeight, duration } = video;

    // FPS was set by LandingScreen; preserve it and update the rest.
    setVideoMetadata({
      id: videoMeta?.id ?? 'vid_hls',
      name: videoMeta?.name ?? videoUrl ?? '',
      width: videoWidth,
      height: videoHeight,
      fps: videoMeta?.fps ?? 29.97,
      duration,
      url: videoUrl ?? '',
    });
  };

  return (
    <div className="h-full flex flex-col rounded-default overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative bg-appbar"
      >
        <video
          ref={videoRef}
          preload="auto"
          className="h-full w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
        {hlsError && (
          <div className="absolute inset-0 flex items-center justify-center bg-appbar/80">
            <p className="text-sm text-error">{hlsError}</p>
          </div>
        )}
        {showPreview && <PreviewCanvas containerRef={containerRef} />}
        <BoundingBoxTool containerRef={containerRef} />
        <ViewportOverlay containerRef={containerRef} />
      </div>
      <div className="shrink-0 border-t border-border-subtle bg-surface-raised px-3 py-1.5">
        <PlaybackControls />
      </div>
    </div>
  );
}
