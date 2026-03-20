import { useRef } from 'react';
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
  const setViewportRect = useAppStore((s) => s.setViewportRect);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const mode = useAppStore((s) => s.mode);
  const viewType = useAppStore((s) => s.viewType);
  const showPreview = mode === 'view' && viewType === 'preview';

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    const { videoWidth, videoHeight, duration } = video;

    setVideoMetadata({
      id: 'vid_sample',
      name: 'Sample Video',
      width: videoWidth,
      height: videoHeight,
      fps: 29.97,
      duration,
      url: '/assets/default.mp4',
    });

    setViewportRect({
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
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
          src="/assets/default.mp4"
          preload="auto"
          className="h-full w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
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
