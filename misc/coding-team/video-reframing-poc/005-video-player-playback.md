# Task 005: Video Player + Playback Controls

## Context
The layout shell from Task 004 has a placeholder for the PlayerPanel. The store has `currentTime`, `isPlaying`, `setCurrentTime`, `setIsPlaying`, and `videoMetadata`/`setVideoMetadata`. The sample video is at `/assets/sample-video.mp4` (29.97fps, ~5m04s). FPS is hardcoded to 29.97.

## Objective
Replace the PlayerPanel placeholder with a working video player: `<video>` element loading the sample MP4, playback controls (play/pause, frame step), timecode display, and a `usePlayback` hook that syncs video time with the store via `requestAnimationFrame`.

## Scope

### `src/components/PlayerPanel.tsx`
- Wrapping card with `rounded-2xl border bg-white shadow-sm` (matching mock)
- Contains:
  1. **Video container**: `relative aspect-video w-full overflow-hidden rounded-xl border bg-slate-900`
     - `<video>` element: `ref={videoRef}`, `src="/assets/sample-video.mp4"`, `preload="auto"`, `className="w-full h-full object-contain"`, **no `controls` attribute** (we provide custom controls)
     - This container will later hold the canvas overlay (Task 007/009) — for now, just the video
  2. **PlaybackControls** sub-component below the video

- On `<video>` `loadedmetadata` event:
  - Read `videoElement.videoWidth`, `videoElement.videoHeight`, `videoElement.duration`
  - Call `setVideoMetadata({ id: 'vid_sample', name: 'Sample Video', width, height, fps: 29.97, duration, url: '/assets/sample-video.mp4' })`
  - Set initial `viewportRect` to full frame: `{ x: 0, y: 0, width: videoWidth, height: videoHeight }`

- Expose `videoRef` via a React context or by passing it down — actually, keep it simple: store the ref in a module-level variable or use a ref forwarded from App. **Simplest approach**: create a `VideoRefContext` in a small file `src/components/VideoRefContext.tsx` that provides `React.RefObject<HTMLVideoElement>` so other components (preview, playback hook) can access it.

### `src/components/PlaybackControls.tsx`
- Row below the video container (inside the PlayerPanel card, below the video area)
- Left side: prev frame button (⏮), play/pause button (⏯), next frame button (⏭)
- Right side: timecode display in `mm:ss.fff` format
- Behavior:
  - **Play/Pause**: toggle `isPlaying` in store. When playing, `video.play()`. When paused, `video.pause()`.
  - **Prev frame**: pause if playing, seek video backward by `1/29.97` seconds, update store time
  - **Next frame**: pause if playing, seek video forward by `1/29.97` seconds, update store time
  - **Timecode**: read `currentTime` from store, format as `MM:SS.mmm`

### `src/hooks/usePlayback.ts`
- Custom hook that runs a `requestAnimationFrame` loop when `isPlaying === true`
- On each frame:
  - Read `videoRef.current.currentTime`
  - Call `setCurrentTime(videoCurrentTime)` to sync store
- When `isPlaying` transitions to `false`, cancel the rAF
- When `isPlaying` transitions to `true`, start the rAF loop and call `video.play()`
- Cleanup on unmount: cancel any pending rAF

### `src/components/VideoRefContext.tsx`
- Simple React context:
  ```tsx
  const VideoRefContext = createContext<React.RefObject<HTMLVideoElement>>(...)
  export const VideoRefProvider = VideoRefContext.Provider
  export const useVideoRef = () => useContext(VideoRefContext)
  ```

### Wire into `src/App.tsx`
- Create the video ref with `useRef<HTMLVideoElement>(null)`
- Wrap the main layout in `<VideoRefProvider value={videoRef}>`
- Replace the PlayerPanel placeholder with `<PlayerPanel />`
- Call `usePlayback()` somewhere (App or PlayerPanel — wherever makes sense)

## Non-Goals
- No canvas overlay (Task 007)
- No preview rendering (Task 009)
- No timeline sync (Task 006 will read currentTime from store)
- No keyboard shortcuts

## Constraints
- FPS constant: `29.97` — define as `const FPS = 29.97` in a shared place or inline
- Frame step: `1 / FPS` seconds per step
- The `<video>` element must NOT have the `controls` attribute
- Use individual Zustand selectors to avoid unnecessary rerenders
- The video ref must be accessible to future components (preview canvas, overlay) — hence the context
