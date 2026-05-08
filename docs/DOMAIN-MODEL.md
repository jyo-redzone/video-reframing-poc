# Domain Model

## Glossary

| Type | Definition |
|---|---|
| `SourceRect` | A rectangle in source-video pixel space: `{ x, y, width, height }`. Represents the camera framing box. |
| `Keyframe` | A time-stamped camera position: `{ id, trackId, time, sourceRect, transitionToNext }`. `transitionToNext` is `'smooth' \| 'cut'` for all KFs except the last, which is `null`. |
| `ClipRange` | The in/out time window for a clip: `{ inTime, outTime }`. Both are clamped to `[0, duration]`. |
| `Track` | A named clip: `{ id, videoId, name, keyframes[], range: ClipRange, isDirty }`. Keyframes are always sorted by `time` ascending. |
| `Segment` | A span between two consecutive keyframes: `{ startKeyframe, endKeyframe, startTime, endTime, transition }`. Derived by `deriveSegments(keyframes)`. |
| `VideoMetadata` | Static video properties loaded once: `{ id, name, width, height, fps, duration, url }`. |
| `VideoBounds` | The video's pixel dimensions: `{ width, height }`. Used by the CRE to clamp `SourceRect` values. |
| `CREOutput` | Result of `resolve(time, …)`: `{ frameTime, sourceRect }`. `frameTime` is the input time snapped to the nearest frame boundary. |

---

## Entity relationships

```
VideoMetadata  ← loaded once per session; referenced by videoId
     │
     └─▶ Track (many per session)
              │  videoId → VideoMetadata.id
              └─▶ Keyframe[] (many per Track, sorted by time)
                       │
                       └─▶ deriveSegments(keyframes) → Segment[]
                                    │
                                    └─▶ resolve(time, …) → CREOutput → SourceRect
```

---

## Key invariants

- `track.keyframes` is always sorted by `time` ascending — enforced by the store on every write (`addKeyframe`, `updateKeyframe`, `commitKeyframeAtTime`).
- The last keyframe in a track always has `transitionToNext: null`; all others must have `'smooth' | 'cut'`. This is maintained by the store when keyframes are inserted or deleted.
- Keyframe dedup: adding/committing a KF within `KEYFRAME_TIME_EPSILON_FRAMES / fps` seconds of an existing KF updates the existing one in place (preserves its `time` and `transitionToNext`).
- `ClipRange.inTime <= ClipRange.outTime`; both values are clamped to `[0, duration]` by `setTrackRange`.

---

## Recording state machine

```
idle ──startRecording──▶ recording ──pauseRecording──▶ paused
                          ◀──resumeRecording──────────────┘
recording ──stopRecording──▶ idle
paused    ──stopRecording──▶ idle
```

Guards:
- `startRecording` is a no-op when `recordingState !== 'idle'` or `viewportRect === null`.
- `startRecording` immediately commits a keyframe at `currentTime` as the first sample.

---

## Mode transitions

```
edit ◀──setMode──▶ view   (blocked when recordingState !== 'idle')
```

`setMode` calls `window.alert` and returns early if a recording is active. The `M` keyboard shortcut calls `setMode` directly.
