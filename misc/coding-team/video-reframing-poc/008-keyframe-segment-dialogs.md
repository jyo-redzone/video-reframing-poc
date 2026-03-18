# Task 008: Keyframe + Segment Dialogs

## Context
The store has `selectedKeyframeId` and `selectedSegmentKey` (set by timeline clicks and bounding box creation). The HTML mock at `html_ui_mock.html` shows the exact dialog markup using `<dialog>` elements. The CRE has `deriveIntent()` for computing segment intent strings. Currently clicking a keyframe diamond or segment bar sets the selection in the store, but no dialog appears.

## Objective
Create two modal dialogs — KeyframeDialog and SegmentDialog — that open when their respective store selection is set, allow inspection/editing, and save changes back to the store.

## Scope

### `src/components/KeyframeDialog.tsx`

A modal dialog for inspecting and editing a single keyframe.

**When to show:** `selectedKeyframeId !== null`

**Behavior:**
- On open: find the keyframe by ID from the active track's keyframes. Populate local form state with `time`, `x`, `y`, `width`, `height` from the keyframe.
- If keyframe not found (deleted while dialog was opening): close immediately by calling `selectKeyframe(null)`.

**Form fields:**
- `t (sec)` — number input, step 0.001
- `x` — number input
- `y` — number input
- `w` — number input
- `h` — number input
- All fields use `font-mono text-sm` styling with labels

**Layout:** Match the HTML mock's keyframe dialog:
- Header: "Keyframe {id}" title + close button (✕)
- 2-column grid for inputs
- Footer: Cancel and Save buttons

**Actions:**
- **Save**: call `updateKeyframe(id, { time: parsedT, sourceRect: { x, y, width, height } })`, then call `setViewportRect({ x, y, width, height })` to sync the viewport overlay, then call `selectKeyframe(null)` to close
- **Cancel / Close (✕)**: call `selectKeyframe(null)` — no changes saved
- **Delete**: add a "Delete" button (red/destructive styling) that calls `deleteKeyframe(id)` then `selectKeyframe(null)`

**Implementation:**
- Use the HTML `<dialog>` element with `ref.showModal()` / `ref.close()` for native modal behavior
- Use a `useEffect` that calls `showModal()` when `selectedKeyframeId` changes from null to a value, and `close()` when it changes back to null
- Local form state via `useState` — initialize from the keyframe when dialog opens
- Handle the `<dialog>` `close` event to ensure store selection is cleared if user presses Escape

### `src/components/SegmentDialog.tsx`

A modal dialog for inspecting and editing a segment's transition type.

**When to show:** `selectedSegmentKey !== null` (format: `"kfId1|kfId2"`)

**Behavior:**
- Parse the segment key to get start and end keyframe IDs
- Find both keyframes from the active track
- If either keyframe not found: close immediately
- Read current transition from start keyframe's `transitionToNext`
- Compute derived intent using `deriveIntent(startKf.sourceRect, endKf.sourceRect)`

**Form fields:**
- `Transition style` — `<select>` dropdown with options "smooth" and "cut"
- `Derived operations` — read-only `<textarea>` showing the derived intent string
- Note below textarea: "Derived ops are heuristic UI hints; not authoritative data."

**Layout:** Match the HTML mock's segment dialog:
- Header: "Segment {startId} → {endId}" title + close button (✕)
- Single-column layout
- Footer: Cancel and Save buttons

**Actions:**
- **Save**: call `setTransition(startKeyframeId, selectedTransition)`, then `selectSegment(null)` to close
- **Cancel / Close (✕)**: call `selectSegment(null)` — no changes saved

**Implementation:**
- Same `<dialog>` pattern as KeyframeDialog
- Local state for the transition dropdown value
- Derived intent computed inline (not stored) using `deriveIntent()` from `src/engine/cre.ts`

### Wire into `src/App.tsx`

- Import and render `<KeyframeDialog />` and `<SegmentDialog />` at the bottom of the App component (outside the main layout, as they are modals)

## Non-Goals
- No drag-to-reposition keyframes on the timeline
- No undo on dialog changes
- No validation beyond basic number parsing (no range clamping in the dialog — the CRE clamps at resolve time)

## Constraints
- Use the native `<dialog>` element for modal behavior (not a custom portal/overlay)
- Match the styling from `html_ui_mock.html` (rounded-2xl, shadow-xl, padding, button styles)
- The dialog must handle Escape key natively (dialog's built-in behavior) — just ensure the `close` event clears the store selection
- Parse number inputs with `parseFloat()` — if NaN, keep the original value
