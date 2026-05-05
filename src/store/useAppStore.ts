import { create } from 'zustand';
import type { VideoMetadata, Track, Keyframe, SourceRect } from '../types';
import { keyframeTimeEpsilon } from '../config';

const UNSET_RANGE = { inTime: 0, outTime: 0 } as const;

type AppState = {
  // Video
  videoMetadata: VideoMetadata | null;

  // Track
  tracks: Track[];
  activeTrackId: string;

  // UI mode
  mode: 'edit' | 'view';

  // Recording
  recordingState: 'idle' | 'recording' | 'paused';

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Viewport
  viewportRect: SourceRect | null;

};

type AppActions = {
  // Video
  setVideoMetadata: (meta: VideoMetadata) => void;

  // Track CRUD
  createTrack: () => string;
  deleteTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  setActiveTrackId: (id: string) => void;
  markActiveTrackSaved: () => void;

  // Track range
  setTrackRange: (inTime: number, outTime: number) => void;

  // Keyframes
  addKeyframe: (kf: Keyframe) => void;
  updateKeyframe: (
    id: string,
    updates: Partial<Pick<Keyframe, 'time' | 'sourceRect' | 'transitionToNext'>>,
  ) => void;
  deleteKeyframe: (id: string) => void;
  getActiveKeyframes: () => Keyframe[];
  commitKeyframeAtTime: (time: number, sourceRect: SourceRect) => void;

  // Selection
  getSelectedKeyframe: () => Keyframe | null;

  // Segments (transition changes)
  setTransition: (keyframeId: string, transition: 'smooth' | 'cut') => void;

  // Mode & view
  setMode: (mode: 'edit' | 'view') => void;

  // Recording
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;

  // Playback
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Viewport
  setViewportRect: (rect: SourceRect | null) => void;

};

const sortByTime = (keyframes: Keyframe[]): Keyframe[] =>
  [...keyframes].sort((a, b) => a.time - b.time);

const useAppStore = create<AppState & AppActions>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────
  videoMetadata: null,
  tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 0 }, isDirty: false }],
  activeTrackId: 'track_default',
  mode: 'edit',
  recordingState: 'idle',
  currentTime: 0,
  isPlaying: false,
  viewportRect: null,

  // ── Video ──────────────────────────────────────────────────────────
  setVideoMetadata: (meta) =>
    set((state) => {
      const activeTrack = state.tracks.find((t) => t.id === state.activeTrackId);
      const rangeIsUnset =
        activeTrack?.range.inTime === UNSET_RANGE.inTime &&
        activeTrack?.range.outTime === UNSET_RANGE.outTime;

      if (!rangeIsUnset) {
        return { videoMetadata: meta };
      }

      return {
        videoMetadata: meta,
        tracks: state.tracks.map((track) =>
          track.id === state.activeTrackId
            ? { ...track, range: { inTime: 0, outTime: meta.duration } }
            : track,
        ),
      };
    }),

  // ── Track CRUD ─────────────────────────────────────────────────────
  createTrack: () => {
    const newId = `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((state) => {
      const newName = `clip-${state.tracks.length + 1}`;
      const newTrack: Track = {
        id: newId,
        videoId: '',
        name: newName,
        keyframes: [],
        range: { inTime: 0, outTime: state.videoMetadata?.duration ?? 0 },
        isDirty: false,
      };
      return {
        tracks: [...state.tracks, newTrack],
        activeTrackId: newId,
        viewportRect: null,
      };
    });
    return newId;
  },

  deleteTrack: (id) =>
    set((state) => {
      const filtered = state.tracks.filter((t) => t.id !== id);
      if (id === state.activeTrackId) {
        return {
          tracks: filtered,
          activeTrackId: '',
          viewportRect: null,
        };
      }
      return { tracks: filtered };
    }),

  renameTrack: (id, name) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === id
          ? {
              ...track,
              name: trimmed,
              isDirty: track.id === state.activeTrackId ? true : track.isDirty,
            }
          : track,
      ),
    }));
  },

  setActiveTrackId: (id) => {
    const { recordingState } = get();
    if (recordingState !== 'idle') {
      window.alert('Stop recording before switching clips');
      return;
    }
    set({ activeTrackId: id, viewportRect: null });
  },

  markActiveTrackSaved: () =>
    set((state) => {
      if (!state.tracks.some((t) => t.id === state.activeTrackId)) return {};
      return {
        tracks: state.tracks.map((track) =>
          track.id === state.activeTrackId ? { ...track, isDirty: false } : track,
        ),
      };
    }),

  // ── Track range ────────────────────────────────────────────────────
  setTrackRange: (inTime, outTime) =>
    set((state) => {
      const duration = state.videoMetadata?.duration ?? Infinity;
      const clampedIn = Math.max(0, Math.min(inTime, duration));
      const clampedOut = Math.max(0, Math.min(outTime, duration));
      const finalIn = Math.min(clampedIn, clampedOut);
      const finalOut = Math.max(clampedIn, clampedOut);

      return {
        tracks: state.tracks.map((track) =>
          track.id === state.activeTrackId
            ? { ...track, range: { inTime: finalIn, outTime: finalOut }, isDirty: true }
            : track,
        ),
      };
    }),

  // ── Keyframes ──────────────────────────────────────────────────────
  addKeyframe: (kf) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === state.activeTrackId
          ? { ...track, keyframes: sortByTime([...track.keyframes, kf]), isDirty: true }
          : track,
      ),
    })),

  updateKeyframe: (id, updates) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === state.activeTrackId
          ? {
              ...track,
              keyframes: sortByTime(
                track.keyframes.map((kf) => (kf.id === id ? { ...kf, ...updates } : kf)),
              ),
              isDirty: true,
            }
          : track,
      ),
    })),

  deleteKeyframe: (id) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        if (track.id !== state.activeTrackId) return track;

        const kfs = track.keyframes;
        const deletedWasLast = kfs.length > 0 && kfs[kfs.length - 1].id === id;
        const filtered = kfs.filter((kf) => kf.id !== id);

        if (deletedWasLast && filtered.length > 0) {
          const lastKf = filtered[filtered.length - 1];
          if (lastKf.transitionToNext !== null) {
            filtered[filtered.length - 1] = { ...lastKf, transitionToNext: null };
          }
        }

        return { ...track, keyframes: filtered, isDirty: true };
      }),
    })),

  getActiveKeyframes: () => {
    const state = get();
    return state.tracks.find((t) => t.id === state.activeTrackId)?.keyframes ?? [];
  },

  commitKeyframeAtTime: (time, sourceRect) =>
    set((state) => {
      const { videoMetadata } = state;
      const epsilon = keyframeTimeEpsilon(videoMetadata?.fps);

      return {
        tracks: state.tracks.map((track) => {
          if (track.id !== state.activeTrackId) return track;

          // Check for existing keyframe within epsilon
          const existing = track.keyframes.find((kf) => Math.abs(kf.time - time) <= epsilon);
          if (existing) {
            // Update in place — do not change time or transitionToNext
            return {
              ...track,
              keyframes: track.keyframes.map((kf) =>
                kf.id === existing.id ? { ...kf, sourceRect } : kf,
              ),
              isDirty: true,
            };
          }

          // Append a new keyframe
          const newId = `kf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const currentLast =
            track.keyframes.length > 0
              ? track.keyframes[track.keyframes.length - 1]
              : null;
          const newIsLast = currentLast === null || time > currentLast.time;

          const newKf: Keyframe = {
            id: newId,
            trackId: track.id,
            time,
            sourceRect,
            transitionToNext: newIsLast ? null : 'smooth',
          };

          let updatedKeyframes = [...track.keyframes];
          if (newIsLast && currentLast !== null && currentLast.transitionToNext === null) {
            // The previously-last keyframe must now have a transition
            updatedKeyframes = updatedKeyframes.map((kf) =>
              kf.id === currentLast.id ? { ...kf, transitionToNext: 'smooth' as const } : kf,
            );
          }

          return {
            ...track,
            keyframes: sortByTime([...updatedKeyframes, newKf]),
            isDirty: true,
          };
        }),
      };
    }),

  getSelectedKeyframe: () => {
    const state = get();
    const keyframes = state.tracks.find((t) => t.id === state.activeTrackId)?.keyframes ?? [];
    const { currentTime, videoMetadata } = state;

    const epsilon = keyframeTimeEpsilon(videoMetadata?.fps);

    let best: Keyframe | null = null;
    let bestDist = Infinity;

    for (const kf of keyframes) {
      const dist = Math.abs(kf.time - currentTime);
      if (dist <= epsilon && dist < bestDist) {
        best = kf;
        bestDist = dist;
      }
    }

    return best;
  },

  // ── Segments ───────────────────────────────────────────────────────
  setTransition: (keyframeId, transition) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === state.activeTrackId
          ? {
              ...track,
              keyframes: track.keyframes.map((kf) =>
                kf.id === keyframeId ? { ...kf, transitionToNext: transition } : kf,
              ),
              isDirty: true,
            }
          : track,
      ),
    })),

  // ── Mode & view ────────────────────────────────────────────────────
  setMode: (mode) => {
    const { recordingState } = get();
    if (recordingState !== 'idle') {
      window.alert('Stop recording before switching modes');
      return;
    }
    set({ mode });
  },

  // ── Recording ──────────────────────────────────────────────────────
  startRecording: () => {
    const { recordingState, viewportRect, currentTime } = get();
    if (recordingState !== 'idle' || viewportRect === null) return;
    set({ recordingState: 'recording' });
    // Snapshot the current position immediately as the first keyframe
    get().commitKeyframeAtTime(currentTime, viewportRect);
  },

  pauseRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'recording') return;
    set({ recordingState: 'paused' });
  },

  resumeRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'paused') return;
    set({ recordingState: 'recording' });
  },

  stopRecording: () => {
    const { recordingState } = get();
    if (recordingState !== 'recording' && recordingState !== 'paused') return;
    set({ recordingState: 'idle' });
  },

  // ── Playback ───────────────────────────────────────────────────────
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // ── Viewport ───────────────────────────────────────────────────────
  setViewportRect: (rect) => set({ viewportRect: rect }),

}));

export default useAppStore;
