import { describe, it, expect, beforeEach, vi } from 'vitest';
import useAppStore from '../useAppStore';
import type { Keyframe, VideoMetadata } from '../../types';

// Helper to build a keyframe with sensible defaults
function makeKf(overrides: Partial<Keyframe> & { id: string; time: number }): Keyframe {
  return {
    trackId: 'track_default',
    sourceRect: { x: 0, y: 0, width: 100, height: 100 },
    transitionToNext: 'smooth',
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<VideoMetadata> = {}): VideoMetadata {
  return {
    id: 'vid1',
    name: 'test.mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 60,
    url: 'blob:test',
    ...overrides,
  };
}

const DEFAULT_TRACK = {
  id: 'track_default',
  videoId: '',
  name: 'Ball follow',
  keyframes: [],
  range: { inTime: 0, outTime: 0 },
};

describe('useAppStore keyframe actions', () => {
  beforeEach(() => {
    // Reset the store to its initial state before each test
    useAppStore.setState({
      tracks: [{ ...DEFAULT_TRACK }],
      activeTrackId: 'track_default',
      videoMetadata: null,
    });
  });

  // ── addKeyframe ────────────────────────────────────────────────────

  it('addKeyframe inserts in sorted order by time', () => {
    const { addKeyframe, getActiveKeyframes } = useAppStore.getState();

    addKeyframe(makeKf({ id: 'kf3', time: 3 }));
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));
    addKeyframe(makeKf({ id: 'kf2', time: 2 }));

    const kfs = getActiveKeyframes();
    expect(kfs.map((k) => k.id)).toEqual(['kf1', 'kf2', 'kf3']);
    expect(kfs.map((k) => k.time)).toEqual([1, 2, 3]);
  });

  // ── updateKeyframe ─────────────────────────────────────────────────

  it('updateKeyframe re-sorts when time changes', () => {
    const { addKeyframe, updateKeyframe, getActiveKeyframes } = useAppStore.getState();

    addKeyframe(makeKf({ id: 'kf1', time: 1 }));
    addKeyframe(makeKf({ id: 'kf2', time: 2 }));
    addKeyframe(makeKf({ id: 'kf3', time: 3 }));

    // Move kf1 to time 2.5 — it should land between kf2 and kf3
    updateKeyframe('kf1', { time: 2.5 });

    const kfs = getActiveKeyframes();
    expect(kfs.map((k) => k.id)).toEqual(['kf2', 'kf1', 'kf3']);
    expect(kfs.map((k) => k.time)).toEqual([2, 2.5, 3]);
  });

  // ── deleteKeyframe (last KF deleted) ──────────────────────────────

  it('deleteKeyframe of the last keyframe clears new last KF transitionToNext', () => {
    const { addKeyframe, getActiveKeyframes } = useAppStore.getState();

    addKeyframe(makeKf({ id: 'kf1', time: 1, transitionToNext: 'smooth' }));
    addKeyframe(makeKf({ id: 'kf2', time: 2, transitionToNext: 'cut' }));
    addKeyframe(makeKf({ id: 'kf3', time: 3, transitionToNext: null }));

    // Verify kf2 has a transition before deletion
    let kfs = getActiveKeyframes();
    expect(kfs.find((k) => k.id === 'kf2')!.transitionToNext).toBe('cut');

    // Delete the last keyframe (kf3 at time 3)
    useAppStore.getState().deleteKeyframe('kf3');

    kfs = getActiveKeyframes();
    expect(kfs).toHaveLength(2);
    // kf2 is now the last keyframe — its transitionToNext must be cleared to null
    expect(kfs[kfs.length - 1].id).toBe('kf2');
    expect(kfs[kfs.length - 1].transitionToNext).toBeNull();
  });

  // ── deleteKeyframe (middle KF deleted) ─────────────────────────────

  it('deleteKeyframe of a middle keyframe does NOT clear the last KF transitionToNext', () => {
    const { addKeyframe, getActiveKeyframes } = useAppStore.getState();

    addKeyframe(makeKf({ id: 'kf1', time: 1, transitionToNext: 'smooth' }));
    addKeyframe(makeKf({ id: 'kf2', time: 2, transitionToNext: 'cut' }));
    addKeyframe(makeKf({ id: 'kf3', time: 3, transitionToNext: null }));

    // Delete a middle keyframe (kf2)
    useAppStore.getState().deleteKeyframe('kf2');

    const kfs = getActiveKeyframes();
    expect(kfs).toHaveLength(2);
    expect(kfs.map((k) => k.id)).toEqual(['kf1', 'kf3']);

    // kf1's transitionToNext must NOT have been cleared (it's not the last KF)
    expect(kfs[0].transitionToNext).toBe('smooth');
    // kf3 remains the last KF — still null as before
    expect(kfs[1].transitionToNext).toBeNull();
  });
});

describe('useAppStore getSelectedKeyframe', () => {
  beforeEach(() => {
    useAppStore.setState({
      tracks: [{ ...DEFAULT_TRACK }],
      activeTrackId: 'track_default',
      videoMetadata: null,
      currentTime: 0,
    });
  });

  it('returns null when there are no keyframes', () => {
    useAppStore.setState({ currentTime: 1 });
    expect(useAppStore.getState().getSelectedKeyframe()).toBeNull();
  });

  it('returns null when playhead is between keyframes (outside epsilon)', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));
    addKeyframe(makeKf({ id: 'kf2', time: 3 }));

    useAppStore.setState({ currentTime: 2, videoMetadata: makeMetadata({ fps: 30 }) });

    expect(useAppStore.getState().getSelectedKeyframe()).toBeNull();
  });

  it('returns the keyframe when playhead matches time exactly', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    useAppStore.setState({ currentTime: 1, videoMetadata: makeMetadata({ fps: 30 }) });

    const selected = useAppStore.getState().getSelectedKeyframe();
    expect(selected?.id).toBe('kf1');
  });

  it('returns the keyframe when playhead is within epsilon (fps-based)', () => {
    // With fps=30, epsilon = 0.5/30 ≈ 0.0167s
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    const epsilon = 0.5 / 30;
    // Just inside epsilon
    useAppStore.setState({
      currentTime: 1 + epsilon * 0.9,
      videoMetadata: makeMetadata({ fps: 30 }),
    });

    expect(useAppStore.getState().getSelectedKeyframe()?.id).toBe('kf1');
  });

  it('returns null when playhead is just outside epsilon', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    const epsilon = 0.5 / 30;
    useAppStore.setState({
      currentTime: 1 + epsilon * 1.1,
      videoMetadata: makeMetadata({ fps: 30 }),
    });

    expect(useAppStore.getState().getSelectedKeyframe()).toBeNull();
  });

  it('picks the closer of two candidates when both fall within epsilon', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1.000 }));
    addKeyframe(makeKf({ id: 'kf2', time: 1.010 }));

    // With fps=1000, epsilon = 0.0005 — only kf1 is within epsilon at time 1.001
    // With fps=30, epsilon ≈ 0.0167 — both are within epsilon at time 1.006
    useAppStore.setState({
      currentTime: 1.006,
      videoMetadata: makeMetadata({ fps: 30 }),
    });

    // kf2 at 1.010 is 0.004 away; kf1 at 1.000 is 0.006 away — kf2 is closer
    const selected = useAppStore.getState().getSelectedKeyframe();
    expect(selected?.id).toBe('kf2');
  });

  it('falls back to 0.02 epsilon when videoMetadata is null', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    // 0.02 fallback — time within 0.018 should match
    useAppStore.setState({ currentTime: 1.018, videoMetadata: null });

    expect(useAppStore.getState().getSelectedKeyframe()?.id).toBe('kf1');
  });

  it('falls back to 0.02 epsilon — time beyond 0.02 should not match', () => {
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    useAppStore.setState({ currentTime: 1.025, videoMetadata: null });

    expect(useAppStore.getState().getSelectedKeyframe()).toBeNull();
  });

  it('returns null after the selected keyframe is deleted (delete-then-arrow path)', () => {
    const { addKeyframe, deleteKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'kf1', time: 1 }));

    useAppStore.setState({ currentTime: 1, videoMetadata: makeMetadata({ fps: 30 }) });

    // Confirm it's selected before delete
    expect(useAppStore.getState().getSelectedKeyframe()?.id).toBe('kf1');

    deleteKeyframe('kf1');

    // After delete, selection must be null even though playhead hasn't moved
    expect(useAppStore.getState().getSelectedKeyframe()).toBeNull();
  });
});

describe('useAppStore clip range', () => {
  beforeEach(() => {
    useAppStore.setState({
      tracks: [{ ...DEFAULT_TRACK }],
      activeTrackId: 'track_default',
      videoMetadata: null,
    });
  });

  // ── default range ──────────────────────────────────────────────────

  it('default track has range {inTime: 0, outTime: 0}', () => {
    const { tracks } = useAppStore.getState();
    expect(tracks[0].range).toEqual({ inTime: 0, outTime: 0 });
  });

  // ── setVideoMetadata auto-default ─────────────────────────────────

  it('setVideoMetadata auto-sets range to {0, duration} when range is still {0, 0}', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));

    const track = useAppStore.getState().tracks[0];
    expect(track.range).toEqual({ inTime: 0, outTime: 60 });
  });

  it('setVideoMetadata does not overwrite a user-set range', () => {
    // First load sets range to {0, 60}
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    // User adjusts range
    useAppStore.getState().setTrackRange(5, 45);

    // Re-loading metadata (e.g. same video, metadata event fires again) must not clobber range
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));

    const track = useAppStore.getState().tracks[0];
    expect(track.range).toEqual({ inTime: 5, outTime: 45 });
  });

  it('setVideoMetadata is idempotent when called multiple times with range still unset', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));

    const track = useAppStore.getState().tracks[0];
    expect(track.range).toEqual({ inTime: 0, outTime: 60 });
  });

  // ── setTrackRange ──────────────────────────────────────────────────

  it('setTrackRange sets inTime and outTime correctly', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    useAppStore.getState().setTrackRange(10, 30);

    const track = useAppStore.getState().tracks[0];
    expect(track.range).toEqual({ inTime: 10, outTime: 30 });
  });

  it('setTrackRange clamps inTime to 0 when negative', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    useAppStore.getState().setTrackRange(-5, 30);

    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBe(0);
    expect(track.range.outTime).toBe(30);
  });

  it('setTrackRange clamps outTime to duration', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    useAppStore.getState().setTrackRange(10, 100);

    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBe(10);
    expect(track.range.outTime).toBe(60);
  });

  it('setTrackRange ensures inTime <= outTime when inverted', () => {
    useAppStore.getState().setVideoMetadata(makeMetadata({ duration: 60 }));
    useAppStore.getState().setTrackRange(40, 10);

    const track = useAppStore.getState().tracks[0];
    expect(track.range.inTime).toBeLessThanOrEqual(track.range.outTime);
    expect(track.range.inTime).toBe(10);
    expect(track.range.outTime).toBe(40);
  });
});

const VIEWPORT_RECT = { x: 0, y: 0, width: 640, height: 360 };

describe('useAppStore recording state machine', () => {
  beforeEach(() => {
    useAppStore.setState({
      recordingState: 'idle',
      viewportRect: null,
      mode: 'edit',
    });
  });

  it('initial recordingState is idle', () => {
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('startRecording transitions idle→recording when viewportRect is set', () => {
    useAppStore.setState({ viewportRect: VIEWPORT_RECT });
    useAppStore.getState().startRecording();
    expect(useAppStore.getState().recordingState).toBe('recording');
  });

  it('startRecording is a no-op when viewportRect is null', () => {
    useAppStore.getState().startRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('startRecording is a no-op when already recording', () => {
    useAppStore.setState({ viewportRect: VIEWPORT_RECT, recordingState: 'recording' });
    useAppStore.getState().startRecording();
    expect(useAppStore.getState().recordingState).toBe('recording');
  });

  it('pauseRecording transitions recording→paused', () => {
    useAppStore.setState({ recordingState: 'recording' });
    useAppStore.getState().pauseRecording();
    expect(useAppStore.getState().recordingState).toBe('paused');
  });

  it('pauseRecording is a no-op when idle', () => {
    useAppStore.getState().pauseRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('pauseRecording is a no-op when already paused', () => {
    useAppStore.setState({ recordingState: 'paused' });
    useAppStore.getState().pauseRecording();
    expect(useAppStore.getState().recordingState).toBe('paused');
  });

  it('resumeRecording transitions paused→recording', () => {
    useAppStore.setState({ recordingState: 'paused' });
    useAppStore.getState().resumeRecording();
    expect(useAppStore.getState().recordingState).toBe('recording');
  });

  it('resumeRecording is a no-op when idle', () => {
    useAppStore.getState().resumeRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('stopRecording transitions recording→idle', () => {
    useAppStore.setState({ recordingState: 'recording' });
    useAppStore.getState().stopRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('stopRecording transitions paused→idle', () => {
    useAppStore.setState({ recordingState: 'paused' });
    useAppStore.getState().stopRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('stopRecording is a no-op when already idle', () => {
    useAppStore.getState().stopRecording();
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('setMode blocks mode switch and calls alert when recording', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    useAppStore.setState({ mode: 'edit', recordingState: 'recording' });
    useAppStore.getState().setMode('view');
    expect(useAppStore.getState().mode).toBe('edit');
    expect(alertSpy).toHaveBeenCalledWith('Stop recording before switching modes');
    alertSpy.mockRestore();
  });

  it('setMode blocks mode switch and calls alert when paused', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    useAppStore.setState({ mode: 'edit', recordingState: 'paused' });
    useAppStore.getState().setMode('view');
    expect(useAppStore.getState().mode).toBe('edit');
    expect(alertSpy).toHaveBeenCalledWith('Stop recording before switching modes');
    alertSpy.mockRestore();
  });

  it('setMode works normally when idle', () => {
    useAppStore.setState({ mode: 'edit', recordingState: 'idle' });
    useAppStore.getState().setMode('view');
    expect(useAppStore.getState().mode).toBe('view');
  });
});

// ── commitKeyframeAtTime ───────────────────────────────────────────────────────

const RECT_A: ReturnType<typeof VIEWPORT_RECT.valueOf> = { x: 0, y: 0, width: 640, height: 360 };
const RECT_B = { x: 10, y: 20, width: 320, height: 180 };

describe('useAppStore commitKeyframeAtTime', () => {
  beforeEach(() => {
    useAppStore.setState({
      tracks: [{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [], range: { inTime: 0, outTime: 0 } }],
      activeTrackId: 'track_default',
      videoMetadata: makeMetadata({ fps: 30 }),
    });
  });

  it('appends a new keyframe when list is empty', () => {
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(1);
    expect(kfs[0].time).toBe(1.0);
    expect(kfs[0].sourceRect).toEqual(RECT_A);
    expect(kfs[0].transitionToNext).toBeNull(); // last kf → null
  });

  it('appended first keyframe has transitionToNext null; second appended gets transition to null too', () => {
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    useAppStore.getState().commitKeyframeAtTime(3.0, RECT_B);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(2);
    // kf at t=1 must now have transitionToNext = 'smooth' (no longer last)
    expect(kfs[0].transitionToNext).toBe('smooth');
    // kf at t=3 is last → null
    expect(kfs[1].transitionToNext).toBeNull();
  });

  it('inserting a kf before the last kf does not change existing transitionToNext values', () => {
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    useAppStore.getState().commitKeyframeAtTime(3.0, RECT_B);
    // Insert in middle at t=2.0
    useAppStore.getState().commitKeyframeAtTime(2.0, RECT_A);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(3);
    expect(kfs.map((k) => k.time)).toEqual([1.0, 2.0, 3.0]);
    // Existing kfs' transitionToNext must not have been changed
    expect(kfs[0].transitionToNext).toBe('smooth');
    expect(kfs[1].transitionToNext).toBe('smooth'); // newly inserted middle
    expect(kfs[2].transitionToNext).toBeNull(); // last remains null
  });

  it('updates in place when time is within epsilon of an existing keyframe', () => {
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    const originalId = useAppStore.getState().getActiveKeyframes()[0].id;
    const epsilon = 0.5 / 30; // ≈ 0.0167
    // Write just inside epsilon
    useAppStore.getState().commitKeyframeAtTime(1.0 + epsilon * 0.9, RECT_B);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(1); // no new kf appended
    expect(kfs[0].id).toBe(originalId); // same kf
    expect(kfs[0].sourceRect).toEqual(RECT_B); // sourceRect updated
    expect(kfs[0].time).toBe(1.0); // time not changed
  });

  it('appends a new keyframe when time is just outside epsilon', () => {
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    const epsilon = 0.5 / 30;
    useAppStore.getState().commitKeyframeAtTime(1.0 + epsilon * 1.1, RECT_B);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(2);
  });

  it('keeps keyframes sorted by time after append', () => {
    useAppStore.getState().commitKeyframeAtTime(5.0, RECT_A);
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_B);
    useAppStore.getState().commitKeyframeAtTime(3.0, RECT_A);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs.map((k) => k.time)).toEqual([1.0, 3.0, 5.0]);
  });

  it('uses fallback epsilon when videoMetadata is null', () => {
    useAppStore.setState({ videoMetadata: null });
    useAppStore.getState().commitKeyframeAtTime(1.0, RECT_A);
    const originalId = useAppStore.getState().getActiveKeyframes()[0].id;
    // 0.018 < 0.02 fallback — should update in place
    useAppStore.getState().commitKeyframeAtTime(1.018, RECT_B);
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(1);
    expect(kfs[0].id).toBe(originalId);
    expect(kfs[0].sourceRect).toEqual(RECT_B);
  });
});

describe('useAppStore startRecording snapshot', () => {
  beforeEach(() => {
    useAppStore.setState({
      tracks: [{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [], range: { inTime: 0, outTime: 0 } }],
      activeTrackId: 'track_default',
      videoMetadata: makeMetadata({ fps: 30 }),
      recordingState: 'idle',
      currentTime: 2.5,
      viewportRect: RECT_A,
    });
  });

  it('startRecording writes one keyframe at currentTime', () => {
    useAppStore.getState().startRecording();
    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(1);
    expect(kfs[0].time).toBe(2.5);
    expect(kfs[0].sourceRect).toEqual(RECT_A);
  });

  it('startRecording writes no keyframe when viewportRect is null', () => {
    useAppStore.setState({ viewportRect: null });
    useAppStore.getState().startRecording();
    expect(useAppStore.getState().getActiveKeyframes()).toHaveLength(0);
    expect(useAppStore.getState().recordingState).toBe('idle');
  });

  it('snapshot updates an existing near-time keyframe rather than appending', () => {
    // Pre-seed a keyframe at nearly the same time
    const { addKeyframe } = useAppStore.getState();
    addKeyframe(makeKf({ id: 'pre', time: 2.5, sourceRect: RECT_B }));

    useAppStore.getState().startRecording();

    const kfs = useAppStore.getState().getActiveKeyframes();
    expect(kfs).toHaveLength(1);
    expect(kfs[0].id).toBe('pre'); // updated in place
    expect(kfs[0].sourceRect).toEqual(RECT_A); // new rect from viewportRect
  });
});
