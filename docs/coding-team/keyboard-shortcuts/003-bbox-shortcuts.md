# 003 — Bbox shortcuts

## Context

Help UI is in place (001) and Player + Timeline shortcuts are wired (002). This task lands the final group: live bbox movement and uniform scale via keyboard. It also **removes** the old arrow handler in `useKeyboardShortcuts.ts` that nudged the *selected keyframe's* stored rect — per the "Removed" section of [docs/keyboard-shortcuts.md](../../keyboard-shortcuts.md), arrow keys are now reserved for live bbox movement.

Existing reference points:
- Clamp logic: `clampRect` callback in `src/components/ViewportOverlay.tsx` (lines 38-46) — minimum 10% of video dim per axis, max full video dim, x/y clamped to keep rect in bounds.
- Recording write API: `useAppStore.commitKeyframeAtTime(time, sourceRect)` — used by mouse drag (`ViewportOverlay.handleMouseUp`) and the sampler (`useRecordingSampler`). It has epsilon-based dedup, so writing at the same time overwrites the existing keyframe in place.

## Objective

Wire up these shortcuts (all **edit mode only**, all require `viewportRect !== null`):

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | Move bbox 1px |
| `Shift+←/→/↑/↓` | Move bbox 10px |
| `]` | Grow bbox 1.1× (uniform, around center) |
| `[` | Shrink bbox 1.1× (uniform, around center) |
| `Shift+]` | Grow bbox 1.25× |
| `Shift+[` | Shrink bbox 1/1.25× |

When a recording session is active (`recordingState !== 'idle'`), every successful change additionally writes a keyframe at the current playhead via `commitKeyframeAtTime`.

## Scope

### Remove the existing arrow / delete handlers in `useKeyboardShortcuts.ts`

Per the doc's "Removed" section, the arrow handler (lines ~222-275 in current file — the one that calls `getSelectedKeyframe()` and `updateKeyframe`) goes away entirely. The `Delete`/`Backspace` handler **stays** — it's the keyframe delete shortcut listed in the Timeline section of the doc, and it operates on the selected keyframe.

So: keep the delete branch, remove the arrow branch.

### Add bbox shortcut handlers

All branches go inside the existing edit-mode gate (after the `I`/`O` branches in the file).

**Arrows (`←`/`→`/`↑`/`↓`, with optional Shift):**
- No-op if `viewportRect === null`.
- Step = 10 if `e.shiftKey`, else 1.
- Compute new x/y, clamp to video bounds: `x ∈ [0, videoWidth - width]`, `y ∈ [0, videoHeight - height]`.
- If new rect is identical to old rect (e.g. already at edge), no-op (don't write a keyframe for a non-change).
- `setViewportRect(newRect)`.
- If `recordingState !== 'idle'`: `commitKeyframeAtTime(currentTime, newRect)`.
- `e.preventDefault()`.

**Scale (`[` / `]`, with optional Shift):**
- No-op if `viewportRect === null` or `videoMetadata === null`.
- Factor: `]` → 1.1, `Shift+]` → 1.25, `[` → 1/1.1, `Shift+[` → 1/1.25.
- Apply uniformly (preserve aspect): compute the **effective factor** that keeps both dims within bounds.
  - Growing (factor > 1): `effectiveFactor = min(factor, videoWidth / currentWidth, videoHeight / currentHeight)`.
  - Shrinking (factor < 1): `effectiveFactor = max(factor, (videoWidth * 0.1) / currentWidth, (videoHeight * 0.1) / currentHeight)`.
  - If `effectiveFactor === 1` (already pinned to a bound), no-op.
- `newWidth = currentWidth * effectiveFactor`, `newHeight = currentHeight * effectiveFactor`.
- Recenter around the original rect's center: `newX = currentX + (currentWidth - newWidth) / 2`, `newY = currentY + (currentHeight - newHeight) / 2`.
- Final clamp: `newX ∈ [0, videoWidth - newWidth]`, `newY ∈ [0, videoHeight - newHeight]` (in case the centered position goes off-edge — e.g. if the rect was near a corner).
- `setViewportRect(newRect)`.
- If `recordingState !== 'idle'`: `commitKeyframeAtTime(currentTime, newRect)`.
- `e.preventDefault()`.

**Key matching:**
- Arrows: `e.key === 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'`. Shift is allowed; Ctrl/Meta/Alt skip.
- `]` / `[`: use `e.code === 'BracketRight'` / `'BracketLeft'`. The shifted variants are detected via `e.shiftKey === true` plus the same `e.code`. (US layout keys for `]` and `[` don't change with Shift, but `e.code` is the layout-stable choice for consistency with task 002's pattern.)

### Tests

Update `src/hooks/__tests__/useKeyboardShortcuts.test.tsx`:
- Remove the existing tests for the old arrow-nudges-selected-keyframe behavior.
- Add tests for the new arrow behavior: moves `viewportRect` 1px / 10px (with Shift), clamps at bounds, no-op when `viewportRect` is null, no-op when not in edit mode.
- Add tests for `[` / `]`: scales around center, clamps at 10% / 100%, no-op when at bounds, no-op when `viewportRect` is null, no-op when not in edit mode.
- Add tests for the recording integration: when `recordingState === 'recording'` (and also `'paused'`), every move/scale writes a keyframe via `commitKeyframeAtTime` at the current playhead. Verify the keyframe's `sourceRect` matches the new rect.

### `src/shortcuts.ts`

No changes — entries already exist from task 001.

## Non-goals / Later

- Scaling around a different anchor (e.g. corner-anchored).
- Animating the rect change.
- Per-button tooltips with shortcut hints.
- Different scale factors than 1.1× and 1.25×.

## Constraints / Caveats

- All handlers must respect the existing focus guard (already at the top of the hook).
- All handlers must skip when Ctrl / Meta / Alt are held (Shift is allowed).
- The recording write must run **after** `setViewportRect`, both reading from the same computed `newRect`. Don't read `viewportRect` from store *after* setting it — race-prone with `set` semantics. Use the local `newRect` variable.
- The "no-op if rect didn't change" rule matters during recording — without it, repeated arrow presses at the edge would write redundant keyframes.
- For uniform scaling, the rect's center is the original center (before scaling), not after. Compute it as `currentX + currentWidth / 2`.
- Preserve all existing behavior in the file — `?` toggle, Player + Timeline shortcuts from 002, and the keyframe-delete handler. Only the arrow branch is removed.

## Acceptance criteria

- All 6 bbox shortcut groups fire correctly in edit mode with a viewport rect.
- All bbox shortcuts no-op silently in view mode, when no viewport rect, or inside text inputs.
- Arrow movement preserves rect dimensions and clamps to video bounds.
- `[` / `]` scaling preserves aspect ratio; the rect's center stays fixed (until the centered position would push it off-edge, in which case x/y is clamped).
- During recording or paused recording, every bbox keypress writes (or overwrites) a keyframe at the current playhead.
- The old arrow-nudges-selected-keyframe behavior is gone.
- The `Delete` / `Backspace` keyframe-delete shortcut still works.
- Existing tests for shortcuts from tasks 001 and 002 still pass; new tests cover the new behavior; old tests for the removed arrow behavior are deleted.
