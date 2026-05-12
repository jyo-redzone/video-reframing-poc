# Task 001 — Track JSON: include source dimensions + schema bump

## Context

Saved Track JSON files currently carry `{ schemaVersion, videoUrl, track }`. The export-mp4 tool needs the original video dimensions (and fps) to correctly scale `sourceRect` coordinates from authoring dimensions to the dimensions of whatever HLS variant PyAV decodes at export time. This task adds that field to the saved JSON and bumps the schema version.

Relevant files:
- [src/utils/trackFile.ts](src/utils/trackFile.ts) — `serializeTrack` and `parseTrackFile`
- [src/config.ts](src/config.ts) — `TRACK_FILE_SCHEMA_VERSION`
- [src/components/TrackPanel/TrackPanel.tsx](src/components/TrackPanel/TrackPanel.tsx) — `handleSave` calls `serializeTrack`
- [src/types/index.ts](src/types/index.ts) — `VideoMetadata` type already exists

## Objective

Saved Track JSONs include the source video's `width`, `height`, and `fps` at the top level of the payload, and parsing rejects files that don't have it.

## Scope

1. **JSON payload shape (top-level, not inside `track`):**
   ```jsonc
   {
     "schemaVersion": 2,
     "videoUrl": "...",
     "videoMetadata": { "width": 1920, "height": 1080, "fps": 29.97 },
     "track": { ... }
   }
   ```
   Only these three fields go into `videoMetadata` for the saved file — do **not** also persist `id`, `name`, `duration`, or `url` from the in-memory `VideoMetadata` type. Define a small local type for the on-disk shape (e.g. `TrackFileVideoMetadata = Pick<VideoMetadata, 'width' | 'height' | 'fps'>`) and use it consistently in both serialize and parse.

2. **`serializeTrack` signature:** add a third parameter for the metadata.
   ```ts
   export function serializeTrack(track: Track, videoUrl: string, videoMetadata: TrackFileVideoMetadata): string
   ```

3. **`parseTrackFile`:**
   - Require `videoMetadata` on parse. Reject with a clear error message if missing or malformed (mirror the existing `validateSourceRect` / `validateClipRange` style — `isFiniteNumber` checks for all three fields; reject non-positive width/height/fps).
   - Update `ParseResult` and `ParsedTrackFile` so the parsed metadata is returned alongside `videoUrl` and `track`.

4. **`TRACK_FILE_SCHEMA_VERSION`** in [src/config.ts](src/config.ts) → bump from `1` to `2`. No migration path for v1 files; the existing version check in `parseTrackFile` will already reject them with a helpful error.

5. **`TrackPanel.handleSave`** → pass `videoMetadata` to `serializeTrack`. The early-return already guarantees `videoMetadata` is non-null at the call site.

6. **Import flow** — `TrackSelectorRow` uses `parseTrackFile` and currently destructures `{ videoUrl, track }`. The store's `importTrack` action only consumes the `track`. For this task, just ignore the parsed `videoMetadata` at the call site (it's only needed at export time, which is a future task). Don't add it to the store yet.

7. **Tests** — add a new test file `src/utils/__tests__/trackFile.test.ts` covering:
   - `serializeTrack` includes `schemaVersion: 2`, `videoUrl`, `videoMetadata` (with exactly width/height/fps), and `track`.
   - `parseTrackFile` round-trips a serialized payload successfully.
   - `parseTrackFile` rejects: missing `videoMetadata`, missing `videoMetadata.width`, non-finite values, negative values, `schemaVersion: 1`.

## Non-goals / Later

- No changes to the store schema, no persistence of `videoMetadata` on the in-memory `Track`.
- No use of the parsed `videoMetadata` at import time — it's read but discarded.
- No CLI / Python work.

## Constraints / Caveats

- The on-disk `videoMetadata` shape must be exactly `{ width, height, fps }` — nothing else. This keeps the file schema minimal and forward-stable.
- Keep the parse-error messages in the same human-readable style already used in `validateSourceRect` etc. (e.g. `"videoMetadata.width: expected a positive finite number"`).
- Don't refactor unrelated parts of `trackFile.ts`.
