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

        // Object-contain: fit the cropped source into the canvas without distorting
        // its aspect ratio, letterbox/pillarbox to match the underlying <video>.
        const srcAR = sourceRect.width / sourceRect.height;
        const dstAR = canvas.width / canvas.height;
        let dw: number;
        let dh: number;
        if (srcAR > dstAR) {
          dw = canvas.width;
          dh = canvas.width / srcAR;
        } else {
          dh = canvas.height;
          dw = canvas.height * srcAR;
        }
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          video,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          dx,
          dy,
          dw,
          dh,
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
