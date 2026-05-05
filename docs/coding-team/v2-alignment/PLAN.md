# v2 Alignment — POC Code Changes

Source of truth for scope: [docs/v2-alignment-plan.md](../../v2-alignment-plan.md), aligned to [Video Reframing HLD - v2.md](../../Video%20Reframing%20HLD%20-%20v2.md) and [Video Reframing UI spec - v2.md](../../Video%20Reframing%20UI%20spec%20-%20v2.md).

## Scope (decided)

- Single-clip scope (no add/delete clips); add a per-clip `range`.
- Drag-to-set-range on the timeline; shaded clip-range band; range handles.
- Remove Keyframe + Segment inspection dialogs entirely.
- Replace segment-click with a small in-place Smooth/Cut picker; keyframe-click seeks (no dialog).
- "Selected keyframe" = the keyframe at the playhead. Delete + arrow nudges act on it; no-op when between keyframes.
- Shift+drag axis-lock for framing-box move, handle-resize, and initial draw.
- TrackPanel cleanup: drop "+ Manual KF" + "Auto" toggle; replace static R1/R2 with read-only display of clip range; rename Export to "Export selected clip" (still a stub).

## Non-goals

- Multi-clip flows (add/delete clips), bookmarks, real export, internal symbol renames, UI label vocabulary changes.

## Tasks

1. **001 — Clip range model.** Add `range: { inTime, outTime }` to `Track`, seed in store, add `setTrackRange`, replace static R1/R2 in TrackPanel with read-only In/Out display.
2. **002 — Strip dialogs, dead selection state, and TrackPanel cruft.** Delete `KeyframeDialog`/`SegmentDialog` and their helpers; remove `selectedKeyframeId`/`selectedSegmentKey` and their actions from the store and all callers; remove "+ Manual KF" + "Auto" toggle from TrackPanel; rename Export button. Leave segment-click as plain seek temporarily — real picker arrives in Task 005.
3. **003 — Playhead-based keyframe selection + keyboard interactions.** Add `getSelectedKeyframe()` selector. Wire document-level keyboard handlers: arrow = 1 source-px nudge, Shift+arrow = 10×, Delete = remove selected keyframe. Guard against firing while focus is in an input.
4. **004 — Shift+drag axis-lock.** ViewportOverlay (move + corner-resize) and BoundingBoxTool (initial draw) lock to dominant axis when Shift is held.
5. **005 — Timeline clip-range band, drag-to-set-range with handles, in-place transition picker.** Render shaded band from `range.inTime`→`outTime`; add range handles; click-drag on empty area sets the range; segment-click opens a small Smooth/Cut popover that calls `setTransition`. Hit-testing must distinguish empty-area drag, handle drag, and playhead drag.
