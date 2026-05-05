import { create } from 'zustand';
import type { VideoMetadata, Track, Keyframe, SourceRect } from '../types';

const UNSET_RANGE = { inTime: 0, outTime: 0 } as const;

type AppState = {
  // Video
  videoMetadata: VideoMetadata | null;

  // Track
  tracks: Track[];
  activeTrackId: string;

  // UI mode
  mode: 'edit' | 'view';
  viewType: 'source' | 'preview';

  // Playback
  currentTime: number;
  isPlaying: boolean;

  // Viewport
  viewportRect: SourceRect | null;

};

type AppActions = {
  // Video
  setVideoMetadata: (meta: VideoMetadata) => void;

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

  // Selection
  getSelectedKeyframe: () => Keyframe | null;

  // Segments (transition changes)
  setTransition: (keyframeId: string, transition: 'smooth' | 'cut') => void;

  // Mode & view
  setMode: (mode: 'edit' | 'view') => void;
  setViewType: (viewType: 'source' | 'preview') => void;

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
  tracks: [{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [], range: { inTime: 0, outTime: 0 } }],
  activeTrackId: 'track_default',
  mode: 'edit',
  viewType: 'source',
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
            ? { ...track, range: { inTime: finalIn, outTime: finalOut } }
            : track,
        ),
      };
    }),

  // ── Keyframes ──────────────────────────────────────────────────────
  addKeyframe: (kf) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === state.activeTrackId
          ? { ...track, keyframes: sortByTime([...track.keyframes, kf]) }
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

        return { ...track, keyframes: filtered };
      }),
    })),

  getActiveKeyframes: () => {
    const state = get();
    return state.tracks.find((t) => t.id === state.activeTrackId)?.keyframes ?? [];
  },

  getSelectedKeyframe: () => {
    const state = get();
    const keyframes = state.tracks.find((t) => t.id === state.activeTrackId)?.keyframes ?? [];
    const { currentTime, videoMetadata } = state;

    const epsilon = videoMetadata != null ? 0.5 / videoMetadata.fps : 0.02;

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
            }
          : track,
      ),
    })),

  // ── Mode & view ────────────────────────────────────────────────────
  setMode: (mode) => set({ mode }),
  setViewType: (viewType) => set({ viewType }),

  // ── Playback ───────────────────────────────────────────────────────
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // ── Viewport ───────────────────────────────────────────────────────
  setViewportRect: (rect) => set({ viewportRect: rect }),

}));

export default useAppStore;
