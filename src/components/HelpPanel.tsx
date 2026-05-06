import { SHORTCUTS, type ShortcutSurface } from '../shortcuts';

const SURFACE_ORDER: ShortcutSurface[] = ['Bbox', 'Player', 'Timeline', 'Help'];

const SURFACE_LABELS: Record<ShortcutSurface, string> = {
  Player: 'Player',
  Timeline: 'Timeline',
  Bbox: 'Bounding Box',
  Help: 'Help',
};

/**
 * Renders a single key group (one binding) as chips joined by '+'.
 *
 * Each element is either:
 *  - a string → one <kbd> chip
 *  - a string[] → multiple alternative <kbd> chips with no '+' between them
 *
 * A '+' separator is rendered between consecutive elements (string or array).
 */
function KeyGroup({ keys }: { keys: (string | string[])[] }) {
  return (
    <>
      {keys.map((key, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && (
            <span className="text-text-disabled text-xs select-none">+</span>
          )}
          {Array.isArray(key) ? (
            // Alternative chips — rendered side-by-side with no separator
            key.map((alt, j) => (
              <kbd
                key={j}
                className="inline-flex items-center rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-primary leading-none"
              >
                {alt}
              </kbd>
            ))
          ) : (
            <kbd className="inline-flex items-center rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-primary leading-none">
              {key}
            </kbd>
          )}
        </span>
      ))}
    </>
  );
}

/**
 * Renders a single shortcut row with <kbd> chips on the left and a
 * description on the right.
 *
 * Each keyGroup is one binding rendered as chips joined with '+'.
 * Multiple groups are separated by a subtle '/' to read as "or".
 */
function ShortcutRow({ keyGroups, description }: { keyGroups: (string | string[])[][]; description: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5">
        {keyGroups.map((group, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className="text-text-disabled text-xs select-none px-0.5">/</span>
            )}
            <KeyGroup keys={group} />
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
  const activeSurfaces = SURFACE_ORDER.filter(
    (surface) => SHORTCUTS.filter((s) => s.surface === surface).length > 0,
  );

  return (
    <div className="overflow-y-auto px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Keyboard Shortcuts
      </p>
      {activeSurfaces.map((surface, index) => {
        const rows = SHORTCUTS.filter((s) => s.surface === surface);
        return (
          <section key={surface} className="mb-3">
            {index > 0 && (
              <div className="my-3 border-t border-border-subtle" />
            )}
            <p className="mb-1 text-xs font-semibold text-text-primary">
              {SURFACE_LABELS[surface]}
            </p>
            {rows.map((shortcut) => (
              <ShortcutRow
                key={shortcut.id}
                keyGroups={shortcut.keyGroups}
                description={shortcut.description}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
