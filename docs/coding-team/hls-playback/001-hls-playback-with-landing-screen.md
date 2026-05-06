# 001 — HLS Playback with Landing Screen

## Context

The app currently loads a hardcoded sample MP4:

```tsx
// src/components/PlayerPanel.tsx
<video ref={videoRef} src="/assets/default.mp4" preload="auto" ... />
```

FPS is hardcoded to `29.97` on `onLoadedMetadata`. We are replacing this with
HLS playback driven by a user-supplied `.m3u8` URL, gated behind a landing
screen that also collects FPS. The existing `<video>` element, Canvas overlay,
CRE engine, playback hooks, and timeline must continue to work unchanged —
only the *source attachment* and *FPS source* change.

A future iteration will bypass the landing screen by reading the URL from a
query parameter; design accordingly so that becomes a trivial change.

## Objective

- Boot the app into a landing screen.
- After the user enters an HLS URL + FPS and clicks Load, the editor appears
  and the video plays via HLS in Safari, Chrome, Firefox, and Edge.

## Scope

- Add `hls.js` to dependencies.
- Extend the Zustand store (`src/store/useAppStore.ts`) with `videoUrl: string | null`
  and add a setter. FPS is already present on `videoMeta` — reuse that; no new
  field needed. The "is the editor active" gate is `videoUrl !== null`.
- New component `src/components/LandingScreen.tsx`:
  - Inputs: HLS URL (text), FPS (number, default `29.97`).
  - "Load" button — disabled until URL is non-empty and FPS > 0.
  - On submit: set `videoUrl` and seed `videoMeta.fps` in the store.
  - Minimal Tailwind styling consistent with the rest of the app.
- `src/App.tsx`: render `<LandingScreen />` when `videoUrl` is null;
  otherwise render the existing editor tree.
- Refactor `src/components/PlayerPanel.tsx`:
  - Remove the hardcoded `src="/assets/default.mp4"`.
  - In a `useEffect` keyed on `videoUrl` and the video ref, attach HLS:
    - If `Hls.isSupported()` → instantiate `new Hls()`, `loadSource(url)`,
      `attachMedia(videoEl)`. Clean up on unmount / URL change with `hls.destroy()`.
    - Else if `videoEl.canPlayType('application/vnd.apple.mpegurl')` → set
      `videoEl.src = url` (native HLS, Safari path).
    - Else → render an inline error ("HLS not supported in this browser").
  - On `Hls.Events.ERROR` with `data.fatal === true`, surface a simple error
    state (e.g., a text overlay "Failed to load video"). No retry logic.
  - In `onLoadedMetadata`, do NOT overwrite FPS — keep the value that came
    from the landing screen. Width / height / duration still come from the
    video element as today.
- Delete `public/assets/default.mp4` and any code references to it. The
  `public/assets/` directory may be removed if it becomes empty.

## Non-goals / Later

- localStorage persistence of URL/FPS.
- URL query-parameter parsing.
- HLS auth headers, DRM, custom credentials.
- FPS auto-detection from the manifest.
- Variant / quality selection UI.
- Retry / backoff / advanced error recovery.
- "Change video" UI inside the editor — landing screen only fires on a fresh
  load (page refresh resets state, which is acceptable for this POC).

## Constraints / Caveats

- `hls.js` does NOT work in Safari — Safari has native HLS support and
  `Hls.isSupported()` returns `false` there. The capability check above is
  the canonical pattern; do not try to force `hls.js` on Safari.
- Tear down the `Hls` instance on unmount and whenever `videoUrl` changes,
  otherwise media element resources leak.
- Keep `videoMeta.fps` as the single source of truth for FPS — search the
  codebase and confirm nothing else hardcodes `29.97`.
- The landing screen must not mount any of the editor components (don't
  rely on CSS hiding) — the Zustand store, CRE engine, and playback hooks
  all assume a video is present.

## Acceptance criteria

- Initial render shows the landing screen, not the editor.
- After loading a valid HLS URL, the full editor appears and the video plays.
- Frame-step controls and the timeline reflect the FPS entered on the
  landing screen (verify with a non-29.97 value).
