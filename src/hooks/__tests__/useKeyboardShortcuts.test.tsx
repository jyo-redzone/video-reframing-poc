import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import useAppStore from '../../store/useAppStore';
import useKeyboardShortcuts from '../useKeyboardShortcuts';

// Minimal harness: mounts the hook in a React component
function Harness() {
  useKeyboardShortcuts();
  return null;
}

function fireKey(key: string, overrides: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...overrides }));
  });
}

describe('useKeyboardShortcuts – ? toggle', () => {
  beforeEach(() => {
    useAppStore.setState({ helpPanelOpen: false, mode: 'edit' });
  });

  afterEach(() => {
    // nothing to clean up — render unmounts automatically
  });

  it('pressing ? opens the help panel', () => {
    const { unmount } = render(<Harness />);
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
    unmount();
  });

  it('pressing ? again closes the help panel', () => {
    const { unmount } = render(<Harness />);
    fireKey('?');
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? in view mode still toggles the panel', () => {
    useAppStore.setState({ mode: 'view' });
    const { unmount } = render(<Harness />);
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
    unmount();
  });

  it('pressing ? while focus is in an INPUT does NOT toggle', () => {
    const { unmount } = render(<Harness />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(false);

    document.body.removeChild(input);
    unmount();
  });

  it('pressing ? with Ctrl held does NOT toggle', () => {
    const { unmount } = render(<Harness />);
    fireKey('?', { ctrlKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? with Meta held does NOT toggle', () => {
    const { unmount } = render(<Harness />);
    fireKey('?', { metaKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? with Alt held does NOT toggle', () => {
    const { unmount } = render(<Harness />);
    fireKey('?', { altKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });
});
