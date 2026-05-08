import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from '../components/VideoRefContext';
import { SPEED_OPTIONS } from '../config';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type ShortcutDef = {
  key?: string | string[];
  code?: string | string[];
  /** true = require shift; false = require no shift; undefined = don't check */
  shift?: boolean;
  condition?: () => boolean;
  handle: (e: KeyboardEvent, video: HTMLVideoElement | null) => void;
};

function matches(def: ShortcutDef, e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (def.shift === true && !e.shiftKey) return false;
  if (def.shift === false && e.shiftKey) return false;
  if (def.key) {
    const keys = Array.isArray(def.key) ? def.key : [def.key];
    if (!keys.includes(e.key)) return false;
  }
  if (def.code) {
    const codes = Array.isArray(def.code) ? def.code : [def.code];
    if (!codes.includes(e.code)) return false;
  }
  if (def.condition && !def.condition()) return false;
  return true;
}

function dispatch(defs: ShortcutDef[], e: KeyboardEvent, video: HTMLVideoElement | null): boolean {
  for (const def of defs) {
    if (matches(def, e)) {
      def.handle(e, video);
      return true;
    }
  }
  return false;
}

// ── Shortcut registries ─────────────────────────────────────────────────────

const globalShortcuts: ShortcutDef[] = [
  {
    key: '?',
    handle(e) {
      useAppStore.getState().toggleHelpPanel();
      e.preventDefault();
    },
  },
  {
    code: 'Space',
    shift: false,
    handle(e, video) {
      const { isPlaying, setIsPlaying } = useAppStore.getState();
      if (!video) return;
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        video.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
      e.preventDefault();
    },
  },
  {
    code: 'Comma',
    shift: true,
    handle(e, video) {
      const { playbackRate, setPlaybackRate } = useAppStore.getState();
      const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
      const baseIdx =
        idx === -1
          ? SPEED_OPTIONS.reduce(
              (best, opt, i) =>
                Math.abs(opt - playbackRate) < Math.abs(SPEED_OPTIONS[best] - playbackRate) ? i : best,
              0,
            )
          : idx;
      const newRate = SPEED_OPTIONS[Math.max(0, baseIdx - 1)];
      setPlaybackRate(newRate);
      if (video) video.playbackRate = newRate;
      e.preventDefault();
    },
  },
  {
    code: 'Period',
    shift: true,
    handle(e, video) {
      const { playbackRate, setPlaybackRate } = useAppStore.getState();
      const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
      const baseIdx =
        idx === -1
          ? SPEED_OPTIONS.reduce(
              (best, opt, i) =>
                Math.abs(opt - playbackRate) < Math.abs(SPEED_OPTIONS[best] - playbackRate) ? i : best,
              0,
            )
          : idx;
      const newRate = SPEED_OPTIONS[Math.min(SPEED_OPTIONS.length - 1, baseIdx + 1)];
      setPlaybackRate(newRate);
      if (video) video.playbackRate = newRate;
      e.preventDefault();
    },
  },
  {
    key: ',',
    shift: false,
    handle(e, video) {
      const { setIsPlaying, setCurrentTime, isPlaying, setTimelineFollowPaused } = useAppStore.getState();
      if (!video) return;
      if (isPlaying) { video.pause(); setIsPlaying(false); }
      const newTime = Math.max(0, video.currentTime - 1);
      video.currentTime = newTime;
      setCurrentTime(newTime);
      setTimelineFollowPaused(false);
      e.preventDefault();
    },
  },
  {
    key: '.',
    shift: false,
    handle(e, video) {
      const { setIsPlaying, setCurrentTime, isPlaying, setTimelineFollowPaused } = useAppStore.getState();
      if (!video) return;
      if (isPlaying) { video.pause(); setIsPlaying(false); }
      const newTime = Math.min(video.duration || Infinity, video.currentTime + 1);
      video.currentTime = newTime;
      setCurrentTime(newTime);
      setTimelineFollowPaused(false);
      e.preventDefault();
    },
  },
  {
    key: '=',
    shift: false,
    handle(e) {
      const { timelineZoom, setTimelineZoom, setTimelineZoomOffset, currentTime } = useAppStore.getState();
      const duration = useAppStore.getState().videoMetadata?.duration ?? 60;
      if (timelineZoom >= 256) return;
      const newZoom = timelineZoom * 2;
      const newVisible = duration / newZoom;
      setTimelineZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
      setTimelineZoom(newZoom);
      e.preventDefault();
    },
  },
  {
    key: '-',
    shift: false,
    handle(e) {
      const { timelineZoom, setTimelineZoom, setTimelineZoomOffset, currentTime } = useAppStore.getState();
      const duration = useAppStore.getState().videoMetadata?.duration ?? 60;
      if (timelineZoom <= 1) return;
      const newZoom = timelineZoom / 2;
      const newVisible = duration / newZoom;
      setTimelineZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
      setTimelineZoom(newZoom);
      e.preventDefault();
    },
  },
  {
    key: '0',
    shift: false,
    handle(e) {
      useAppStore.getState().resetTimelineZoom();
      e.preventDefault();
    },
  },
  {
    code: 'Home',
    shift: false,
    handle(e, video) {
      const { tracks, activeTrackId, setCurrentTime, setTimelineFollowPaused } = useAppStore.getState();
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (!activeTrack) return;
      const seekTime = activeTrack.range.inTime;
      if (video) video.currentTime = seekTime;
      setCurrentTime(seekTime);
      setTimelineFollowPaused(false);
      e.preventDefault();
    },
  },
  {
    code: 'End',
    shift: false,
    handle(e, video) {
      const { tracks, activeTrackId, setCurrentTime, setTimelineFollowPaused } = useAppStore.getState();
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (!activeTrack) return;
      const seekTime = activeTrack.range.outTime;
      if (video) video.currentTime = seekTime;
      setCurrentTime(seekTime);
      setTimelineFollowPaused(false);
      e.preventDefault();
    },
  },
  {
    key: ['m', 'M'],
    shift: false,
    handle(e) {
      const { mode, setMode } = useAppStore.getState();
      setMode(mode === 'edit' ? 'view' : 'edit');
      e.preventDefault();
    },
  },
];

// Active when mode === 'edit', regardless of recording state.
const editModeShortcuts: ShortcutDef[] = [
  {
    // Shift+R: stop recording. Works from recording or paused state.
    code: 'KeyR',
    shift: true,
    handle(e) {
      useAppStore.getState().stopRecording();
      e.preventDefault();
    },
  },
  {
    // R when paused: resume. Condition gates against idle/recording states.
    key: ['r', 'R'],
    shift: false,
    condition: () => useAppStore.getState().recordingState === 'paused',
    handle(e) {
      useAppStore.getState().resumeRecording();
      e.preventDefault();
    },
  },
  {
    key: ['i', 'I'],
    shift: false,
    handle(e) {
      const { tracks, activeTrackId, currentTime, setTrackRange } = useAppStore.getState();
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (!activeTrack) return;
      setTrackRange(currentTime, activeTrack.range.outTime);
      e.preventDefault();
    },
  },
  {
    key: ['o', 'O'],
    shift: false,
    handle(e) {
      const { tracks, activeTrackId, currentTime, setTrackRange } = useAppStore.getState();
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (!activeTrack) return;
      setTrackRange(activeTrack.range.inTime, currentTime);
      e.preventDefault();
    },
  },
  {
    key: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    handle(e) {
      const { viewportRect, videoMetadata, setViewportRect, recordingState, currentTime, commitKeyframeAtTime } =
        useAppStore.getState();
      if (viewportRect === null || videoMetadata === null) return;

      const step = e.shiftKey ? 10 : 1;
      let { x, y, width, height } = viewportRect;
      const { width: vw, height: vh } = videoMetadata;

      switch (e.key) {
        case 'ArrowLeft':  x = Math.max(0, x - step); break;
        case 'ArrowRight': x = Math.min(vw - width, x + step); break;
        case 'ArrowUp':    y = Math.max(0, y - step); break;
        case 'ArrowDown':  y = Math.min(vh - height, y + step); break;
      }

      if (x === viewportRect.x && y === viewportRect.y) return;

      const newRect = { x, y, width, height };
      setViewportRect(newRect);
      if (recordingState !== 'idle') commitKeyframeAtTime(currentTime, newRect);
      e.preventDefault();
    },
  },
  {
    code: ['BracketLeft', 'BracketRight'],
    handle(e) {
      const { viewportRect, videoMetadata, setViewportRect, recordingState, currentTime, commitKeyframeAtTime } =
        useAppStore.getState();
      if (viewportRect === null || videoMetadata === null) return;

      const { width: vw, height: vh } = videoMetadata;
      const growing = e.code === 'BracketRight';
      const factor = growing
        ? (e.shiftKey ? 1.25 : 1.05)
        : (e.shiftKey ? 1 / 1.25 : 1 / 1.05);

      const { x: cx, y: cy, width: cw, height: ch } = viewportRect;
      const effectiveFactor = growing
        ? Math.min(factor, vw / cw, vh / ch)
        : Math.max(factor, (vw * 0.1) / cw, (vh * 0.1) / ch);

      if (effectiveFactor === 1) return;

      const nw = cw * effectiveFactor;
      const nh = ch * effectiveFactor;
      const nx = Math.min(Math.max(cx + (cw - nw) / 2, 0), vw - nw);
      const ny = Math.min(Math.max(cy + (ch - nh) / 2, 0), vh - nh);

      const newRect = { x: nx, y: ny, width: nw, height: nh };
      setViewportRect(newRect);
      if (recordingState !== 'idle') commitKeyframeAtTime(currentTime, newRect);
      e.preventDefault();
    },
  },
  {
    key: ['Delete', 'Backspace'],
    handle(e) {
      const kf = useAppStore.getState().getSelectedKeyframe();
      if (kf === null) return;
      useAppStore.getState().deleteKeyframe(kf.id);
      e.preventDefault();
    },
  },
];

// Active when mode === 'edit' AND recordingState === 'recording'.
const recordingShortcuts: ShortcutDef[] = [
  {
    key: ['r', 'R'],
    shift: false,
    handle(e) {
      useAppStore.getState().pauseRecording();
      e.preventDefault();
    },
  },
];

// Active when mode === 'edit' AND recordingState === 'idle'.
const idleShortcuts: ShortcutDef[] = [
  {
    key: ['r', 'R'],
    shift: false,
    condition: () => useAppStore.getState().activeTrackId !== '',
    handle(e) {
      useAppStore.getState().startRecording();
      e.preventDefault();
    },
  },
];

// ── Hook ────────────────────────────────────────────────────────────────────

export default function useKeyboardShortcuts(): void {
  const videoRef = useVideoRef();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active) {
        if (INPUT_TAGS.has(active.tagName)) return;
        if (active.getAttribute('contenteditable') !== null) return;
      }

      const video = videoRef.current;
      if (dispatch(globalShortcuts, e, video)) return;

      const { mode, recordingState } = useAppStore.getState();
      if (mode !== 'edit') return;

      if (dispatch(editModeShortcuts, e, video)) return;

      if (recordingState === 'recording') {
        dispatch(recordingShortcuts, e, video);
      } else if (recordingState === 'idle') {
        dispatch(idleShortcuts, e, video);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
