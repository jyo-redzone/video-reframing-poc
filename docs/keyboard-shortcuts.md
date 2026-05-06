# Keyboard Shortcuts — Player, Timeline, Bbox

## Purpose & scope

Reference for keyboard shortcuts in the three primary interaction surfaces of the Video Reframing app: the **Player** (transport + recording controls), the **Timeline** (zoom, seeking, in/out), and the **Bounding box** (live viewport rect). Other surfaces (TrackPanel, dialogs) are out of scope.

This document is the source of truth for the agreed shortcut map. Implementation status is not tracked here — refer to the codebase for what is currently wired up.

## Conventions

- **`Shift` modifier** → larger step (e.g. 10px instead of 1px) or aspect-ratio constraint while resizing / drawing a bbox.
- **Reserved combos** → `Ctrl`, `Meta`, and `Alt` are left to the OS / browser and are never intercepted.
- **Focus guard** → no shortcuts fire while focus is inside an `INPUT`, `TEXTAREA`, `SELECT`, or `contenteditable` element.
- **Mode guard** → most shortcuts are active in **Edit mode** only. View mode is read-only and accepts only navigation shortcuts.
- **Recording integration** → bbox shortcuts pressed while a recording session is active (recording or paused) write a keyframe at the current playhead, using the same path as a mouse drag.

---

## Player

| Key | Action | Notes |
|---|---|---|
| `Space` | Play / pause | Always available. |
| `,` | Step back one second | |
| `.` | Step forward one second | |
| `Shift+,` | Cycle playback speed down | Through existing dropdown values: 0.5× → 1× → 1.5× → 2× → 4× → 8× → 16×. |
| `Shift+.` | Cycle playback speed up | Same list. |
| `R` | Record toggle | Context-aware: idle → recording, recording → paused, paused → recording. Edit mode only. Disabled when no active track or no viewport rect. |
| `Shift+R` | Stop recording | Works from both recording and paused states; commits the session. |

---

## Timeline

| Key | Action | Notes |
|---|---|---|
| `=` | Zoom in (max 256×) | Plain key, no modifier. |
| `-` | Zoom out (min 1×) | |
| `0` | Reset zoom to 1× | |
| `Home` | Seek to clip start | |
| `End` | Seek to clip end | |
| `I` | Set clip in-point at playhead | NLE-standard. Edit mode only. |
| `O` | Set clip out-point at playhead | NLE-standard. Edit mode only. |
| `Delete` / `Backspace` | Delete selected keyframe | Edit mode only. Requires a keyframe selected (clicked) on the timeline. |
| `Esc` | Close transition picker / dialog | |

---

## Bounding box

| Key | Action | Notes |
|---|---|---|
| `←` `→` `↑` `↓` | Move bbox 1px | Edit mode only; requires a viewport rect. While recording, writes a keyframe at the playhead. |
| `Shift+←` / `Shift+→` / `Shift+↑` / `Shift+↓` | Move bbox 10px | Same recording behavior as the 1px variant. |
| `]` | Grow bbox (uniform scale up) | 1.05× per press, scaled around rect center. Clamped to the existing 100% video-frame max. |
| `[` | Shrink bbox (uniform scale down) | 1.05× per press, scaled around rect center. Clamped to the existing 10% video-frame min. |
| `Shift+]` | Grow bbox (larger step) | |
| `Shift+[` | Shrink bbox (larger step) | |
| `Shift` (held while resizing or drawing) | Maintain aspect ratio while resizing or drawing | During resize: maintains the existing rect's aspect ratio. During draw: constrains to the video's aspect ratio. Move (drag the body) is unaffected. |

---

## Cheat sheet (all shortcuts)

| Key | Action | Surface |
|---|---|---|
| `Space` | Play / pause | Player |
| `,` | Step 1 second back | Player |
| `.` | Step 1 second forward | Player |
| `Shift+,` | Speed down | Player |
| `Shift+.` | Speed up | Player |
| `R` | Record toggle | Player |
| `Shift+R` | Stop recording | Player |
| `=` | Timeline zoom in | Timeline |
| `-` | Timeline zoom out | Timeline |
| `0` | Timeline zoom reset | Timeline |
| `Home` | Seek to clip start | Timeline |
| `End` | Seek to clip end | Timeline |
| `I` | Set in-point | Timeline |
| `O` | Set out-point | Timeline |
| `Delete` / `Backspace` | Delete selected keyframe | Timeline |
| `Esc` | Close popover / dialog | Timeline |
| `←` `→` `↑` `↓` | Move bbox 1px | Bbox |
| `Shift+←/→/↑/↓` | Move bbox 10px | Bbox |
| `]` | Grow bbox | Bbox |
| `[` | Shrink bbox | Bbox |
| `Shift+]` / `Shift+[` | Grow / shrink bbox (larger step) | Bbox |
| `Shift` (resize / draw modifier) | Maintain aspect ratio | Bbox |

---

## Removed

- **Arrow / `Shift+Arrow` keyframe-nudge** — previously, selecting a keyframe and pressing arrows would fine-tune that keyframe's stored bbox position. This is removed: arrow keys are now reserved for live bbox movement. Post-hoc correction workflow is **seek to the keyframe → drag the bbox to the corrected position → the keyframe at that time is overwritten**.
