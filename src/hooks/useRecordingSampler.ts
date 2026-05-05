import { useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { RECORDING_SAMPLE_HZ } from '../config';
import type { SourceRect } from '../types';

function rectsEqual(a: SourceRect, b: SourceRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Runs the recording sampler while recordingState === 'recording' AND isPlaying === true.
 *
 * First-tick semantics:
 * - paused → recording (Resume) while playing: fire one tick immediately, then at interval.
 * - idle → recording (Record-start): wait for first interval — Record-start snapshot covers t=0.
 * - isPlaying flips true while already recording: wait for first interval (steady-state resume).
 *
 * Dedup ref (Option B — persisted across pause/resume, reset only on Stop or Record-start):
 * - On idle → recording: set lastSampledRect to current viewportRect (mirrors the snapshot).
 * - On recording|paused → idle (Stop): reset lastSampledRect to null.
 * - On paused ↔ recording transitions: leave lastSampledRectRef untouched.
 */
export default function useRecordingSampler(): void {
  const recordingState = useAppStore((s) => s.recordingState);
  const isPlaying = useAppStore((s) => s.isPlaying);

  // Tracks the previous recordingState value to detect transitions
  const prevRecordingStateRef = useRef<'idle' | 'recording' | 'paused'>(recordingState);

  // Dedup ref — persisted across pause/resume, reset on Stop or Record-start
  const lastSampledRectRef = useRef<SourceRect | null>(null);

  // Whether the most recent activation was a paused→recording Resume
  const wasResumeRef = useRef(false);

  // Synchronise dedup ref and detect transitions on each recordingState change
  useEffect(() => {
    const prev = prevRecordingStateRef.current;
    const curr = recordingState;

    if (prev !== curr) {
      if (prev === 'idle' && curr === 'recording') {
        // Record-start: seed dedup ref with current viewportRect
        lastSampledRectRef.current = useAppStore.getState().viewportRect;
        wasResumeRef.current = false;
      } else if (prev === 'paused' && curr === 'recording') {
        // Resume: mark so sampler fires an immediate tick — but only if video
        // is already playing. If video is paused at Resume time, the ref would
        // linger and incorrectly fire an immediate tick when the user later
        // presses Play (which must be treated as steady-state, not Resume).
        wasResumeRef.current = useAppStore.getState().isPlaying;
        // Leave lastSampledRectRef untouched (Option B)
      } else if (curr === 'idle') {
        // Stop (from any active state): reset dedup ref
        lastSampledRectRef.current = null;
        wasResumeRef.current = false;
      }

      prevRecordingStateRef.current = curr;
    }
  }, [recordingState]);

  // The sampler interval — active only when recording + playing
  useEffect(() => {
    const active = recordingState === 'recording' && isPlaying;
    if (!active) return;

    const sample = () => {
      const { viewportRect, currentTime, commitKeyframeAtTime } = useAppStore.getState();
      if (viewportRect === null) return;
      const last = lastSampledRectRef.current;
      if (last !== null && rectsEqual(viewportRect, last)) return;
      commitKeyframeAtTime(currentTime, viewportRect);
      lastSampledRectRef.current = viewportRect;
    };

    const intervalMs = 1000 / RECORDING_SAMPLE_HZ;

    // Fire immediately only on Resume (paused → recording)
    if (wasResumeRef.current) {
      wasResumeRef.current = false;
      sample();
    }

    const id = setInterval(sample, intervalMs);
    return () => clearInterval(id);
  }, [recordingState, isPlaying]);
}
