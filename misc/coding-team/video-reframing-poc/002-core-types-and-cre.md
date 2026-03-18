# Task 002: Core Types + Camera Resolution Engine

## Context
The CRE is the mathematical heart of the POC. It resolves a camera rectangle at any time `t` given a set of keyframes. The math spec is in `CRE Maths spec.md` at the project root. The POC only needs **linear interpolation** and **cut** transitions (no Catmull-Rom/natural smooth).

## Objective
Create TypeScript type definitions for all data models and implement the Camera Resolution Engine as a pure-function module with Vitest unit tests.

## Scope

### Types (`src/types/index.ts`)

```ts
SourceRect { x: number; y: number; width: number; height: number }

Keyframe {
  id: string
  trackId: string
  time: number                          // seconds
  sourceRect: SourceRect
  transitionToNext: 'smooth' | 'cut' | null  // null = last keyframe
}

Track {
  id: string
  videoId: string
  name: string
  keyframes: Keyframe[]                 // kept sorted by time
}

Segment {
  startKeyframe: Keyframe
  endKeyframe: Keyframe
  startTime: number
  endTime: number
  transition: 'smooth' | 'cut'
  derivedIntent: string
}

VideoMetadata {
  id: string
  name: string
  width: number
  height: number
  fps: number
  duration: number
  url: string
}

VideoBounds { width: number; height: number }

CREOutput {
  frameTime: number
  sourceRect: SourceRect
}
```

### CRE (`src/engine/cre.ts`)

Pure functions, no classes, no state:

1. **`snapToFrame(time: number, fps: number): number`**
   - `frameIndex = floor(time * fps)`, `frameTime = frameIndex / fps`

2. **`resolve(time: number, keyframes: Keyframe[], bounds: VideoBounds, fps: number): CREOutput`**
   - Snap `time` to frame time
   - Find surrounding keyframes (binary search or linear scan — the list is small)
   - If before first KF → return first KF's sourceRect (hold)
   - If after last KF → return last KF's sourceRect (hold)
   - If exactly on a KF → return that KF's sourceRect
   - If between two KFs:
     - **smooth**: linear interpolation per component (x, y, w, h) using α = (t - t₁) / (t₂ - t₁)
     - **cut**: return start KF's sourceRect for t < t₂, end KF's sourceRect for t ≥ t₂
   - Clamp result to bounds: `x ∈ [0, W - w]`, `y ∈ [0, H - h]`, `w ∈ [1, W]`, `h ∈ [1, H]`

3. **`deriveSegments(keyframes: Keyframe[]): Segment[]`**
   - For each consecutive pair, compute segment with derived intent
   - Derived intent: see `deriveIntent` below

4. **`deriveIntent(start: SourceRect, end: SourceRect): string`**
   - Pan: |dx| > 5px → "Pan left" or "Pan right"
   - Tilt: |dy| > 5px → "Tilt up" or "Tilt down"
   - Zoom: width ratio != 1 (±5%) → "Zoom in {ratio}x" or "Zoom out {ratio}x"
   - Combine with " + ". If no motion → "Hold"

### Tests (`src/engine/__tests__/cre.test.ts`)

Cover at minimum:
- `snapToFrame` with 29.97fps
- `resolve` linear interpolation at α = 0, 0.5, 1
- `resolve` cut transition (before and at t₂)
- `resolve` hold before first / after last keyframe
- `resolve` clamping to bounds
- `deriveIntent` cases: pan, tilt, zoom, hold, combined

## Non-Goals
- No Catmull-Rom / natural smooth
- No UI components
- No store integration
- Do not create `resolve` as a class method — keep it as an exported function

## Constraints
- All coordinates are in **source pixel space** (not normalized 0–1)
- FPS for this POC: 29.97
- Keyframes array passed to `resolve` must already be sorted by time (the caller's responsibility; do not re-sort inside resolve)
