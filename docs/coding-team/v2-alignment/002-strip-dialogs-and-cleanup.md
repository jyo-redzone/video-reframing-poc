# Task 002 — Strip dialogs, dead selection state, and TrackPanel cruft

## Context

v2 has no inspection dialogs. The current codebase still mounts [src/components/KeyframeDialog.tsx](../../../src/components/KeyframeDialog.tsx) and [src/components/SegmentDialog.tsx](../../../src/components/SegmentDialog.tsx) from [src/App.tsx](../../../src/App.tsx), and the store carries `selectedKeyframeId` / `selectedSegmentKey` solely to drive them. v2 HLD also drops the segment-derived-intent concept; the only remaining producer/consumer of `derivedIntent` is the segment helper + its tests + SegmentDialog. TrackPanel still has a "+ Manual KF" button and an "Auto" capture toggle that v2 says should not exist — auto-capture is the only model.

Task 001 left Task 005's responsibilities (timeline range band + segment-click picker) untouched. This task removes dead code and prepares the surface; segment-click on the timeline temporarily becomes a plain seek-to-midpoint until Task 005 wires the in-place picker.

## Objective

Delete the dialog components and all the state, actions, and call sites that existed only to feed them. Remove the matching TrackPanel UI bits. Leave the codebase in a consistent state with all tests + typecheck green.

## Scope

- **Delete files**
  - [src/components/KeyframeDialog.tsx](../../../src/components/KeyframeDialog.tsx)
  - [src/components/SegmentDialog.tsx](../../../src/components/SegmentDialog.tsx)

- [src/App.tsx](../../../src/App.tsx) — remove the imports and the `<KeyframeDialog />` / `<SegmentDialog />` mounts.

- [src/store/useAppStore.ts](../../../src/store/useAppStore.ts) — drop `selectedKeyframeId`, `selectedSegmentKey`, `selectKeyframe`, `selectSegment` (state fields, action types, initial values, action implementations).

- [src/components/TimelineBar.tsx](../../../src/components/TimelineBar.tsx) —
  - Remove the `selectKeyframe` and `selectSegment` subscriptions.
  - Keyframe diamond click: keep `setCurrentTime` + `videoRef.currentTime` + `setViewportRect(kf.sourceRect)`. Drop only the `selectKeyframe(kf.id)` call.
  - Segment-bar click: keep the seek-to-midpoint behavior as a placeholder. Drop only the `selectSegment(segKey)` call. (Task 005 will replace the click handler with the in-place transition picker.)

- [src/components/BoundingBoxTool.tsx](../../../src/components/BoundingBoxTool.tsx) — remove the `selectKeyframe` subscription, the `selectKeyframe(newId)` call after `addKeyframe`, and the corresponding entry in `useCallback`'s dependency array.

- [src/components/TrackPanel.tsx](../../../src/components/TrackPanel.tsx) —
  - Remove the "+ Manual KF" button, the `handleAddManualKF` handler, and the `addKeyframe` / `selectKeyframe` / `viewportRect` / `currentTime` / `activeTrackId` subscriptions used only by it.
  - Remove the entire "Keyframe capture / Auto" group (label, checkbox, tooltip).
  - The grid that wrapped the Auto block + Manual KF button goes with them; the "Mode & View" grid above stays as is.
  - Change the Export button label to **"Export selected clip"** (keep the existing alert stub).

- **Drop derived-intent** (the v2 HLD removed §4.3):
  - [src/types/index.ts](../../../src/types/index.ts) — remove `derivedIntent` from `Segment`.
  - [src/engine/cre.ts](../../../src/engine/cre.ts) — stop populating `derivedIntent` in the segment factory and delete the now-unused `deriveIntent` helper (and its private helpers, if any are unused after removal).
  - [src/engine/__tests__/cre.test.ts](../../../src/engine/__tests__/cre.test.ts) — drop the assertions on `derivedIntent` (and any tests whose sole purpose was exercising `deriveIntent`).

- [src/store/__tests__/useAppStore.test.ts](../../../src/store/__tests__/useAppStore.test.ts) — drop tests / setup that referenced the removed selection state, if any.

## Non-goals / Later

- Do **not** add the in-place transition picker — Task 005.
- Do **not** add the playhead-derived `getSelectedKeyframe()` selector or any keyboard handlers — Task 003.
- Do **not** touch the timeline range band, range handles, or drag-to-set behavior — Task 005.
- Do **not** rename internal symbols beyond the explicit deletions above.
- Leave the "Selected track" and "Output res" cosmetic dropdowns alone; they are out of scope for v2 single-clip work.

## Constraints / Caveats

- After this task there should be zero references to `selectedKeyframeId`, `selectedSegmentKey`, `selectKeyframe`, `selectSegment`, `KeyframeDialog`, `SegmentDialog`, `derivedIntent`, or `deriveIntent` anywhere in `src/`. Verify before declaring done.
- `setViewportRect` on keyframe-diamond click must stay — without it, clicking a diamond no longer snaps the framing box to that keyframe's rect, which is the v2 interaction model (click → seek → box at keyframe).
- Watch for unused imports in TimelineBar / BoundingBoxTool / TrackPanel after the deletions.
