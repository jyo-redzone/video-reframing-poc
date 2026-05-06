import { describe, it, expect, beforeEach } from 'vitest';
import useAppStore from '../useAppStore';

describe('useAppStore – help panel', () => {
  beforeEach(() => {
    useAppStore.setState({ helpPanelOpen: false });
  });

  it('starts closed', () => {
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
  });

  it('toggleHelpPanel opens the panel', () => {
    useAppStore.getState().toggleHelpPanel();
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
  });

  it('toggleHelpPanel closes an open panel', () => {
    useAppStore.setState({ helpPanelOpen: true });
    useAppStore.getState().toggleHelpPanel();
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
  });

  it('setHelpPanelOpen(true) opens the panel', () => {
    useAppStore.getState().setHelpPanelOpen(true);
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
  });

  it('setHelpPanelOpen(false) closes the panel', () => {
    useAppStore.setState({ helpPanelOpen: true });
    useAppStore.getState().setHelpPanelOpen(false);
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
  });
});
