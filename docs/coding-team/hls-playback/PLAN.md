# HLS Playback

Replace the hardcoded sample MP4 with HLS playback driven by a user-supplied URL,
gated behind a landing screen that also collects the source FPS.

## Scope

- Cross-browser HLS: `hls.js` for Chrome/Firefox/Edge, native `<video>` for Safari.
- HLS-only — no MP4 fallback.
- Landing screen as the entry gate; future URL-query-parameter flow will simply
  bypass it.

## Out of scope

- localStorage persistence of URL/FPS.
- URL query-parameter parsing.
- HLS auth headers, DRM, custom CDN credentials.
- FPS auto-detection from manifest.
- Variant/quality selection UI.
- Advanced error recovery (retry/backoff). Basic "failed to load" message only.

## Tasks

1. **001-hls-playback-with-landing-screen** — Add `hls.js`; introduce `videoUrl`
   and `fps` in the store; build a `LandingScreen` component (URL + FPS inputs,
   "Load" button) gating the editor; refactor `PlayerPanel` to attach the HLS
   source via `hls.js` or native HLS based on browser capability; remove the
   hardcoded `/assets/default.mp4` path.
