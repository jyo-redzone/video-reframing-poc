import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { useVideoRef } from '../components/VideoRefContext';
import { SPEED_OPTIONS } from '../constants';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default function useKeyboardShortcuts(): void {
  const videoRef = useVideoRef();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when focus is inside a text input / editable element.
      // This guard applies to ALL branches below, including the global ? toggle.
      const active = document.activeElement;
      if (active) {
        if (INPUT_TAGS.has(active.tagName)) return;
        if (active.getAttribute('contenteditable') !== null) return;
      }

      // Skip when Ctrl, Meta, or Alt modifiers are held (Shift is allowed where noted).
      // Applied per-branch below (after the ? branch which has its own check).

      // ── Global shortcuts (work in both edit and view modes) ──────────

      // ? (Shift+/) — toggle help panel. Must run before the mode gate.
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useAppStore.getState().toggleHelpPanel();
        e.preventDefault();
        return;
      }

      // Space — play/pause (always-on)
      if (e.code === 'Space' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { isPlaying, setIsPlaying } = useAppStore.getState();
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) {
          video.pause();
          setIsPlaying(false);
        } else {
          video.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        }
        e.preventDefault();
        return;
      }

      // Shift+, — cycle playback speed down (always-on; must come before unshifted ,)
      if (e.shiftKey && e.code === 'Comma' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { playbackRate, setPlaybackRate } = useAppStore.getState();
        const currentIdx = SPEED_OPTIONS.indexOf(playbackRate as typeof SPEED_OPTIONS[number]);
        // Snap to nearest option if not found (defensive)
        const baseIdx = currentIdx === -1
          ? SPEED_OPTIONS.reduce((best, opt, i) =>
              Math.abs(opt - playbackRate) < Math.abs(SPEED_OPTIONS[best] - playbackRate) ? i : best, 0)
          : currentIdx;
        const newIdx = Math.max(0, baseIdx - 1);
        const newRate = SPEED_OPTIONS[newIdx];
        setPlaybackRate(newRate);
        if (videoRef.current) videoRef.current.playbackRate = newRate;
        e.preventDefault();
        return;
      }

      // Shift+. — cycle playback speed up (always-on; must come before unshifted .)
      if (e.shiftKey && e.code === 'Period' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { playbackRate, setPlaybackRate } = useAppStore.getState();
        const currentIdx = SPEED_OPTIONS.indexOf(playbackRate as typeof SPEED_OPTIONS[number]);
        const baseIdx = currentIdx === -1
          ? SPEED_OPTIONS.reduce((best, opt, i) =>
              Math.abs(opt - playbackRate) < Math.abs(SPEED_OPTIONS[best] - playbackRate) ? i : best, 0)
          : currentIdx;
        const newIdx = Math.min(SPEED_OPTIONS.length - 1, baseIdx + 1);
        const newRate = SPEED_OPTIONS[newIdx];
        setPlaybackRate(newRate);
        if (videoRef.current) videoRef.current.playbackRate = newRate;
        e.preventDefault();
        return;
      }

      // , — step 1 frame back (always-on, unshifted only)
      if (e.key === ',' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { videoMetadata, setIsPlaying, setCurrentTime, isPlaying } = useAppStore.getState();
        if (!videoMetadata) return;
        const video = videoRef.current;
        if (!video) return;
        const frameDuration = 1 / videoMetadata.fps;
        if (isPlaying) { video.pause(); setIsPlaying(false); }
        const newTime = Math.max(0, video.currentTime - frameDuration);
        video.currentTime = newTime;
        setCurrentTime(newTime);
        e.preventDefault();
        return;
      }

      // . — step 1 frame forward (always-on, unshifted only)
      if (e.key === '.' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { videoMetadata, setIsPlaying, setCurrentTime, isPlaying } = useAppStore.getState();
        if (!videoMetadata) return;
        const video = videoRef.current;
        if (!video) return;
        const frameDuration = 1 / videoMetadata.fps;
        if (isPlaying) { video.pause(); setIsPlaying(false); }
        const newTime = Math.min(video.duration || Infinity, video.currentTime + frameDuration);
        video.currentTime = newTime;
        setCurrentTime(newTime);
        e.preventDefault();
        return;
      }

      // = — timeline zoom in (always-on)
      if (e.key === '=' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { timelineZoom, setTimelineZoom, setTimelineZoomOffset, currentTime } = useAppStore.getState();
        const duration = useAppStore.getState().videoMetadata?.duration ?? 60;
        if (timelineZoom >= 256) return;
        const newZoom = timelineZoom * 2;
        const newVisible = duration / newZoom;
        setTimelineZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
        setTimelineZoom(newZoom);
        e.preventDefault();
        return;
      }

      // - — timeline zoom out (always-on)
      if (e.key === '-' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { timelineZoom, setTimelineZoom, setTimelineZoomOffset, currentTime } = useAppStore.getState();
        const duration = useAppStore.getState().videoMetadata?.duration ?? 60;
        if (timelineZoom <= 1) return;
        const newZoom = timelineZoom / 2;
        const newVisible = duration / newZoom;
        setTimelineZoomOffset(Math.max(0, Math.min(duration - newVisible, currentTime - newVisible / 2)));
        setTimelineZoom(newZoom);
        e.preventDefault();
        return;
      }

      // 0 — reset timeline zoom (always-on)
      if (e.key === '0' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useAppStore.getState().resetTimelineZoom();
        e.preventDefault();
        return;
      }

      // Home — seek to clip in-point (always-on)
      if (e.code === 'Home' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { tracks, activeTrackId, setCurrentTime } = useAppStore.getState();
        const activeTrack = tracks.find((t) => t.id === activeTrackId);
        if (!activeTrack) return;
        const video = videoRef.current;
        const seekTime = activeTrack.range.inTime;
        if (video) video.currentTime = seekTime;
        setCurrentTime(seekTime);
        e.preventDefault();
        return;
      }

      // End — seek to clip out-point (always-on)
      if (e.code === 'End' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { tracks, activeTrackId, setCurrentTime } = useAppStore.getState();
        const activeTrack = tracks.find((t) => t.id === activeTrackId);
        if (!activeTrack) return;
        const video = videoRef.current;
        const seekTime = activeTrack.range.outTime;
        if (video) video.currentTime = seekTime;
        setCurrentTime(seekTime);
        e.preventDefault();
        return;
      }

      // ── Mode gate: edit-only shortcuts below ─────────────────────────
      const state = useAppStore.getState();
      if (state.mode !== 'edit') return;

      // Shift+R — stop recording (edit only; must come before unshifted R)
      if (e.shiftKey && e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useAppStore.getState().stopRecording();
        e.preventDefault();
        return;
      }

      // R — record toggle (edit only, unshifted)
      if (e.key === 'r' || e.key === 'R') {
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const { recordingState, activeTrackId, startRecording, pauseRecording, resumeRecording } =
          useAppStore.getState();
        // No-op when no active track (matches button disabled rule)
        if (activeTrackId === '') return;
        if (recordingState === 'idle') {
          startRecording();
        } else if (recordingState === 'recording') {
          pauseRecording();
        } else if (recordingState === 'paused') {
          resumeRecording();
        }
        e.preventDefault();
        return;
      }

      // I — set in-point at playhead (edit only)
      if ((e.key === 'i' || e.key === 'I') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { tracks, activeTrackId, currentTime, setTrackRange } = useAppStore.getState();
        const activeTrack = tracks.find((t) => t.id === activeTrackId);
        if (!activeTrack) return;
        setTrackRange(currentTime, activeTrack.range.outTime);
        e.preventDefault();
        return;
      }

      // O — set out-point at playhead (edit only)
      if ((e.key === 'o' || e.key === 'O') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { tracks, activeTrackId, currentTime, setTrackRange } = useAppStore.getState();
        const activeTrack = tracks.find((t) => t.id === activeTrackId);
        if (!activeTrack) return;
        setTrackRange(activeTrack.range.inTime, currentTime);
        e.preventDefault();
        return;
      }

      // ── Existing bbox / delete handlers ──────────────────────────────

      const isArrow =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight';

      const isDelete = e.key === 'Delete' || e.key === 'Backspace';

      if (!isArrow && !isDelete) return;

      // Don't intercept when Ctrl, Meta, or Alt modifiers are held (reserved)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isArrow) {
        const kf = useAppStore.getState().getSelectedKeyframe();
        if (kf === null) return;

        const { videoMetadata, updateKeyframe, setViewportRect } = useAppStore.getState();
        const step = e.shiftKey ? 10 : 1;
        const videoWidth = videoMetadata?.width ?? 0;
        const videoHeight = videoMetadata?.height ?? 0;

        let { x, y, width, height } = kf.sourceRect;

        switch (e.key) {
          case 'ArrowLeft':
            x = Math.max(0, x - step);
            break;
          case 'ArrowRight':
            x = Math.min(videoWidth - width, x + step);
            break;
          case 'ArrowUp':
            y = Math.max(0, y - step);
            break;
          case 'ArrowDown':
            y = Math.min(videoHeight - height, y + step);
            break;
        }

        const newRect = { x, y, width, height };
        updateKeyframe(kf.id, { sourceRect: newRect });
        setViewportRect(newRect);

        e.preventDefault();
        return;
      }

      if (isDelete) {
        const kf = useAppStore.getState().getSelectedKeyframe();
        if (kf === null) return;

        useAppStore.getState().deleteKeyframe(kf.id);
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
