import { useState } from 'react';
import useAppStore from '../store/useAppStore';

export default function LandingScreen() {
  const [url, setUrl] = useState('');
  const [fps, setFps] = useState<number>(25);
  const setVideoUrl = useAppStore((s) => s.setVideoUrl);
  const setVideoMetadata = useAppStore((s) => s.setVideoMetadata);

  const isValid = url.trim() !== '' && fps > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    // Seed fps into videoMetadata so PlayerPanel's onLoadedMetadata can use it.
    // Width/height/duration will be filled in by PlayerPanel after the video loads;
    // we use placeholder values here that will be overwritten.
    setVideoMetadata({
      id: 'vid_hls',
      name: url,
      width: 0,
      height: 0,
      fps,
      duration: 0,
      url: url.trim(),
    });
    setVideoUrl(url.trim());
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg text-text-primary">
      <div className="w-full max-w-md rounded-default border border-border-subtle bg-surface-raised p-8 shadow-elevation-8">
        <h1 className="mb-6 font-heading text-2xl font-semibold text-text-primary">
          Video Reframing
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="hls-url" className="text-sm text-text-secondary">
              HLS URL (.m3u8)
            </label>
            <input
              id="hls-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/stream.m3u8"
              className="rounded-default border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline focus:outline-2 focus:outline-brand"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fps" className="text-sm text-text-secondary">
              Frames per second
            </label>
            <input
              id="fps"
              type="number"
              value={fps}
              onChange={(e) => setFps(parseFloat(e.target.value))}
              min={1}
              step="any"
              className="rounded-default border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary focus:outline focus:outline-2 focus:outline-brand"
            />
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="mt-2 rounded-default bg-brand px-4 py-2 text-sm font-semibold tracking-button text-white shadow-elevation-1 hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Load
          </button>
        </form>
      </div>
    </div>
  );
}
