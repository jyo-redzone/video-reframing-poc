# 002 — Player + Timeline shortcuts

## Context

Help UI is in place (task 001). This task wires up the Player and Timeline shortcuts from [docs/keyboard-shortcuts.md](../../keyboard-shortcuts.md). All branches go into `src/hooks/useKeyboardShortcuts.ts` alongside the existing `?` handler. The focus guard at the top of that hook already covers all branches.

Two pieces of local state must move to the Zustand store before the keyboard hook can drive them — see "Required store moves" below.

## Objective

Wire up these shortcuts so they fire correctly with proper mode gating:

| Key | Action | Mode |
|---|---|---|
| `Space` | Play / pause | both |
| `,` | Step 1 frame back | both |
| `.` | Step 1 frame forward | both |
| `Shift+,` | Cycle playback speed down | both |
| `Shift+.` | Cycle playback speed up | both |
| `R` | Record toggle (context-aware) | edit only |
| `Shift+R` | Stop recording | edit only |
| `=` | Timeline zoom in | both |
| `-` | Timeline zoom out | both |
| `0` | Reset zoom to 1× | both |
| `Home` | Seek to clip start | both |
| `End` | Seek to clip end | both |
| `I` | Set in-point at playhead | edit only |
| `O` | Set out-point at playhead | edit only |

## Scope

### Required store moves

Two pieces of UI state currently live as `useState` inside components and need to move to `useAppStore` so the keyboard hook can drive them:

1. **`playbackRate`** (currently in `PlaybackControls.tsx`).
   - Add to store: `playbackRate: number` (initial `1`).
   - Add action: `setPlaybackRate(rate: number): void`. The store action only updates store state — the component setting it is responsible for also pushing to `videoRef.current.playbackRate`. (Keep this rule simple: one place writes the DOM, the store is just the source of truth for the UI.)
   - Refactor `PlaybackControls.tsx` to read/write through the store. The select still updates both store and the live `videoRef.current.playbackRate`.

2. **`zoomLevel`** + **`zoomOffset`** (currently `useState` inside `TimelineBar.tsx`).
   - Add to store: `timelineZoom: number` (initial `1`), `timelineZoomOffset: number` (initial `0`).
   - Add actions:
     - `setTimelineZoom(zoom: number)` — clamps to `[1, 256]`.
     - `setTimelineZoomOffset(offset: number)` — clamping that's currently inline in TimelineBar can stay in TimelineBar (the keyboard handler doesn't need to clamp offset itself).
     - `resetTimelineZoom()` — sets `timelineZoom = 1` and `timelineZoomOffset = 0`.
   - Refactor `TimelineBar.tsx` to read/write through the store instead of `useState`. Behavior must be byte-identical (existing tests must still pass).

### New shortcut handlers in `useKeyboardShortcuts.ts`

Add branches between the existing `?` block and the existing edit-mode arrow/delete block. Suggested ordering (any order is fine as long as cases don't shadow each other):

**Always-on (run before the edit-mode gate):**
- `Space` → toggle play/pause via the existing `videoRef.current` flow. Use `useVideoRef()` inside the hook (the hook is called from `AppContent` which is inside `VideoRefProvider`). Mirror the logic in `PlaybackControls.handlePlayPause` — call `video.play()` / `video.pause()` and update `isPlaying` in the store.
- `,` / `.` → frame step. Mirror `handlePrevFrame` / `handleNextFrame`: read `fps` from `videoMetadata`, compute `frameDuration = 1/fps`, pause if playing, set `video.currentTime` and store `currentTime`. No-op if `videoMetadata` is null.
- `Shift+,` / `Shift+.` → cycle playback speed through `[0.5, 1, 1.5, 2, 4, 8, 16]`. Move this constant to a small shared module (e.g. `src/constants.ts` or alongside `src/config.ts`) so both `PlaybackControls.tsx` and the hook import it. Do not duplicate. Wrap-around at the ends is **not** required (the doc says "cycle ... down" / "up" through the list — match that with clamp-at-ends behavior, identical to selecting the first / last item in the existing dropdown).
- `=` / `-` → zoom. `=` doubles `timelineZoom` clamped to 256, `-` halves clamped to 1. (Match whatever step the existing `+`/`-` zoom buttons in TimelineBar already use; if the existing buttons use a different step like `+1`/`-1`, use the same step here for consistency.) Verify what the existing buttons do and match exactly.
- `0` → call `resetTimelineZoom()`.
- `Home` → seek `video.currentTime` to the active track's `range.inTime`; also update `currentTime` in the store. If no active track, no-op.
- `End` → same but to `range.outTime`.

**Edit-mode only (run inside the existing edit-mode gate):**
- `R` (no shift) → context-aware record toggle:
  - `recordingState === 'idle'` → call `startRecording()`. The store's `startRecording` already no-ops if `viewportRect` is null, so the disabled-when-no-bbox rule is preserved automatically. Also no-op here if `activeTrackId === ''` (matching the existing button's disabled rule).
  - `recordingState === 'recording'` → call `pauseRecording()`.
  - `recordingState === 'paused'` → call `resumeRecording()`.
- `Shift+R` → call `stopRecording()` from any non-idle state. The store's `stopRecording` already guards.
- `I` → `setTrackRange(currentTime, activeTrack.range.outTime)`. Read currentTime from store, range from the active track. The store action already clamps and ensures `inTime <= outTime`.
- `O` → `setTrackRange(activeTrack.range.inTime, currentTime)`.

### Existing branches

Leave the existing arrow / delete handlers in `useKeyboardShortcuts.ts` untouched. Task 003 will replace those.

### `src/shortcuts.ts`

No changes — the metadata is already complete from task 001.

## Non-goals / Later

- Bbox shortcuts (arrows, `[`/`]`) — task 003.
- Removing the existing arrow / delete handlers — task 003.
- Per-button tooltips with shortcut hints.
- Wraparound on speed cycling.
- Configurable zoom step.

## Constraints / Caveats

- All shortcuts must respect the existing focus guard (already at the top of the hook). Don't duplicate it per branch.
- All shortcuts must skip when Ctrl / Meta / Alt are held (Shift is allowed). The existing `?` branch checks Ctrl/Meta/Alt; the existing arrow/delete branches do too. Apply the same check on every new branch.
- `e.preventDefault()` on every successfully-handled keypress — matters especially for `Space` (would scroll the page) and `Home`/`End` (would scroll the page).
- The `?` shortcut is `e.key === '?'` (Shift+/). The new `Shift+,` / `Shift+.` / `Shift+R` shortcuts: detect via `e.shiftKey === true && e.key === ','` etc. Do not match on `e.key === '<'` (which is the shifted character on US layouts) — `e.key` for `Shift+,` is layout-dependent. Safer pattern: when shift is held, prefer `e.code` (`'Comma'`, `'Period'`, `'KeyR'`). Use this for any shifted shortcut. (For `?`, `e.key === '?'` is fine because that's the document-level convention — but do not break it if you generalize. If in doubt, prefer `e.code` for the shifted variants.)
- For the speed cycle: when current rate is not in `SPEED_OPTIONS` (shouldn't happen, but defensive), snap to the nearest option before cycling.
- Frame step keys (`,` / `.`) must NOT match `Shift+,` / `Shift+.` — i.e. the un-shifted branch must check `!e.shiftKey` (or be ordered after the shift branch).
- The hook's existing `useEffect` runs once on mount with `[]` deps. The new code must follow the same pattern — read `useAppStore.getState()` inside the handler, do not subscribe.

## Acceptance criteria

- All 14 shortcuts above fire correctly in their respective modes.
- All shortcuts no-op silently inside text inputs (focus guard).
- `R` cycles idle → recording → paused → recording, just like the button does.
- `Shift+R` works from both recording and paused states.
- `=` / `-` / `0` produce identical results to clicking the corresponding zoom buttons. (Verify zoom state moved to store didn't change visible behavior.)
- After `Space`, the page does not scroll. After `Home`/`End`, the page does not scroll.
- Existing tests still pass; new tests cover the new shortcuts and the store moves.
- Visual regression check: PlaybackControls and TimelineBar look and behave identically to before the store moves.
