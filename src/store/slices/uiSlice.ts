import type { StateCreator } from 'zustand';
import type { AppStore } from '../useAppStore';

export type UISlice = {
  helpPanelOpen: boolean;
  toggleHelpPanel: () => void;
  setHelpPanelOpen: (open: boolean) => void;
};

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  helpPanelOpen: false,

  toggleHelpPanel: () => set((state) => ({ helpPanelOpen: !state.helpPanelOpen })),
  setHelpPanelOpen: (open) => set({ helpPanelOpen: open }),
});
