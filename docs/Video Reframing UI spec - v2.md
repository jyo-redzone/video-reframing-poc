
## 1. Purpose

The UI enables analysts to create reframed clips from long panoramic sports videos. Analysts should be able to:

1. open a source video
2. select a clip range
3. position a framing box
4. adjust the framing over time
5. preview the reframed result
6. export MP4 clips

The UI should not require analysts to understand keyframes, segments, pixel coordinates, or camera-resolution algorithms.

## 2. Foundational Concepts

| Concept        | What It Is                                                                               | Why It Exists                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source Video   | The original, high-quality video                                                         | Ensures a single, untouchable visual source                                                                                                                                                                                                                      |
| Virtual Camera | An imaginary camera that looks at a portion of the source video over time                | Enables reframing without altering the original.<br>It can pan, tilt, and zoom by changing _which part of the source video is viewed_.<br>At any time `t`, which rectangle of the source video should be visible now?                                            |
| Viewport       | The rectangular region of the source video currently visible through the virtual camera. | It is defined by <br>- `(x, y)` → top-left corner in source pixels<br>- `(width, height)` → size of visible region                                                                                                                                               |
| Keyframe       | A **saved** virtual camera view at a specific time                                       | Keyframes represent:<br>- _Where the camera is_ (`sourceRect`)<br>- _When it should be there_ (`time`)<br>- _How it should move next_ (`transitionToNext`)<br><br>Keyframes do **not** represent:<br>- Mouse movements<br>- Scroll deltas<br>- Gesture sequences |
| Segment        | Time interval between two consecutive keyframes                                          | The virtual camera’s position is not stored continuously. <br>Instead, the system calculates it in real time by transitioning between the camera views defined by neighboring keyframes.                                                                         |
| Transition     | How the view changes between keyframes                                                   | `cut`: Camera snaps to the next keyframe.<br>`smooth`: Camera gradually moves to the next key frame.                                                                                                                                                             |
| Track          | An independent timeline over the same source video.                                      | Enable multiple analytical intents without duplicating media.                                                                                                                                                                                                    |
| Output Video   | The final newly encoded and exported video                                               | Delivers the reframed result                                                                                                                                                                                                                                     |


## 3. UI Mock

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ (A) TOP BAR                                                                  │
│ Video: Match_2025_11_21_4K  | Info  | Jobs             
└──────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────-────────────────────────────────┬─------───────────--────-┐
│  (B) PLAYER (Playback + Preview)                      │ (C) Track  [Export]     │
│                                                       │                         │
│  ┌───────────────────────────-------------┐           │ Selected: [▼ Ball track]│
│  │        Video Frame                                 │ Mode: View or Edit      │
│  │                                                    │ View: Source or Preview │
│  │  ┌──────────────────────────┐                      │                         |
│  │  │ Viewport (sourceRect)    │                      │ Export ranges:          |
│  │  │ Source pixel coords      │                      │ R1: 00:10 - 00:20s ✎   |
│  │  └──────────────────────────┘                      │ R2: 00:30 - 00:35s ✎   │
│  │                                                    │ [ +Add range ]          │
|  |                                                    |                         |
│  │  Playback: ⏮ ⏯ ⏭  Timecode                        │ Output res: <dropdown>  │
│  └────────────────────────────────--------┘           │ Keyframe capture        │
│                                                       │ Auto 🛈: []             │
│                                                       │ [ +Add Manual KF ]      │
└──────────────────────-────────────────────────────────┴─────------──────────--─-┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ (D) TIMELINE                                                                  │
│ Time:   00:10     00:20     00:30     00:40                                  │
│ Ranges: [========== R1 =========]                                           │
│ Track:    ♦ KF0     ♦ KF1 ────(smooth)──── ♦ KF2 ─(cut)─ ♦ KF3               │
│ Scrub: ────────────────|──────────────── playhead                            │
└──────────────────────────────────────────────────────────────────────────────┘
```


## 4. User interactions
### 4.1 Video Based interactions
- Bounding box
	- Drag inside framing box: move box
	- Drag handles: resize box
	- Shift + drag: constrain movement axis
	- Arrow keys: nudge box
	- Shift + arrow keys: larger nudge
	- Delete selected point: remove adjustment point
- Movement of box start and end are automatically captured as keyframes
- Default transition between keyframes is smooth

### 4.2 Right panel
1. **Clip Selection and Creation**
    - User can select an existing clip or create a new one
    - Each clip represents an independent analytical intent
    - User gives time range for each clip. Instead of making this manual entry, allow user to create clip from timeline bar by dragging.
2. **Mode Selection**
    - **View Mode**: Toggle between 
	    - **Source** view (playback of original source video)  
	    - **Preview** view (playback of selected track preview)
    - **Edit Mode**: author intent
        - Enable keyframe creation and segment editing
3. **Export Execution**
	- Export submits a background job
	- Jobs run asynchronously and do not block the UI
	- Users can monitor progress and download outputs via **Jobs**

### 4.3 Timeline bar
- Timeline bar shows the video timeline, keyframes and segments. Show indication for the timeline of selected clip.
- Drag to create new clip or modify the existing clip by dragging the start/end handles for a clip
- Scroll/zoom controls
- Add bookmarks for important events on the timeline

## 5. Supporting Information
- **Video Info**
    - Displays metadata such as resolution and available stream and download URLs
- **Jobs**
    - Lists submitted export jobs
    - Shows progress, completion status, and download links
Note: All user interactions are **auto-saved**; there is no explicit Save action