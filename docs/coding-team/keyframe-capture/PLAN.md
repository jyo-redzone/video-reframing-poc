# Keyframe Capture — Recording Mode

Implements the explicit recording-session model from [docs/DESIGN-gestures-and-keyframe-capture.md](../../DESIGN-gestures-and-keyframe-capture.md). That doc is the source of truth for behaviour; tasks below are the execution slice.

## Scope (decided)

- Collapse modes to `edit` / `view`. Drop `viewType` field and the View dropdown.
- `viewportRect` starts `null`; user draws once to create the live box.
- Drawing only sets `viewportRect` (no keyframe). `BoundingBoxTool` becomes inert once a box exists.
- Drag/resize gestures only update `viewportRect` — never persist on their own.
- New recording state machine: `idle` ↔ `recording` ↔ `paused`. Mode switch blocked while not `idle`.
- Three write paths, all gated on `recordingState`:
  - Record-start: explicit immediate snapshot at `currentTime`.
  - Sampler at `RECORDING_SAMPLE_HZ` while `recording` + playing. Dedup against previous tick rect, **persisted across pause/resume** (reset on Stop / Record-start).
  - Gesture-end on drag/resize mouseup while `recording` + paused, only when rect actually changed.
- Single epsilon-resolution rule for all writes (within ε ⇒ update in place; else append).
- All tunable constants live in `src/config.ts`.
- REC controls inline with `PlaybackControls`, Edit mode only. Record disabled when `viewportRect === null`.

## Non-goals

Per design doc "Out of scope" section: per-keyframe inspection UI, snap-to-keyframe, re-record range UI, sample-rate UI, scroll-zoom capture.

## Tasks

1. **001 — Foundation cleanup.** Create `src/config.ts`; refactor `getSelectedKeyframe` to use it. Drop `viewType` field/dropdown and the view+source branch in `ViewportOverlay`. Remove auto-set of `viewportRect` on metadata load. Strip keyframe creation from `BoundingBoxTool` draw, and gate the tool on `viewportRect === null`. Wire `PlaybackControls` frame-step to `videoMetadata.fps`.
2. **002 — Recording state machine + REC UI.** Add `recordingState` and transition actions; block mode switch while not idle. Render the three-layout REC controls in `PlaybackControls` (Edit mode only). State + UI only — no write paths yet.
3. **003 — Write paths (snapshot, sampler, gesture-end).** Single epsilon write helper in the store. Record-start snapshot at `currentTime`. `useRecordingSampler` hook: 4 Hz `setInterval` while recording + playing, immediate first tick on Resume only, dedup ref persisted across pause/resume. Gesture-end write in `ViewportOverlay` mouseup when recording + paused and rect changed.
