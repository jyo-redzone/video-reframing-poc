
## 1. Purpose

The Recutting tool enables authoring and inspection of **virtual camera intent** over an immutable source video using PTZ-style operations (pan, tilt, zoom). The UI is designed to make camera intent **explicit, inspectable, replayable, and auditable**, without ever modifying the original video.

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
1. **Bounding Box Creation**
	- User draws a bounding box on the video
	- Each bounding box creates a keyframe
	- Transition to the next keyframe defaults to `cut`
2. **PTZ Gestures (Pan / Tilt / Zoom)**
    - User performs a PTZ gesture using mouse or joystick
    - Gesture start and end are automatically captured as keyframes
    - Transition between them defaults to `smooth`

### 4.2 Right panel
3. **Track Selection and Creation**
    - User can select an existing track or create a new one
    - Each track represents an independent analytical intent
4. **Mode Selection**
    - **View Mode**: Toggle between 
	    - **Source** view (playback of original source video)  
	    - **Preview** view (playback of selected track preview)
    - **Edit Mode**: author intent
        - Enable keyframe creation and segment editing
5. **Manual Keyframe Creation**
    - User navigates to a time and clicks **Add Manual KF**
    - A keyframe is inserted using the current viewport
    - User may define the transition to the next keyframe  
6. **Automatic Keyframe Capture**
    - When enabled, the system automatically captures keyframes during:
        - Start and end of PTZ gestures
        - Bounding box creation    
    - User can disable auto-capture for fully manual control    
7.  **Export Ranges**
    - User may select one or more time ranges within a track
    - Each range is exported as an individual MP4 file
    - Future option: merge multiple ranges into a single output
        
8. **Export Execution**
	- Export submits a background job
	- Jobs run asynchronously and do not block the UI
	- Users can monitor progress and download outputs via **Jobs**

### 4.3 Timeline bar
Timeline bar shows the video timeline, keyframes and segments.
9.  **Keyframe Inspection**
    - Clicking a keyframe opens a dialog showing:
        - Time (`t`)
        - Viewport position and size (`x, y, w, h`)
10. **Segment Inspection**
    - Clicking a segment opens a dialog showing:
        - Transition type (`cut` or `smooth`)
        - System derived camera operations (e.g., pan right, zoom 2x)
    - Derived operations are informational and non editable

## 5. Supporting Information
- **Video Info**
    - Displays metadata such as resolution and available stream and download URLs
- **Jobs**
    - Lists submitted export jobs
    - Shows progress, completion status, and download links
Note: All user interactions are **auto-saved**; there is no explicit Save action