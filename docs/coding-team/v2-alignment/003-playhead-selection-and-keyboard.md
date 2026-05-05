# Task 003 — Playhead-based keyframe selection + keyboard interactions

## Context

After Task 002 the store no longer carries explicit `selectedKeyframeId`. v2's mental model is "the framing box you see at this time *is* the keyframe at this time — edit it directly." A keyframe is "selected" when the playhead is parked on it (within tolerance); when the playhead is between keyframes nothing is selected and keybinds become no-ops.

The framing-box visuals in edit mode are driven by `viewportRect` (see [src/components/ViewportOverlay.tsx](../../../src/components/ViewportOverlay.tsx)). Diamond click already mirrors `kf.sourceRect → viewportRect`, so keyboard nudges must update **both** the keyframe and `viewportRect` to keep the on-screen box in sync.

## Objective

1. Add a derived store selector that returns the keyframe at the playhead (or null).
2. Add document-level keyboard handlers that, in edit mode, nudge or delete the selected keyframe.

## Scope

- [src/store/useAppStore.ts](../../../src/store/useAppStore.ts) — add a getter action:

  ```ts
  getSelectedKeyframe: () => Keyframe | null;
  ```

  Selection rule: pick the active track's keyframe whose `time` is closest to `currentTime`, provided `|kf.time - currentTime| ≤ epsilon`. Otherwise return null.

  Epsilon = `0.5 / videoMetadata.fps` when metadata is loaded; fall back to `0.02` (≈ half a 30 fps frame) when null.

- **New file** [src/hooks/useKeyboardShortcuts.ts](../../../src/hooks/useKeyboardShortcuts.ts) — encapsulate the document-level listener. Use `useEffect` to attach `keydown` to `document`, return nothing. Inside the handler:
  - If `mode !== 'edit'`, return.
  - If `document.activeElement` is an `INPUT`, `TEXTAREA`, `SELECT`, or `[contenteditable]`, return.
  - On `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`:
    - Look up the selected keyframe via `useAppStore.getState().getSelectedKeyframe()`. If null, return.
    - Step = 1 source pixel; with `e.shiftKey`, step = 10 source pixels.
    - Compute new `sourceRect.x/y` (width/height unchanged). Clamp to `[0, videoWidth - width]` × `[0, videoHeight - height]`.
    - Call `updateKeyframe(kf.id, { sourceRect: newRect })` and `setViewportRect(newRect)`.
    - `e.preventDefault()` to keep the page from scrolling.
  - On `Delete` (also accept `Backspace` — Mac keyboards lack a Delete key):
    - Look up the selected keyframe; if null, return.
    - Call `deleteKeyframe(kf.id)`. Do **not** clear `viewportRect` — let the next CRE-resolved frame paint take over.
    - `e.preventDefault()`.

- [src/App.tsx](../../../src/App.tsx) — call `useKeyboardShortcuts()` inside `AppContent` alongside `usePlayback()`.

- [src/store/__tests__/useAppStore.test.ts](../../../src/store/__tests__/useAppStore.test.ts) — add coverage for `getSelectedKeyframe`:
  - Returns null when no keyframes.
  - Returns null when playhead is between keyframes.
  - Returns the keyframe when playhead matches `time` exactly.
  - Returns the keyframe within epsilon (use a known fps).
  - Picks the closer of two candidates if both fall within epsilon.
  - Falls back to the 0.02 epsilon when `videoMetadata` is null.

## Non-goals / Later

- No timeline range band / drag-to-set / picker — Task 005.
- No Shift+drag axis-lock — Task 004.
- Do **not** wire arrow keys to seek the playhead, scrub frames, or move the viewport when no keyframe is selected. Between-keyframes is a deliberate no-op.
- Do **not** add a "selected keyframe" highlight on the timeline diamond. The visual cue is the framing box itself.
- Do **not** introduce a hook for mode switching, undo, or any other shortcut.

## Constraints / Caveats

- The keyboard hook must read fresh state per keystroke (use `useAppStore.getState()` inside the handler, not subscribed values closed over by the effect). This avoids stale-closure bugs.
- After Delete the playhead stays put. If the user immediately presses an arrow key, `getSelectedKeyframe()` should return null (the keyframe is gone) and the handler must no-op — exercise this path in a test if cheap.
- Don't catch arrow keys when modifiers other than Shift are held (Ctrl/Meta/Alt) — those are reserved for future shortcuts and should fall through to default browser behavior.
- The fallback epsilon is 0.02 s, not 0 — 0 would only match floating-point-equal times and silently break selection during the brief window between metadata load and first store update.
