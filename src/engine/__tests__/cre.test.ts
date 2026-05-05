import { describe, it, expect } from 'vitest';
import { snapToFrame, resolve, deriveSegments } from '../cre.ts';
import type { Keyframe, VideoBounds, SourceRect } from '../../types/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FPS = 29.97;

const bounds: VideoBounds = { width: 3840, height: 2160 };

function kf(
  time: number,
  rect: SourceRect,
  transitionToNext: 'smooth' | 'cut' | null = null,
): Keyframe {
  return {
    id: `kf-${time}`,
    trackId: 'track-1',
    time,
    sourceRect: rect,
    transitionToNext,
  };
}

/**
 * Return a frame-aligned time at 29.97 fps for a given frame index.
 * This avoids floating-point mismatches in tests that need exact keyframe hits.
 */
function frameTime(frameIndex: number): number {
  return frameIndex / FPS;
}

// ---------------------------------------------------------------------------
// snapToFrame
// ---------------------------------------------------------------------------

describe('snapToFrame', () => {
  it('snaps to frame boundary at 29.97 fps', () => {
    // frameIndex = floor(1.0 * 29.97) = 29
    // frameTime  = 29 / 29.97
    const result = snapToFrame(1.0, FPS);
    expect(result).toBeCloseTo(29 / 29.97, 10);
  });

  it('returns 0 for time 0', () => {
    expect(snapToFrame(0, FPS)).toBe(0);
  });

  it('snaps a mid-frame time down to the frame boundary', () => {
    // At 29.97fps, frame 1 starts at 1/29.97 ≈ 0.03337
    // A time slightly past that should still snap to frame 1
    const result = snapToFrame(0.04, FPS);
    expect(result).toBeCloseTo(1 / 29.97, 10);
  });
});

// ---------------------------------------------------------------------------
// resolve — linear interpolation
// ---------------------------------------------------------------------------

describe('resolve — linear interpolation', () => {
  // Use frame-aligned keyframe times so that resolve hits them exactly.
  const t1 = frameTime(300); // frame 300
  const t2 = frameTime(420); // frame 420
  const tMid = frameTime(360); // frame 360 — exactly halfway

  const rect1: SourceRect = { x: 100, y: 200, width: 1920, height: 1080 };
  const rect2: SourceRect = { x: 300, y: 400, width: 960, height: 540 };
  const kf1 = kf(t1, rect1, 'smooth');
  const kf2 = kf(t2, rect2, null);
  const keyframes = [kf1, kf2];

  it('returns start rect at alpha = 0 (exactly on first keyframe)', () => {
    const out = resolve(t1, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect1);
  });

  it('returns end rect at alpha = 1 (exactly on last keyframe)', () => {
    const out = resolve(t2, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect2);
  });

  it('interpolates at alpha = 0.5', () => {
    const out = resolve(tMid, keyframes, bounds, FPS);
    expect(out.sourceRect.x).toBeCloseTo(200, 5);
    expect(out.sourceRect.y).toBeCloseTo(300, 5);
    expect(out.sourceRect.width).toBeCloseTo(1440, 5);
    expect(out.sourceRect.height).toBeCloseTo(810, 5);
  });
});

// ---------------------------------------------------------------------------
// resolve — cut transition
// ---------------------------------------------------------------------------

describe('resolve — cut transition', () => {
  const t1 = frameTime(300);
  const t2 = frameTime(420);
  const tBetween = frameTime(360);

  const rect1: SourceRect = { x: 100, y: 200, width: 1920, height: 1080 };
  const rect2: SourceRect = { x: 500, y: 600, width: 960, height: 540 };
  const kf1 = kf(t1, rect1, 'cut');
  const kf2 = kf(t2, rect2, null);
  const keyframes = [kf1, kf2];

  it('holds start rect before t2', () => {
    const out = resolve(tBetween, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect1);
  });

  it('snaps to end rect at t2', () => {
    const out = resolve(t2, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect2);
  });
});

// ---------------------------------------------------------------------------
// resolve — hold before first / after last keyframe
// ---------------------------------------------------------------------------

describe('resolve — hold before first / after last', () => {
  const t1 = frameTime(150);
  const t2 = frameTime(300);

  const rect1: SourceRect = { x: 100, y: 200, width: 1920, height: 1080 };
  const rect2: SourceRect = { x: 300, y: 400, width: 960, height: 540 };
  const kf1 = kf(t1, rect1, 'smooth');
  const kf2 = kf(t2, rect2, null);
  const keyframes = [kf1, kf2];

  it('holds first keyframe before its time', () => {
    const out = resolve(0, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect1);
  });

  it('holds last keyframe after its time', () => {
    const out = resolve(20, keyframes, bounds, FPS);
    expect(out.sourceRect).toEqual(rect2);
  });
});

// ---------------------------------------------------------------------------
// resolve — clamping
// ---------------------------------------------------------------------------

describe('resolve — clamping to bounds', () => {
  it('clamps x/y so rect stays within bounds', () => {
    const kfOverflow = kf(0, { x: 3800, y: 2100, width: 100, height: 100 }, null);
    const out = resolve(0, [kfOverflow], bounds, FPS);
    // x must be <= 3840 - 100 = 3740, y must be <= 2160 - 100 = 2060
    expect(out.sourceRect.x).toBe(3740);
    expect(out.sourceRect.y).toBe(2060);
  });

  it('clamps width/height to at least 1', () => {
    const kfTiny = kf(0, { x: 0, y: 0, width: 0, height: -5 }, null);
    const out = resolve(0, [kfTiny], bounds, FPS);
    expect(out.sourceRect.width).toBe(1);
    expect(out.sourceRect.height).toBe(1);
  });

  it('clamps width/height to at most video dimensions', () => {
    const kfHuge = kf(0, { x: 0, y: 0, width: 5000, height: 5000 }, null);
    const out = resolve(0, [kfHuge], bounds, FPS);
    expect(out.sourceRect.width).toBe(3840);
    expect(out.sourceRect.height).toBe(2160);
  });

  it('clamps interpolated rect that drifts out of bounds', () => {
    // Two keyframes whose midpoint would put x beyond W - w
    const t1 = frameTime(0);
    const t2 = frameTime(60);
    const tMid = frameTime(30);
    const kfA = kf(t1, { x: 3600, y: 0, width: 500, height: 500 }, 'smooth');
    const kfB = kf(t2, { x: 3700, y: 0, width: 500, height: 500 }, null);
    const out = resolve(tMid, [kfA, kfB], bounds, FPS);
    // Interpolated x ≈ 3650, max x = 3840 - 500 = 3340 → clamped
    expect(out.sourceRect.x).toBe(3340);
  });
});

// ---------------------------------------------------------------------------
// resolve — edge cases
// ---------------------------------------------------------------------------

describe('resolve — edge cases', () => {
  it('returns full-frame rect when keyframes array is empty', () => {
    const out = resolve(5, [], bounds, FPS);
    expect(out.sourceRect).toEqual({ x: 0, y: 0, width: 3840, height: 2160 });
  });

  it('handles a single keyframe', () => {
    const single = kf(frameTime(100), { x: 50, y: 60, width: 800, height: 600 }, null);
    const before = resolve(0, [single], bounds, FPS);
    const after = resolve(100, [single], bounds, FPS);
    expect(before.sourceRect).toEqual(single.sourceRect);
    expect(after.sourceRect).toEqual(single.sourceRect);
  });
});

// ---------------------------------------------------------------------------
// deriveSegments
// ---------------------------------------------------------------------------

describe('deriveSegments', () => {
  it('produces one segment per consecutive pair', () => {
    const keyframes = [
      kf(0, { x: 0, y: 0, width: 1920, height: 1080 }, 'smooth'),
      kf(5, { x: 100, y: 0, width: 1920, height: 1080 }, 'cut'),
      kf(10, { x: 200, y: 0, width: 960, height: 540 }, null),
    ];
    const segments = deriveSegments(keyframes);
    expect(segments).toHaveLength(2);

    expect(segments[0].startTime).toBe(0);
    expect(segments[0].endTime).toBe(5);
    expect(segments[0].transition).toBe('smooth');

    expect(segments[1].startTime).toBe(5);
    expect(segments[1].endTime).toBe(10);
    expect(segments[1].transition).toBe('cut');
  });

  it('returns empty array for single keyframe', () => {
    const keyframes = [kf(0, { x: 0, y: 0, width: 1920, height: 1080 }, null)];
    expect(deriveSegments(keyframes)).toEqual([]);
  });

  it('returns empty array for no keyframes', () => {
    expect(deriveSegments([])).toEqual([]);
  });
});
