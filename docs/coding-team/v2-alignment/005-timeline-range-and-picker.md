# Task 005 — Timeline clip-range band, drag-to-set-range, in-place transition picker

## Context

This is the last v2-alignment task. Today [src/components/TimelineBar.tsx](../../../src/components/TimelineBar.tsx) treats every SVG click as a seek, draws ticks/segments/keyframes/playhead, and has no awareness of the active track's `range` (added in Task 001). Task 002 left the segment-bar `onClick` as a placeholder seek-to-midpoint. We now need to:

1. Render the active track's clip range as a shaded band on the timeline.
2. Let the user **drag** on empty timeline area to replace the clip range, with a movement threshold so a quick click still seeks.
3. Render handles at the range edges; dragging a handle adjusts that edge.
4. Replace segment-bar click with an in-place Smooth/Cut popover.

## Objective

Wire up the timeline's range band, drag-to-set-range gesture (with handles), and segment transition picker. Preserve existing behavior: tick rendering, keyframe diamond click (seek + `setViewportRect`), zoom controls, hover tooltip, scroll-to-pan.

## Scope

All edits in [src/components/TimelineBar.tsx](../../../src/components/TimelineBar.tsx).

### 5.1 Render the clip-range band

- Subscribe to the active track's `range` from the store.
- Add a new SVG group rendered **before** segment bars (so segments and keyframes overlay it). Render a rounded rect from `xFor(range.inTime)` to `xFor(range.outTime)`, vertically spanning roughly `y=20`–`y=50` (cover the segment row). Use a low-opacity brand fill (e.g. `rgba(228, 2, 44, 0.10)`) so it reads as a colored band without competing with content.
- Skip rendering when `range.inTime === range.outTime` (collapsed/unset state) or when the band is fully outside `[visibleStart, visibleEnd]`. Clip the rendered x range to `[TL_X0, TL_X1]` like existing segment rendering does.

### 5.2 Range handles

- Render two small SVG handles (filled rect ~6×30 px, brand color, `cursor: ew-resize`) centered on `xFor(range.inTime)` and `xFor(range.outTime)`. Render **after** the band so they sit on top.
- Skip rendering when `videoMetadata` is null or `duration === 0`.
- Each handle owns its own `onMouseDown` that initiates a `'resize-handle'` drag (see 5.4) and `e.stopPropagation()` so it doesn't bubble into the empty-area mousedown.

### 5.3 In-place transition picker

- Replace the placeholder seek-to-midpoint in the segment-bar `onClick` with: open a popover anchored to the clicked segment, two buttons "Smooth" and "Cut".
- New local state: `pickerState: { startKfId: string; svgX: number } | null`.
- On segment click: `e.stopPropagation()`, set `pickerState` with the segment's `startKeyframe.id` and the click's SVG x coordinate (or the segment midpoint x — pick midpoint for stability).
- Render the popover as a sibling DOM element next to the SVG (not inside it). Position it absolutely above the timeline at the SVG x converted to container x. Use `getBoundingClientRect` on the SVG to compute the conversion, OR keep it simple by storing the click event's `clientX` and positioning relative to the wrapper div. Wrapper div needs `position: relative` (it already is via `relative` Tailwind class).
- Each button: calls `setTransition(pickerState.startKfId, 'smooth' | 'cut')`, then closes the popover.
- Close the popover on: option select, Escape key, click outside (mousedown anywhere outside the popover including elsewhere on the timeline).
- **No seek** when opening the picker.

### 5.4 Drag-to-set-range with click-vs-drag discrimination

Replace the existing `onClick` on the SVG with `onMouseDown` + window `mousemove`/`mouseup` listeners. New local state:

```ts
type DragState =
  | { type: 'pending'; startTime: number; startClientX: number }
  | { type: 'create-range'; startTime: number; currentTime: number }
  | { type: 'resize-handle'; side: 'in' | 'out'; otherEdgeTime: number };
```

Flow:

- **SVG `onMouseDown`** (empty area only — segment/keyframe/handle children call `stopPropagation`):
  - Compute the time at the cursor.
  - Set state to `{ type: 'pending', startTime: time, startClientX: e.clientX }`.
- **Handle `onMouseDown`** (in 5.2):
  - Set state to `{ type: 'resize-handle', side, otherEdgeTime: range.outTime | range.inTime }`.
- **Window `mousemove`** (active only while drag state is non-null):
  - For `pending`: if `|e.clientX - startClientX| > 4` px, transition to `create-range` with `currentTime = time(e)`.
  - For `create-range`: update `currentTime` to `time(e)`, clamped to `[0, duration]`.
  - For `resize-handle`: call `setTrackRange(side === 'in' ? time(e) : otherEdgeTime, side === 'out' ? time(e) : otherEdgeTime)` — let the store's clamp/sort handle invalid values. (Since `setTrackRange` swaps when in > out, dragging a handle past the other edge inverts the range, which is the natural editor behavior.)
- **Window `mouseup`**:
  - For `pending`: treat as click → seek to `startTime` (existing behavior; sets `currentTime` and `videoRef.current.currentTime`).
  - For `create-range`: call `setTrackRange(startTime, currentTime)`.
  - For `resize-handle`: nothing extra; live updates already happened during mousemove.
  - Clear drag state.
- During `create-range`, render an extra preview band (slightly different style than the committed band) so the user sees what they're about to commit. It's fine to reuse the band rect with a different opacity/stroke.

### 5.5 Cleanup

- Remove the temporary segment-bar seek-to-midpoint logic that Task 002 left.
- Remove the now-unused `handleSvgClick` handler (replaced by mousedown-based flow).
- Keep `handleSvgMouseMove` (hover tooltip) and the wheel/zoom logic untouched.

## Non-goals / Later

- No multi-clip, add-clip, or delete-clip flow.
- No bookmarks.
- No keyboard shortcut to clear the range.
- No drag-to-move the entire range as a block (only individual handles + recreate via empty-area drag).
- Do **not** seek on segment click, segment hover, or handle interaction.
- Do **not** add a visual snap to keyframes during drag — it's a stretch goal we haven't scoped.

## Constraints / Caveats

- Hit-testing order matters. Z-order from bottom: range band → segment bars → range handles → keyframe diamonds → playhead. Diamonds must remain clickable for seek; keep their `e.stopPropagation()` in their `onClick`.
- **Existing keyframe-diamond click is `onClick`, not `onMouseDown`.** When you switch the SVG to mousedown-based handling, the diamond still works because `onClick` fires after a clean mouseup with no movement. But: dragging from on top of a diamond will currently start an empty-area `pending` drag (mousedown bubbles). Two clean fixes:
  1. Add `onMouseDown={(e) => e.stopPropagation()}` to each diamond as well as `onClick`.
  2. In the SVG `onMouseDown`, check `e.target` and bail if it's a diamond/segment/handle.
  Pick (1) — it's local to each interactive element and doesn't require per-shape target sniffing.
- Apply the same `onMouseDown stopPropagation` to segment bars so a drag-from-segment doesn't start a range-create.
- Segment-bar `onClick` already calls `stopPropagation`. Keep that — clicks shouldn't seek even now that the SVG mousedown is the entry point.
- Range band itself should be `pointer-events="none"` so it doesn't block clicks on the area it covers.
- The popover is a DOM element; it sits inside the wrapper div which is `position: relative`. Compute its left coordinate by converting the stored SVG x to a percentage of viewBox width and applying that to the wrapper's pixel width — the SVG already uses `viewBox="0 0 1000 75"` and `className="w-full"`, so percentage positioning works cleanly.
- After commit (`setTrackRange`), the band re-renders from store state. No need to keep a "preview" version after mouseup.
- `setTrackRange` in the store already clamps and orders. Do not re-implement clamping in the timeline.
- The picker should not steal focus from the rest of the app (no autofocus on its buttons), to avoid breaking the keyboard-shortcut hook from Task 003. If you need to handle Escape, attach a one-shot keydown listener from the picker's mount effect, scoped to `document`, and remove it on close.
