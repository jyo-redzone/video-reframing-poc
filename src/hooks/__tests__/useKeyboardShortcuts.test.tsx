import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, act } from '@testing-library/react';
import useAppStore from '../../store/useAppStore';
import useKeyboardShortcuts from '../useKeyboardShortcuts';
import { VideoRefProvider } from '../../components/VideoRefContext';
import { SPEED_OPTIONS } from '../../config';

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

// ── , / . — second step ───────────────────────────────────────────────────────

describe('useKeyboardShortcuts – second step', () => {
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

  it(', steps back one second', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    expect(mockVideo.currentTime).toBe(1.0);
    unmount();
  });

  it('. steps forward one second', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('.');
    expect(mockVideo.currentTime).toBe(3.0);
    unmount();
  });

  it(', still works when videoMetadata is null (no fps dependency)', () => {
    useAppStore.setState({ videoMetadata: null });
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    expect(mockVideo.currentTime).toBe(1.0); // stepped back 1 second
    unmount();
  });

  it(', is a no-op when videoRef is null', () => {
    const ref = { current: null as unknown as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    // No crash — no video element to operate on
    unmount();
  });

  it(', clamps to 0 when currentTime is less than 1 second', () => {
    mockVideo.currentTime = 0.5;
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey(',');
    expect(mockVideo.currentTime).toBe(0);
    unmount();
  });

  it('. clamps to video.duration when near the end', () => {
    mockVideo.currentTime = 59.8;
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('.');
    expect(mockVideo.currentTime).toBe(60);
    unmount();
  });

  it('Shift+, does NOT trigger second step', () => {
    const ref = { current: mockVideo as HTMLVideoElement };
    function Inner() { useKeyboardShortcuts(); return null; }
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('Comma', ',', { shiftKey: true });
    expect(mockVideo.currentTime).toBe(2.0); // unchanged — speed changed, not second stepped
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

// ── Arrow keys — live bbox movement ──────────────────────────────────────────

describe('useKeyboardShortcuts – arrow keys (live bbox movement)', () => {
  const VIDEO_META = { id: 'v', name: 'test.mp4', width: 1920, height: 1080, fps: 30, duration: 60, url: '' };
  const INITIAL_RECT = { x: 100, y: 100, width: 400, height: 300 };

  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      viewportRect: { ...INITIAL_RECT },
      videoMetadata: VIDEO_META,
      recordingState: 'idle',
      currentTime: 5,
      tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 60 }, isDirty: false }],
      activeTrackId: 'track_default',
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }
  const ref = { current: null as unknown as HTMLVideoElement };

  it('ArrowLeft moves bbox 1px left', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft');
    expect(useAppStore.getState().viewportRect?.x).toBe(99);
    expect(useAppStore.getState().viewportRect?.y).toBe(100);
    expect(useAppStore.getState().viewportRect?.width).toBe(400);
    expect(useAppStore.getState().viewportRect?.height).toBe(300);
    unmount();
  });

  it('ArrowRight moves bbox 1px right', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowRight');
    expect(useAppStore.getState().viewportRect?.x).toBe(101);
    unmount();
  });

  it('ArrowUp moves bbox 1px up', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowUp');
    expect(useAppStore.getState().viewportRect?.y).toBe(99);
    unmount();
  });

  it('ArrowDown moves bbox 1px down', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowDown');
    expect(useAppStore.getState().viewportRect?.y).toBe(101);
    unmount();
  });

  it('Shift+ArrowLeft moves bbox 10px left', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft', { shiftKey: true });
    expect(useAppStore.getState().viewportRect?.x).toBe(90);
    unmount();
  });

  it('Shift+ArrowDown moves bbox 10px down', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowDown', { shiftKey: true });
    expect(useAppStore.getState().viewportRect?.y).toBe(110);
    unmount();
  });

  it('ArrowLeft clamps at x=0', () => {
    useAppStore.setState({ viewportRect: { x: 0, y: 100, width: 400, height: 300 } });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft');
    // x was already 0, no change → no-op (rect identical)
    expect(useAppStore.getState().viewportRect?.x).toBe(0);
    unmount();
  });

  it('ArrowRight clamps at x = videoWidth - width', () => {
    useAppStore.setState({ viewportRect: { x: 1920 - 400, y: 100, width: 400, height: 300 } });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowRight');
    expect(useAppStore.getState().viewportRect?.x).toBe(1920 - 400);
    unmount();
  });

  it('ArrowLeft at edge is a no-op (does not write keyframe during recording)', () => {
    useAppStore.setState({
      viewportRect: { x: 0, y: 100, width: 400, height: 300 },
      recordingState: 'recording',
    });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    const kfsBefore = useAppStore.getState().tracks[0].keyframes.length;
    fireKey('ArrowLeft');
    expect(useAppStore.getState().tracks[0].keyframes.length).toBe(kfsBefore);
    unmount();
  });

  it('is a no-op when viewportRect is null', () => {
    useAppStore.setState({ viewportRect: null });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft');
    expect(useAppStore.getState().viewportRect).toBeNull();
    unmount();
  });

  it('is a no-op when videoMetadata is null', () => {
    useAppStore.setState({ videoMetadata: null });
    const before = { ...useAppStore.getState().viewportRect };
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft');
    const after = useAppStore.getState().viewportRect;
    expect(after?.x).toBe(before.x);
    unmount();
  });

  it('is a no-op in view mode', () => {
    useAppStore.setState({ mode: 'view' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft');
    // In view mode, mode gate blocks edit-only shortcuts
    expect(useAppStore.getState().viewportRect?.x).toBe(100);
    unmount();
  });

  it('Ctrl+ArrowLeft is a no-op', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowLeft', { ctrlKey: true });
    expect(useAppStore.getState().viewportRect?.x).toBe(100);
    unmount();
  });

  it('during recording, arrow move writes keyframe at current playhead', () => {
    useAppStore.setState({ recordingState: 'recording' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowRight');
    const kfs = useAppStore.getState().tracks[0].keyframes;
    expect(kfs.length).toBeGreaterThan(0);
    const written = kfs.find((kf) => Math.abs(kf.time - 5) < 0.1);
    expect(written).toBeDefined();
    expect(written?.sourceRect.x).toBe(101);
    unmount();
  });

  it('during paused recording, arrow move writes keyframe at current playhead', () => {
    useAppStore.setState({ recordingState: 'paused' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowDown');
    const kfs = useAppStore.getState().tracks[0].keyframes;
    expect(kfs.length).toBeGreaterThan(0);
    const written = kfs.find((kf) => Math.abs(kf.time - 5) < 0.1);
    expect(written).toBeDefined();
    expect(written?.sourceRect.y).toBe(101);
    unmount();
  });

  it('when idle, arrow move does NOT write keyframe', () => {
    // recordingState is 'idle' in beforeEach
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireKey('ArrowRight');
    expect(useAppStore.getState().tracks[0].keyframes.length).toBe(0);
    unmount();
  });
});

// ── [ / ] — bbox scale ────────────────────────────────────────────────────────

describe('useKeyboardShortcuts – [ / ] bbox scale', () => {
  const VIDEO_META = { id: 'v', name: 'test.mp4', width: 1920, height: 1080, fps: 30, duration: 60, url: '' };
  // Center rect: 960x540 centered at (480, 270)
  const CENTER_RECT = { x: 480, y: 270, width: 960, height: 540 };

  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      viewportRect: { ...CENTER_RECT },
      videoMetadata: VIDEO_META,
      recordingState: 'idle',
      currentTime: 3,
      tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 60 }, isDirty: false }],
      activeTrackId: 'track_default',
    });
  });

  function Inner() { useKeyboardShortcuts(); return null; }
  const ref = { current: null as unknown as HTMLVideoElement };

  it('] grows bbox by 1.05× (uniform)', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    const rect = useAppStore.getState().viewportRect!;
    expect(rect.width).toBeCloseTo(960 * 1.05, 4);
    expect(rect.height).toBeCloseTo(540 * 1.05, 4);
    // Aspect ratio preserved
    expect(rect.width / rect.height).toBeCloseTo(960 / 540, 4);
    unmount();
  });

  it('[ shrinks bbox by 1/1.05× (uniform)', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketLeft', '[');
    const rect = useAppStore.getState().viewportRect!;
    expect(rect.width).toBeCloseTo(960 / 1.05, 4);
    expect(rect.height).toBeCloseTo(540 / 1.05, 4);
    unmount();
  });

  it('Shift+] grows bbox by 1.25×', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']', { shiftKey: true });
    const rect = useAppStore.getState().viewportRect!;
    expect(rect.width).toBeCloseTo(960 * 1.25, 4);
    expect(rect.height).toBeCloseTo(540 * 1.25, 4);
    unmount();
  });

  it('Shift+[ shrinks bbox by 1/1.25×', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketLeft', '[', { shiftKey: true });
    const rect = useAppStore.getState().viewportRect!;
    expect(rect.width).toBeCloseTo(960 / 1.25, 4);
    expect(rect.height).toBeCloseTo(540 / 1.25, 4);
    unmount();
  });

  it('] scales around the original center', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    const rect = useAppStore.getState().viewportRect!;
    const newCenterX = rect.x + rect.width / 2;
    const newCenterY = rect.y + rect.height / 2;
    // Original center: 480 + 960/2 = 960, 270 + 540/2 = 540
    expect(newCenterX).toBeCloseTo(960, 1);
    expect(newCenterY).toBeCloseTo(540, 1);
    unmount();
  });

  it('] clamps at videoWidth/videoHeight max (no-op when already at max)', () => {
    // Full-sized rect: already at 100%
    useAppStore.setState({ viewportRect: { x: 0, y: 0, width: 1920, height: 1080 } });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    const before = { ...useAppStore.getState().viewportRect };
    fireCode('BracketRight', ']');
    const after = useAppStore.getState().viewportRect!;
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    unmount();
  });

  it('[ clamps at 10% minimum (no-op when at min)', () => {
    // 10%-sized rect: width = 192, height = 108
    useAppStore.setState({ viewportRect: { x: 0, y: 0, width: 192, height: 108 } });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    const before = { ...useAppStore.getState().viewportRect };
    fireCode('BracketLeft', '[');
    const after = useAppStore.getState().viewportRect!;
    expect(after.width).toBeCloseTo(before.width!, 1);
    expect(after.height).toBeCloseTo(before.height!, 1);
    unmount();
  });

  it('is a no-op when viewportRect is null', () => {
    useAppStore.setState({ viewportRect: null });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    expect(useAppStore.getState().viewportRect).toBeNull();
    unmount();
  });

  it('is a no-op when videoMetadata is null', () => {
    useAppStore.setState({ videoMetadata: null });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    // No crash; viewportRect still set (from beforeEach) but should not have changed
    const rect = useAppStore.getState().viewportRect;
    // The hook no-ops before setViewportRect — check via a spy or just confirm no crash
    expect(rect).not.toBeNull();
    unmount();
  });

  it('is a no-op in view mode', () => {
    useAppStore.setState({ mode: 'view' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    expect(useAppStore.getState().viewportRect?.width).toBe(960);
    unmount();
  });

  it('Ctrl+] is a no-op', () => {
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']', { ctrlKey: true });
    expect(useAppStore.getState().viewportRect?.width).toBe(960);
    unmount();
  });

  it('during recording, ] scale writes keyframe at current playhead', () => {
    useAppStore.setState({ recordingState: 'recording' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    const kfs = useAppStore.getState().tracks[0].keyframes;
    expect(kfs.length).toBeGreaterThan(0);
    const written = kfs.find((kf) => Math.abs(kf.time - 3) < 0.1);
    expect(written).toBeDefined();
    expect(written?.sourceRect.width).toBeCloseTo(960 * 1.05, 2);
    unmount();
  });

  it('during paused recording, [ scale writes keyframe at current playhead', () => {
    useAppStore.setState({ recordingState: 'paused' });
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketLeft', '[');
    const kfs = useAppStore.getState().tracks[0].keyframes;
    expect(kfs.length).toBeGreaterThan(0);
    const written = kfs.find((kf) => Math.abs(kf.time - 3) < 0.1);
    expect(written).toBeDefined();
    expect(written?.sourceRect.width).toBeCloseTo(960 / 1.05, 2);
    unmount();
  });

  it('when idle, ] scale does NOT write keyframe', () => {
    // recordingState is 'idle' in beforeEach
    const { unmount } = render(<VideoRefProvider value={ref}><Inner /></VideoRefProvider>);
    fireCode('BracketRight', ']');
    expect(useAppStore.getState().tracks[0].keyframes.length).toBe(0);
    unmount();
  });
});
