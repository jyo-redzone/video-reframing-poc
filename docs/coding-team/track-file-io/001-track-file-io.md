# 001 — Track file Save / Import + unsaved-change guards

## Context

Browser-based video recutting tool. Tracks are currently kept in Zustand state with `isDirty` tracking. The existing "Save clip" button opens [src/components/TrackPanel/SaveDialog.tsx](src/components/TrackPanel/SaveDialog.tsx) which copies the Track JSON to the clipboard. There is no import path, and no warning if the user closes the tab or switches clips with unsaved changes.

This task replaces the SaveDialog with a direct file download, adds an Import button, and adds two unsaved-change guards. The chosen file format mirrors the future REST payload shape (one Track per file) — see [docs/PERSISTENCE.md](docs/PERSISTENCE.md) for the eventual server design (NOT in scope here).

Domain types live in [src/types/index.ts](src/types/index.ts). Store slices live in [src/store/](src/store/).

## Objective

1. "Save clip" triggers a direct browser download of one Track as a `.json` file.
2. New "Import clip" button loads a `.json` file as a new Track.
3. `beforeunload` warning when the tab is closed with any dirty track.
4. `window.confirm` warning when switching to a different clip while the active track is dirty.

## Scope

### File format

```json
{
  "schemaVersion": 1,
  "videoUrl": "<HLS URL of source video>",
  "track": { /* full Track object */ }
}
```

Add `TRACK_FILE_SCHEMA_VERSION = 1` to [src/config.ts](src/config.ts).

### New: `src/utils/trackFile.ts`

Pure helpers, no React/store imports:

- `serializeTrack(track: Track, videoUrl: string): string` — returns pretty-printed JSON for the file payload above.
- `parseTrackFile(text: string): { ok: true; videoUrl: string; track: Track } | { ok: false; error: string }` — validates JSON shape strictly (schemaVersion, videoUrl, track and all nested fields per the type definitions). Returns a human-readable error message on failure.
- `sanitizeFilenamePart(s: string): string` — strips path separators, control chars, and reserved filesystem chars (`/ \ : * ? " < > |`); collapses whitespace to single underscores; trims to a sane length (e.g., 80 chars).
- `buildTrackFilename(videoName: string, trackName: string): string` — returns `<sanitized-videoName>_<sanitized-trackName>.json`.
- `downloadJsonFile(filename: string, content: string): void` — creates a Blob, anchors a temporary `<a download>` element, clicks it, revokes the URL.

### New store action: `importTrack` in `src/store/slices/trackSlice.ts`

Signature: `importTrack(track: Track): string` — returns the new track ID.

Behavior:
- Generate a fresh `id` for the new Track (same scheme as `createTrack`).
- Generate fresh `id`s for every keyframe; rewrite each keyframe's `trackId` to the new track id.
- Sort keyframes by `time` ascending (defensive — file may have been hand-edited).
- Enforce invariants: last keyframe's `transitionToNext` MUST be `null`; all preceding ones must be `'smooth'` or `'cut'` (if missing/invalid, default to `'smooth'`).
- Clamp `range.inTime`/`range.outTime` against current `videoMetadata.duration` if present.
- `isDirty: false`.
- Append to `tracks` and set as `activeTrackId`. Clear `viewportRect` (mirrors `createTrack`).

Do NOT validate file structure here — that's the util's job. This action assumes a well-formed `Track`.

### New hook: `src/hooks/useUnsavedChangesWarning.ts`

- Subscribes to `tracks` and registers a `beforeunload` listener while any `track.isDirty === true`.
- The listener calls `e.preventDefault()` and sets `e.returnValue = ''` (browsers ignore custom strings now, but the assignment is required for the prompt to fire).
- Cleans up the listener when no track is dirty or on unmount.

Mount this hook once in the app root. Locate the root component (likely `src/App.tsx` or `src/main.tsx`) and add the hook call there.

### UI: [src/components/TrackPanel/TrackPanel.tsx](src/components/TrackPanel/TrackPanel.tsx)

- Remove `SaveDialog` import, the `showSaveDialog` state, and the `openSaveDialog`/`closeSaveDialog` handlers.
- Replace the "Save clip" `onClick` with: serialize the active track + current `videoMetadata.url`, call `downloadJsonFile(buildTrackFilename(videoMetadata.name, activeTrack.name), serialized)`, then call `markActiveTrackSaved()`.
- Save button stays disabled when not dirty (existing behavior).

### UI: [src/components/TrackPanel/TrackSelectorRow.tsx](src/components/TrackPanel/TrackSelectorRow.tsx)

- Add an "Import clip" button alongside the existing "Create Clip" button. Style it consistently with existing buttons in this row.
- Add a hidden `<input type="file" accept="application/json,.json">` controlled via `useRef`. Clicking the Import button triggers the input's `click()`. On `onChange`, read the file as text, run `parseTrackFile`, then:
  - On parse failure → `window.alert(error)`; reset the input value so the same file can be re-selected later.
  - If parsed `videoUrl !== currentVideoUrl` → `window.alert('This clip belongs to a different video. Import blocked.')`; do NOT import.
  - If a video isn't loaded at all → block with a clear message.
  - Otherwise → call `importTrack(parsed.track)`.
- Wrap `onSelectTrack`: if the currently active track is dirty AND the user is selecting a different track, show `window.confirm('You have unsaved changes in "<name>". Switch clips and discard them?')`. If they cancel, do not switch.

### Delete

- [src/components/TrackPanel/SaveDialog.tsx](src/components/TrackPanel/SaveDialog.tsx) — no longer used.

## Non-goals / Later

- No server upload or autosave (future work, see `docs/PERSISTENCE.md`).
- No multi-track export (one file = one track).
- No schema migration (only `schemaVersion === 1` is accepted).
- No drag-and-drop file import.
- No toast/snackbar UI — use `window.alert` and `window.confirm` for now (consistent with existing code in TrackPanel/TrackSelectorRow).
- Do not change the "Export mp4" button.

## Constraints / Caveats

- All magic numbers go in [src/config.ts](src/config.ts) per project convention.
- Sub-components receive computed props and do not subscribe to the store directly. The Import flow needs `videoMetadata.url` and `importTrack` — pass them down from `TrackPanel` to `TrackSelectorRow` as props rather than subscribing in the row.
- `track.keyframes` invariants (sorted by time, last has `transitionToNext: null`) MUST hold after import.
- The dirty-track switch confirm should only fire on a *different* selection, not when re-clicking the active track.
- The `beforeunload` handler must be cleanly removed when no track is dirty — leaving stale listeners would warn unnecessarily.
- Keep `useUnsavedChangesWarning` disabled in tests if it interferes — but prefer designing it so it does nothing when no tracks are dirty (the natural state in tests).
