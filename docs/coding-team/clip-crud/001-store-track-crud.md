# 001 — Store: track CRUD + dirty tracking

## Context
Currently the store seeds a single hardcoded track (`track_default`, name `Ball follow`) and exposes no actions to create, rename, delete, or switch tracks. All keyframe/range mutations target `activeTrackId`. We're adding real track CRUD plus a per-track dirty flag for a "Save clip" button.

Relevant files:
- [src/store/useAppStore.ts](src/store/useAppStore.ts)
- [src/types/index.ts](src/types/index.ts)
- Existing tests under `src/store/` (mirror their style)

## Objective
Extend the store with track CRUD primitives, add a dirty flag to `Track`, mark dirty on any mutation that changes the active track's persistable data, and rename the seeded track to `clip-1`.

## Scope
1. **Type change** — Add `isDirty: boolean` to `Track` in `src/types/index.ts`.

2. **Seeded track** — Initial state: `tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 0 }, isDirty: false }]`. `activeTrackId: 'track_default'`.

3. **New actions** on the store:
   - `createTrack()` — Appends a new track with id `track_${Date.now()}_${rand}`, name `clip-${tracks.length + 1}` (length **before** insertion + 1), empty keyframes, range = `{0, videoMetadata?.duration ?? 0}`, `isDirty: false`. Sets `activeTrackId` to the new track. Sets `viewportRect` to `null`. Returns the new id.
   - `deleteTrack(id: string)` — Removes the track. If `id === activeTrackId`, sets `activeTrackId` to `''` (empty string sentinel for "no active track") and `viewportRect` to `null`. Does **not** touch `currentTime`.
   - `renameTrack(id: string, name: string)` — Trims the name; if empty, no-op (return without mutating). Updates the name. If `id === activeTrackId`, marks the track dirty.
   - `setActiveTrackId(id: string)` — Switches active track. If `recordingState !== 'idle'`, alert (`window.alert('Stop recording before switching clips')`) and return without mutating. Sets `viewportRect` to `null` on switch.
   - `markActiveTrackSaved()` — Flips active track's `isDirty` to `false`. No-op if no active track.

4. **Dirty marking** — The following existing actions must set `isDirty: true` on the active track when they actually change it:
   - `setTrackRange`
   - `addKeyframe`
   - `updateKeyframe`
   - `deleteKeyframe`
   - `commitKeyframeAtTime` (both update-existing and append paths)
   - `setTransition`
   - `renameTrack` (already mentioned above)
   
   `setVideoMetadata`'s auto-range-fill path should **not** mark dirty (it's a system-driven default, not a user edit). The first `setVideoMetadata` call should also not flip the seeded track's dirty flag.

5. **Recording guard parity** — `setActiveTrackId` should mirror `setMode`'s pattern: alert + return when `recordingState !== 'idle'`.

6. **Tests** — Add unit tests in the same style as existing store tests covering:
   - `createTrack` naming counter (`clip-1` seeded → first create → `clip-2`; after delete + create, the counter is still `tracks.length + 1`, NOT a max-suffix scan).
   - `createTrack` sets active and clears viewport.
   - `deleteTrack` of active clears `activeTrackId` to `''` and clears viewport; `currentTime` preserved.
   - `deleteTrack` of non-active leaves active untouched.
   - `renameTrack` empty/whitespace-only name → no-op.
   - `renameTrack` of active marks dirty.
   - `setActiveTrackId` blocked while recording (alert + no state change).
   - `markActiveTrackSaved` clears dirty on active track only.
   - Dirty flag flips true on each listed mutation, false after `markActiveTrackSaved`.
   - Seeded track's name is `clip-1` and `isDirty` is `false`.

## Non-goals / Later
- Any UI changes (Task 002).
- Persistence / serialization beyond what's already in `Track`.
- Reordering, duplicating tracks, undo/redo.
- Per-clip ranges within a single track.
- Tracking dirty for non-active tracks (only active track's mutations are reachable today).

## Constraints / Caveats
- `activeTrackId: ''` is the sentinel for "no active track". All existing read sites already use `find()`, which returns `undefined` cleanly for `''` — verify nothing crashes.
- Don't change action signatures of existing actions; only add internal `isDirty` updates.
- Use `window.alert` for the recording guard, matching `setMode`.
- Don't add a max-suffix scan for naming — user explicitly chose `tracks.length + 1`.
