import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export type PlaybackSlice = {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
};

export const createPlaybackSlice: StateCreator<AppStore, [], [], PlaybackSlice> = (set) => ({
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
});
