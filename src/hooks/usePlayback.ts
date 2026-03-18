import { useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from '../components/VideoRefContext';

export default function usePlayback(): void {
  const videoRef = useVideoRef();
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setCurrentTime = useAppStore((s) => s.setCurrentTime);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        useAppStore.getState().setIsPlaying(false);
      });
      const tick = () => {
        setCurrentTime(video.currentTime);
        rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
    } else {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    }

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [isPlaying, videoRef, setCurrentTime]);
}
