# Task 004 — Shift+drag axis-lock

## Context

v2 §4.1 (Bounding Box) calls for "Shift + drag: constrain movement axis." This applies to **three** gestures:

1. Framing-box **move** — drag inside the box. Implemented in [src/components/ViewportOverlay.tsx](../../../src/components/ViewportOverlay.tsx) `handleMouseMove`, `interaction.type === 'drag'`.
2. Framing-box **handle-resize** — drag a corner. Same file, `interaction.type === 'resize'`.
3. Initial **draw** of a new framing box — click-drag in [src/components/BoundingBoxTool.tsx](../../../src/components/BoundingBoxTool.tsx).

In all three the existing `mousemove` handler is a native `MouseEvent` listener attached to `window`, so `e.shiftKey` is available per move.

## Objective

While Shift is held during any of the three gestures, lock the gesture to the dominant cursor axis: if `|dx| > |dy|`, only horizontal motion takes effect; otherwise only vertical. Shift state is sampled per mousemove (releasing Shift mid-gesture unlocks the next move; pressing it mid-gesture locks the next move).

## Scope

- [src/components/ViewportOverlay.tsx](../../../src/components/ViewportOverlay.tsx) — in `handleMouseMove`, after computing `dx`/`dy` (container-pixel deltas), apply axis-lock by zeroing the non-dominant delta when `e.shiftKey` is true. Do this **before** the source-coord conversion, so the corner-resize math (which uses the post-conversion `dxSource`/`dySource`) inherits the lock without further changes:

  ```ts
  let dx = e.clientX - interaction.startMouse.x;
  let dy = e.clientY - interaction.startMouse.y;
  if (e.shiftKey) {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  ```

  Both `drag` and `resize` branches consume the (now possibly zeroed) deltas — single point of change covers both.

- [src/components/BoundingBoxTool.tsx](../../../src/components/BoundingBoxTool.tsx) — in `handleMouseMove`, when `e.shiftKey` is held, lock the cursor to one axis relative to the drag origin:

  ```ts
  let cx = clampedX;
  let cy = clampedY;
  if (e.shiftKey && drawingRef.current) {
    const dx = cx - drawingRef.current.startX;
    const dy = cy - drawingRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy)) cy = drawingRef.current.startY;
    else cx = drawingRef.current.startX;
  }
  setDrawing((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));
  ```

  The drawing visual will be a thin strip along the locked axis. The existing `< 20`-container-px minimum check in `handleMouseUp` is intentionally left in place — see Caveats.

## Non-goals / Later

- No keyboard-driven axis lock — Shift only matters during active drag.
- No 1:1 (square) constraint mode — the user explicitly chose single-axis stretch over square-constrain in the plan.
- No visual indicator (axis guide line) for which axis is locked. If we want one later, it goes on a follow-up task.

## Constraints / Caveats

- Compare pixel deltas (`dx`/`dy` in container/screen space), not source-coord deltas. The user's intent is screen-direction, and source coords scale asymmetrically when the rendered video is letterboxed.
- The `drag` and `resize` branches in `ViewportOverlay` must share the same lock. Don't duplicate the conditional in each branch — apply once at the top of the handler.
- **Initial-draw degeneracy:** with a perfect axis-lock the orthogonal dimension is 0. The existing `drawnRect.width < 20 || drawnRect.height < 20` check in `handleMouseUp` will reject the draw on release. That is the desired failure mode for this edge gesture — do **not** add any "min thickness" workaround. If a user genuinely wants a thin keyframe via draw, they release Shift just before mouseup.
- Per-frame `e.shiftKey` sampling is correct: a mid-drag Shift toggle changes behavior on the next mousemove, which is what users expect.
