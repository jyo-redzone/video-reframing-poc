export type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Keyframe = {
  id: string;
  trackId: string;
  time: number; // seconds
  sourceRect: SourceRect;
  transitionToNext: 'smooth' | 'cut' | null; // null = last keyframe
};

export type ClipRange = {
  inTime: number;
  outTime: number;
};

export type Track = {
  id: string;
  videoId: string;
  name: string;
  keyframes: Keyframe[]; // kept sorted by time
  range: ClipRange;
};

export type Segment = {
  startKeyframe: Keyframe;
  endKeyframe: Keyframe;
  startTime: number;
  endTime: number;
  transition: 'smooth' | 'cut';
};

export type VideoMetadata = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  url: string;
};

export type VideoBounds = {
  width: number;
  height: number;
};

export type CREOutput = {
  frameTime: number;
  sourceRect: SourceRect;
};
