import type { StateCreator } from 'zustand';
import { TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX } from '../../config';
import type { AppStore } from '../useAppStore';

export type TimelineSlice = {
  timelineZoom: number;
  timelineZoomOffset: number;
  timelineFollowPaused: boolean;
  setTimelineZoom: (zoom: number) => void;
  setTimelineZoomOffset: (offset: number) => void;
  resetTimelineZoom: () => void;
  setTimelineFollowPaused: (paused: boolean) => void;
};

export const createTimelineSlice: StateCreator<AppStore, [], [], TimelineSlice> = (set) => ({
  timelineZoom: 1,
  timelineZoomOffset: 0,
  timelineFollowPaused: false,

  setTimelineZoom: (zoom) =>
    set({ timelineZoom: Math.max(TIMELINE_ZOOM_MIN, Math.min(TIMELINE_ZOOM_MAX, zoom)) }),
  setTimelineZoomOffset: (offset) => set({ timelineZoomOffset: offset }),
  resetTimelineZoom: () => set({ timelineZoom: 1, timelineZoomOffset: 0 }),
  setTimelineFollowPaused: (paused) => set({ timelineFollowPaused: paused }),
});
