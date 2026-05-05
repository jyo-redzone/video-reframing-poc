# Task 001 — Foundation cleanup

## Context

Prep work for the recording-mode feature. We collapse modes from three to two, remove the implicit "draw creates a keyframe" behaviour, centralise tunable constants, and stop pretending the FPS is hardcoded. No recording behaviour yet — that's Task 002/003.

Source of truth: [docs/DESIGN-gestures-and-keyframe-capture.md](../../DESIGN-gestures-and-keyframe-capture.md).

## Objective

After this task: the app boots with no framing box, the user creates one by drawing once, the box is purely live preview, modes are just `edit` / `view`, and all magic numbers for keyframe-time epsilon live in a single config file.

## Scope

### 1. New file: `src/config.ts`

```ts
// Recording
export const RECORDING_SAMPLE_HZ = 4; // sampler rate while recording + playing

// Keyframe time resolution
export const KEYFRAME_TIME_EPSILON_FRAMES = 0.5; // epsilon = FRAMES / fps
export const KEYFRAME_TIME_EPSILON_FALLBACK_S = 0.02; // when videoMetadata is null
```

Export a small helper, e.g. `keyframeTimeEpsilon(fps: number | null | undefined): number`, that returns `KEYFRAME_TIME_EPSILON_FRAMES / fps` when fps is a finite positive number, else `KEYFRAME_TIME_EPSILON_FALLBACK_S`. Use this helper in every consumer below — no inlined `0.5 / fps` math elsewhere.

### 2. Mode collapse — drop `viewType`

- `src/store/useAppStore.ts`: remove `viewType` from `AppState`, remove `setViewType` from `AppActions`, remove the initial value, remove the action.
- `src/components/TrackPanel.tsx`: remove the View dropdown and any `viewType` reads.
- `src/components/PlayerPanel.tsx`: replace `mode === 'view' && viewType === 'preview'` with `mode === 'view'`. `PreviewCanvas` is the only thing rendered in view mode.
- `src/components/ViewportOverlay.tsx`: simplify — overlay renders only in `edit` mode. Drop the `view+source` branch (the one that resolves a read-only rect via `resolve(...)`). The component should early-return when `mode !== 'edit'`. The `displayRect` indirection collapses to just `viewportRect`.

### 3. Box lifecycle — no auto-set, draw doesn't persist

- `src/components/PlayerPanel.tsx` `handleLoadedMetadata`: remove the `setViewportRect({ x:0, y:0, width: videoWidth, height: videoHeight })` call. `viewportRect` stays `null` until the user draws.
- `src/components/BoundingBoxTool.tsx`:
  - Remove the `addKeyframe(...)` call from `handleMouseUp`. Drawing only calls `setViewportRect(sourceRect)`.
  - Drop the now-unused imports (`addKeyframe`, `activeTrackId`, `currentTime` if no longer needed).
  - Gate the entire tool on `viewportRect === null`. If `viewportRect !== null`, return null (in addition to the existing `mode !== 'edit'` guard). Once a box exists the tool is inert.

### 4. Refactor epsilon consumers

- `src/store/useAppStore.ts` `getSelectedKeyframe`: replace the inline `videoMetadata != null ? 0.5 / videoMetadata.fps : 0.02` with the helper from `src/config.ts`.
- `src/hooks/useKeyboardShortcuts.ts`: it already calls `getSelectedKeyframe()` — no math change there, just verify nothing inlines an epsilon. Skip if not present.

### 5. Frame-step uses video metadata fps

- `src/components/PlaybackControls.tsx`:
  - Remove the local `const FPS = 29.97;` and `FRAME_DURATION` constants.
  - Read `videoMetadata.fps` from the store.
  - Compute frame duration as `1 / fps` when fps is available; if metadata is null, disable the prev/next-frame buttons (or no-op the handlers — disabled is preferable for clarity).

## Non-goals / Later

- No recording state machine, no REC UI, no sampler, no gesture-end writes — all in Tasks 002/003.
- Don't introduce a way to clear `viewportRect` back to `null` from the UI.
- Don't change `BoundingBoxTool`'s shift-axis-lock or container hit area — only the persistence behaviour and the new gate.
- Don't touch the keyframe diamond click in `TimelineBar` (still seeks + sets viewportRect).
- Don't expose `RECORDING_SAMPLE_HZ` in UI yet.

## Constraints / Caveats

- `setVideoMetadata` in the store currently does extra work seeding the track range when range is unset. Leave that logic intact — only the auto-set of `viewportRect` (in `PlayerPanel`) is being removed.
- Tests in `src/store/__tests__/useAppStore.test.ts` may reference `viewType` — update or remove those assertions as needed. Don't add new tests for this task; existing suite should still pass.
- Existing v2 ranges use `videoMetadata?.fps ?? someFallback` patterns — keep behaviour consistent.

## Acceptance criteria

- `viewType` is not present anywhere in `src/`.
- App loads with no framing box; drawing once produces a live box but no keyframe diamond on the timeline.
- After drawing, dragging or scroll-zooming on the box still works; clicking outside the box does nothing (BoundingBoxTool inert).
- Frame-step buttons advance by exactly one source frame for whatever fps the loaded video reports.
- No file outside `src/config.ts` contains a literal `0.5 / fps` or `0.02` for keyframe-time epsilon.
