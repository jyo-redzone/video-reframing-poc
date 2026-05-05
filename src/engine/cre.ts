import type { CREOutput, Keyframe, Segment, SourceRect, VideoBounds } from '../types/index.ts';

/**
 * Snap a continuous time value to the nearest frame boundary.
 *
 *   frameIndex = floor(time * fps)
 *   frameTime  = frameIndex / fps
 */
export function snapToFrame(time: number, fps: number): number {
  const frameIndex = Math.floor(time * fps);
  return frameIndex / fps;
}

/**
 * Clamp a resolved SourceRect so it stays within the video bounds.
 *
 *   w in [1, W], h in [1, H]
 *   x in [0, W - w], y in [0, H - h]
 */
function clampRect(rect: SourceRect, bounds: VideoBounds): SourceRect {
  const w = Math.min(Math.max(rect.width, 1), bounds.width);
  const h = Math.min(Math.max(rect.height, 1), bounds.height);
  const x = Math.min(Math.max(rect.x, 0), bounds.width - w);
  const y = Math.min(Math.max(rect.y, 0), bounds.height - h);
  return { x, y, width: w, height: h };
}

/**
 * Linearly interpolate between two SourceRects at normalised time alpha.
 */
function lerp(a: SourceRect, b: SourceRect, alpha: number): SourceRect {
  return {
    x: a.x + alpha * (b.x - a.x),
    y: a.y + alpha * (b.y - a.y),
    width: a.width + alpha * (b.width - a.width),
    height: a.height + alpha * (b.height - a.height),
  };
}

/**
 * Resolve the camera rectangle at a given time.
 *
 * The keyframes array must already be sorted by time (caller's responsibility).
 *
 * Rules:
 *  - Time is snapped to frame boundaries first.
 *  - Before the first keyframe -> hold first keyframe's rect.
 *  - After the last keyframe  -> hold last keyframe's rect.
 *  - Exactly on a keyframe    -> return that keyframe's rect.
 *  - Between two keyframes:
 *      smooth -> linear interpolation per component
 *      cut    -> start KF's rect for t < t2, end KF's rect for t >= t2
 *  - Result is clamped to bounds.
 */
export function resolve(
  time: number,
  keyframes: Keyframe[],
  bounds: VideoBounds,
  fps: number,
): CREOutput {
  const frameTime = snapToFrame(time, fps);

  if (keyframes.length === 0) {
    return {
      frameTime,
      sourceRect: { x: 0, y: 0, width: bounds.width, height: bounds.height },
    };
  }

  // Before first keyframe — hold
  if (frameTime <= keyframes[0].time) {
    return {
      frameTime,
      sourceRect: clampRect(keyframes[0].sourceRect, bounds),
    };
  }

  // After last keyframe — hold
  const last = keyframes[keyframes.length - 1];
  if (frameTime >= last.time) {
    return {
      frameTime,
      sourceRect: clampRect(last.sourceRect, bounds),
    };
  }

  // Find surrounding keyframes
  // The list is small so a linear scan is fine.
  let startIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i + 1].time > frameTime) {
      startIdx = i;
      break;
    }
  }

  const kf1 = keyframes[startIdx];
  const kf2 = keyframes[startIdx + 1];

  // Exactly on kf1 (already covered by the <= check above for the first KF)
  if (frameTime === kf1.time) {
    return {
      frameTime,
      sourceRect: clampRect(kf1.sourceRect, bounds),
    };
  }

  const transition = kf1.transitionToNext ?? 'smooth';

  if (transition === 'cut') {
    // Cut: hold kf1 for t < t2, snap to kf2 at t >= t2
    const rect = frameTime >= kf2.time ? kf2.sourceRect : kf1.sourceRect;
    return {
      frameTime,
      sourceRect: clampRect(rect, bounds),
    };
  }

  // Smooth (linear interpolation)
  const alpha = (frameTime - kf1.time) / (kf2.time - kf1.time);
  const interpolated = lerp(kf1.sourceRect, kf2.sourceRect, alpha);

  return {
    frameTime,
    sourceRect: clampRect(interpolated, bounds),
  };
}

/**
 * Derive segments from consecutive keyframe pairs.
 *
 * Each segment spans [kf_i, kf_{i+1}] and carries the transition type
 * and a derived intent string.
 */
export function deriveSegments(keyframes: Keyframe[]): Segment[] {
  const segments: Segment[] = [];

  for (let i = 0; i < keyframes.length - 1; i++) {
    const start = keyframes[i];
    const end = keyframes[i + 1];
    const transition = start.transitionToNext ?? 'smooth';

    segments.push({
      startKeyframe: start,
      endKeyframe: end,
      startTime: start.time,
      endTime: end.time,
      transition,
    });
  }

  return segments;
}
