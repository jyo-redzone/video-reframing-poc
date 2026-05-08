// Recording
export const RECORDING_SAMPLE_HZ = 4; // sampler rate while recording + playing

// Keyframe time resolution
export const KEYFRAME_TIME_EPSILON_FRAMES = 0.5; // epsilon = FRAMES / fps
export const KEYFRAME_TIME_EPSILON_FALLBACK_S = 0.02; // when videoMetadata is null

/**
 * Returns the keyframe time epsilon in seconds.
 * When fps is a finite positive number, returns KEYFRAME_TIME_EPSILON_FRAMES / fps.
 * Otherwise returns KEYFRAME_TIME_EPSILON_FALLBACK_S.
 */
export function keyframeTimeEpsilon(fps: number | null | undefined): number {
  if (fps != null && Number.isFinite(fps) && fps > 0) {
    return KEYFRAME_TIME_EPSILON_FRAMES / fps;
  }
  return KEYFRAME_TIME_EPSILON_FALLBACK_S;
}

// Playback speeds (merged from constants.ts)
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 4, 8, 16] as const;

// Timeline layout (SVG viewBox is 0 0 1000 75)
export const TL_X0 = 40;           // left edge of timeline track area
export const TL_X1 = 960;          // right edge of timeline track area
export const TL_Y = 35;            // vertical center of the timeline axis
export const TIMELINE_ZOOM_MIN = 1;
export const TIMELINE_ZOOM_MAX = 256;
export const TIMELINE_SCROLL_FACTOR = 1 / 300; // wheel delta → time shift ratio
export const TIMELINE_POPOVER_WIDTH = 200;      // transition picker popover width (px)

// Viewport framing box
export const VIEWPORT_MIN_SIZE_RATIO = 0.1;     // min W or H as fraction of video dimension
export const VIEWPORT_WHEEL_ZOOM_IN = 0.9;      // scale factor when scrolling to zoom in
export const VIEWPORT_WHEEL_ZOOM_OUT = 1.1;     // scale factor when scrolling to zoom out
export const VIEWPORT_WHEEL_DEBOUNCE_MS = 250;  // ms after last wheel event to clear wheelActive
