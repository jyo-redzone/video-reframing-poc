import { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

/**
 * Registers a `beforeunload` listener whenever any track has unsaved changes.
 * Cleans up automatically when no track is dirty (or on unmount), so we never
 * leave a stale prompt-firing handler attached.
 */
export default function useUnsavedChangesWarning(): void {
  const hasDirty = useAppStore((s) => s.tracks.some((t) => t.isDirty));

  useEffect(() => {
    if (!hasDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but the assignment is still
      // required for the prompt to fire in some engines.
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirty]);
}
