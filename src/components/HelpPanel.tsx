import { SHORTCUTS, type ShortcutSurface } from '../shortcuts';

const SURFACE_ORDER: ShortcutSurface[] = ['Player', 'Timeline', 'Bbox', 'Help'];

const SURFACE_LABELS: Record<ShortcutSurface, string> = {
  Player: 'Player',
  Timeline: 'Timeline',
  Bbox: 'Bounding Box',
  Help: 'Help',
};

/**
 * Renders a single shortcut row with <kbd> chips on the left and a
 * description on the right.
 *
 * Keys joined by '+' are displayed as separate chips with a '+' separator
 * between them.  A single-element keys array renders as one chip.
 */
function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className="text-text-disabled text-xs select-none">+</span>
            )}
            <kbd className="inline-flex items-center rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-primary leading-none">
              {key}
            </kbd>
          </span>
        ))}
      </div>
      <span className="text-xs text-text-secondary leading-tight">{description}</span>
    </div>
  );
}

/**
 * HelpPanel — docked in the right column, self-scrolling.
 * Renders all shortcuts from SHORTCUTS grouped by surface.
 */
export default function HelpPanel() {
  return (
    <div className="overflow-y-auto border-t border-border-subtle px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Keyboard Shortcuts
      </p>
      {SURFACE_ORDER.map((surface) => {
        const rows = SHORTCUTS.filter((s) => s.surface === surface);
        if (rows.length === 0) return null;
        return (
          <section key={surface} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold text-text-primary">
              {SURFACE_LABELS[surface]}
            </h3>
            {rows.map((shortcut) => (
              <ShortcutRow
                key={shortcut.id}
                keys={shortcut.keys}
                description={shortcut.description}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
