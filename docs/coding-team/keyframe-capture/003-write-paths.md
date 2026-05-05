# Task 003 — Write paths: snapshot, sampler, gesture-end

## Context

Tasks 001 + 002 set up the foundation and the recording state machine + UI. This task wires the three write paths described in the design doc. After this task, the recording feature is functionally complete.

Source of truth: [docs/DESIGN-gestures-and-keyframe-capture.md](../../DESIGN-gestures-and-keyframe-capture.md), sections "Storage model" and "Epsilon resolution rule".

## Objective

After this task: pressing Record writes one keyframe immediately at `currentTime`; while recording AND playing, a 4 Hz sampler captures rect changes (deduped); while recording AND paused, drag/resize mouseup writes a keyframe. All three paths funnel through one epsilon-resolved write helper.

## Scope

### 1. Epsilon write helper in the store

`src/store/useAppStore.ts`

Add a new action:
```ts
commitKeyframeAtTime: (time: number, sourceRect: SourceRect) => void;
```

Behaviour, applied to the active track's keyframes:

1. Compute `epsilon = keyframeTimeEpsilon(videoMetadata?.fps)` from `src/config.ts`.
2. Find any existing keyframe with `|kf.time - time| <= epsilon`. If found, **update** that keyframe's `sourceRect` in place — do not change `time` or `transitionToNext`. Done.
3. Otherwise **append** a new keyframe with `time` and `sourceRect`. Generate an id matching the existing convention (`kf_${Date.now()}_${random}`). Set `transitionToNext` so the invariant holds: **the time-last keyframe has `transitionToNext: null`; all other keyframes have `transitionToNext` preserved if already set, defaulting to `'smooth'` when newly appended.** In practice this means:
   - If the new keyframe has the maximum `time` of all keyframes → its `transitionToNext = null`. If a previously-last keyframe is now non-last (i.e. an existing kf had `transitionToNext: null`), set its `transitionToNext = 'smooth'`.
   - Else (insert in middle / start) → new kf gets `'smooth'`; do not modify any existing keyframe's `transitionToNext`.

The result must remain sorted by time (existing `sortByTime` helper).

`addKeyframe` is no longer called by any production code after this task. Leave it in place for now (tests may still use it); don't waste effort deleting.

### 2. Record-start snapshot

`src/store/useAppStore.ts`

Update `startRecording`: in addition to flipping state to `'recording'`, call `commitKeyframeAtTime(currentTime, viewportRect)` using the current store values (read via `get()`), but **only when the transition is valid** (currently idle and `viewportRect !== null` — same guards already in place from Task 002). The snapshot fires regardless of `isPlaying`.

### 3. Sampler hook

New file: `src/hooks/useRecordingSampler.ts`

Wire it in `src/App.tsx` alongside `usePlayback()` and `useKeyboardShortcuts()`.

Behaviour:

- Active when `recordingState === 'recording'` AND `isPlaying === true`. Otherwise dormant.
- When active, run `setInterval` at `1000 / RECORDING_SAMPLE_HZ` ms (from `src/config.ts`).
- **First-tick semantics:**
  - When sampler activates because `recordingState` just transitioned `paused → recording` (Resume), fire one tick immediately, then at the configured interval.
  - When sampler activates due to `idle → recording` (Record-start) or because `isPlaying` flipped true while already in `recording`, do NOT fire an immediate tick — wait for the first interval. The Record-start snapshot already covered the initial write in the first case; the second case is "user resumed video playback during a recording session" and is treated as steady-state continuation.
  - Track previous `recordingState` in a ref to distinguish these.
- **Dedup:** maintain a `lastSampledRect: SourceRect | null` ref.
  - On `idle → recording` transition: set this ref to the current `viewportRect` (mirroring the Record-start snapshot, so the first interval tick over an unmoved box dedups).
  - On `recording|paused → idle` transition (Stop): reset to `null`.
  - On `paused ↔ recording` transitions: leave the ref untouched (per Q2 Option B — dedup persists across pause/resume).
- **Per-tick logic:**
  1. Read `viewportRect` and `currentTime` from the store.
  2. If `viewportRect` is null, skip (defensive — shouldn't happen given Record requires a box).
  3. If the read rect deep-equals `lastSampledRect`, skip.
  4. Otherwise call `commitKeyframeAtTime(currentTime, viewportRect)` and set `lastSampledRect = viewportRect`.

Implementation note: read live store values via `useAppStore.getState()` inside the interval callback so the timer doesn't capture stale closures. Use `useAppStore.subscribe(...)` if it simplifies tracking the previous `recordingState`, or a plain `useEffect` watching `[recordingState]` updating a ref — your call.

### 4. Gesture-end write

`src/components/ViewportOverlay.tsx`

In the existing mouseup handler for drag/resize interactions:

1. After clearing `interaction`, check the live store: if `recordingState === 'recording'` AND `isPlaying === false`, proceed; otherwise no-op.
2. Compare `interaction.startRect` (already captured at gesture start) to the current `viewportRect`. If deep-equal (no movement), no-op.
3. Else call `commitKeyframeAtTime(currentTime, viewportRect)`.

Read live values via `useAppStore.getState()` inside the handler — the `interaction` object is available because the handler still has it in scope at mouseup time. Make sure the comparison happens before `setInteraction(null)` clears the reference, or stash `startRect` in a local before clearing.

## Non-goals / Later

- Don't expose recording state outside the store / `PlaybackControls` / sampler hook / `ViewportOverlay`.
- Don't change the timeline keyframe-click behaviour (still seeks + sets viewportRect).
- Don't add UI for sample rate, snap-to-keyframe, or re-record range.
- Don't change `BoundingBoxTool` (drawing still doesn't persist; gesture-end is for drag/resize only — drawing during a session is already gated to `viewportRect === null`, so the question doesn't arise once a session is active).
- Don't worry about the wheel-zoom path in `ViewportOverlay` — the design explicitly excludes scroll-zoom from capture. Scroll-zoom changes `viewportRect` live, and a subsequent sampler tick (if recording+playing) will pick it up; that's acceptable.

## Constraints / Caveats

- Deep equality on `SourceRect`: just compare `x`, `y`, `width`, `height` directly. No need for a generic helper.
- The sampler interval should be cleared cleanly on every state/playback change to avoid leaks. `useEffect` cleanup is sufficient.
- Don't introduce a `useRef` snake pit: prefer reading live state via `useAppStore.getState()` inside callbacks rather than re-deriving from React-rendered closures. The existing hooks (`usePlayback`, `useKeyboardShortcuts`) follow this pattern.
- The sampler must not fire when video is at end-of-file or in any other paused-by-the-element state — `isPlaying` is the source of truth, not direct video element checks.
- After this task, `addKeyframe` is unused in production. Don't delete it; tests reference it.

## Acceptance criteria

- Drawing a box, then pressing Record, produces exactly one keyframe diamond on the timeline at `currentTime` (the explicit snapshot). No second keyframe appears immediately, even if the user is playing.
- With Record active and the video playing, dragging the box produces a stream of keyframes at ≤4 Hz. A held-still box adds no further keyframes after the first sample at the held position.
- Pause (recording action), drag the box, mouseup → exactly one keyframe at the gesture end. No-movement gestures write nothing.
- Stop, then Record again on a moved box, then play → first keyframe is the new snapshot; held-still afterwards adds nothing.
- Pressing Pause (video) while `recordingState === 'recording'` halts the sampler; pressing Play resumes it without firing an immediate tick.
- Pressing the recording **Pause** then **Resume** (state action) — sampler fires immediately on Resume if video is playing, then continues at 4 Hz.
- A keyframe sampled within `epsilon` of an existing keyframe's time updates that keyframe's `sourceRect` in place (no near-duplicate kf appears on the timeline).
