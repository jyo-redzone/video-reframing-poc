# Plan — Track file Save / Import

Replace the existing copy-to-clipboard SaveDialog with a direct file download, and add an Import button that loads a Track from a `.json` file.

## File format

```json
{
  "schemaVersion": 1,
  "videoUrl": "<HLS URL of the source video>",
  "track": { /* full Track object */ }
}
```

- `schemaVersion`: integer. Constant lives in `src/config.ts`.
- `videoUrl`: used at import to verify the file matches the currently loaded video.
- `track`: the existing `Track` type, serialized as-is.

## Tasks

- **001 — Implement Track file Save / Import + unsaved-change guards**
  Add file-format helpers, replace SaveDialog with direct download (`<videoName>_<trackName>.json`), add Import button next to "Create Clip" with file picker, and add an `importTrack` store action that validates and inserts the imported Track as a new entry. Block import on schema mismatch, malformed file, or video URL mismatch. Warn the user via `beforeunload` when closing the tab with any dirty track, and via `window.confirm` when switching to a different clip while the active track is dirty.
