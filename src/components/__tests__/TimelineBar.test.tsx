import { describe, it, expect, beforeEach } from 'vitest';
import { useRef } from 'react';
import { render, act } from '@testing-library/react';
import TimelineBar from '../Timeline';
import { VideoRefProvider } from '../VideoRefContext';
import useAppStore from '../../store/useAppStore';

// Wrapper that supplies the required VideoRef context.
function Harness() {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <VideoRefProvider value={ref}>
      <TimelineBar />
    </VideoRefProvider>
  );
}

describe('TimelineBar empty-state', () => {
  beforeEach(() => {
    // Start with a single default track, then delete it to reach the empty state.
    useAppStore.setState({
      tracks: [
        {
          id: 'track_default',
          videoId: '',
          name: 'clip-1',
          keyframes: [],
          range: { inTime: 0, outTime: 0 },
          isDirty: false,
        },
      ],
      activeTrackId: 'track_default',
      videoMetadata: null,
      currentTime: 0,
    });
  });

  it('does not infinite-loop when the active track is deleted and unrelated state updates fire', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('svg')).not.toBeNull();

    // Delete the only (and active) track — store now has tracks: [], activeTrackId: ''.
    // Pre-fix, TimelineBar's `?? []` and `?? { inTime: 0, outTime: 0 }` selector
    // fallbacks returned a fresh reference on every getSnapshot, causing
    // useSyncExternalStore to re-render forever.
    act(() => {
      useAppStore.getState().deleteTrack('track_default');
    });

    // Trigger several unrelated store updates. If selector references were
    // unstable, React would throw "Maximum update depth exceeded" here.
    act(() => {
      useAppStore.getState().setCurrentTime(1);
      useAppStore.getState().setCurrentTime(2);
      useAppStore.getState().setCurrentTime(3);
    });

    // Component still mounted and rendering after the empty-state path.
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
