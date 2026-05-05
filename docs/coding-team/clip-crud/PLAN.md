# Clip CRUD

Replace the static "Selected track" dropdown with real create / rename / delete / switch / save controls. A "track" and "clip" are the same entity in this codebase.

## Requirements
- Single seeded clip on app load, named `clip-1` (renamed from `Ball follow`).
- **Create:** "Create clip" button. New clip = empty keyframes, range = full video duration, name = `clip-${tracks.length + 1}`. Becomes active.
- **Rename:** Pencil icon next to the dropdown opens an inline input. Empty name rejected. Enter commits, Esc cancels.
- **Delete:** Trash icon opens a confirmation. After deletion, if the active clip was deleted, `activeTrackId` is cleared and the user is prompted to pick another. Playback time is preserved. Viewport overlay is hidden until a clip is selected.
- **Switch:** Dropdown selection updates `activeTrackId`. Blocked while recording (consistent with mode-switch guard).
- **Save clip:** Per-track button. Enabled only when the active clip is dirty (any keyframe/range/rename mutation since last save flips dirty). Opens a modal showing the active track's JSON only (read-only). Marks the track saved on close.
- **Export clip:** Existing button — unchanged (still shows POC-not-available alert).

## Constraints
- Zustand store, in-memory only. No persistence.
- Save dialog content = active `Track` object only (not the rest of app state).
- Track switching, like mode switching, is blocked while `recordingState !== 'idle'`.

## Success criteria
- User can create N clips, switch between them, rename inline, and delete with confirmation.
- Deleting the active clip leaves the app in a "no active track" state — viewport overlay hidden, save/export/rename/delete disabled — until the user picks one.
- Save button is greyed when no unsaved changes; enabled after any edit; greyed again after save dialog closes.

## Non-goals / Out of scope
- Per-clip ranges within a single track (already flattened — out).
- localStorage / backend persistence (later).
- Reordering, duplicating, undo/redo on track operations.
- Editing clip range from the panel (handled on TimelineBar already).

## Tasks

### 001-store-track-crud
Extend Zustand store with track CRUD primitives and dirty-tracking. Rename seeded track to `clip-1`. Add a guard against switching tracks while recording.

### 002-trackpanel-ui
Rework `TrackPanel.tsx`: wire dropdown to store, add create/rename/delete affordances with confirmation, add Save-clip button with dirty-aware enable state, and a JSON dialog showing the active track. Handle the "no active track" empty state.
