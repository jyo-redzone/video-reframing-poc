# Design — Gestures and Keyframe Capture

Reference doc for the explicit recording model that gates keyframe persistence in v2. This document is the source of truth for the *behavior*; subsequent task briefs implement against it.

## Purpose

Replace the implicit "every gesture writes a keyframe" model with an explicit recording session. The user opts into capture, dictates when it starts and stops, and can pause mid-session without losing the session.

## Modes

The mode set collapses from three (`edit` / `view+source` / `view+preview`) to **two**:

- **Edit** — source video, framing box rendered with editing affordances (drag-move, corner-resize, draw new box). This is the only authoring surface.
- **View** — preview rendering (CRE-resolved output). No box overlay, no editing.

The previous `view+source` mode (source video with a read-only framing box) is dropped — it overlapped Edit visually with no functional gain. The store's `viewType` field and the View dropdown in TrackPanel both go away.

**Mode switch while recording is blocked.** If the user picks the other mode while recording is active (state `recording` or `paused`), show an alert ("Stop recording before switching modes") and leave mode unchanged.

## Box lifecycle

- **No default framing box at app load.** `viewportRect` starts `null`; nothing is rendered over the video.
- The user creates the box **manually** by drawing it with the existing draw tool ([src/components/BoundingBoxTool.tsx](../../../src/components/BoundingBoxTool.tsx)).
- **The initial draw no longer persists a keyframe.** It only sets `viewportRect`. The box exists as live preview state.
- Once a box exists, the user can drag or resize it freely; those gestures continue to update `viewportRect` and never persist on their own.
- Persistence is exclusively the responsibility of the recording session described below.

## Recording state machine

```
idle ──Record──▶ recording ──Pause──▶ paused
  ▲                  │                  │
  └────────Stop──────┴────Stop──────────┘
                   ┌──Resume──┐
                   │          ▼
                paused ────▶ recording
```

- `idle`: no session active.
- `recording`: session active and writing.
- `paused`: session active but writing held.

Transitions:

| From      | Action  | To        | Effect                                     |
| --------- | ------- | --------- | ------------------------------------------ |
| idle      | Record  | recording | Snapshot current `viewportRect` immediately at `currentTime` (first keyframe). Start sampler if video is playing. |
| recording | Pause   | paused    | Stop sampler. Suppress gesture-writes.     |
| recording | Stop    | idle      | Stop sampler. Session over.                |
| paused    | Resume  | recording | Start sampler if video is playing.         |
| paused    | Stop    | idle      | Session over.                              |

**Record is disabled when no box exists** (`viewportRect === null`). Pause/Resume/Stop are disabled outside their valid states.

## Recording is independent of playback

Record and Play are separate buttons. The user can:

- Record while paused → sampler is dormant; only gestures persist.
- Play without recording → no writes; previewing only.
- Press Record then Play → sampler runs.
- Press Pause (recording) without touching playback → video keeps playing but no keyframes are captured.

## Storage model

Two write paths, gated by recording state:

### 1. Sampler — while `recording` AND video is playing

A timer fires at the configured **sample rate** (default **4 Hz**, configurable via a single constant for now). Each tick:

1. Read `viewportRect` and `currentTime`.
2. Apply the **epsilon resolution rule** below.

If the read rect equals the previous sample's rect (deep equality on x/y/width/height), skip the write — a held-still box should not fill the timeline.

The first tick fires immediately on Record-start (via the explicit snapshot above) and on Resume; subsequent ticks at the configured interval.

### 2. Gesture-end — while `recording` AND video is paused

On `mouseup` of a drag-move or corner-resize gesture in [src/components/ViewportOverlay.tsx](../../../src/components/ViewportOverlay.tsx):

1. If gesture didn't actually move the rect, no-op.
2. Read final `viewportRect` and `currentTime`. Apply the epsilon resolution rule.

This path lets a user author deliberate keypoints while paused, without waiting for the sampler.

### When nothing is written

- `idle`: no writes from any path.
- `paused`: no writes from any path. Dragging the box only updates the live preview.
- `recording` + video paused + no gesture: no writes (sampler is dormant when not playing).

## Epsilon resolution rule

When a write is about to occur at time `t`:

- Let `epsilon = 0.5 / fps` (half a frame), with a fallback if `videoMetadata` is null. The fraction (`0.5`) and the fallback live in the config file (see Configuration). This is the same epsilon Task 003 introduced for `getSelectedKeyframe` — refactor that lookup to read from the config too.
- Look up the active track's keyframes. If any existing keyframe `kf` has `|kf.time - t| ≤ epsilon`, **update** that keyframe's `sourceRect` in place (do not change its `time`).
- Otherwise, **append** a new keyframe at time `t` with the read `sourceRect`.

This single rule covers:

- Sampler ticks landing on fresh time slots → append.
- Sampler ticks landing within epsilon of a kf the user just dropped via gesture → update (no near-duplicate).
- Gesture writes landing on the playhead's existing keyframe → update.
- Re-recording over a previously recorded range → samples that match prior times update; samples in the gaps append. No special "re-record" logic is needed.

## UI: REC badge + controls

Recording controls live **inline with the playback controls** in [src/components/PlaybackControls.tsx](../../../src/components/PlaybackControls.tsx) — same row as `⏮ ▶/⏸ ⏭` + the speed dropdown. Visible only in Edit mode.

One of three layouts based on state:

| State     | Visual                                                |
| --------- | ----------------------------------------------------- |
| idle      | `⏺ Record`                                            |
| recording | pulsing red dot + `REC` + `⏸ Pause` + `⏹ Stop`        |
| paused    | steady red dot + `REC` + `⏵ Resume` + `⏹ Stop`        |

Pulsing dot = "actively writing." Steady dot = "session open but writing held."

Record button is disabled while `viewportRect === null`. Tooltip explains: "Draw a framing box first."

## Configuration

All tunable constants live in a single file at [src/config.ts](../../../src/config.ts) (new file). Initial contents:

```ts
// Recording
export const RECORDING_SAMPLE_HZ = 4; // sampler rate while recording + playing

// Keyframe time resolution
export const KEYFRAME_TIME_EPSILON_FRAMES = 0.5; // epsilon = FRAMES / fps
export const KEYFRAME_TIME_EPSILON_FALLBACK_S = 0.02; // when videoMetadata is null
```

Consumers (`useAppStore.getSelectedKeyframe`, the recording sampler, the gesture-end writer, `useKeyboardShortcuts`) import from this file. No magic numbers in component or store code.

At 4 Hz with dedup, a held-still box produces zero post-first samples. A 10-second moving take produces at most ~40 keyframes.

## Edge cases (decided)

- **Box deleted mid-session** (user invokes Delete via Task 003 hotkey): `viewportRect` does not vanish — the keyframe is removed but the live rect persists. Sampler keeps writing because the rect still exists.
- **All keyframes deleted, recording active**: same as above. The deleted ones are gone; subsequent samples write new ones.
- **Scrubbing during recording**: sampler doesn't fire on scrub (only on playback ticks). When user resumes playback, sampler resumes from the new `currentTime`.
- **Mode switch attempted during recording**: blocked. Show alert "Stop recording before switching modes." See Modes section.
- **First sample on Record-start**: written immediately at `currentTime`, regardless of play state. This is the only write the sampler does while video is paused.

## Out of scope (for the recording task)

- Per-keyframe inspection or editing UI — Tasks 002/005 already removed dialogs and the `getSelectedKeyframe` model with keyboard nudges remains the editing surface.
- Snap-to-keyframe during scrub.
- Re-record range selection (e.g. "re-record from t=5s to t=10s only"). Append + epsilon handles this implicitly.
- Sample-rate UI control. Reads from `src/config.ts`; UI exposure is a follow-up.
- Capture during scroll-zoom. Out per prior decision.
