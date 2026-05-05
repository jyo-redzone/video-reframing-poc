# Task 002 — Recording state machine + REC UI

## Context

Task 001 cleaned the foundation. This task adds the recording state machine in the store and renders the REC controls inline with `PlaybackControls`. **No write paths in this task.** The keyframe writes (snapshot, sampler, gesture-end) all land in Task 003 — Record here only flips state and updates the UI.

Source of truth: [docs/DESIGN-gestures-and-keyframe-capture.md](../../DESIGN-gestures-and-keyframe-capture.md), section "Recording state machine" and "UI: REC badge + controls".

## Objective

After this task: a `recordingState` field exists in the store with four transition actions, mode switching is blocked while a session is active, and `PlaybackControls` renders the three-layout REC UI per the design table. Pressing the buttons changes state and visual layout but does not yet alter any keyframes.

## Scope

### 1. Store: state + actions

`src/store/useAppStore.ts`

- Add to `AppState`:
  ```ts
  recordingState: 'idle' | 'recording' | 'paused';
  ```
  Initial value `'idle'`.
- Add to `AppActions`:
  ```ts
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  ```
- Action behaviour (state-machine guards — invalid transitions are silent no-ops, not errors):
  - `startRecording`: only valid when `recordingState === 'idle'` AND `viewportRect !== null`. Sets state to `'recording'`. **Do not write any keyframe in this task** — the explicit Record-start snapshot is wired in Task 003.
  - `pauseRecording`: only valid when `recordingState === 'recording'`. Sets state to `'paused'`.
  - `resumeRecording`: only valid when `recordingState === 'paused'`. Sets state to `'recording'`.
  - `stopRecording`: valid from `'recording'` or `'paused'`. Sets state to `'idle'`.
- `setMode` action: when called while `recordingState !== 'idle'`, show `window.alert('Stop recording before switching modes')` and do not change `mode`. When idle, behaves as before.

### 2. UI: REC controls in `PlaybackControls`

`src/components/PlaybackControls.tsx`

- Read `mode`, `recordingState`, `viewportRect` from the store, plus the four transition actions.
- Render the existing transport (`⏮ ▶/⏸ ⏭` + speed dropdown) unchanged.
- Append REC controls **inline on the same row**, only when `mode === 'edit'`. In `view` mode the REC group is not rendered at all (transport remains).
- Three layouts, driven by `recordingState`:

  | State       | Visual                                              |
  | ----------- | --------------------------------------------------- |
  | `idle`      | `⏺ Record` button                                   |
  | `recording` | pulsing red dot + `REC` text + `⏸ Pause` + `⏹ Stop` |
  | `paused`    | steady red dot + `REC` text + `⏵ Resume` + `⏹ Stop` |

- The Record button is `disabled` when `viewportRect === null`, with `title="Draw a framing box first."` Otherwise `title="Start recording"`.
- The pulsing dot animation: a small red circle with a CSS animation (e.g. opacity or scale pulse). Tailwind 4 is available — use `animate-pulse` or an inline keyframe via `<style>` in this component if you need a custom pulse. Steady dot is the same circle without the animation.
- Buttons styled consistently with the existing transport (`rounded-default px-3 py-1.5 text-sm`...). Use a subtle visual separator (e.g. a vertical divider or extra `gap`) between the transport and the REC group so it reads as a distinct section.
- Wire each REC button to its corresponding store action. No other side effects.

## Non-goals / Later

- **No write paths.** Record-start must not write a keyframe; gesture-end must not write; no sampler. All three live in Task 003.
- Don't auto-pause/resume recording when video is played/paused — recording and playback are independent.
- Don't expose sample rate or recording state outside `PlaybackControls` and the store.
- Don't add a confirmation dialog on Stop.
- Don't change `BoundingBoxTool` or `ViewportOverlay`.

## Constraints / Caveats

- The state-machine guards in store actions are silent no-ops on invalid transitions. The UI is responsible for not exposing impossible buttons; the guards are belt-and-braces.
- When the user is in `view` mode and a session is somehow active (shouldn't happen after this task wires the mode-switch block, but defensively): the REC group still doesn't render in view mode. The session simply persists invisibly until they switch back. Mode-switch block makes this practically unreachable, so don't add extra plumbing.
- `window.alert` is acceptable for the mode-switch block. Don't build a custom modal.

## Acceptance criteria

- In `edit` mode with no box: Record button is visible and disabled with the "Draw a framing box first." tooltip.
- After drawing a box: Record becomes enabled. Clicking it switches the layout to `recording` (pulsing dot + Pause + Stop). No keyframe diamond appears on the timeline.
- Pause swaps the layout to `paused` (steady dot + Resume + Stop). Resume returns to `recording`. Stop returns to `idle`.
- Trying to switch Mode (Edit↔View) while `recordingState !== 'idle'` shows the alert and the dropdown selection snaps back. After Stop, mode switching works normally.
- In `view` mode the REC group is not rendered. Transport remains.
