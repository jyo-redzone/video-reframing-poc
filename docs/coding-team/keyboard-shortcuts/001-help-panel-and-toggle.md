# 001 — Help panel UI + `?` toggle

## Context

We are about to wire up the shortcuts in [docs/keyboard-shortcuts.md](../../keyboard-shortcuts.md) (~20 across Player / Timeline / Bbox surfaces). Before any of those land, we need an in-app help UI so users can discover them. This task delivers the help UI and the `?` toggle only — no other shortcuts in this task.

## Objective

- A persistent **HelpPanel** docked below TrackPanel in the right column. Workspace (Player, Timeline, Bbox) stays fully interactive while open.
- A floating circular **`?` button** at the bottom-right of the viewport, always visible.
- A `?` (Shift+/) keyboard shortcut that toggles the panel.
- A static shortcut-metadata file that the HelpPanel renders from. This is the source of truth for what's shown to the user; handlers in tasks 002/003 will be added imperatively but every handler must correspond to an entry in this file.

## Scope

### New file: `src/shortcuts.ts`

Static array of all shortcuts from `docs/keyboard-shortcuts.md`. Suggested shape:

```ts
export type ShortcutSurface = 'Player' | 'Timeline' | 'Bbox' | 'Help';

export type Shortcut = {
  id: string;              // stable id, e.g. 'play-pause', 'frame-back'
  keys: string[];          // display tokens, e.g. ['Space'], ['Shift', ','], ['←','→','↑','↓']
  description: string;     // shown in the help panel
  surface: ShortcutSurface;
};

export const SHORTCUTS: Shortcut[] = [ /* every row from the doc */ ];
```

Populate with every row from the doc's "Cheat sheet" section, plus a `Help` surface entry for the `?` toggle. `keys` is for **display only** — handler matching stays imperative.

### New component: `src/components/HelpPanel.tsx`

- Renders sections grouped by `surface` in this order: Player → Timeline → Bbox → Help.
- Each row: `<kbd>` chip(s) on the left, description on the right. Multiple keys (e.g. `Shift+,`) render as separate chips with a `+` between them. Arrow rows show all four arrows as a single chip group.
- Section headers use existing typography tokens.
- Component is self-scrolling (`overflow-y-auto`); the parent decides height.
- Style the `<kbd>` chips with rounded corners, subtle border, monospaced font, ~theme-appropriate background — match the existing dark surface tokens. Keep it understated.

### Store changes: `src/store/useAppStore.ts`

Add:
- `helpPanelOpen: boolean` (initial `false`)
- `toggleHelpPanel: () => void`
- `setHelpPanelOpen: (open: boolean) => void`

### Layout changes: `src/App.tsx`

- Right `<aside>` becomes a vertical flex container.
- TrackPanel on top (its own scroll area).
- HelpPanel below it, only mounted when `helpPanelOpen` is true. When mounted, both panels share column height — TrackPanel takes `flex-1 min-h-0` and HelpPanel takes its natural height up to a sensible cap (e.g. `max-h-[60%]`), each with independent vertical scroll. Tune so neither dominates.
- Render a fixed-positioned floating `?` button (`fixed bottom-4 right-4 z-40`) that calls `toggleHelpPanel`. Circular, ~40-44px, brand red (`#E4022C` / existing token) on dark, with white `?`. `aria-label="Toggle keyboard shortcuts"`. Title attribute matches.

### Keyboard handler: `src/hooks/useKeyboardShortcuts.ts`

Add a branch that handles `?` (i.e. `e.key === '?'`) and calls `toggleHelpPanel`. This shortcut is **global**: it fires regardless of mode (edit or view). It still respects the existing focus-guard (skip if focus is in INPUT / TEXTAREA / SELECT / contenteditable) and the existing modifier guard (skip if Ctrl / Meta / Alt held — Shift is fine since `?` requires Shift on most layouts). Do NOT touch the existing arrow / delete branches in this task.

## Non-goals / Later

- Wiring any other shortcut (Space, R, arrows for bbox, etc.) — those come in tasks 002 and 003.
- Removing the existing arrow / delete handlers — task 003 does that.
- Per-button tooltips with shortcut hints.
- Persisting `helpPanelOpen` across reloads.
- Esc-to-close on the HelpPanel (intentionally absent — panel is persistent, only toggled by `?` or the floating button).

## Constraints / Caveats

- Tailwind v4 + existing design tokens only (`bg-bg`, `text-text-primary`, `border-border-subtle`, brand red, etc.). No new dependencies, no new color tokens.
- The `?` shortcut must work in **both** edit and view modes (the existing handler is gated to edit mode — the `?` branch must run before that gate).
- Width of the right column is 288px and stays that way. Help content stacks vertically; do not break the column width.
- HelpPanel must list every shortcut from the doc, including ones not yet wired up. The user should see the full map from day one; the handlers fill in across tasks 002/003.
- The floating `?` button's z-index must be below the existing save-dialog modal (`z-50`) so the modal can cover it, but above the side panels.

## Acceptance criteria

- Pressing `?` toggles the HelpPanel open and closed; clicking the floating button does the same.
- HelpPanel content matches the doc's cheat-sheet exactly (every row present, descriptions consistent).
- With HelpPanel open, the user can still play/pause the video, seek the timeline, draw and manipulate the bbox — nothing in the left column is impacted.
- Typing `?` inside the rename input or the save-dialog filename field does NOT toggle the panel (focus guard).
