# POC Plan: Video Recutting — Virtual Camera Authoring & Preview

## 1. POC Objective

Demonstrate that a browser-based virtual camera authoring workflow — where users draw bounding boxes, perform PTZ gestures, and inspect keyframes on a timeline — produces correct, visually convincing reframed video output via a TypeScript Camera Resolution Engine. Success means a stakeholder can watch someone author 3–4 keyframes on a sports video, switch to Preview mode, and see a smooth reframed playback that matches the authored intent exactly.

## 2. Scope Definition

### In Scope
- **Video playback**: Local MP4 loaded via `<video>` element, with standard play/pause/seek controls
- **Canvas viewport overlay**: Draggable and resizable rectangle rendered over the video in Edit mode, representing the virtual camera's `sourceRect`
- **Bounding box creation**: User draws a rectangle on the video to create a keyframe at the current time
- **PTZ gestures**: Drag-to-pan and scroll-to-zoom on the viewport overlay, creating/updating keyframes
- **Camera Resolution Engine (CRE)**: TypeScript implementation supporting linear interpolation (smooth) and cut transitions
- **Timeline bar**: SVG-based timeline showing keyframe diamonds, segment bars with transition labels, and a scrubable playhead
- **Keyframe inspection dialog**: Click a keyframe to view/edit time, x, y, w, h values
- **Segment inspection dialog**: Click a segment to view/change transition type (cut/smooth) and see derived intent descriptors
- **Mode switching**: Edit mode (author keyframes), Source view (original video), Preview view (reframed output)
- **Preview rendering**: Canvas-based cropped view that reads the source video frame via `drawImage()` with the CRE-resolved `sourceRect`
- **Manual keyframe creation**: "Add Manual KF" button captures current time + viewport as a keyframe
- **Single track**: One functional track with a track selector dropdown (cosmetic additional options)

### Out of Scope
- **Timeline API Service** (all state held in browser memory, no persistence)
- **Export Orchestrator + Worker** (Export button shows a "Export not available in POC" toast)
- **WASM / C# CRE** (TypeScript-only CRE; validates the math, not the delivery mechanism)
- **HLS streaming** (local `<video>` with an MP4 file)
- **Multi-track editing** (track selector is present but only one track is functional)
- **Natural smooth / Catmull-Rom splines** (linear interpolation only; noted as assumption)
- **Auto-keyframe capture** (gestures do not auto-create keyframes; user must click "Add Manual KF" or draw a bounding box)
- **Export ranges** (UI visible with hardcoded sample ranges; add/edit is non-functional)
- **Jobs panel** (button visible, shows static "No jobs" placeholder)
- **Server persistence / auto-save** (state resets on page refresh)
- **Authentication / authorization** (none)
- **Mobile / responsive layout** (desktop only, min 1280px viewport)
- **Video metadata API** (video dimensions read from the `<video>` element directly)

## 3. User Flows to Validate

### Flow 1: Author Camera Intent via Bounding Box

**Goal**: User reframes a moment in the video by drawing a rectangle around a region of interest.

**Entry point**: App loads with a sample video in Edit mode.

**Steps**:
1. User sees the video player with the full source frame visible and the timeline below
2. User scrubs or plays the video to the desired moment (e.g., a player receiving the ball)
3. User clicks and drags on the video canvas to draw a bounding box around the region of interest
4. A keyframe is created at the current time with the drawn rectangle as `sourceRect`
5. A diamond appears on the timeline at that time
6. The viewport overlay snaps to show the drawn rectangle with resize handles
7. User repeats at 2–3 more moments, creating additional keyframes
8. Segments automatically appear between consecutive keyframes (defaulting to smooth/linear)

**Success indicator**: After creating 3–4 keyframes, the timeline shows diamonds connected by labeled segments, and each keyframe's viewport overlay matches what the user drew.

### Flow 2: Preview Reframed Output

**Goal**: User sees what the final reframed video would look like, driven by the CRE.

**Entry point**: User has authored at least 2 keyframes in Flow 1.

**Steps**:
1. User switches from Edit mode to View mode, then selects "Preview" from the view dropdown
2. The canvas switches from showing the full source frame + overlay to showing only the cropped region
3. User presses Play
4. The preview plays back the video, with the visible region smoothly panning/zooming between keyframes according to the CRE's linear interpolation
5. At a cut transition, the view snaps instantly to the next keyframe's rectangle
6. The timeline playhead moves in sync; keyframe diamonds and segment bars remain visible for reference
7. User scrubs the timeline to jump to a specific moment; the preview updates instantly

**Success indicator**: The preview shows a smooth, continuous reframed view that visibly pans and zooms between authored keyframes. A cut transition produces an instant snap. Scrubbing produces frame-accurate results.

### Flow 3: Inspect and Edit Timeline

**Goal**: User fine-tunes the camera intent by inspecting and editing keyframes and segment transitions.

**Entry point**: User has authored keyframes and wants to adjust them.

**Steps**:
1. User clicks a keyframe diamond on the timeline
2. The keyframe dialog opens showing time, x, y, w, h values
3. User edits the x value to shift the viewport slightly right, then saves
4. The viewport overlay updates immediately; preview (if active) reflects the change
5. User clicks a segment bar between two keyframes
6. The segment dialog opens showing transition type (smooth) and derived intent (e.g., "Pan right + Zoom in 1.5x")
7. User changes the transition from smooth to cut, then saves
8. The segment label on the timeline updates to "cut"
9. User plays the preview and confirms the transition is now an instant snap

**Success indicator**: Edits to keyframe positions and segment transitions are immediately reflected in both the timeline visualization and the preview playback.

## 4. Screen / UI Breakdown

### Top Bar
- **Purpose**: App-level navigation and video identification
- **Key elements**: Video name label, Info button (opens metadata popover), Jobs button (opens placeholder)
- **State variations**: Static — no state changes
- **Navigation**: Always visible; Info/Jobs open overlay popovers

### Player Panel (Section B)
- **Purpose**: Video playback, viewport overlay authoring, and preview rendering
- **Key elements**:
  - `<video>` element for source playback
  - `<canvas>` overlay for viewport rectangle (Edit mode) or cropped preview (Preview mode)
  - Playback controls: previous frame, play/pause, next frame
  - Timecode display (mm:ss.fff)
- **State variations**:
  - **Edit + Source**: Full source video visible, viewport rectangle overlay is interactive (draggable, resizable)
  - **View + Source**: Full source video visible, viewport rectangle overlay is read-only (shows CRE-resolved position at current time)
  - **View + Preview**: Canvas shows only the cropped region from the CRE-resolved `sourceRect`
- **Navigation**: Mode and view controlled by right panel dropdowns

### Track & Settings Panel (Section C)
- **Purpose**: Track selection, mode/view switching, export ranges, keyframe controls
- **Key elements**:
  - Track selector dropdown
  - Mode dropdown (View / Edit)
  - View dropdown (Source / Preview) — visible only when Mode = View
  - Export button (stubbed)
  - Export ranges list (static display)
  - Output resolution dropdown (cosmetic)
  - Auto-keyframe toggle with info tooltip
  - "Add Manual KF" button
- **State variations**:
  - **Edit mode selected**: View dropdown hidden, bounding box and PTZ gestures enabled on player
  - **View mode selected**: View dropdown visible, player interactions disabled
- **Navigation**: Controls affect the Player Panel behavior

### Timeline Bar (Section D)
- **Purpose**: Temporal visualization of keyframes, segments, and playhead
- **Key elements**:
  - SVG timeline with time axis labels
  - Keyframe diamonds (clickable → opens keyframe dialog)
  - Segment bars between keyframes (clickable → opens segment dialog), colored by transition type
  - Segment labels ("smooth" / "cut")
  - Playhead line (draggable for scrubbing)
- **State variations**:
  - **No keyframes**: Empty timeline with only the time axis
  - **With keyframes**: Diamonds and segments rendered
  - **Playing**: Playhead moves automatically
- **Navigation**: Click keyframe → keyframe dialog; click segment → segment dialog; click/drag timeline → scrub

### Keyframe Dialog (Modal)
- **Purpose**: Inspect and edit a single keyframe's properties
- **Key elements**: Time input, x/y/w/h inputs, Save and Cancel buttons
- **State variations**: Open (populated with selected keyframe data) / Closed
- **Navigation**: Opened from timeline keyframe click; closes on Save or Cancel

### Segment Dialog (Modal)
- **Purpose**: Inspect and edit a segment's transition type; view derived intent
- **Key elements**: Transition type dropdown (cut/smooth), derived operations textarea (read-only), Save and Cancel buttons
- **State variations**: Open (populated with selected segment data) / Closed
- **Navigation**: Opened from timeline segment click; closes on Save or Cancel

## 5. Component Hierarchy

```
App
├── TopBar
│   ├── VideoLabel
│   ├── InfoButton → InfoPopover
│   └── JobsButton → JobsPlaceholder
├── MainLayout (grid: 8col + 4col)
│   ├── PlayerPanel
│   │   ├── VideoLayer (<video> element)
│   │   ├── CanvasOverlay
│   │   │   ├── ViewportRect (Edit mode: draggable/resizable)
│   │   │   ├── BoundingBoxDrawTool (Edit mode: click-drag to create)
│   │   │   └── PreviewRenderer (Preview mode: cropped drawImage)
│   │   └── PlaybackControls
│   │       ├── PrevFrameButton
│   │       ├── PlayPauseButton
│   │       ├── NextFrameButton
│   │       └── TimecodeDisplay
│   └── TrackPanel
│       ├── TrackSelector
│       ├── ModeSelector
│       ├── ViewSelector
│       ├── ExportButton (stubbed)
│       ├── ExportRangesList (static)
│       ├── OutputResDropdown (cosmetic)
│       ├── AutoKeyframeToggle
│       └── AddManualKFButton
├── TimelineBar
│   ├── TimeAxis (SVG: ticks + labels)
│   ├── SegmentBars (SVG: rect per segment, colored by transition type)
│   ├── KeyframeDiamonds (SVG: polygon per keyframe)
│   └── Playhead (SVG: draggable line)
├── KeyframeDialog (modal)
│   ├── KeyframeForm (t, x, y, w, h inputs)
│   └── DialogActions (Save, Cancel)
└── SegmentDialog (modal)
    ├── TransitionTypeSelect
    ├── DerivedOpsDisplay (read-only)
    └── DialogActions (Save, Cancel)
```

## 6. Mock Data Contracts

### Video Metadata
Purpose: Describes the source video. In the POC, derived from the `<video>` element's intrinsic properties.

```json
{
  "id": "vid_match_2025_11_21",
  "name": "Match_2025_11_21_4K",
  "width": 3840,
  "height": 2160,
  "fps": 25,
  "duration": 5400.0,
  "url": "/assets/sample-match.mp4"
}
```
Notes: `width`, `height`, `duration` are read from `videoElement.videoWidth`, `.videoHeight`, `.duration`. `fps` is hardcoded to 25 for the POC (no reliable browser API for this).

### Keyframe
Purpose: A saved virtual camera state at a specific time. This is the core persisted entity.

```json
{
  "id": "kf_001",
  "trackId": "track_default",
  "time": 12.5,
  "sourceRect": {
    "x": 960,
    "y": 540,
    "width": 1920,
    "height": 1080
  },
  "transitionToNext": "smooth"
}
```
Notes: `sourceRect` values are in source pixel coordinates. `transitionToNext` is either `"smooth"` (linear interpolation) or `"cut"` (instant snap at next keyframe time). The last keyframe in a track has `transitionToNext: null`.

### Track
Purpose: An independent timeline of keyframes over the same source video.

```json
{
  "id": "track_default",
  "videoId": "vid_match_2025_11_21",
  "name": "Ball follow",
  "keyframes": ["kf_001", "kf_002", "kf_003", "kf_004"],
  "createdAt": "2025-11-22T10:30:00Z"
}
```
Notes: `keyframes` is an ordered array of keyframe IDs sorted by time. The POC uses a single track; the data model supports multiple for forward compatibility.

### Segment (Derived)
Purpose: Represents the interval between two consecutive keyframes. Not persisted — derived at runtime from adjacent keyframes.

```json
{
  "startKeyframeId": "kf_001",
  "endKeyframeId": "kf_002",
  "startTime": 12.5,
  "endTime": 18.0,
  "transition": "smooth",
  "derivedIntent": "Pan right + Zoom in 1.5x"
}
```
Notes: `derivedIntent` is computed from the delta between start and end keyframe `sourceRect` values. It is a UX hint only — not authoritative. Derived using simple heuristics (e.g., if `x` increases → "Pan right", if `width` decreases → "Zoom in", ratio = old width / new width).

### CRE Output (Per-Frame)
Purpose: The resolved camera rectangle at a specific frame time. This is what the preview renderer and (future) export worker consume.

```json
{
  "frameTime": 15.24,
  "sourceRect": {
    "x": 1200,
    "y": 580,
    "width": 1800,
    "height": 1012
  }
}
```
Notes: Computed by the CRE from surrounding keyframes + transition type. All values are in source pixels, clamped to source bounds.

### Export Range (Static Display)
Purpose: A time range within a track to be exported. Non-functional in POC.

```json
{
  "id": "range_01",
  "trackId": "track_default",
  "inTime": 10.0,
  "outTime": 20.0,
  "outputResolution": { "width": 1920, "height": 1080 }
}
```

## 7. Key Interactions & Behaviors

### Bounding Box Drawing (Edit Mode)
- **Trigger**: User clicks and drags on the video canvas (not on an existing viewport rect)
- **Behavior**:
  1. `mousedown` → record start point, begin drawing a dashed rectangle
  2. `mousemove` → update rectangle dimensions live
  3. `mouseup` → finalize rectangle, convert canvas coordinates to source pixel coordinates, create a new keyframe at current `time` with this `sourceRect`, open keyframe dialog for confirmation
- **Coordinate conversion**: `sourceX = (canvasX / canvasWidth) * videoWidth`, same for Y/W/H

### Viewport Drag-to-Pan (Edit Mode)
- **Trigger**: User clicks inside the existing viewport rectangle and drags
- **Behavior**: `[drag] → viewport position updates → (on release) keyframe sourceRect.x/y updated`
- The viewport stays within source bounds (clamped)

### Viewport Scroll-to-Zoom (Edit Mode)
- **Trigger**: Mouse wheel while hovering over the viewport rectangle
- **Behavior**: `[scroll up] → viewport shrinks (zoom in) → [scroll down] → viewport grows (zoom out)`
- Zoom is centered on the mouse cursor position within the viewport
- Minimum viewport size: 10% of source dimensions. Maximum: 100% (full source)
- `[scroll end] → keyframe sourceRect.width/height updated`

### Mode & View Switching
- `[select Edit mode] → View dropdown hidden → canvas shows source + interactive viewport overlay`
- `[select View mode] → View dropdown visible`
  - `[select Source view] → canvas shows source video + read-only viewport overlay (CRE-driven)`
  - `[select Preview view] → canvas shows cropped/reframed output only (CRE-driven)`

### Preview Rendering
- **Technique**: On each `requestAnimationFrame`, call `CRE.resolve(currentTime)` to get `sourceRect`, then use `canvas.drawImage(video, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight)` to render the cropped region
- **Simulated async**: No loading states needed — the `<video>` element handles buffering natively

### Timeline Scrubbing
- `[click on timeline SVG] → playhead jumps to clicked time → video seeks to that time → viewport/preview updates`
- `[drag playhead] → continuous scrub → video and viewport update in real-time`

### Keyframe Dialog Save
- `[edit values + click Save] → keyframe updated in state → timeline re-renders → viewport overlay updates → if in preview mode, next frame reflects change`

### Segment Dialog Save
- `[change transition type + click Save] → segment transition updated → timeline segment label/color updates → preview playback uses new transition type`

### Derived Intent Computation
- On segment dialog open, compute from the two adjacent keyframes:
  - **Pan**: if `|dx| > threshold` → "Pan left/right"
  - **Tilt**: if `|dy| > threshold` → "Tilt up/down"
  - **Zoom**: if `width` ratio ≠ 1 → "Zoom in/out {ratio}x"
  - Combine into a string like "Pan right + Zoom in 1.5x"

### State Transitions Summary
| Trigger | From State | To State |
|---------|-----------|----------|
| Draw bounding box | Edit mode, no keyframe at time | New keyframe created, dialog opens |
| Drag viewport | Edit mode, viewport idle | Viewport moving, keyframe x/y updating |
| Scroll on viewport | Edit mode, viewport idle | Viewport resizing, keyframe w/h updating |
| Click "Add Manual KF" | Edit mode | New keyframe at current time + viewport, dialog opens |
| Switch to View + Preview | Any mode | Canvas renders CRE-driven cropped view |
| Click timeline keyframe | Any mode | Keyframe dialog opens |
| Click timeline segment | Any mode | Segment dialog opens |
| Play button | Paused | Playing (requestAnimationFrame loop) |
| Pause button | Playing | Paused |

## 8. Assumptions

- Users access the POC on a desktop browser (Chrome or Edge) at ≥ 1280px width. No mobile or tablet layout.
- A sample MP4 video file (ideally sports footage, ~1080p or 4K, 30–60 seconds) will be available locally. The POC does not fetch video from a server.
- FPS is hardcoded to 25 (matching the HLD's examples). There is no reliable cross-browser API to detect actual video FPS.
- Linear interpolation is sufficient to demonstrate the core concept. Natural smooth (Catmull-Rom) is deferred but the CRE interface is designed to support it later.
- The `transitionToNext` property lives on the keyframe (not on a separate segment entity), matching the HLD's sparse intent model.
- Canvas-based preview rendering (`drawImage` with source rect) provides acceptable performance for a single video at 1080p. No WebGL required.
- React + TypeScript is the stack. Konva.js or raw Canvas2D API for the overlay — decision deferred to implementation. The POC plan is agnostic to this choice.
- The viewport overlay supports both drawing new bounding boxes and manipulating an existing viewport. These are contextually exclusive: clicking empty canvas area = draw, clicking on the viewport rect = drag/resize.

## 9. Open Questions / Unknowns

- **Sample video source**: Does the team have a sample sports video clip to use, or should we source a public domain clip? → Ask: Product/Engineering
- **Keyboard shortcuts**: Should the POC support keyboard shortcuts for playback (space = play/pause, arrow keys = frame step)? → Suggest: Yes, low effort and high usability impact
- **Undo/redo**: Is undo important for the POC demo, or is "delete keyframe and re-create" acceptable? → Suggest: Defer undo; add a delete button on the keyframe dialog instead
- **Viewport aspect ratio lock**: Should the viewport maintain a fixed aspect ratio (e.g., 16:9) or allow freeform rectangles? → Ask: Product/Design. Assumption for POC: freeform, with output resolution dropdown being cosmetic
- **Frame-step granularity**: The HLD specifies frame-aligned time (`frameTime = floor(t * fps) / fps`). Should the scrubber and keyframe time inputs enforce frame alignment? → Suggest: Yes, for correctness parity with future export

## 10. Demo Narrative

"We open the app and see a 4K sports match loaded in the player with a full-width view. The timeline below is empty — no camera intent has been authored yet. We switch to Edit mode and scrub to the 12-second mark where a player receives the ball. We draw a bounding box tightly around the player — a keyframe diamond appears on the timeline. We scrub forward to 18 seconds, where the player has moved downfield, and draw another bounding box. A segment labeled 'smooth' now connects the two keyframes. We add a third keyframe at 22 seconds with a wider tactical view. Now we switch to View → Preview mode and press Play. Watch the preview: it starts tight on the player at 12 seconds, smoothly pans and zooms to follow them to 18 seconds, then smoothly pulls out to the wider view at 22 seconds. The virtual camera is doing exactly what we authored. Finally, we click the segment between keyframes 2 and 3, change it from 'smooth' to 'cut', and replay — now the transition is an instant snap to the wide view. This demonstrates that non-destructive virtual camera authoring works: same source video, different camera intent, deterministic reframed output."
