# Plan: Code Changes to Align POC with v2 HLD + UI Specs

## Context

Two v2 specs ([Video Reframing HLD - v2.md](../Video%20Reframing%20HLD%20-%20v2.md), [Video Reframing UI spec - v2.md](../Video%20Reframing%20UI%20spec%20-%20v2.md)) revise the v1 documents. This plan lists every **code change** required to bring the current POC into alignment with v2.

**Decided scope:**
- Code-only changes; no edits to [POC-Plan.md](../POC-Plan.md).
- Internal naming stays as-is (no symbol renames). UI label vocabulary changes deferred.
- Single selected clip at a time (no add/delete clip flows).
- **Bookmarks: out of scope** for now (dropped for simplicity).
- Inspection dialogs (Keyframe + Segment) are **removed entirely**.
- Drag-to-create clip on timeline is **in scope**.
- Shift+drag axis-lock applies to **move, handle-resize, and initial draw**.
- "Selected keyframe" = the keyframe at the current playhead time. Delete + arrow-key nudge act on it. When the playhead is between keyframes, both keys are no-ops.
- Clicking a timeline diamond seeks to that keyframe; the framing box at that time *is* the keyframe and editing it (drag, resize, nudge) edits that keyframe directly — no dialog.
- Clicking a timeline segment opens a small in-place transition picker (Smooth/Cut, default Smooth). No seek, no dialog.

Items already aligned with v2 are flagged as "no-op" so the audit is explicit.

---

## Required Code Changes

### Group 1 — Clip model (single-clip with range)

| # | Change | Reason |
|---|---|---|
| 1.1 | Add `range: { inTime: number; outTime: number }` to the `Track` type in [src/types/index.ts](../src/types/index.ts). | v2 says each clip has its own time range; current Track has no place to store it. |
| 1.2 | Seed the default track in [src/store/useAppStore.ts](../src/store/useAppStore.ts) with a starting range. Initial value `{inTime: 0, outTime: 0}` until video metadata loads, then auto-set to full duration inside `setVideoMetadata`. | App must not crash on initial render before user has authored a range. Auto-defaulting to full duration on metadata load gives a sensible starting state for drag-to-resize. |
| 1.3 | Add a `setTrackRange(inTime, outTime)` action on the store. **No** `addTrack` / `deleteTrack` — single-clip scope. | Drag-to-set-range and handle-resize on the timeline (Group 3.2) need a single mutation API. |
| 1.4 | Remove the static "Export ranges" block (R1, R2 lines, "+ Add range" button) from [src/components/TrackPanel.tsx](../src/components/TrackPanel.tsx). Replace with a small read-only display of the active clip's current range (e.g. `In: 00:00 / Out: 00:30`). | v2 has no separate range concept; the clip's range is the export range. Static R1/R2 was POC stub. |

### Group 2 — Right panel (TrackPanel)

| # | Change | Reason |
|---|---|---|
| 2.1 | Remove **"+ Manual KF"** button + `handleAddManualKF` from [src/components/TrackPanel.tsx](../src/components/TrackPanel.tsx). | v2 UI §4.2 has no manual-KF entry; v2 §4.1 captures keyframes only at framing-box gesture boundaries. |
| 2.2 | Remove **"Auto" keyframe-capture toggle** + tooltip from [src/components/TrackPanel.tsx](../src/components/TrackPanel.tsx). | v2 makes auto-capture the only model — no opt-out. |
| 2.3 | Repurpose existing **Export** button to "Export selected clip"; keep stub toast. | v2 export is per-clip; behaviorally still a stub for POC. |
| 2.4 | Leave "Selected track" dropdown + Output res dropdown cosmetic for single-clip scope. Layout cleanup only if removing 2.1 / 2.2 leaves the panel awkward. | Single-clip scope — selector has nothing to switch between. |

### Group 3 — Timeline bar

| # | Change | Reason |
|---|---|---|
| 3.1 | Render a **selected-clip range band** on the timeline (shaded rect from `clip.range.inTime` → `outTime`) in [src/components/TimelineBar.tsx](../src/components/TimelineBar.tsx). | v2 UI §4.3: "Show indication for the timeline of selected clip." |
| 3.2 | Add **drag-to-set-range** on timeline: click-drag on empty area sets the clip's range (calls `setTrackRange`). Render drag-handles at the clip range edges; dragging a handle adjusts in/out. With single-clip, "create" semantically means "replace the existing clip's range". Care: distinguish empty-area drag from playhead drag and from clip-handle drag (hit-testing). | v2 UI §4.2 (drag to create), §4.3 (drag start/end handles). Required for POC. |
| 3.3 | Update timeline **keyframe-click handler**: keep the existing seek + `setViewportRect` behavior (so the framing box snaps to that keyframe), but **drop the dialog-open side effect**. Keep `selectKeyframe(kf.id)` only if it's used elsewhere; otherwise the playhead-time-based selection model (§4.2) makes it redundant. | Per user: edit keyframes by dragging the framing box, not via dialog. Click → seek → box at keyframe → drag the box to edit. |
| 3.4 | Replace timeline **segment-click handler** with a small **in-place transition picker**: on click, render a tiny popover anchored at the segment with two options (Smooth / Cut). Selecting one calls `setTransition(startKeyframeId, choice)` and closes the popover. **No seek**. Default for new segments stays Smooth (already correct). | Per user: open a small menu in place to switch transition; no modal dialog. v2 HLD removed §4.3 derived intent, so the popover does **not** show derived ops. |
| 3.5 | **No-op:** scroll/zoom controls in [src/components/TimelineBar.tsx](../src/components/TimelineBar.tsx) already satisfy v2. | Already shipped. |

### Group 4 — Bounding-box interactions + dialog removal

The current [src/components/BoundingBoxTool.tsx](../src/components/BoundingBoxTool.tsx) supports draw only; [src/components/ViewportOverlay.tsx](../src/components/ViewportOverlay.tsx) supports drag-to-pan and scroll-to-zoom. With dialogs removed, the framing-box surface becomes the primary editing path.

| # | Change | Reason |
|---|---|---|
| 4.1 | **Remove Keyframe + Segment inspection dialogs**: delete [src/components/KeyframeDialog.tsx](../src/components/KeyframeDialog.tsx) and [src/components/SegmentDialog.tsx](../src/components/SegmentDialog.tsx); remove their imports and `<KeyframeDialog />` / `<SegmentDialog />` usages from [src/App.tsx](../src/App.tsx). Delete any segment-derived-intent helper that was only used by SegmentDialog (v2 HLD removed §4.3 — derived intent is gone). | v2 UI §4 has no inspection items; user confirmed remove. |
| 4.2 | **Selection model**: define "selected keyframe" as the keyframe whose `time` equals the current playhead `currentTime` (within a small epsilon, e.g. half a frame). Add a derived selector (e.g. `getSelectedKeyframe()`) on the store. Delete + arrow-key handlers (4.4–4.7) consult this selector. When between keyframes, `getSelectedKeyframe()` returns null and the keyboard handlers no-op. | Keeps the model simple and matches the user's mental model: "the box you see *is* the keyframe at this time, edit it directly." |
| 4.3 | Clean up store: drop `selectedSegmentKey` + `selectSegment` (no longer used after 3.4 + 4.1). Decision on `selectedKeyframeId` + `selectKeyframe`: **drop** them too, because 4.2 derives selection from playhead time — explicit selection state becomes dead code. Audit consumers before removing. | Remove dead state introduced for dialogs. |
| 4.4 | **Arrow-key nudge** on the selected framing box (small step). Step size: 1 source pixel (or container-pixel-equivalent — pick whichever feels right after testing; recommend 1 source px for determinism). Updates the keyframe's `sourceRect.x/y` directly via `updateKeyframe`. No-op when no keyframe is selected per 4.2. | v2 §4.1: "Arrow keys: nudge box". |
| 4.5 | **Shift+arrow** for larger nudge — 10× the small step. | v2 §4.1: "Shift + arrow keys: larger nudge". |
| 4.6 | **Shift+drag axis-lock** during framing-box **move** (in [src/components/ViewportOverlay.tsx](../src/components/ViewportOverlay.tsx)), **handle-resize** (also ViewportOverlay if it supports handles, else add), and **initial draw** of a new box (in [src/components/BoundingBoxTool.tsx](../src/components/BoundingBoxTool.tsx)). On Shift held during drag, lock to the dominant axis (`abs(dx) > abs(dy)` → X-only; else Y-only). For draw, lock the rectangle's growth to the dominant axis (the other dimension stays at 0/min — or alternatively, makes it a square; **going with axis-lock = constrain growth direction**, single-axis stretch). | v2 §4.1: "Shift + drag: constrain movement axis". User confirmed apply to all gestures. |
| 4.7 | **Delete key** removes the currently selected adjustment point (per 4.2). `deleteKeyframe` already exists in the store — only the keybind handler is missing. Wire at app or canvas level so it fires while focus is on the player area. Guard against firing when focus is in an input field. | v2 §4.1: "Delete selected point: remove adjustment point". |
| 4.8 | **No-op:** default transition for box-created keyframes is already `'smooth'` in [src/components/BoundingBoxTool.tsx:81](../src/components/BoundingBoxTool.tsx#L81). v2 §4.1 says default is smooth. | Already aligned. |

---

## Critical files

- [src/types/index.ts](../src/types/index.ts) — Track range field (1.1)
- [src/store/useAppStore.ts](../src/store/useAppStore.ts) — seed range, `setTrackRange`, `getSelectedKeyframe`, drop dead selection state (1.2, 1.3, 4.2, 4.3)
- [src/App.tsx](../src/App.tsx) — remove dialog mounts, add document-level keyboard handlers (4.1, 4.4, 4.5, 4.7)
- [src/components/TrackPanel.tsx](../src/components/TrackPanel.tsx) — remove Manual KF, Auto toggle, static ranges; show clip range read-only (1.4, 2.1–2.3)
- [src/components/TimelineBar.tsx](../src/components/TimelineBar.tsx) — clip band, drag-to-set-range + handles, in-place transition picker, click-handler cleanup (3.1–3.4)
- [src/components/BoundingBoxTool.tsx](../src/components/BoundingBoxTool.tsx) — Shift axis-lock during initial draw (4.6)
- [src/components/ViewportOverlay.tsx](../src/components/ViewportOverlay.tsx) — Shift axis-lock for move/resize (4.6)
- **Delete:** [src/components/KeyframeDialog.tsx](../src/components/KeyframeDialog.tsx), [src/components/SegmentDialog.tsx](../src/components/SegmentDialog.tsx) (4.1)

---

## Verification (per change, when implementation starts)

- UI changes: `npm run dev`, exercise the changed interaction in the browser, regression-check the others (drag-to-pan, scroll-to-zoom, Edit/View+Source/View+Preview, timeline scrub, zoom).
- Types/store: `npm run typecheck`; existing vitest suites in [src/engine/__tests__/cre.test.ts](../src/engine/__tests__/cre.test.ts) and [src/store/__tests__/useAppStore.test.ts](../src/store/__tests__/useAppStore.test.ts) must still pass. Tests that referenced removed dialog/segment-key state will need to be updated or dropped alongside the change that removes them.
