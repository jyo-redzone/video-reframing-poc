# Task 003: Zustand Store

## Context
The app needs centralized state shared across PlayerPanel, TrackPanel, TimelineBar, and dialogs. Zustand v5 is already installed. Types are in `src/types/index.ts`. CRE functions are in `src/engine/cre.ts`.

## Objective
Create a single Zustand store (`useAppStore`) that holds all app state and exposes actions for keyframe CRUD, segment transition changes, mode/view switching, playback control, and video metadata.

## Scope

### Store file: `src/store/useAppStore.ts`

#### State shape

```ts
{
  // Video
  videoMetadata: VideoMetadata | null

  // Track
  tracks: Track[]
  activeTrackId: string

  // Keyframes (authoritative source — stored as a flat sorted array inside the active track)
  // Access via a selector, not duplicated

  // UI mode
  mode: 'edit' | 'view'
  viewType: 'source' | 'preview'   // only relevant when mode === 'view'

  // Playback
  currentTime: number              // seconds
  isPlaying: boolean

  // Viewport (the current viewport rect shown on the overlay — may differ from any keyframe during drag)
  viewportRect: SourceRect | null

  // Dialog state
  selectedKeyframeId: string | null
  selectedSegmentKey: string | null   // format: "kfId1|kfId2"
}
```

#### Actions

```ts
// Video
setVideoMetadata(meta: VideoMetadata): void

// Keyframes
addKeyframe(kf: Keyframe): void          // insert into active track, maintain sort by time
updateKeyframe(id: string, updates: Partial<Pick<Keyframe, 'time' | 'sourceRect' | 'transitionToNext'>>): void
deleteKeyframe(id: string): void
getActiveKeyframes(): Keyframe[]          // selector — returns active track's keyframes sorted by time

// Segments (transition changes)
setTransition(keyframeId: string, transition: 'smooth' | 'cut'): void   // sets transitionToNext on the keyframe

// Mode & view
setMode(mode: 'edit' | 'view'): void
setViewType(viewType: 'source' | 'preview'): void

// Playback
setCurrentTime(time: number): void
setIsPlaying(playing: boolean): void

// Viewport
setViewportRect(rect: SourceRect | null): void

// Dialog
selectKeyframe(id: string | null): void
selectSegment(key: string | null): void
```

#### Initial state

- `videoMetadata`: null (set when `<video>` loads metadata)
- `tracks`: one default track `{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [] }`
- `activeTrackId`: `'track_default'`
- `mode`: `'edit'`
- `viewType`: `'source'`
- `currentTime`: 0
- `isPlaying`: false
- `viewportRect`: null
- `selectedKeyframeId`: null
- `selectedSegmentKey`: null

#### Implementation notes

- Use `create` from `zustand` (not `createStore`)
- `addKeyframe` must keep `track.keyframes` sorted by `time` after insertion
- `updateKeyframe` must re-sort if `time` changed
- `deleteKeyframe` removes from track's keyframes array; if the deleted KF was the last one and the previous KF had `transitionToNext` set, set the new last KF's `transitionToNext` to `null`
- `getActiveKeyframes` is a convenience getter — just returns `tracks.find(t => t.id === activeTrackId)?.keyframes ?? []`
- Generate unique keyframe IDs with a simple counter: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

### Delete `.gitkeep` from `src/store/`

## Non-Goals
- No persistence (localStorage, server, etc.)
- No undo/redo
- No multi-track logic beyond the data model supporting it
- No derived segments in the store — compute them on the fly using `deriveSegments()` from `cre.ts` where needed

## Constraints
- Single store, no slices pattern needed for this size
- Do not use immer middleware — Zustand v5 with vanilla set is fine since the state tree is shallow
- Export the store hook as the default export
