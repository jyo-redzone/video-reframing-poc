import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only act in edit mode
      const state = useAppStore.getState();
      if (state.mode !== 'edit') return;

      // Don't intercept when focus is inside a text input / editable element
      const active = document.activeElement;
      if (active) {
        if (INPUT_TAGS.has(active.tagName)) return;
        if (active.getAttribute('contenteditable') !== null) return;
      }

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
