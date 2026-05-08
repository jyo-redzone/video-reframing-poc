import type { StateCreator } from 'zustand';
import type { Track, Keyframe, SourceRect } from '../../types';
import { keyframeTimeEpsilon } from '../../config';
import type { AppStore } from '../useAppStore';

export type TrackSlice = {
  tracks: Track[];
  activeTrackId: string;
  createTrack: () => string;
  deleteTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  setActiveTrackId: (id: string) => void;
  markActiveTrackSaved: () => void;
  setTrackRange: (inTime: number, outTime: number) => void;
  addKeyframe: (kf: Keyframe) => void;
  updateKeyframe: (
    id: string,
    updates: Partial<Pick<Keyframe, 'time' | 'sourceRect' | 'transitionToNext'>>,
  ) => void;
  deleteKeyframe: (id: string) => void;
  getActiveKeyframes: () => Keyframe[];
  commitKeyframeAtTime: (time: number, sourceRect: SourceRect) => void;
  getSelectedKeyframe: () => Keyframe | null;
  setTransition: (keyframeId: string, transition: 'smooth' | 'cut') => void;
};

const sortByTime = (keyframes: Keyframe[]): Keyframe[] =>
  [...keyframes].sort((a, b) => a.time - b.time);

export const createTrackSlice: StateCreator<AppStore, [], [], TrackSlice> = (set, get) => ({
  tracks: [{ id: 'track_default', videoId: '', name: 'clip-1', keyframes: [], range: { inTime: 0, outTime: 0 }, isDirty: false }],
  activeTrackId: 'track_default',

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
        return { tracks: filtered, activeTrackId: '', viewportRect: null };
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
    set((state) => {
      let activeBecameEmpty = false;
      const tracks = state.tracks.map((track) => {
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

        if (filtered.length === 0) activeBecameEmpty = true;

        return { ...track, keyframes: filtered, isDirty: true };
      });

      return activeBecameEmpty ? { tracks, viewportRect: null } : { tracks };
    }),

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

          const existing = track.keyframes.find((kf) => Math.abs(kf.time - time) <= epsilon);
          if (existing) {
            return {
              ...track,
              keyframes: track.keyframes.map((kf) =>
                kf.id === existing.id ? { ...kf, sourceRect } : kf,
              ),
              isDirty: true,
            };
          }

          const newId = `kf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const currentLast =
            track.keyframes.length > 0 ? track.keyframes[track.keyframes.length - 1] : null;
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
});
