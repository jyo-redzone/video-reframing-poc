# Task 001 — Documentation & Config Consolidation

## Context
This is the first task in a production refactor of a React + TypeScript video recutting POC.
Stack: React 18, TypeScript 5.6, Vite 6, Zustand 5, Tailwind 4, hls.js, Vitest.
No behavior changes in this task. Pure documentation and constant consolidation.

## Objective
1. Create three orientation documents for future Claude sessions.
2. Consolidate all magic numbers into `src/config.ts` and delete `src/constants.ts`.

## Scope

### 1. Create `CLAUDE.md` at the project root

Content must cover:
- **Product**: One paragraph. A browser-based video recutting tool. Users load an HLS video URL, draw a framing rectangle (SourceRect) on the video, then place and record keyframes over time. The Camera Reframing Engine (CRE) interpolates between keyframes (smooth = linear lerp, cut = instant snap). Multiple clips (Tracks) can be created per video. Output is a Track JSON payload for a downstream pipeline.
- **Stack**: React 18 + TypeScript 5.6 + Vite 6 + Zustand 5 + Tailwind CSS 4 + hls.js 1.6 + Vitest 3
- **Commands**: `npm run dev`, `npm test`, `npm run build`
- **Folder map** (target state — write this as the target, not the current):
  ```
  src/
  ├── types/          # Domain types (SourceRect, Keyframe, Track, Segment, …)
  ├── engine/         # Pure domain logic: CRE interpolation (cre.ts)
  ├── store/          # Zustand store split into slices/ + selectors.ts
  ├── hooks/          # usePlayback, useKeyboardShortcuts, useRecordingSampler
  ├── components/
  │   ├── Timeline/   # TimelineBar shell + sub-components + timelineLayout.ts
  │   ├── TrackPanel/ # TrackPanel shell + TrackSelectorRow, SaveDialog, VideoInfoPopover
  │   └── Viewport/   # ViewportOverlay shell + useViewportDrag + BoundingBoxTool
  ├── utils/          # coordinates.ts (video ↔ container coord transforms)
  └── config.ts       # All constants and magic numbers
  ```
- **Domain model summary**: Track → has many Keyframes → CRE derives Segments → resolve(time) = SourceRect
- **Key invariants**: keyframes always sorted by time; last keyframe has `transitionToNext: null`; keyframe dedup uses epsilon = `KEYFRAME_TIME_EPSILON_FRAMES / fps`
- **Conventions**: Zustand StateCreator slices, named selectors in `store/selectors.ts`, sub-components receive computed props (do not subscribe to store directly), pure helpers extracted to `.ts` files alongside components

---

### 2. Create `docs/ARCHITECTURE.md`

Content must cover:
- **Data flow**: User gesture → store action → Zustand state → React re-render. Also: `currentTime` → `resolve(time, keyframes, bounds, fps)` → `sourceRect` → CSS position on screen.
- **Module responsibilities** (one paragraph each): `types/`, `engine/`, `store/`, `hooks/`, `components/`, `utils/`, `config.ts`
- **State model**: table of slice → state fields → key actions
- **Coordinate system**: Two coordinate spaces exist. *Source coords* are pixels in the original video (e.g. 1920×1080). *Container coords* are CSS pixels of the rendered `<video>` element. `getVideoRenderArea()` computes the letterboxed render rect; `sourceToPercent()` and `containerToSource()` convert between them.
- **CRE algorithm**: inputs (`time`, `keyframes[]`, `VideoBounds`, `fps`), outputs (`CREOutput`). Behaviour: hold-first before first KF, hold-last after last KF, lerp for smooth, snap-on-boundary for cut, frame-snapping via `snapToFrame`.
- **Recording pipeline**: state machine (`idle → recording → paused → idle`). `useRecordingSampler` fires at `RECORDING_SAMPLE_HZ` Hz while `recordingState === 'recording' && isPlaying`. Gesture-end writes happen in `ViewportOverlay` when `recordingState === 'recording' && !isPlaying`.

---

### 3. Create `docs/DOMAIN-MODEL.md`

Content must cover:
- **Glossary**: one-line definition for each exported type: `SourceRect`, `Keyframe`, `ClipRange`, `Track`, `Segment`, `VideoMetadata`, `VideoBounds`, `CREOutput`
- **Entity relationships**: `VideoMetadata` ← loaded once. `Track` references a video via `videoId`. `Track` contains `Keyframe[]`. `deriveSegments(keyframes)` produces `Segment[]` from consecutive keyframe pairs.
- **Key invariants** (as a bullet list):
  - `track.keyframes` is always sorted by `time` ascending (enforced by store on every write)
  - The last keyframe in a track always has `transitionToNext: null`; all others have `'smooth' | 'cut'`
  - Keyframe dedup: adding/committing a KF within `KEYFRAME_TIME_EPSILON_FRAMES / fps` seconds of an existing KF updates the existing one in place
  - `ClipRange.inTime <= ClipRange.outTime`; both clamped to `[0, duration]`
- **Recording state machine** (text or ASCII):
  ```
  idle ──startRecording──▶ recording ──pauseRecording──▶ paused
                            ◀──resumeRecording──────────────┘
  recording ──stopRecording──▶ idle
  paused    ──stopRecording──▶ idle
  ```
- **Mode transitions**:
  ```
  edit ◀──setMode──▶ view   (blocked when recordingState !== 'idle')
  ```

---

### 4. Update `src/config.ts` — add all scattered magic numbers

Add the following exports (keep existing ones, merge `SPEED_OPTIONS` from `constants.ts`):

```ts
// Playback speeds (merged from constants.ts)
export const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4, 8, 16] as const;

// Timeline layout (SVG viewBox is 0 0 1000 75)
export const TL_X0 = 40;           // left edge of timeline track area
export const TL_X1 = 960;          // right edge of timeline track area
export const TL_Y = 35;            // vertical center of the timeline axis
export const TIMELINE_ZOOM_MIN = 1;
export const TIMELINE_ZOOM_MAX = 256;
export const TIMELINE_SCROLL_FACTOR = 1 / 300; // wheel delta → time shift ratio
export const TIMELINE_POPOVER_WIDTH = 200;      // transition picker popover width (px)

// Viewport framing box
export const VIEWPORT_MIN_SIZE_RATIO = 0.1;     // min W or H as fraction of video dimension
export const VIEWPORT_WHEEL_ZOOM_IN = 0.9;      // scale factor when scrolling to zoom in
export const VIEWPORT_WHEEL_ZOOM_OUT = 1.1;     // scale factor when scrolling to zoom out
export const VIEWPORT_WHEEL_DEBOUNCE_MS = 250;  // ms after last wheel event to clear wheelActive
```

### 5. Delete `src/constants.ts` and update its import

`src/constants.ts` currently exports only `SPEED_OPTIONS`. After merging into `config.ts`:
- Delete `src/constants.ts`
- Update the one import site in `src/components/PlaybackControls.tsx` (and any other files that import from `'../constants'` or `'./constants'`) to import `SPEED_OPTIONS` from `'../config'` or `'./config'` as appropriate.
- Also check `src/hooks/useKeyboardShortcuts.ts` — it may import `SPEED_OPTIONS` too.

## Non-goals / Later
- Do NOT change any component logic
- Do NOT move constants into components yet (that happens in Tasks 003–004)
- Do NOT create the store slices yet (Task 002)
- Do NOT update TimelineBar.tsx or ViewportOverlay.tsx to use the new config constants yet (that happens in Tasks 003–004 during decomposition)

## Constraints / Caveats
- Keep docs concise — these are reference docs, not tutorials. Aim for ≤ 200 lines per doc.
- Do not use `export default` in `config.ts` — named exports only.
- `SPEED_OPTIONS` uses `as const` — preserve this when moving it.
- Verify no other files import from `constants.ts` before deleting it.

## Acceptance criteria
- `CLAUDE.md` exists at the project root and covers all sections listed above
- `docs/ARCHITECTURE.md` and `docs/DOMAIN-MODEL.md` exist and cover their sections
- `src/constants.ts` is deleted
- `src/config.ts` exports all constants listed above
- `npm test` passes (no broken imports)
- `npm run build` passes (no TypeScript errors)
