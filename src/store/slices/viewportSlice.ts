import type { StateCreator } from 'zustand';
import type { SourceRect } from '../../types';
import type { AppStore } from '../useAppStore';

export type ViewportSlice = {
  viewportRect: SourceRect | null;
  mode: 'edit' | 'view';
  setViewportRect: (rect: SourceRect | null) => void;
  setMode: (mode: 'edit' | 'view') => void;
};

export const createViewportSlice: StateCreator<AppStore, [], [], ViewportSlice> = (set, get) => ({
  viewportRect: null,
  mode: 'edit',

  setViewportRect: (rect) => set({ viewportRect: rect }),

  setMode: (mode) => {
    const { recordingState } = get();
    if (recordingState !== 'idle') {
      window.alert('Stop recording before switching modes');
      return;
    }
    set({ mode });
  },
});
