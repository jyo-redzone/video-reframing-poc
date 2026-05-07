import type { AppStore } from './useAppStore';
import type { Track, Keyframe, ClipRange } from '../types';

const EMPTY_KEYFRAMES: Keyframe[] = [];
const EMPTY_RANGE: ClipRange = { inTime: 0, outTime: 0 };

export const selectActiveTrack = (s: AppStore): Track | null =>
  s.tracks.find((t) => t.id === s.activeTrackId) ?? null;

export const selectActiveKeyframes = (s: AppStore): Keyframe[] =>
  s.tracks.find((t) => t.id === s.activeTrackId)?.keyframes ?? EMPTY_KEYFRAMES;

export const selectActiveClipRange = (s: AppStore): ClipRange =>
  s.tracks.find((t) => t.id === s.activeTrackId)?.range ?? EMPTY_RANGE;

export const selectIsTrackDirty = (s: AppStore): boolean =>
  s.tracks.find((t) => t.id === s.activeTrackId)?.isDirty ?? false;
