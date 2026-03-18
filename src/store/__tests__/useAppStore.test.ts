import { describe, it, expect, beforeEach } from 'vitest';
import useAppStore from '../useAppStore';
import type { Keyframe } from '../../types';

// Helper to build a keyframe with sensible defaults
function makeKf(overrides: Partial<Keyframe> & { id: string; time: number }): Keyframe {
  return {
    trackId: 'track_default',
    sourceRect: { x: 0, y: 0, width: 100, height: 100 },
    transitionToNext: 'smooth',
    ...overrides,
  };
}

describe('useAppStore keyframe actions', () => {
  beforeEach(() => {
    // Reset the store to its initial state before each test
    useAppStore.setState({
      tracks: [{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [] }],
      activeTrackId: 'track_default',
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
