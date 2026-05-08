# Architecture

## Data flow

**User gesture → store action → Zustand state → React re-render.**

The playback loop drives a parallel read path:

```
currentTime
  → resolve(time, keyframes, bounds, fps)   [engine/cre.ts]
  → CREOutput { frameTime, sourceRect }
  → CSS position/size on screen             [ViewportOverlay / PreviewCanvas]
```

Write path for gestures:

```
Pointer/wheel event in ViewportOverlay
  → setViewportRect(rect)                   [store action]
  → commitKeyframeAtTime(time, rect)        [store action, if recording]
  → track.keyframes updated + sorted
```

---

## Module responsibilities

**`types/`** — Shared domain types only (`SourceRect`, `Keyframe`, `Track`, `Segment`, `VideoMetadata`, `VideoBounds`, `CREOutput`). No runtime logic.

**`engine/`** — Pure, side-effect-free domain logic. `cre.ts` exports `resolve` (interpolates a `SourceRect` at a given time) and `deriveSegments` (builds `Segment[]` from consecutive keyframe pairs). Has no React or store dependencies.

**`store/`** — Single Zustand store (`useAppStore`). Owns all mutable application state: video metadata, tracks, keyframes, recording state, playback time, viewport rect, timeline zoom. Enforces invariants (keyframe sort order, `transitionToNext` on last KF, epsilon-dedup) on every write.

**`hooks/`** — React hooks that wire the DOM and browser APIs to store actions. `usePlayback` syncs the `<video>` element's `timeupdate` with `setCurrentTime`. `useRecordingSampler` fires `commitKeyframeAtTime` at `RECORDING_SAMPLE_HZ` Hz during active recording. `useKeyboardShortcuts` attaches a `keydown` listener and dispatches store actions.

**`components/`** — React UI layer. Components subscribe to the store (or receive computed props) and render. `ViewportOverlay` handles pointer drag and wheel zoom on the video area. `TimelineBar` renders the SVG timeline, keyframe markers, and range handles. `TrackPanel` manages clip CRUD. Sub-components receive computed props and do not subscribe to the store directly.

**`utils/`** — Stateless coordinate helpers. `coordinates.ts` provides `getVideoRenderArea`, `sourceToPercent`, and `containerToSource` for converting between source-video pixels and CSS container pixels.

**`config.ts`** — Single source of truth for all constants and magic numbers (recording rate, epsilon values, timeline layout, zoom limits, speed options, viewport behaviour).

---

## State model

| Slice (logical) | Key state fields | Key actions |
|---|---|---|
| Video | `videoUrl`, `videoMetadata` | `setVideoUrl`, `setVideoMetadata` |
| Track | `tracks[]`, `activeTrackId` | `createTrack`, `deleteTrack`, `renameTrack`, `setActiveTrackId` |
| Keyframe | inside each `Track.keyframes[]` | `addKeyframe`, `updateKeyframe`, `deleteKeyframe`, `commitKeyframeAtTime` |
| Recording | `recordingState` | `startRecording`, `pauseRecording`, `resumeRecording`, `stopRecording` |
| Playback | `currentTime`, `isPlaying`, `playbackRate` | `setCurrentTime`, `setIsPlaying`, `setPlaybackRate` |
| Viewport | `viewportRect` | `setViewportRect` |
| Timeline | `timelineZoom`, `timelineZoomOffset`, `timelineFollowPaused` | `setTimelineZoom`, `setTimelineZoomOffset`, `resetTimelineZoom` |
| UI | `mode`, `helpPanelOpen` | `setMode`, `toggleHelpPanel` |

---

## Coordinate system

Two coordinate spaces exist:

- **Source coords** — pixels in the original video frame (e.g. 1920 × 1080). `SourceRect` fields are in source coords.
- **Container coords** — CSS pixels of the rendered `<video>` element (letterboxed inside its container).

`getVideoRenderArea(video)` computes the letterboxed render rect (accounting for aspect ratio and element size). `sourceToPercent(rect, bounds)` converts a `SourceRect` to percentage-based CSS positioning. `containerToSource(point, video)` maps a pointer event position to source coords.

---

## CRE algorithm

**Inputs:** `time: number`, `keyframes: Keyframe[]`, `bounds: VideoBounds`, `fps: number`  
**Output:** `CREOutput { frameTime, sourceRect }`

1. Snap `time` to nearest frame boundary: `frameTime = floor(time * fps) / fps`.
2. If no keyframes → return full-frame rect.
3. Before first KF → hold first KF's rect (clamp to bounds).
4. After last KF → hold last KF's rect (clamp to bounds).
5. Between two KFs:
   - `smooth` → linear lerp per component, clamped to bounds.
   - `cut` → hold `kf1.sourceRect` for `t < kf2.time`, snap to `kf2.sourceRect` at `t >= kf2.time`.

---

## Recording pipeline

State machine: `idle → recording → paused → idle`

- `useRecordingSampler` fires at `RECORDING_SAMPLE_HZ` Hz while `recordingState === 'recording' && isPlaying`. Each tick calls `commitKeyframeAtTime(currentTime, viewportRect)`.
- Gesture-end writes occur in `ViewportOverlay` after drag/wheel ends, when `recordingState === 'recording' && !isPlaying`.
- `commitKeyframeAtTime` deduplicates: if a KF already exists within `keyframeTimeEpsilon(fps)` seconds of `time`, it updates that KF's `sourceRect` in place instead of inserting a new one.
