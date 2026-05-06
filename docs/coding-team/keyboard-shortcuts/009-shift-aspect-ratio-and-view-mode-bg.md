# 009 — Shift = maintain aspect ratio + hide original video in view mode

## Context

Two unrelated fixes bundled because they're small.

### A — Shift modifier on bbox interactions

Doc says Shift is "axis / square constraint". Current code:
- `ViewportOverlay` (lines 62-65): Shift axis-locks both move AND resize.
- `BoundingBoxTool` (lines 49-54): Shift zeros out one dimension while drawing — broken (height or width becomes 0, draw fails the 20px minimum).

Replace with: **Shift = maintain aspect ratio** during resize and draw. Move ignores Shift.

### B — Original video visible in view mode

`PlayerPanel` renders `<video>` and `<PreviewCanvas>` simultaneously (canvas only in view mode). PreviewCanvas uses `ctx.clearRect`, so the canvas pixels are transparent in letterbox/pillarbox regions — the original `<video>` shows through. The user wants only the cropped preview visible in view mode.

## Objective

- Shift+resize on an existing rect: maintain that rect's current `width:height` ratio.
- Shift+draw of a new rect: maintain the **video's** aspect ratio (since there's no existing rect ratio to preserve).
- Shift+move (drag-the-body): no special behavior. Just a normal unconstrained move.
- View mode: only the cropped preview is visible; the underlying `<video>` is hidden behind the canvas.

## Scope

### `src/components/ViewportOverlay.tsx`

Replace the existing axis-lock block (lines 62-65: `if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }`).

- **For `interaction.type === 'drag'`** (move): no Shift handling. Drop the axis-lock entirely. Move is always unconstrained.
- **For `interaction.type === 'resize'`**: when `e.shiftKey` is held, constrain the new rect to the **start rect's aspect ratio** (`startRect.width / startRect.height`).

Algorithm for aspect-preserving resize (corner-driven):

1. Compute `aspect = startRect.width / startRect.height`.
2. Decide which axis drives based on the larger normalized delta:
   - `dxNorm = dxSource / startRect.width` (signed, with corner sign convention applied — see below)
   - `dyNorm = dySource / startRect.height` (same)
   - If `|dxNorm| >= |dyNorm|`: the X delta drives. Recompute the new height from the new width so the aspect is preserved.
   - Else: Y drives. Recompute new width from new height.
3. Apply the corner-specific sign and anchor logic so the rect grows from the dragged corner (NW, NE, SW, SE) using the now-aspect-locked deltas.
4. Clamp to bounds. The existing `clampRect` may break aspect ratio when it shrinks one dim; for Shift+resize, prefer a clamp that scales BOTH dims down by the same factor when one would violate bounds. Implement a small helper: given a candidate rect, if it exceeds video bounds or undershoots the 10% min, scale it uniformly by the most-constrained ratio so the aspect is preserved. (If this results in the rect still being out of position, position-clamp x/y after — moving the rect inside is fine, distorting it isn't.)

Sign convention recap by corner (already in the code, just make sure aspect-locked deltas are applied symmetrically):
- `nw`: dragging up-left grows rect; positive dx and dy → shrink. Apply sign flip when computing scale from dx/dy.
- `ne`: positive dx grows; positive dy shrinks.
- `sw`: positive dx shrinks; positive dy grows.
- `se`: positive dx and dy both grow. (Easiest case.)

The simplest implementation may be: compute a "growth scale" by corner (using whichever axis drives), then derive newW = startW * scale and newH = startH * scale, then place x/y based on the corner's anchor (e.g. SE keeps x/y at startRect.x/y; NW shifts x by startW - newW, y by startH - newH; etc.).

Without Shift, the existing per-axis resize behavior is unchanged.

### `src/components/BoundingBoxTool.tsx`

Replace the existing Shift block (lines 49-54: which currently zeros out one dim).

When `e.shiftKey` and `drawingRef.current` are both truthy, constrain the cursor position so the resulting rect (computed by `getDrawnRect`) has the video's aspect ratio.

Algorithm:
1. `aspect = videoMetadata.width / videoMetadata.height`. Read once via `useAppStore.getState()` inside `handleMouseMove`. If `videoMetadata` is null, fall back to no constraint (treat as if Shift were not held).
2. Compute signed deltas: `dx = clampedX - startX`, `dy = clampedY - startY` (both can be negative).
3. Decide driver:
   - `wantedH = |dx| / aspect` (the height that would match `|dx|` at the target aspect).
   - If `|dy| >= wantedH`: dy drives. Set `cx = startX + sign(dx) * |dy| * aspect`.
   - Else: dx drives. Set `cy = startY + sign(dy) * |dx| / aspect`.
4. Clamp `cx` and `cy` to the container bounds (already clamped before this block in current code; if Shift snapping pushes back out, a final clamp here is fine).

This ensures the drawn rect always matches the video's aspect ratio while Shift is held, regardless of cursor direction.

### `src/components/PreviewCanvas.tsx`

Add a solid background to the canvas element so the underlying `<video>` is not visible in letterbox/pillarbox regions.

```tsx
<canvas
  ref={canvasRef}
  className="absolute inset-0 w-full h-full bg-appbar"
  style={{ zIndex: 15 }}
/>
```

(The `bg-appbar` token is already used by the container — same color, so the visual matches what the container would have shown if the video weren't there.)

This works because the canvas's CSS background is opaque; even where `ctx.clearRect` leaves canvas pixels transparent, the CSS bg covers the underlying `<video>`.

### `src/shortcuts.ts`

Update the `bbox-constrain` entry description from "Axis / square constraint (drag)" to **"Maintain aspect ratio (resize / draw)"**.

### `docs/keyboard-shortcuts.md`

Update the Bbox-section row for `Shift` (held while dragging): change the action from "Constrain drag to axis / square" to "Maintain aspect ratio while resizing or drawing". Update the cheat sheet row similarly.

### Tests

If any tests assert axis-lock behavior on Shift+drag/resize/draw, update them. Add at least:
- One test confirming Shift+resize via SE corner keeps the rect's aspect ratio (e.g. start at 200×100, drag se by (+50, +0); with Shift, expect width and height to grow proportionally).
- One test for BoundingBoxTool: with Shift held during draw, the resulting rect's aspect equals the video's aspect.
- One test confirming Shift+move (drag the body) is now an unconstrained move.

If existing axis-lock tests exist, replace with the new aspect-ratio assertions.

## Non-goals / Later

- Allowing the user to specify a target aspect ratio (e.g. 16:9 vs 9:16). For draw, the video's ratio is the only target.
- Aspect-preserving on `bbox-move` arrow keys, `[`/`]`, etc. Those already preserve aspect because they don't change shape (move) or scale uniformly ([`/`]).
- Hiding the `<video>` element via `display: none` or `visibility: hidden`. The CSS background fix is sufficient.

## Constraints / Caveats

- Don't change the no-Shift behavior of any interaction.
- The clamp helper for aspect-preserving resize must not break aspect when shrinking — uniform-scale-down is correct, axis-by-axis clamping is not.
- Keep the existing 10%-min and 100%-max bounds.
- The `bg-appbar` Tailwind token must already exist (it does; the container uses it).
- The fix in PreviewCanvas should not affect non-view-mode (PreviewCanvas only mounts when `mode === 'view'`).

## Acceptance criteria

- Shift+drag-corner resizes the rect with locked aspect ratio. Without Shift, resize is per-axis as today.
- Shift+drag-body (move) behaves identically to no-Shift drag — no axis lock.
- Shift+drag during initial draw produces a rect with the video's aspect ratio.
- View mode: the cropped frame is visible against a solid (`bg-appbar`) background. The original video frame underneath is not visible anywhere on screen, including letterbox/pillarbox regions.
- `bbox-constrain` row in the help panel reads "Maintain aspect ratio (resize / draw)".
- `docs/keyboard-shortcuts.md` updated to match.
- Tests pass.
