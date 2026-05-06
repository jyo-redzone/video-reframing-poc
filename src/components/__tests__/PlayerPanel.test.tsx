import type { MockInstance } from 'vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PlayerPanel from '../PlayerPanel';
import { VideoRefProvider } from '../VideoRefContext';
import useAppStore from '../../store/useAppStore';

// Force the Safari-native HLS branch so no real Hls instance is created.
vi.mock('hls.js', () => ({
  default: { isSupported: () => false, Events: {} },
}));

function Harness() {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <VideoRefProvider value={ref}>
      <PlayerPanel />
    </VideoRefProvider>
  );
}

describe('PlayerPanel buffering indicator', () => {
  let canPlayTypeSpy: MockInstance<HTMLMediaElement['canPlayType']>;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom's canPlayType returns '' for everything; pretend Safari-native HLS
    // is supported so the videoUrl effect doesn't set hlsError (which would
    // suppress the spinner overlay).
    canPlayTypeSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'canPlayType')
      .mockReturnValue('maybe');
    useAppStore.setState({
      videoUrl: 'https://example.test/stream.m3u8',
      mode: 'edit',
      videoMetadata: null,
    });
  });

  afterEach(() => {
    canPlayTypeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('shows the spinner after 250ms of waiting and clears it on playing', () => {
    const { container } = render(<Harness />);
    const video = container.querySelector('video')!;

    fireEvent(video, new Event('waiting'));
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole('status')).toBeTruthy();

    fireEvent(video, new Event('playing'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the spinner during initial load and clears it on canplay', () => {
    const { container } = render(<Harness />);
    const video = container.querySelector('video')!;

    fireEvent(video, new Event('loadstart'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole('status')).toBeTruthy();

    fireEvent(video, new Event('canplay'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not show the spinner for sub-threshold waiting blips', () => {
    const { container } = render(<Harness />);
    const video = container.querySelector('video')!;

    fireEvent(video, new Event('waiting'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent(video, new Event('playing'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
