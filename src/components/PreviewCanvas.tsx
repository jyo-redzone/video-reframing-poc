import { useEffect, useRef } from 'react';
import { useVideoRef } from './VideoRefContext';
import useAppStore from '../store/useAppStore';
import { resolve } from '../engine/cre';

type PreviewCanvasProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export default function PreviewCanvas({ containerRef }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useVideoRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Size canvas to container physical pixels ──────────────────────
    function syncSize() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }

    syncSize();

    const resizeObserver = new ResizeObserver(() => {
      syncSize();
    });
    resizeObserver.observe(container);

    // ── rAF rendering loop ────────────────────────────────────────────
    let rafId: number;

    function draw() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !ctx) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Imperative read — no reactive selectors
      const state = useAppStore.getState();
      const { currentTime, videoMetadata } = state;
      const keyframes =
        state.tracks.find((t) => t.id === state.activeTrackId)?.keyframes ?? [];

      if (videoMetadata) {
        const bounds = { width: videoMetadata.width, height: videoMetadata.height };
        const { sourceRect } = resolve(currentTime, keyframes, bounds, videoMetadata.fps);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          video,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [containerRef, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 15 }}
    />
  );
}
