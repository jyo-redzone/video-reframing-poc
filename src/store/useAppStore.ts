import { create } from 'zustand';
import type { VideoMetadata, Track, Keyframe, SourceRect } from '../types';

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

  // Dialog state
  selectedKeyframeId: string | null;
  selectedSegmentKey: string | null;
};

type AppActions = {
  // Video
  setVideoMetadata: (meta: VideoMetadata) => void;

  // Keyframes
  addKeyframe: (kf: Keyframe) => void;
  updateKeyframe: (
    id: string,
    updates: Partial<Pick<Keyframe, 'time' | 'sourceRect' | 'transitionToNext'>>,
  ) => void;
  deleteKeyframe: (id: string) => void;
  getActiveKeyframes: () => Keyframe[];

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

  // Dialog
  selectKeyframe: (id: string | null) => void;
  selectSegment: (key: string | null) => void;
};

const sortByTime = (keyframes: Keyframe[]): Keyframe[] =>
  [...keyframes].sort((a, b) => a.time - b.time);

const useAppStore = create<AppState & AppActions>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────
  videoMetadata: null,
  tracks: [{ id: 'track_default', videoId: '', name: 'Ball follow', keyframes: [] }],
  activeTrackId: 'track_default',
  mode: 'edit',
  viewType: 'source',
  currentTime: 0,
  isPlaying: false,
  viewportRect: null,
  selectedKeyframeId: null,
  selectedSegmentKey: null,

  // ── Video ──────────────────────────────────────────────────────────
  setVideoMetadata: (meta) => set({ videoMetadata: meta }),

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

  // ── Dialog ─────────────────────────────────────────────────────────
  selectKeyframe: (id) => set({ selectedKeyframeId: id }),
  selectSegment: (key) => set({ selectedSegmentKey: key }),
}));

export default useAppStore;
