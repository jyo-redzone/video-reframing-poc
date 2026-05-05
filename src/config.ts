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
