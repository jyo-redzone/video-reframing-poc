# Task 001 — Clip range model

## Context

v2 introduces a per-clip time range (the export range). The current `Track` type has no field for it; [src/components/TrackPanel.tsx](../../../src/components/TrackPanel.tsx) shows a static stub for ranges (`R1: 00:10 - 00:20`, `R2: 00:30 - 00:35`, "+ Add range") that has no backing state. Scope is single-clip (no add/delete).

## Objective

Add a per-track `range` field, seed it sensibly when video metadata loads, expose a `setTrackRange` action, and replace the static R1/R2 stub in TrackPanel with a read-only display of the active clip's current range.

## Scope

- [src/types/index.ts](../../../src/types/index.ts) — extend `Track` with `range: { inTime: number; outTime: number }`.
- [src/store/useAppStore.ts](../../../src/store/useAppStore.ts) —
  - Initialize the default track's `range` to `{ inTime: 0, outTime: 0 }`.
  - In `setVideoMetadata`, when the active track's `range` is still `{0, 0}` (i.e. unset), auto-set it to `{ inTime: 0, outTime: meta.duration }`. Do **not** clobber a user-set range on subsequent metadata updates.
  - Add a `setTrackRange(inTime: number, outTime: number)` action that updates the active track's range. Clamp to `[0, duration]` and ensure `inTime ≤ outTime`.
- [src/components/TrackPanel.tsx](../../../src/components/TrackPanel.tsx) — remove the static R1/R2 rows and the "+ Add range" button. Replace with a single read-only display of the active track's `range` (e.g. `In: 00:10  Out: 00:20`). Use a simple `mm:ss` formatter; no need to share with TimelineBar's formatter for now.
- [src/store/__tests__/useAppStore.test.ts](../../../src/store/__tests__/useAppStore.test.ts) — add coverage for the new field, the auto-default on metadata load, and `setTrackRange` clamping/ordering.

## Non-goals / Later

- No `addTrack` / `deleteTrack` / clip selector logic.
- No timeline rendering of the range band — Task 005 handles that.
- No edit affordance in TrackPanel for the range — display only.
- Do **not** rename or remove the static "Selected track" or "Output res" dropdowns in TrackPanel; leave them cosmetic.
- Do **not** touch the Export button in this task.

## Constraints / Caveats

- `Track.range` is required on the type. Update the default-track initializer in the store to satisfy it; check that no other test/fixture constructs a `Track` literal without it.
- Auto-default must be idempotent: re-loading the same metadata, or loading metadata after the user has already adjusted the range, must not reset it. Use the "still `{0, 0}`" check as the sentinel.
