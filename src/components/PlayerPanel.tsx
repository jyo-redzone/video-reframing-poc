import useAppStore from '../store/useAppStore';
import { useVideoRef } from './VideoRefContext';
import PlaybackControls from './PlaybackControls';

export default function PlayerPanel() {
  const videoRef = useVideoRef();
  const setVideoMetadata = useAppStore((s) => s.setVideoMetadata);
  const setViewportRect = useAppStore((s) => s.setViewportRect);

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
      url: '/assets/sample-video.mp4',
    });

    setViewportRect({
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    });
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="p-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-slate-900">
          <video
            ref={videoRef}
            src="/assets/sample-video.mp4"
            preload="auto"
            className="h-full w-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
          />
        </div>
        <PlaybackControls />
      </div>
    </div>
  );
}
