# 004 — Second-step instead of frame-step

## Context

The Prev/Next step buttons and the `,` / `.` keyboard shortcuts currently step by **one frame** (using `1 / fps`). Change both to step by **one second** instead. This removes the fps dependency for stepping.

## Objective

- Step buttons in `PlaybackControls.tsx` step ±1 second.
- `,` / `.` keyboard shortcuts step ±1 second.
- Help-panel rows and the doc reflect the new behavior.

## Scope

### `src/components/PlaybackControls.tsx`

- Rename `handlePrevFrame` → `handlePrevSecond` and `handleNextFrame` → `handleNextSecond` (or whatever reads cleanest — name change is optional, just keep it accurate).
- Change step amount from `frameDuration` (`1/fps`) to `1`.
- Drop the `frameDuration` and `frameStepDisabled` derivations — they're no longer needed.
- Drop the `disabled` prop on the two buttons. Inside each handler, no-op when `videoRef.current === null` (or `videoMetadata === null` if you still need duration — note `video.duration` on the DOM element gives you that, same as today).
- Update button `title`s: "Prev frame" → "Prev second", "Next frame" → "Next second".
- Clamping unchanged: `Math.max(0, …)` and `Math.min(video.duration || Infinity, …)`.

### `src/hooks/useKeyboardShortcuts.ts`

- The `,` and `.` branches: replace the `frameDuration = 1 / videoMetadata.fps` computation with `step = 1`.
- The `if (!videoMetadata) return;` guard at the top of those branches can be relaxed — we no longer need fps. Keep a `if (!videoRef.current) return;` guard so we don't operate without a video element. (The `video.duration` clamp comes off the DOM element, not store metadata.)
- All other behavior unchanged: pause if playing, set `video.currentTime`, mirror to store via `setCurrentTime`, `e.preventDefault()`.

### `src/shortcuts.ts`

Update the two affected entries:
- `frame-back` → keep the id (or rename to `second-back`, your call); description "Step 1 second back".
- `frame-forward` → same; description "Step 1 second forward".

### `docs/keyboard-shortcuts.md`

Update the Player table rows for `,` and `.` and the corresponding cheat-sheet rows. Wording: "Step back one second" / "Step forward one second" (or similar, keep style consistent with the existing entries).

### Tests

Update the existing tests that asserted frame-stepping behavior to assert second-stepping. Specifically, in `src/hooks/__tests__/useKeyboardShortcuts.test.tsx`, any test that set up `fps: 30` and expected a step of `1/30` should now expect a step of `1`. If there are component tests for PlaybackControls covering the buttons, update those too. Add (or keep) at least one test that verifies the step works without fps in metadata (now that we don't depend on it — though keeping `videoMetadata` populated in tests is fine; the point is just to confirm correctness).

## Non-goals / Later

- Adding a separate "step by frame" shortcut alongside this. (If desired later, it would need its own keys — `Shift+,/.` is already taken.)
- Configurable step size.
- Changing the step icons.

## Constraints / Caveats

- Clamping behavior must stay correct at video boundaries — pressing `.` near the end clamps to `video.duration`; pressing `,` at `currentTime === 0` is a no-op.
- The store action `setCurrentTime` is still called after seeking the video element — this keeps the timeline UI in sync.
- Don't introduce a new constant for the step size; `1` inline is clearer than `STEP_SECONDS = 1`.

## Acceptance criteria

- Clicking Prev/Next buttons moves currentTime by exactly 1 second (clamped).
- Pressing `,` / `.` does the same.
- Buttons are no longer disabled in the absence of fps metadata; they still do nothing if there's no video loaded at all.
- Help panel and the markdown doc both read "second" instead of "frame" for these two rows.
- Existing tests updated; full suite passes.
