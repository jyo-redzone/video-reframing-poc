# Task 009: Preview Rendering

## Context
The PlayerPanel renders a `<video>` element with viewport overlay and bounding box tool. The store has `mode` ('edit'|'view') and `viewType` ('source'|'preview'). The CRE `resolve()` function returns the camera rect at any time. In View+Preview mode, the user should see only the cropped/reframed region of the video, driven by the CRE.

## Objective
Add a canvas-based preview renderer that, in View+Preview mode, draws only the CRE-resolved crop region of the video onto a `<canvas>`, producing the reframed output. Also ensure mode/view switching properly shows/hides the right elements.

## Scope

### `src/components/PreviewCanvas.tsx`

A `<canvas>` element that fills the video container and renders the cropped preview.

**Props:** `containerRef: React.RefObject<HTMLDivElement | null>`

**When rendered:** Only when `mode === 'view' && viewType === 'preview'`

**Rendering loop:**
- Use `requestAnimationFrame` to drive rendering
- On each frame:
  1. Get `currentTime` from store
  2. Get keyframes from store (same selector pattern as TimelineBar)
  3. Get `videoMetadata` from store (for bounds and fps)
  4. Call `resolve(currentTime, keyframes, { width, height }, fps)` to get the `sourceRect`
  5. Draw onto the canvas: `ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)`
     - `sx = sourceRect.x`, `sy = sourceRect.y`, `sw = sourceRect.width`, `sh = sourceRect.height`
     - Destination is the full canvas
- The rAF loop should run continuously while the component is mounted (which is only during preview mode)
- Clean up rAF on unmount

**Canvas sizing:**
- The canvas should match the container's pixel dimensions
- Use `ResizeObserver` or read `containerRef.current.getBoundingClientRect()` on mount and on window resize to set `canvas.width` and `canvas.height` (physical pixels)
- CSS: `className="absolute inset-0 w-full h-full"` to fill the container

**Important:** Read store values inside the rAF callback using `useAppStore.getState()` (imperative read) rather than reactive selectors, to avoid creating a new rAF loop on every state change. The rAF loop is a single persistent loop that reads fresh state each frame.

**Z-index:** Higher than the video element but below the viewport overlay z-index. Use `style={{ zIndex: 15 }}`. Since ViewportOverlay returns `null` in preview mode, there's no actual overlap, but the z-index ensures correct ordering if there's any timing during mode switch.

### Update `src/components/PlayerPanel.tsx`

**Mode/view switching logic — what's visible in each state:**

| Mode | ViewType | `<video>` | BoundingBoxTool | ViewportOverlay | PreviewCanvas |
|------|----------|-----------|-----------------|-----------------|---------------|
| edit | (n/a)    | visible   | rendered        | rendered (interactive) | not rendered |
| view | source   | visible   | not rendered    | rendered (read-only)   | not rendered |
| view | preview  | visible (but behind canvas) | not rendered | not rendered | rendered |

The `<video>` element stays mounted always (it's the source for both playback and `drawImage`). BoundingBoxTool and ViewportOverlay already handle their own conditional rendering internally. So the main change is:

- Add conditional rendering of `<PreviewCanvas containerRef={containerRef} />` when `mode === 'view' && viewType === 'preview'`
- Render it inside the video container div, after the video element

### Ensure video keeps playing in preview mode

The `<video>` element must continue playing in preview mode (it's the source for `drawImage`). The `usePlayback` hook and PlaybackControls already work with the video element directly, so this should work naturally. But verify that:
- Switching to preview mode doesn't pause the video
- Play/pause controls still work in preview mode
- The timecode display still updates

## Non-Goals
- No WebGL or fancy scaling
- No letterboxing/pillarboxing (stretch to fill canvas — the viewport rect can be any aspect ratio in this POC)
- No performance optimization beyond a single rAF loop
- No output resolution matching (canvas matches container size, not the "output resolution" dropdown)

## Constraints
- Use `useAppStore.getState()` for imperative reads inside the rAF callback — do NOT use reactive selectors inside the loop
- The canvas must use physical pixel dimensions (not CSS dimensions) for crisp rendering
- The `<video>` element must remain mounted in all modes (do not conditionally render it)
- `drawImage` source coordinates must be the raw sourceRect values from the CRE (source pixel space) — no coordinate conversion needed since drawImage operates in source video pixel space
