# 002 — TrackPanel UI: dropdown CRUD + save dialog + empty-state

## Context
Task 001 added store CRUD primitives (`createTrack`, `deleteTrack`, `renameTrack`, `setActiveTrackId`, `markActiveTrackSaved`), a per-track `isDirty` flag, and the `''` sentinel for "no active track". Now wire the UI to use them.

Relevant files:
- [src/components/TrackPanel.tsx](src/components/TrackPanel.tsx) — primary file, currently has a static `<select>`.
- [src/components/PlayerPanel.tsx](src/components/PlayerPanel.tsx) — hosts `BoundingBoxTool` + `ViewportOverlay`.
- [src/components/BoundingBoxTool.tsx](src/components/BoundingBoxTool.tsx) and [src/components/ViewportOverlay.tsx](src/components/ViewportOverlay.tsx) — must be gated on active-track existence.
- [src/components/TimelineBar.tsx](src/components/TimelineBar.tsx) — already degrades cleanly via `find()?.x ?? fallback`; verify nothing crashes when `activeTrackId === ''`.

Stack: React + TypeScript + Tailwind. No new deps. Use `window.confirm` and `window.alert` consistent with existing patterns. Modal can be a native `<dialog>` or a simple absolute-positioned div with backdrop — pick the lower-friction option, but it must be dismissable via Esc/backdrop-click and trap focus minimally (a focusable close button is enough).

## Objective
Replace the static dropdown with a real track switcher and add inline rename, create, delete (with confirmation), and a "Save clip" button that opens a JSON dialog of the active track. Handle the no-active-track empty state across the panel and player.

## Scope

### A) TrackPanel rework
Layout (top to bottom inside the existing panel):
1. **Selected track row** — flex row with three children:
   - **Dropdown** (`<select>`): wired to `tracks` (option for each: `value=id`, label=`name`) + `activeTrackId`. `onChange` calls `setActiveTrackId`. When `activeTrackId === ''`, prepend a disabled `<option value="">Select a clip</option>` and render it as the selected option.
   - **Pencil icon button** — opens inline rename. Disabled when no active track.
   - **Trash icon button** — opens delete confirm. Disabled when no active track.

   Use simple unicode/emoji glyphs (`✏️`, `🗑️`) or Tailwind-styled SVG inline — match the existing aesthetic in the codebase. No new icon libraries.

2. **Inline rename mode** — when the pencil is clicked, swap the dropdown row for a text input pre-filled with the active track's name + Save button + Cancel button. Enter or Save commits via `renameTrack`. Esc or Cancel exits without mutation. Trim before submit; if trimmed name is empty, reject (keep input open, tiny inline error text "Name required" or just shake — keep it minimal, a hint under the input is fine). On successful rename, exit rename mode.

3. **Create clip button** — full-width button below the selected-track row, label "Create clip". Calls `createTrack()`. Always enabled (even with no tracks).

4. **Mode selector** — keep existing edit/view dropdown unchanged. Disable it when no active track (mode editing without a clip is meaningless for the rest of the UI).

5. **Clip range section** — keep existing read-only In/Out display. When no active track, show a placeholder line ("No clip selected") instead of `00:00 / 00:00`.

6. **Action buttons row** — replace the single "Export selected clip" button with two side-by-side buttons:
   - **Save clip** — primary style, enabled only when an active track exists and `isDirty === true`. Disabled state should be visually distinct (greyed). On click, opens the Save dialog (see B).
   - **Export clip** — keeps the existing alert behavior (`window.alert('Export not available in POC')`). Disabled when no active track.

### B) Save dialog
- Modal showing the active track's full object as pretty-printed JSON (`JSON.stringify(track, null, 2)`).
- Read-only `<pre>` block inside a scrollable container, max-height 60vh.
- "Copy" button (uses `navigator.clipboard.writeText`).
- "Close" button (and Esc / backdrop click). On close, call `markActiveTrackSaved()` so the dirty flag clears.
- Title: "Save clip — `<name>`".

### C) Delete confirm
Use `window.confirm('Delete clip "<name>"? This cannot be undone.')`. On OK, call `deleteTrack(id)`. Per Task 001, the store handles clearing active and viewport when the deleted track was active.

### D) Empty-state gating (no active track)
- **TrackPanel**: handled above (placeholder option, disabled buttons, "No clip selected" line, mode selector disabled).
- **BoundingBoxTool** and **ViewportOverlay**: when `activeTrackId === ''`, render nothing (return `null`). Same effect as today's `viewportRect === null` for BoundingBoxTool — reinforces that drawing requires an active clip.
- **PlaybackControls**: Record button must additionally require an active track (extend the existing `viewportRect === null` disabled check). Tooltip when disabled-due-to-no-track: "Select or create a clip first."
- **TimelineBar**: no functional change required — verify it doesn't crash with `activeTrackId === ''`. The existing `find()?.x ?? fallback` pattern already covers reads. Drag-to-set-range mutations are silently no-op in the store; that's acceptable for the POC (don't add UI gating here unless trivial).

## Non-goals / Later
- Reordering, duplicating tracks, undo/redo.
- Multi-track preview/playback (still single-active-track).
- Editing clip range from the panel (timeline handles it).
- Persistence beyond the JSON dialog (no localStorage, no API).
- Custom modal animation, focus-trap library, accessibility audit beyond basics.
- Adding tests for purely UI-side behavior — only add a test if it covers a non-trivial wiring concern (e.g., dirty flag flips false after dialog close). Use existing testing patterns; do not pull in `@testing-library/react` if it isn't already a dep.

## Constraints / Caveats
- Don't add new dependencies.
- Keep Tailwind class style consistent with the existing TrackPanel (e.g., `rounded-default`, `border-border-subtle`, `bg-surface-raised`, `text-text-primary`, `bg-brand`).
- The disabled "Save clip" button must be visually distinct (e.g., `disabled:opacity-40 disabled:cursor-not-allowed` per the existing PlaybackControls pattern).
- `markActiveTrackSaved` is called on dialog close, not on dialog open. The user can copy the JSON, then close — that's the "save".
- Inline rename input should auto-focus and select-all on entry.
- Verify `npm run build` is clean and existing store tests still pass.
