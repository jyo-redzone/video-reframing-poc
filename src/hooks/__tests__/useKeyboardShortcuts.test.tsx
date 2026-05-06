import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, act } from '@testing-library/react';
import useAppStore from '../../store/useAppStore';
import useKeyboardShortcuts from '../useKeyboardShortcuts';
import { VideoRefProvider } from '../../components/VideoRefContext';
import { SPEED_OPTIONS } from '../../constants';

// Harness: renders the hook inside a VideoRefProvider.
// useVideoRef is called at hook level so the provider must wrap the component.
function HarnessWithProvider({ videoRef }: { videoRef?: React.RefObject<HTMLVideoElement> }) {
  const defaultRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? defaultRef;
  function Inner() {
    useKeyboardShortcuts();
    return null;
  }
  return <VideoRefProvider value={ref}><Inner /></VideoRefProvider>;
}

function fireKey(key: string, overrides: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...overrides }));
  });
}

function fireCode(code: string, key: string, overrides: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, ...overrides }));
  });
}

// ── ? toggle ──────────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts – ? toggle', () => {
  beforeEach(() => {
    useAppStore.setState({ helpPanelOpen: false, mode: 'edit' });
  });

  it('pressing ? opens the help panel', () => {
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
    unmount();
  });

  it('pressing ? again closes the help panel', () => {
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?');
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? in view mode still toggles the panel', () => {
    useAppStore.setState({ mode: 'view' });
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(true);
    unmount();
  });

  it('pressing ? while focus is in an INPUT does NOT toggle', () => {
    const { unmount } = render(<HarnessWithProvider />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireKey('?');
    expect(useAppStore.getState().helpPanelOpen).toBe(false);

    document.body.removeChild(input);
    unmount();
  });

  it('pressing ? with Ctrl held does NOT toggle', () => {
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?', { ctrlKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? with Meta held does NOT toggle', () => {
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?', { metaKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });

  it('pressing ? with Alt held does NOT toggle', () => {
    const { unmount } = render(<HarnessWithProvider />);
    fireKey('?', { altKey: true });
    expect(useAppStore.getState().helpPanelOpen).toBe(false);
    unmount();
  });
});

// ── Space — play/pause ────────────────────────────────────────────────────────

describe('useKeyboardShortcuts – Space play/pause', () => {
  let mockVideo: Partial<HTMLVideoElement>;

  beforeEach(() => {
    mockVideo = {
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
    };
    useAppStore.setState({ isPlaying: false, mode: 'edit' });
  });

  it('Space while paused calls video.play() and sets isPlaying=true', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(
      <VideoRefProvider value={ref}>
        <SpaceHarness />
      </VideoRefProvider>
    );
    fireCode('Space', ' ');
    expect(mockVideo.play).toHaveBeenCalled();
    expect(useAppStore.getState().isPlaying).toBe(true);
    unmount();
  });

  it('Space while playing calls video.pause() and sets isPlaying=false', () => {
    useAppStore.setState({ isPlaying: true });
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(
      <VideoRefProvider value={ref}>
        <SpaceHarness />
      </VideoRefProvider>
    );
    fireCode('Space', ' ');
    expect(mockVideo.pause).toHaveBeenCalled();
    expect(useAppStore.getState().isPlaying).toBe(false);
    unmount();
  });

  it('Space works in view mode too', () => {
    useAppStore.setState({ mode: 'view' });
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(
      <VideoRefProvider value={ref}>
        <SpaceHarness />
      </VideoRefProvider>
    );
    fireCode('Space', ' ');
    expect(mockVideo.play).toHaveBeenCalled();
    unmount();
  });

  it('Space with Ctrl held does NOT toggle', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(
      <VideoRefProvider value={ref}>
        <SpaceHarness />
      </VideoRefProvider>
    );
    fireCode('Space', ' ', { ctrlKey: true });
    expect(mockVideo.play).not.toHaveBeenCalled();
    unmount();
  });

  function SpaceHarness() {
    useKeyboardShortcuts();
    return null;
  }
});

// ── , / . — frame step ────────────────────────────────────────────────────────

describe('useKeyboardShortcuts – frame step', () => {
  let mockVideo: Partial<HTMLVideoElement>;

  beforeEach(() => {
    mockVideo = {
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      currentTime: 2.0,
      duration: 60,
    };
    useAppStore.setState({
      isPlaying: false,
      mode: 'edit',
      videoMetadata: { id: 'v', name: 'test.mp4', width: 1920, height: 1080, fps: 30, duration: 60, url: '' },
    });
  });

  it(', steps back one frame', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    expect(mockVideo.currentTime).toBeCloseTo(2.0 - 1 / 30, 5);
    unmount();
  });

  it('. steps forward one frame', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('.');
    expect(mockVideo.currentTime).toBeCloseTo(2.0 + 1 / 30, 5);
    unmount();
  });

  it(', is a no-op when videoMetadata is null', () => {
    useAppStore.setState({ videoMetadata: null });
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    expect(mockVideo.currentTime).toBe(2.0); // unchanged
    unmount();
  });

  it('Shift+, does NOT trigger frame step', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Comma', ',', { shiftKey: true });
    expect(mockVideo.currentTime).toBe(2.0); // unchanged — speed changed, not frame stepped
    unmount();
  });
});

// ── Shift+, / Shift+. — speed cycle ──────────────────────────────────────────

describe('useKeyboardShortcuts – speed cycle', () => {
  let mockVideo: Partial<HTMLVideoElement>;

  beforeEach(() => {
    mockVideo = { playbackRate: 1 };
    useAppStore.setState({ playbackRate: 1, mode: 'edit' });
  });

  it('Shift+. cycles speed up from 1 to 1.5', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Period', '.', { shiftKey: true });
    expect(useAppStore.getState().playbackRate).toBe(1.5);
    expect(mockVideo.playbackRate).toBe(1.5);
    unmount();
  });

  it('Shift+, cycles speed down from 1 to 0.5', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Comma', ',', { shiftKey: true });
    expect(useAppStore.getState().playbackRate).toBe(0.5);
    expect(mockVideo.playbackRate).toBe(0.5);
    unmount();
  });

  it('Shift+, clamps at minimum (0.5)', () => {
    useAppStore.setState({ playbackRate: 0.5 });
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Comma', ',', { shiftKey: true });
    expect(useAppStore.getState().playbackRate).toBe(SPEED_OPTIONS[0]);
    unmount();
  });

  it('Shift+. clamps at maximum (16)', () => {
    useAppStore.setState({ playbackRate: 16 });
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Period', '.', { shiftKey: true });
    expect(useAppStore.getState().playbackRate).toBe(SPEED_OPTIONS[SPEED_OPTIONS.length - 1]);
    unmount();
  });

  it('Shift+. works in view mode too', () => {
    useAppStore.setState({ mode: 'view', playbackRate: 1 });
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Period', '.', { shiftKey: true });
    expect(useAppStore.getState().playbackRate).toBe(1.5);
    unmount();
  });
});

// ── = / - / 0 — timeline zoom ────────────────────────────────────────────────

describe('useKeyboardShortcuts – timeline zoom', () => {
  beforeEach(() => {
    useAppStore.setState({
      timelineZoom: 1,
      timelineZoomOffset: 0,
      mode: 'edit',
      currentTime: 0,
      videoMetadata: { id: 'v', name: 'test.mp4', width: 1920, height: 1080, fps: 30, duration: 60, url: '' },
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }

  it('= doubles zoom from 1 to 2', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('=');
    expect(useAppStore.getState().timelineZoom).toBe(2);
    unmount();
  });

  it('- halves zoom from 2 to 1', () => {
    useAppStore.setState({ timelineZoom: 2 });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('-');
    expect(useAppStore.getState().timelineZoom).toBe(1);
    unmount();
  });

  it('= clamps at 256', () => {
    useAppStore.setState({ timelineZoom: 256 });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('=');
    expect(useAppStore.getState().timelineZoom).toBe(256);
    unmount();
  });

  it('- clamps at 1', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('-');
    expect(useAppStore.getState().timelineZoom).toBe(1);
    unmount();
  });

  it('0 resets zoom and offset', () => {
    useAppStore.setState({ timelineZoom: 8, timelineZoomOffset: 15 });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('0');
    expect(useAppStore.getState().timelineZoom).toBe(1);
    expect(useAppStore.getState().timelineZoomOffset).toBe(0);
    unmount();
  });

  it('= works in view mode too', () => {
    useAppStore.setState({ mode: 'view' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('=');
    expect(useAppStore.getState().timelineZoom).toBe(2);
    unmount();
  });
});

// ── Home / End — seek to clip bounds ─────────────────────────────────────────

describe('useKeyboardShortcuts – Home/End seek', () => {
  let mockVideo: Partial<HTMLVideoElement>;

  beforeEach(() => {
    mockVideo = { currentTime: 5 };
    useAppStore.setState({
      mode: 'edit',
      currentTime: 5,
      tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 3, outTime: 45 }, isDirty: false }],
      activeTrackId: 'track_default',
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }

  it('Home seeks to inTime', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Home', 'Home');
    expect(mockVideo.currentTime).toBe(3);
    expect(useAppStore.getState().currentTime).toBe(3);
    unmount();
  });

  it('End seeks to outTime', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('End', 'End');
    expect(mockVideo.currentTime).toBe(45);
    expect(useAppStore.getState().currentTime).toBe(45);
    unmount();
  });

  it('Home is a no-op when activeTrackId is empty', () => {
    useAppStore.setState({ activeTrackId: '' });
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Home', 'Home');
    expect(mockVideo.currentTime).toBe(5); // unchanged
    unmount();
  });

  it('Home works in view mode', () => {
    useAppStore.setState({ mode: 'view' });
    const ref = { current: mockVideo as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Home', 'Home');
    expect(mockVideo.currentTime).toBe(3);
    unmount();
  });
});

// ── R — record toggle ─────────────────────────────────────────────────────────

describe('useKeyboardShortcuts – record toggle (R)', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      recordingState: 'idle',
      activeTrackId: 'track_default',
      viewportRect: { x: 0, y: 0, width: 100, height: 100 },
      currentTime: 0,
      tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 60 }, isDirty: false }],
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }

  it('R when idle starts recording', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('r');
    expect(useAppStore.getState().recordingState).toBe('recording');
    unmount();
  });

  it('R when recording pauses', () => {
    useAppStore.setState({ recordingState: 'recording' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('r');
    expect(useAppStore.getState().recordingState).toBe('paused');
    unmount();
  });

  it('R when paused resumes', () => {
    useAppStore.setState({ recordingState: 'paused' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('r');
    expect(useAppStore.getState().recordingState).toBe('recording');
    unmount();
  });

  it('R is a no-op when activeTrackId is empty', () => {
    useAppStore.setState({ activeTrackId: '' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('r');
    expect(useAppStore.getState().recordingState).toBe('idle');
    unmount();
  });

  it('R is a no-op in view mode', () => {
    useAppStore.setState({ mode: 'view' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('r');
    expect(useAppStore.getState().recordingState).toBe('idle');
    unmount();
  });

  it('Shift+R stops recording from recording state', () => {
    useAppStore.setState({ recordingState: 'recording' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('KeyR', 'R', { shiftKey: true });
    expect(useAppStore.getState().recordingState).toBe('idle');
    unmount();
  });

  it('Shift+R stops recording from paused state', () => {
    useAppStore.setState({ recordingState: 'paused' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('KeyR', 'R', { shiftKey: true });
    expect(useAppStore.getState().recordingState).toBe('idle');
    unmount();
  });

  it('Shift+R is a no-op in view mode', () => {
    useAppStore.setState({ mode: 'view', recordingState: 'recording' });
    const ref = { current: null as unknown as HTMLVideoElement };
    // stopRecording is blocked by mode guard before the Shift+R branch in edit-mode section
    // Actually Shift+R is inside the edit-mode gate, so it should be no-op in view mode
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('KeyR', 'R', { shiftKey: true });
    expect(useAppStore.getState().recordingState).toBe('recording');
    unmount();
  });
});

// ── I / O — in/out point ──────────────────────────────────────────────────────

describe('useKeyboardShortcuts – I/O in/out points', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      currentTime: 10,
      tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 60 }, isDirty: false }],
      activeTrackId: 'track_default',
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }

  it('I sets in-point at current time', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('i');
    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBe(10);
    expect(track.range.outTime).toBe(60);
    unmount();
  });

  it('O sets out-point at current time', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('o');
    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBe(0);
    expect(track.range.outTime).toBe(10);
    unmount();
  });

  it('I is a no-op in view mode', () => {
    useAppStore.setState({ mode: 'view' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('i');
    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBe(0); // unchanged
    unmount();
  });

  it('O is a no-op when no active track', () => {
    useAppStore.setState({ activeTrackId: '' });
    const ref = { current: null as unknown as HTMLVideoElement };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('o');
    // No crash; no change (no active track to update)
    expect(useAppStore.getState().tracks[0].range.outTime).toBe(60);
    unmount();
  });
});

// ── store: playbackRate / timelineZoom / timelineZoomOffset ───────────────────

describe('useAppStore – new store fields', () => {
  beforeEach(() => {
    useAppStore.setState({ playbackRate: 1, timelineZoom: 1, timelineZoomOffset: 0 });
  });

  it('setPlaybackRate updates playbackRate', () => {
    useAppStore.getState().setPlaybackRate(2);
    expect(useAppStore.getState().playbackRate).toBe(2);
  });

  it('setTimelineZoom clamps to [1, 256]', () => {
    useAppStore.getState().setTimelineZoom(0);
    expect(useAppStore.getState().timelineZoom).toBe(1);
    useAppStore.getState().setTimelineZoom(512);
    expect(useAppStore.getState().timelineZoom).toBe(256);
    useAppStore.getState().setTimelineZoom(4);
    expect(useAppStore.getState().timelineZoom).toBe(4);
  });

  it('setTimelineZoomOffset updates offset', () => {
    useAppStore.getState().setTimelineZoomOffset(15.5);
    expect(useAppStore.getState().timelineZoomOffset).toBe(15.5);
  });

  it('resetTimelineZoom resets zoom to 1 and offset to 0', () => {
    useAppStore.setState({ timelineZoom: 8, timelineZoomOffset: 20 });
    useAppStore.getState().resetTimelineZoom();
    expect(useAppStore.getState().timelineZoom).toBe(1);
    expect(useAppStore.getState().timelineZoomOffset).toBe(0);
  });
});
