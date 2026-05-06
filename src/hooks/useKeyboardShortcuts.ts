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

      // , — step 1 second back (always-on, unshifted only)
      if (e.key === ',' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { setIsPlaying, setCurrentTime, isPlaying } = useAppStore.getState();
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) { video.pause(); setIsPlaying(false); }
        const newTime = Math.max(0, video.currentTime - 1);
        video.currentTime = newTime;
        setCurrentTime(newTime);
        e.preventDefault();
        return;
      }

      // . — step 1 second forward (always-on, unshifted only)
      if (e.key === '.' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const { setIsPlaying, setCurrentTime, isPlaying } = useAppStore.getState();
        const video = videoRef.current;
        if (!video) return;
        if (isPlaying) { video.pause(); setIsPlaying(false); }
        const newTime = Math.min(video.duration || Infinity, video.currentTime + 1);
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

      // ── Bbox movement shortcuts (arrow keys) ─────────────────────────

      const isArrow =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight';

      if (isArrow) {
        // Don't intercept when Ctrl, Meta, or Alt modifiers are held (reserved)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const { viewportRect, videoMetadata, setViewportRect, recordingState, currentTime, commitKeyframeAtTime } =
          useAppStore.getState();

        if (viewportRect === null || videoMetadata === null) return;

        const videoWidth = videoMetadata.width;
        const videoHeight = videoMetadata.height;
        const step = e.shiftKey ? 10 : 1;

        let { x, y, width, height } = viewportRect;

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

        // No-op if rect didn't actually change (e.g. already at edge)
        if (x === viewportRect.x && y === viewportRect.y) return;

        const newRect = { x, y, width, height };
        setViewportRect(newRect);
        if (recordingState !== 'idle') {
          commitKeyframeAtTime(currentTime, newRect);
        }

        e.preventDefault();
        return;
      }

      // ── Bbox scale shortcuts ([ / ]) ──────────────────────────────────

      const isBracket = e.code === 'BracketLeft' || e.code === 'BracketRight';

      if (isBracket) {
        // Don't intercept when Ctrl, Meta, or Alt modifiers are held (reserved)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const { viewportRect, videoMetadata, setViewportRect, recordingState, currentTime, commitKeyframeAtTime } =
          useAppStore.getState();

        if (viewportRect === null || videoMetadata === null) return;

        const videoWidth = videoMetadata.width;
        const videoHeight = videoMetadata.height;

        const growing = e.code === 'BracketRight';
        let factor: number;
        if (growing) {
          factor = e.shiftKey ? 1.25 : 1.1;
        } else {
          factor = e.shiftKey ? 1 / 1.25 : 1 / 1.1;
        }

        const { x: currentX, y: currentY, width: currentWidth, height: currentHeight } = viewportRect;

        // Compute effective factor that keeps both dims within bounds
        let effectiveFactor: number;
        if (growing) {
          effectiveFactor = Math.min(factor, videoWidth / currentWidth, videoHeight / currentHeight);
        } else {
          effectiveFactor = Math.max(factor, (videoWidth * 0.1) / currentWidth, (videoHeight * 0.1) / currentHeight);
        }

        // No-op if already pinned to a bound
        if (effectiveFactor === 1) return;

        const newWidth = currentWidth * effectiveFactor;
        const newHeight = currentHeight * effectiveFactor;

        // Recenter around original center
        let newX = currentX + (currentWidth - newWidth) / 2;
        let newY = currentY + (currentHeight - newHeight) / 2;

        // Final clamp to video bounds
        newX = Math.min(Math.max(newX, 0), videoWidth - newWidth);
        newY = Math.min(Math.max(newY, 0), videoHeight - newHeight);

        const newRect = { x: newX, y: newY, width: newWidth, height: newHeight };
        setViewportRect(newRect);
        if (recordingState !== 'idle') {
          commitKeyframeAtTime(currentTime, newRect);
        }

        e.preventDefault();
        return;
      }

      // ── Delete / Backspace — delete selected keyframe ─────────────────

      const isDelete = e.key === 'Delete' || e.key === 'Backspace';

      if (isDelete) {
        // Don't intercept when Ctrl, Meta, or Alt modifiers are held (reserved)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

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
