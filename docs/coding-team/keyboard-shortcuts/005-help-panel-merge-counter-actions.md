# 005 — Help panel: merge counter-actions

## Context

The help panel currently has 22 rows — one per shortcut. Counter-action pairs (zoom in/out, in/out point, grow/shrink, etc.) are listed on separate lines. Merge those onto single lines for a more compact, scannable panel.

The keyboard handler doesn't read this metadata — it stays untouched. Only display changes.

## Objective

- Change the schema in `src/shortcuts.ts` from `keys: string[]` to `keyGroups: string[][]`.
- Collapse counter-action pairs (and Shift-as-larger-step variants) into single rows.
- Update `HelpPanel.tsx` to render multiple key groups separated by `/`.

## Scope

### `src/shortcuts.ts` — new schema

```ts
export type Shortcut = {
  id: string;
  keyGroups: string[][];   // each inner array is one binding (chips joined with '+')
  description: string;
  surface: ShortcutSurface;
};
```

Final entries (15 total, down from 22):

```ts
export const SHORTCUTS: Shortcut[] = [
  // Player
  { id: 'play-pause',    keyGroups: [['Space']],                          description: 'Play / pause',                  surface: 'Player' },
  { id: 'second-step',   keyGroups: [[',']], [['.']]   /* see note */,    description: 'Step 1 second back / forward',  surface: 'Player' },
  { id: 'speed-cycle',   keyGroups: [['Shift', ',']], [['Shift', '.']],   description: 'Cycle playback speed down / up', surface: 'Player' },
  { id: 'record-toggle', keyGroups: [['R']],                              description: 'Record toggle',                 surface: 'Player' },
  { id: 'record-stop',   keyGroups: [['Shift', 'R']],                     description: 'Stop recording',                surface: 'Player' },

  // Timeline
  { id: 'zoom',          keyGroups: [['=']], [['-']],                     description: 'Timeline zoom in / out',        surface: 'Timeline' },
  { id: 'zoom-reset',    keyGroups: [['0']],                              description: 'Reset timeline zoom',           surface: 'Timeline' },
  { id: 'seek-ends',     keyGroups: [['Home']], [['End']],                description: 'Seek to clip start / end',      surface: 'Timeline' },
  { id: 'in-out-point',  keyGroups: [['I']], [['O']],                     description: 'Set in / out point',            surface: 'Timeline' },
  { id: 'delete-keyframe', keyGroups: [['Delete']], [['Backspace']],      description: 'Delete selected keyframe',      surface: 'Timeline' },
  { id: 'close-popover', keyGroups: [['Esc']],                            description: 'Close popover / dialog',        surface: 'Timeline' },

  // Bbox
  { id: 'bbox-move',     keyGroups: [['←', '→', '↑', '↓']],               description: 'Move bbox 1px (Shift = 10px)',  surface: 'Bbox' },
  { id: 'bbox-scale',    keyGroups: [[']']], [['[']]                      description: 'Grow / shrink bbox (Shift = larger step)', surface: 'Bbox' },
  { id: 'bbox-constrain', keyGroups: [['Shift']],                          description: 'Axis / square constraint (drag)', surface: 'Bbox' },

  // Help
  { id: 'toggle-help',   keyGroups: [['?']],                              description: 'Toggle keyboard shortcuts panel', surface: 'Help' },
];
```

> **Note on syntax above** — the table-like layout with `[[',']], [['.']]` is just for readability in this brief. The actual TypeScript should be `keyGroups: [[','], ['.']]` (a two-element outer array, each inner being one binding). Same for the other multi-group rows.

Notable changes vs. the old list:
- `frame-back` + `frame-forward` → one row `second-step`.
- `speed-down` + `speed-up` → one row `speed-cycle`.
- `zoom-in` + `zoom-out` → one row `zoom` (zoom-reset stays separate).
- `seek-start` + `seek-end` → one row `seek-ends`.
- `set-in-point` + `set-out-point` → one row `in-out-point`.
- `bbox-move-1px` + `bbox-move-10px` → one row `bbox-move` with "(Shift = 10px)" in the description.
- `bbox-grow` + `bbox-shrink` + `bbox-grow-large` + `bbox-shrink-large` → one row `bbox-scale` with "(Shift = larger step)" in the description.
- `delete-keyframe` keeps both keys but as two groups so the rendering matches the new convention.

`record-toggle` + `record-stop` stay separate — they're not counter-actions; Shift+R is "stop", which is functionally distinct from R's three-state toggle. Same reason `zoom-reset` stays standalone.

### `src/components/HelpPanel.tsx` — rendering update

The `ShortcutRow` component currently takes `keys: string[]` and renders chips joined with `+`. Update it to:

- Accept `keyGroups: string[][]`.
- For each group, render chips joined with `+` (existing pattern).
- Between groups, render a `/` separator. Style the `/` subtly (`text-text-disabled` or similar — match the existing `+` styling but distinct enough that it reads as "or").

Suggested visual: `[Shift]+[,] / [Shift]+[.]` — Cycle playback speed down / up.

Single-group rows (the majority) look identical to today.

### Tests

`src/components/__tests__/HelpPanel.test.tsx` — update assertions to match the new descriptions and row counts. Add at minimum one test that verifies multi-group rendering (e.g., the `seek-ends` row renders both `Home` and `End` chips with a separator between).

No changes elsewhere — the keyboard handler doesn't read this metadata, so its tests are unaffected.

## Non-goals / Later

- Changing `docs/keyboard-shortcuts.md` — that spec stays per-shortcut; the help panel is the compact user-facing view.
- Adding richer per-row metadata (e.g., a "modifier note" field) — folding modifier hints into the description string is fine for this scale.
- Renaming `id` values to be backwards-compatible — IDs are internal and not consumed elsewhere.

## Constraints / Caveats

- Don't change `ShortcutSurface` or the surface order in `HelpPanel`.
- Don't introduce visual regressions for single-group rows. They should render byte-identical (same chip styling, same spacing).
- The `/` separator should be visually lighter than the chips themselves so the eye groups each binding correctly.

## Acceptance criteria

- `src/shortcuts.ts` exports the new shape; `keys` field is gone.
- `HelpPanel` renders all 15 rows correctly, with multi-group rows showing both key bindings separated by `/`.
- The keyboard handler still works (no behavioral regression).
- HelpPanel tests pass with updated assertions; full suite green.
