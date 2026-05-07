import type { StateCreator } from 'zustand';
import type { VideoMetadata } from '../../types';
import type { AppStore } from '../useAppStore';

export type VideoSlice = {
  videoUrl: string | null;
  videoMetadata: VideoMetadata | null;
  setVideoUrl: (url: string) => void;
  setVideoMetadata: (meta: VideoMetadata) => void;
};

export const createVideoSlice: StateCreator<AppStore, [], [], VideoSlice> = (set) => ({
  videoUrl: null,
  videoMetadata: null,

  setVideoUrl: (url) => set({ videoUrl: url }),

  setVideoMetadata: (meta) =>
    set((state) => {
      const activeTrack = state.tracks.find((t) => t.id === state.activeTrackId);
      const rangeIsUnset =
        activeTrack?.range.inTime === 0 && activeTrack?.range.outTime === 0;

      if (!rangeIsUnset) {
        return { videoMetadata: meta };
      }

      return {
        videoMetadata: meta,
        tracks: state.tracks.map((track) =>
          track.id === state.activeTrackId
            ? { ...track, range: { inTime: 0, outTime: meta.duration } }
            : track,
        ),
      };
    }),
});
