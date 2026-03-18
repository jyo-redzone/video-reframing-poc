import { createContext, useContext } from 'react';
import type React from 'react';

const VideoRefContext = createContext<React.RefObject<HTMLVideoElement> | null>(null);

export const VideoRefProvider = VideoRefContext.Provider;

export function useVideoRef(): React.RefObject<HTMLVideoElement> {
  const ref = useContext(VideoRefContext);
  if (!ref) {
    throw new Error('useVideoRef must be used within a VideoRefProvider');
  }
  return ref;
}
