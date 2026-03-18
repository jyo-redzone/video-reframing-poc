# Task 006: Timeline Bar

## Context
The layout has a placeholder for the timeline. The store holds `currentTime`, `setCurrentTime`, keyframes (via `getActiveKeyframes()`), and `isPlaying`/`setIsPlaying`. The CRE has `deriveSegments()` for computing segments. The video duration comes from `videoMetadata.duration`. The HTML mock at `html_ui_mock.html` shows the SVG timeline structure.

## Objective
Replace the timeline placeholder with an interactive SVG-based timeline showing the time axis, keyframe diamonds, segment bars with transition labels, and a draggable playhead. Clicking a keyframe or segment opens the respective dialog (store selection — actual dialogs come in Task 008).

## Scope

### `src/components/TimelineBar.tsx`

An SVG-based timeline component rendered inside the timeline section of the layout.

#### Layout
- Outer container: `rounded-2xl border bg-white shadow-sm` card
- Header: "Timeline" label with `border-b px-4 py-3 font-semibold`
- SVG: `viewBox="0 0 1000 120"`, `className="w-full rounded-lg border bg-white"`
- The SVG uses a coordinate system where:
  - `TL_X0 = 40` (left margin)
  - `TL_X1 = 960` (right margin)
  - `TL_Y = 60` (center Y for the axis)
  - Time range: `0` to `videoMetadata.duration` (fallback to 60 if no metadata)

#### Helper: `xForTime(time, duration)`
- Maps a time value to an SVG x coordinate: `TL_X0 + (time / duration) * (TL_X1 - TL_X0)`

#### Elements (rendered in this order for correct z-stacking):

1. **Axis line**: horizontal line at Y=60 from X0 to X1, stroke `#CBD5E1`, width 2

2. **Time ticks + labels**: Generate ticks at sensible intervals based on duration:
   - If duration <= 60s: tick every 10s
   - If duration <= 300s: tick every 30s
   - If duration <= 600s: tick every 60s
   - Else: tick every 120s
   - Each tick: short vertical line at Y=54 to Y=66, stroke `#CBD5E1`
   - Label below: formatted as `MM:SS`, font-size 12, fill `#475569`

3. **Segment bars**: For each derived segment (from `deriveSegments(keyframes)`):
   - `<rect>` from startTime x to endTime x, Y=50 to Y=70 (height 20), rx=6
   - Fill: `#CBD5E1` for smooth, `#E5E7EB` for cut
   - `cursor: pointer`
   - onClick: `selectSegment(`${startKf.id}|${endKf.id}`)` in store
   - **Label**: `<text>` centered on the segment rect, Y=64, font-size 10, fill `#334155`, content = transition type ("smooth" / "cut")

4. **Keyframe diamonds**: For each keyframe:
   - `<polygon>` diamond shape centered at `(xForTime(kf.time), TL_Y)`, size ±6 horizontal, ±14 vertical
   - Points: `cx,cy-14  cx-6,cy  cx,cy+14  cx+6,cy`
   - Fill: `#0F172A`
   - `cursor: pointer`
   - onClick (with `stopPropagation`): `selectKeyframe(kf.id)` in store

5. **Playhead**: `<line>` from Y=20 to Y=100 at `xForTime(currentTime)`
   - Stroke: `#0F172A`, width 2
   - Should update reactively as `currentTime` changes

#### Interactions:

- **Click-to-scrub**: clicking anywhere on the SVG (that isn't a keyframe/segment) should:
  - Convert click position to SVG coordinates using `svg.getScreenCTM().inverse()`
  - Map x to time: `time = ((svgX - TL_X0) / (TL_X1 - TL_X0)) * duration`
  - Clamp to `[0, duration]`
  - Seek the video: `videoRef.current.currentTime = time`
  - Update store: `setCurrentTime(time)`

- **Playhead drag**: For simplicity in this task, clicking on the timeline is sufficient for scrubbing. Full drag-to-scrub (mousedown + mousemove) is a nice-to-have — implement it if straightforward, skip if it adds significant complexity.

#### Store reads:
- `currentTime` — for playhead position
- `getActiveKeyframes()` — for diamonds and segment derivation
- `videoMetadata?.duration` — for time scale
- `selectKeyframe()` — for diamond click
- `selectSegment()` — for segment click

#### Video ref:
- Use `useVideoRef()` to get the video element for seeking on scrub

### Update `src/App.tsx`
- Replace the timeline placeholder with `<TimelineBar />`

## Non-Goals
- No keyframe/segment dialogs (Task 008) — just set the store selection state
- No drag-and-drop keyframe repositioning on timeline
- No zoom/scroll on the timeline
- No export range visualization on the timeline

## Constraints
- SVG viewBox is fixed at `0 0 1000 120` — the component scales naturally via CSS `w-full`
- Use `deriveSegments()` from `src/engine/cre.ts` to compute segments — do not duplicate the logic
- Click handlers on diamonds and segments must call `stopPropagation()` to prevent the scrub handler from firing
