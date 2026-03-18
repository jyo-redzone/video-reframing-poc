import type { SourceRect } from '../types';

/** Source pixel coords -> CSS percentage position within the video container */
export function sourceToPercent(
  rect: SourceRect,
  videoWidth: number,
  videoHeight: number,
) {
  return {
    left: (rect.x / videoWidth) * 100,
    top: (rect.y / videoHeight) * 100,
    width: (rect.width / videoWidth) * 100,
    height: (rect.height / videoHeight) * 100,
  };
}

/** CSS pixel position within the video container -> source pixel coords */
export function containerToSource(
  containerRect: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): SourceRect {
  return {
    x: (containerRect.x / containerWidth) * videoWidth,
    y: (containerRect.y / containerHeight) * videoHeight,
    width: (containerRect.width / containerWidth) * videoWidth,
    height: (containerRect.height / containerHeight) * videoHeight,
  };
}
