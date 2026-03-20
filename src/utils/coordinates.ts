import type { SourceRect } from '../types';

/**
 * Compute the actual rendered video area within a container when using
 * object-fit: contain. Returns the offset and rendered dimensions in CSS pixels.
 */
export function getVideoRenderArea(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
) {
  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;

  if (videoAspect > containerAspect) {
    // Video wider than container: constrained by width, bars top/bottom
    const renderWidth = containerWidth;
    const renderHeight = containerWidth / videoAspect;
    return {
      offsetX: 0,
      offsetY: (containerHeight - renderHeight) / 2,
      renderWidth,
      renderHeight,
    };
  } else {
    // Video taller than container: constrained by height, bars left/right
    const renderHeight = containerHeight;
    const renderWidth = containerHeight * videoAspect;
    return {
      offsetX: (containerWidth - renderWidth) / 2,
      offsetY: 0,
      renderWidth,
      renderHeight,
    };
  }
}

/** Source pixel coords -> CSS percentage position within the video container */
export function sourceToPercent(
  rect: SourceRect,
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
) {
  const { offsetX, offsetY, renderWidth, renderHeight } = getVideoRenderArea(
    containerWidth, containerHeight, videoWidth, videoHeight,
  );
  return {
    left: (offsetX + (rect.x / videoWidth) * renderWidth) / containerWidth * 100,
    top: (offsetY + (rect.y / videoHeight) * renderHeight) / containerHeight * 100,
    width: (rect.width / videoWidth) * renderWidth / containerWidth * 100,
    height: (rect.height / videoHeight) * renderHeight / containerHeight * 100,
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
  const { offsetX, offsetY, renderWidth, renderHeight } = getVideoRenderArea(
    containerWidth, containerHeight, videoWidth, videoHeight,
  );
  return {
    x: ((containerRect.x - offsetX) / renderWidth) * videoWidth,
    y: ((containerRect.y - offsetY) / renderHeight) * videoHeight,
    width: (containerRect.width / renderWidth) * videoWidth,
    height: (containerRect.height / renderHeight) * videoHeight,
  };
}
