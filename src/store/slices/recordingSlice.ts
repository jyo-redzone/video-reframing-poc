import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export type RecordingSlice = {
  recordingState: 'idle' | 'recording' | 'paused';
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
};

export const createRecordingSlice: StateCreator<AppStore, [], [], RecordingSlice> = (set, get) => ({
  recordingState: 'idle',

  startRecording: () => {
    const { recordingState, viewportRect, currentTime } = get();
    if (recordingState !== 'idle' || viewportRect === null) return;
    set({ recordingState: 'recording' });
    get().commitKeyframeAtTime(currentTime, viewportRect);
  },

  pauseRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'recording') return;
    set({ recordingState: 'paused' });
  },

  resumeRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'paused') return;
    set({ recordingState: 'recording' });
  },

  stopRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'recording' && recordingState !== 'paused') return;
    set({ recordingState: 'idle' });
  },
});
