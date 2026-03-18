# Task 010: PTZ Zoom + Integration Polish

## Context
This is the final task. All core features are implemented: video player, viewport overlay with drag-to-pan, bounding box drawing, timeline, keyframe/segment dialogs, and preview rendering. What remains is scroll-to-zoom on the viewport, and an integration pass to ensure all pieces work together correctly end-to-end.

## Objective
Add scroll-to-zoom on the viewport rectangle (edit mode), and fix any integration gaps to ensure the three POC user flows work smoothly.

## Scope

### 1. Scroll-to-Zoom (`src/components/ViewportOverlay.tsx`)

Add `onWheel` handler on the viewport rectangle div (edit mode only):

**Behavior:**
- Scroll up → viewport shrinks (zoom in) → sourceRect width/height decrease
- Scroll down → viewport grows (zoom out) → sourceRect width/height increase
- Zoom is centered on the mouse cursor position within the viewport

**Implementation:**
- On `wheel` event:
  1. Prevent default scroll behavior (`e.preventDefault()`)
  2. Determine zoom factor: `const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9` (scroll down = grow = 1.1, scroll up = shrink = 0.9)
  3. Get mouse position relative to the viewport rect as a ratio `(mouseXRatio, mouseYRatio)` where (0,0) is top-left and (1,1) is bottom-right of the viewport
  4. Compute new size: `newW = viewportRect.width * zoomFactor`, `newH = viewportRect.height * zoomFactor`
  5. Clamp: minimum 10% of video dimensions, maximum 100% of video dimensions
  6. Adjust position to keep the cursor point stationary:
     ```
     newX = viewportRect.x + mouseXRatio * (viewportRect.width - newW)
     newY = viewportRect.y + mouseYRatio * (viewportRect.height - newH)
     ```
  7. Clamp position to bounds: `x ∈ [0, videoWidth - newW]`, `y ∈ [0, videoHeight - newH]`
  8. Update store: `setViewportRect({ x: newX, y: newY, width: newW, height: newH })`

- The `onWheel` must use `{ passive: false }` to allow `preventDefault()`. Since React's synthetic `onWheel` doesn't support passive option, attach the native wheel listener via `useEffect` on the viewport div element. Use a ref for the viewport div.

### 2. Integration Fixes

Review and fix these known integration points:

**a. Viewport sync after keyframe creation/edit:**
- After drawing a bounding box: viewport should show the new keyframe's rect ✓ (already done in Task 007)
- After editing a keyframe in the dialog: viewport should update ✓ (already done in Task 008)
- After adding a manual KF: viewport stays at current position ✓ (already done)

**b. Mode switching cleanup:**
- Switching from Edit to View should stop any in-progress drag/resize interaction
- Switching from View+Preview back to Edit should re-show the viewport overlay at the correct position
- When switching to View+Source, the viewport overlay should immediately show the CRE-resolved position for `currentTime`

**c. Timeline ↔ Player sync:**
- Clicking a keyframe diamond on the timeline should: set selection (opens dialog) AND seek the video to that keyframe's time AND update the viewport overlay to that keyframe's rect
- Currently it only sets the selection. Fix: in `TimelineBar.tsx`, when a keyframe diamond is clicked, also call `setCurrentTime(kf.time)` and `videoRef.current.currentTime = kf.time` and `setViewportRect(kf.sourceRect)`

**d. Segment click → seek to segment midpoint:**
- When clicking a segment bar, seek the video to the midpoint of the segment for context
- In `TimelineBar.tsx`, when a segment is clicked, also seek to `(seg.startTime + seg.endTime) / 2`

**e. Video ended handling:**
- When the video reaches the end (`video.ended` event), set `isPlaying` to false in the store

**f. TopBar info button:**
- Currently shows a generic alert. Update to show actual video metadata if available: resolution, duration, fps

### 3. Edge Cases to Handle

- **No keyframes in preview mode:** If the user switches to View+Preview with zero keyframes, the PreviewCanvas should show the full source frame (CRE `resolve()` with empty keyframes returns full bounds — this should already work, verify)
- **Keyframe at same time:** If a user creates two keyframes at the exact same time, the earlier-added one is retained at that position in the sorted array. No special handling needed — the CRE will just use whichever comes first in the sorted array.
- **Frame-aligned time snapping:** The CRE already snaps to frame time internally. Keyframe time inputs in the dialog accept freeform values — the CRE handles snapping at resolve time. No change needed.

## Non-Goals
- No keyboard shortcuts
- No undo/redo
- No drag-to-reposition keyframes on the timeline
- No timeline zoom/scroll
- No playhead drag (click-to-scrub is sufficient)

## Constraints
- The wheel event listener must be native (not React synthetic) with `{ passive: false }` to call `preventDefault()`
- Do not break any existing functionality — this is a polish pass
- All 32 existing tests must continue to pass
