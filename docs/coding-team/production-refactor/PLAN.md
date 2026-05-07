# Production Refactor Plan

Refactor the video recutting POC into a production-friendly codebase. No UI or behavior changes. No new libraries.

## Goals
- Components ≤ ~150 lines, single responsibility
- Store split into domain-aligned Zustand slices
- Named selectors eliminate inline store-query duplication
- All magic numbers in one place
- Three orientation docs for future Claude sessions

## Non-goals (explicit)
- No UI redesign or visual changes
- No new libraries
- No behavior changes
- No changes to the existing public store API (same selectors, same action names)
- No splitting into multiple Zustand stores (one store, multiple slices)
- No fixing `window.alert` / `window.confirm` calls (tech debt, future work)

---

## Task 001 — Documentation & Config Consolidation

**What changes**: Zero behavior change. Establishes shared vocabulary for all subsequent tasks.

### Docs to create
- `CLAUDE.md` (project root) — orientation for future Claude sessions:
  product summary, stack, commands (`npm run dev`, `npm test`, `npm run build`),
  folder map (target architecture), domain model summary, conventions.

- `docs/ARCHITECTURE.md` — technical reference:
  data flow (user → video → keyframes → CRE → output),
  module responsibilities (store, engine, hooks, components, utils),
  state model (which slice owns what), coordinate system,
  CRE algorithm, recording pipeline lifecycle.

- `docs/DOMAIN-MODEL.md` — domain glossary:
  each type with one-line definition, entity relationships,
  key invariants (sorted keyframes, last KF has `transitionToNext: null`, epsilon dedup),
  recording and mode state machine diagrams.

### Config consolidation
- Merge `constants.ts` into `config.ts` (delete `constants.ts`)
- Move these currently-scattered magic numbers into `config.ts`:
  - `TL_X0 = 40`, `TL_X1 = 960`, `TL_Y = 35` (from TimelineBar.tsx)
  - `TIMELINE_ZOOM_MIN = 1`, `TIMELINE_ZOOM_MAX = 256` (from TimelineBar.tsx + store)
  - `TIMELINE_SCROLL_FACTOR = 1 / 300` (from TimelineBar.tsx wheel handler)
  - `TIMELINE_POPOVER_WIDTH = 200` (from TimelineBar.tsx)
  - `VIEWPORT_MIN_SIZE_RATIO = 0.1` (from ViewportOverlay.tsx)
  - `VIEWPORT_WHEEL_ZOOM_IN = 0.9`, `VIEWPORT_WHEEL_ZOOM_OUT = 1.1` (from ViewportOverlay.tsx)
  - `VIEWPORT_WHEEL_DEBOUNCE_MS = 250` (from ViewportOverlay.tsx)
  - `SPEED_OPTIONS` (from constants.ts, now merged here)

---

## Task 002 — Store Slicing + Selectors

**What changes**: Split `useAppStore.ts` (442L) into Zustand `StateCreator` slices.
Extract named selectors. Public API is identical — all existing tests must stay green.

### Slices to create under `src/store/slices/`
Each file exports a `StateCreator` function for its slice type.

| File | State | Actions |
|------|-------|---------|
| `videoSlice.ts` | `videoUrl`, `videoMetadata` | `setVideoUrl`, `setVideoMetadata` |
| `trackSlice.ts` | `tracks[]`, `activeTrackId` | All track CRUD + all keyframe ops + `setTrackRange`, `setTransition` |
| `playbackSlice.ts` | `currentTime`, `isPlaying`, `playbackRate` | `setCurrentTime`, `setIsPlaying`, `setPlaybackRate` |
| `viewportSlice.ts` | `viewportRect`, `mode` | `setViewportRect`, `setMode` |
| `recordingSlice.ts` | `recordingState` | `startRecording`, `pauseRecording`, `resumeRecording`, `stopRecording` |
| `timelineSlice.ts` | `timelineZoom`, `timelineZoomOffset`, `timelineFollowPaused` | `setTimelineZoom`, `setTimelineZoomOffset`, `resetTimelineZoom`, `setTimelineFollowPaused` |
| `uiSlice.ts` | `helpPanelOpen` | `toggleHelpPanel`, `setHelpPanelOpen` |

**Cross-slice deps note**: Several actions read state from other slices via `get()`.
In Zustand's slice pattern, `get()` returns the full combined store — no special handling needed.
Affected actions: `startRecording` reads `viewportRect` + `currentTime` then calls `commitKeyframeAtTime`;
`setActiveTrackId` and `setMode` guard against `recordingState !== 'idle'`.
Type all slices against the full combined store type.

### Selectors to create in `src/store/selectors.ts`
These eliminate the repeated inline `tracks.find(t => t.id === activeTrackId)` pattern
that would otherwise be duplicated across all new sub-components.

```ts
export const selectActiveTrack    = (s: AppStore): Track | null
export const selectActiveKeyframes= (s: AppStore): Keyframe[]   // stable EMPTY_KEYFRAMES ref if none
export const selectActiveClipRange= (s: AppStore): ClipRange    // stable EMPTY_RANGE ref if none
export const selectIsTrackDirty   = (s: AppStore): boolean
```

### Compose in `src/store/useAppStore.ts`
Wire all slices into the single exported `useAppStore`. File should be ≤ 30 lines after slicing.

---

## Task 003 — Timeline Decomposition

**What changes**: Break `TimelineBar.tsx` (646L) into `src/components/Timeline/`.
Add `index.ts` barrel. No behavior change.

### Files to create
```
src/components/Timeline/
├── index.ts                  ← barrel export
├── TimelineBar.tsx           ← shell (stays); target ≤ 150L
├── timelineLayout.ts         ← pure TS, no React; fully unit-testable
├── TimelineAxis.tsx          ← SVG <g>: axis line, tick marks, labels, hover tooltip
├── TimelineRange.tsx         ← SVG <g>: clip range band + drag handles
├── TimelineSegments.tsx      ← SVG <g>: segment bars
├── TransitionPicker.tsx      ← HTML div overlay: popover above the bar
├── TimelineKeyframes.tsx     ← SVG <g>: keyframe dots
└── TimelineScrollbar.tsx     ← HTML div: zoom scrollbar below the SVG
```

### `timelineLayout.ts` — pure helpers (no React, no store)
```ts
export const TL_X0, TL_X1, TL_Y           // moved from config.ts re-export or inline
export function xFor(time, visibleStart, visibleDuration): number
export function timeFromClientX(clientX, svg, visibleStart, visibleDuration, duration): number
export function formatTickLabel(seconds): string
export function getTickInterval(visibleDuration, targetTicks?): number
```

### Shell `TimelineBar.tsx` owns
- All drag state (`DragState` discriminated union)
- Picker state
- Window-level mousemove/mouseup listeners (active only during drag)
- Wheel event listener for panning
- Auto-follow effect
- Zoom controls
- The `<svg>` element itself (sub-components are SVG `<g>` elements rendered inside it)
- Uses selectors from `store/selectors.ts`

### Sub-component contract
Each SVG sub-component receives computed values as props (pixel positions, filtered data).
They do NOT subscribe to the store directly.
`TransitionPicker` and `TimelineScrollbar` are HTML elements (not SVG), positioned outside the `<svg>`.

---

## Task 004 — TrackPanel & ViewportOverlay Decomposition

**What changes**: Break two large components into sub-directories. No behavior change.

### TrackPanel: `src/components/TrackPanel/`
```
src/components/TrackPanel/
├── index.ts
├── TrackPanel.tsx          ← shell; subscribes to store; target ≤ 100L
├── TrackSelectorRow.tsx    ← <select> dropdown + rename inline input (its own state)
├── SaveDialog.tsx          ← full-screen modal with JSON preview + copy button
└── VideoInfoPopover.tsx    ← info button + portal-positioned popover
```

**TrackPanel shell** owns mode toggle, "Create clip" button, "Save clip" / "Export" buttons,
and passes data + callbacks down. It does NOT own rename state or dialog state.

**TrackSelectorRow** owns: `isRenaming`, `renameValue`, `renameError`, `renameInputRef` —
all currently in TrackPanel. Receives `tracks`, `activeTrackId`, `onSelect`, `onRename`, `onDelete` as props.

**SaveDialog** owns: `copyState`. Receives `track`, `onClose` as props.

**VideoInfoPopover** owns: `infoPos`, `infoPopoverRef`, position effects. Receives `videoMetadata` as prop.

### ViewportOverlay: `src/components/Viewport/`
```
src/components/Viewport/
├── index.ts
├── ViewportOverlay.tsx     ← shell; target ≤ 100L
├── useViewportDrag.ts      ← hook
└── BoundingBoxTool.tsx     ← moved from components/ (no logic change)
```

**`useViewportDrag(containerRef, videoMetadata, keyframes, currentTime)`** owns:
- `interaction` state + `wheelActive` + `wheelTimerRef`
- `clampRect` and `clampRectAspect` callbacks
- `handleMouseMove`, `handleMouseUp` (window listeners)
- `handleWheel` (native listener on the viewport div)
- `displayedRect` computation (CRE-follow vs. interaction override)
- `handleDragStart`, `handleResizeStart` (returned for the shell to attach)

Returns: `{ displayedRect, handleDragStart, handleResizeStart, viewportDivRef }`.

**ViewportOverlay shell** owns only: store subscriptions, CSS positioning math, JSX (the div + corner handles).

---

## Task 005 — Keyboard Shortcuts Refactor

**What changes**: Replace the 359-line if-chain in `useKeyboardShortcuts.ts` with a
shortcut registry. No change to which keys do what.

### Pattern
```ts
type ShortcutHandler = {
  handler: (e: KeyboardEvent) => void;
  condition?: () => boolean;   // if present and returns false, skip
};
type ShortcutRegistry = Record<string, ShortcutHandler>;
```

### Structure
Split into four named registries composed in the main hook:
- `globalShortcuts` — always active (Space, `,`, `.`, `Shift+,`, `Shift+.`, `=`, `-`, `0`, `Home`, `End`, `?`, `M`, `Delete/Backspace`)
- `editModeShortcuts` — active only when `mode === 'edit'` (arrow keys for move, `[`/`]` for resize)
- `recordingShortcuts` — active when `recordingState !== 'idle'` (`Shift+R` to stop)
- `idleShortcuts` — active when `recordingState === 'idle'` (`R` to record, `I`/`O` for in/out)

### Dispatch
One `handleKeyDown` function iterates the applicable registries in order,
finds the matching key string, checks `condition()`, and calls `handler()`.

### Testability
Each registry is exported as a pure factory function taking store actions as arguments.
Individual handlers become independently testable without mounting the hook.
