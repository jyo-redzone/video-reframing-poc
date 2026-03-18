# Task 007: Viewport Overlay + Bounding Box

## Context
The PlayerPanel renders a `<video>` inside a `relative aspect-video` container. The store has `viewportRect` (source pixel coords), `mode`, keyframes, and `addKeyframe`/`updateKeyframe`/`setViewportRect`. The CRE has `resolve()`. In edit mode, users need to see and manipulate a viewport rectangle, and draw bounding boxes to create keyframes.

## Objective
Add a DOM-based viewport overlay on top of the video that is:
- **Edit mode**: interactive — draggable to pan, resizable via corner handles, plus a bounding box draw tool for creating new keyframes
- **View+Source mode**: read-only — shows the CRE-resolved viewport position at current time
- **View+Preview mode**: hidden (preview canvas replaces it in Task 009)

Also wire up the "Add Manual KF" button in TrackPanel.

## Scope

### Coordinate conversion utility: `src/utils/coordinates.ts`

Two functions:
```ts
/** Source pixel coords → CSS percentage position within the video container */
export function sourceToPercent(rect: SourceRect, videoWidth: number, videoHeight: number) {
  return {
    left: (rect.x / videoWidth) * 100,
    top: (rect.y / videoHeight) * 100,
    width: (rect.width / videoWidth) * 100,
    height: (rect.height / videoHeight) * 100,
  }
}

/** CSS pixel position within the video container → source pixel coords */
export function containerToSource(
  containerRect: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): SourceRect {
  return {
    x: (containerRect.x / containerWidth) * videoWidth,
    y: (containerRect.y / containerHeight) * videoHeight,
    width: (containerRect.width / containerWidth) * videoWidth,
    height: (containerRect.height / containerHeight) * videoHeight,
  }
}
```

Delete `src/utils/.gitkeep`.

### `src/components/ViewportOverlay.tsx`

A `<div>` absolutely positioned inside the video container. Receives `containerRef` (ref to the video container div) as a prop.

**Display logic:**
- Read `mode`, `viewType`, `viewportRect`, `videoMetadata` from store
- If `mode === 'view' && viewType === 'preview'`: render nothing
- If `mode === 'view' && viewType === 'source'`: render read-only viewport rect (CRE-resolved position at currentTime). Use `resolve(currentTime, keyframes, bounds, fps)` to get the rect.
- If `mode === 'edit'`: render interactive viewport rect + bounding box draw tool

**Viewport rectangle rendering:**
- Absolute-positioned `<div>` with `border-2 border-emerald-400/90`
- Position/size via CSS `left`, `top`, `width`, `height` in percentages (using `sourceToPercent`)
- A small label above: "Viewport (sourceRect)" in a green badge (matching the mock)
- If no `viewportRect` in store: don't render the rect

**Edit mode interactions — Drag to pan:**
- `onMouseDown` on the viewport div (not on resize handles): start tracking drag
- `onMouseMove` (on the container or window): update the rect's position
- `onMouseUp`: finalize — update `viewportRect` in store with new source pixel coords
- Clamp so the rect stays within bounds: `x ∈ [0, videoWidth - rectWidth]`, `y ∈ [0, videoHeight - rectHeight]`

**Edit mode interactions — Resize via corner handles:**
- Render 4 small `<div>` squares (8x8px) at the corners of the viewport rect
- Each handle has a distinct cursor: `nw-resize`, `ne-resize`, `sw-resize`, `se-resize`
- `onMouseDown` on a handle: start resize tracking (record which corner)
- `onMouseMove`: adjust the rect's position and size based on which corner is being dragged
- `onMouseUp`: finalize — update `viewportRect` in store
- Minimum size: 10% of video dimensions (both width and height)
- Clamp to video bounds

**Implementation approach for drag/resize:**
- Use a single state: `interaction: null | { type: 'drag' | 'resize', corner?: 'nw' | 'ne' | 'sw' | 'se', startMouse: {x, y}, startRect: SourceRect }`
- Attach `mousemove` and `mouseup` listeners on `window` (not just the element) so the mouse can move outside the container during drag
- Use `useEffect` to add/remove window listeners based on whether `interaction` is active
- During interaction, compute the new rect in source pixel coords and update `viewportRect` in store on each move (for live feedback). Do NOT create a keyframe on every drag frame — only on final mouseup if needed.

### `src/components/BoundingBoxTool.tsx`

A transparent overlay `<div>` covering the entire video container, rendered BEHIND the viewport rect (lower z-index). Only rendered when `mode === 'edit'`.

**Behavior:**
- `onMouseDown` (on this overlay, meaning the click was NOT on the viewport rect): start drawing
- `onMouseMove`: render a dashed rectangle from the start point to the current point
- `onMouseUp`: finalize the bounding box
  - Convert the drawn rect from container pixels to source pixel coords
  - Create a new keyframe:
    ```ts
    addKeyframe({
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      trackId: activeTrackId,
      time: currentTime,
      sourceRect: { x, y, width, height },  // source pixel coords
      transitionToNext: 'smooth',
    })
    ```
  - Update `viewportRect` to the newly drawn rect
  - Set `selectKeyframe(newKfId)` to open the dialog for confirmation (dialog comes in Task 008 — for now just set the selection)
- The dashed rect during drawing: `border-2 border-dashed border-white/80 bg-white/10`
- Minimum draw size: if the drawn rect is smaller than 20px in either dimension (container pixels), discard it (accidental click)

### Wire into `src/components/PlayerPanel.tsx`

- Add a `ref` to the video container div (the `relative aspect-video` wrapper)
- Render `<ViewportOverlay containerRef={containerRef} />` and `<BoundingBoxTool containerRef={containerRef} />` inside the video container div, after the `<video>` element
- Z-ordering: video (bottom) → BoundingBoxTool → ViewportOverlay (top)

### Wire "Add Manual KF" button in `src/components/TrackPanel.tsx`

- On click:
  - Read `currentTime`, `viewportRect`, `activeTrackId` from store
  - If no `viewportRect`, do nothing
  - Create a new keyframe with the current viewport and time (same pattern as bounding box)
  - Call `addKeyframe(...)` and `selectKeyframe(newId)`

## Non-Goals
- No scroll-to-zoom (Task 010)
- No preview canvas rendering (Task 009)
- No keyframe dialog (Task 008 — just set selection state)
- No aspect ratio locking

## Constraints
- All rect coordinates in the store are in **source pixel space**, not percentages or container pixels
- Coordinate conversion happens at the boundary: container pixels ↔ source pixels
- During drag/resize, update `viewportRect` in the store on every mousemove for live feedback
- The viewport overlay must NOT intercept clicks meant for the bounding box tool — use z-index ordering and `pointer-events` carefully
