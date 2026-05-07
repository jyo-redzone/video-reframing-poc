import { create } from 'zustand';
import { createVideoSlice, type VideoSlice } from './slices/videoSlice';
import { createTrackSlice, type TrackSlice } from './slices/trackSlice';
import { createPlaybackSlice, type PlaybackSlice } from './slices/playbackSlice';
import { createViewportSlice, type ViewportSlice } from './slices/viewportSlice';
import { createRecordingSlice, type RecordingSlice } from './slices/recordingSlice';
import { createTimelineSlice, type TimelineSlice } from './slices/timelineSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';

export type AppStore =
  & VideoSlice
  & TrackSlice
  & PlaybackSlice
  & ViewportSlice
  & RecordingSlice
  & TimelineSlice
  & UISlice;

const useAppStore = create<AppStore>()((...a) => ({
  ...createVideoSlice(...a),
  ...createTrackSlice(...a),
  ...createPlaybackSlice(...a),
  ...createViewportSlice(...a),
  ...createRecordingSlice(...a),
  ...createTimelineSlice(...a),
  ...createUISlice(...a),
}));

export default useAppStore;
