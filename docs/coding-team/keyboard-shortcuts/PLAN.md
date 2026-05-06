# Keyboard Shortcuts — Plan

Implements the shortcut map defined in [docs/keyboard-shortcuts.md](../../keyboard-shortcuts.md), preceded by an in-app help UI so users can discover the shortcuts.

## Goals

- Persistent help panel docked below TrackPanel in the right column. Workspace (Player, Timeline, Bbox) stays fully interactive while open.
- Floating `?` button at bottom-right of the viewport, always visible. Click toggles the panel.
- `?` (Shift+/) keyboard shortcut also toggles the panel.
- All shortcuts from the doc are wired up, respecting the focus-guard (no fire inside inputs / contenteditable) and mode-guard (most are edit-only) rules.
- Single source of truth for the shortcut map: a config array drives both the keyboard handler and the help panel content.

## Non-goals

- Per-button tooltips with shortcut hints.
- User-customizable keybindings.
- Search/filter inside the help panel.
- Resizable / draggable / repositionable panel.
- Persisting open/closed state across reloads.
- Shortcuts for TrackPanel and dialogs.

## Layout

```
┌──────────────────────────┬──────────┐
│  Player + Timeline       │ TrackP.  │
│  (unchanged)             │ (top)    │
│                          ├──────────┤
│                          │  Help    │
│                          │ (bottom) │
└──────────────────────────┴──────────┘
                              [?]  ← fixed bottom-right
```

Right aside becomes a vertical flex container. TrackPanel takes its natural height; Help fills the remainder when open. Both have independent `overflow-y-auto`.

Help content stacks sections vertically (Player → Timeline → Bbox) to fit the 288px-wide column. Each key rendered as a styled `<kbd>` chip.

## Tasks

1. **001 — Help panel UI + `?` toggle.** New `HelpPanel` component rendered below TrackPanel in the right aside. Floating `?` button (fixed bottom-right). Open/close state in store. `?` keyboard shortcut wired through a new central shortcut dispatch. Defines the shortcut config array as the single source of truth (used by both the help panel and future handlers). No other shortcuts implemented yet.

2. **002 — Player + Timeline shortcuts.** Wire up: `Space` (play/pause), `,` / `.` (frame step), `Shift+,` / `Shift+.` (speed cycle), `R` / `Shift+R` (record toggle / stop), `=` / `-` / `0` (timeline zoom), `Home` / `End` (seek to start/end), `I` / `O` (set in/out point). All registered through the dispatch from task 001.

3. **003 — Bbox shortcuts.** Wire up: `←/→/↑/↓` (move viewport rect 1px), `Shift+arrows` (10px), `]` / `[` (uniform scale up/down 1.1×, clamped to existing 10–100% bounds, scaled around rect center). When a recording session is active, every change writes a keyframe at the playhead via the existing `commitKeyframeAtTime` path. The previously-existing arrow handler in `useKeyboardShortcuts.ts` (which moved the *selected keyframe's* stored rect) is removed per the doc's "Removed" section.

4. **004 — Second-step instead of frame-step.** Replace the frame-step (`1/fps`) used by the Prev/Next buttons and the `,` / `.` shortcuts with a 1-second step. Removes the fps dependency on those two controls. Updates `shortcuts.ts`, the help panel rows, and `docs/keyboard-shortcuts.md` to match.
