# 006 — Help panel: bbox split + dividers + scroll-divider fix

## Context

Three small refinements to the help panel:
1. Reorder sections so **Bbox comes first** (most-used surface).
2. **Split the Bbox section** so the Shift variants are on their own rows (instead of folded into descriptions). Use a single combined chip (`'←/→/↑/↓'`, `']/['`) so the modifier renders only once per row.
3. Add **subtle dividers between sections** inside the panel.
4. Fix a real bug: the divider between TrackPanel and HelpPanel currently lives as `border-t` on the scrolling HelpPanel container, so it scrolls out of view when the user scrolls inside the panel. Move it out into `App.tsx` as a non-scrolling sibling.

## Objective

- Bbox section first.
- Bbox section: 5 rows total, one per logical action.
- Subtle horizontal divider between every section in the panel.
- Panel-level divider between TrackPanel and HelpPanel stays visible during scroll.

## Scope

### `src/shortcuts.ts`

Replace the Bbox section. Final 5 entries:

```ts
{ id: 'bbox-move',        keyGroups: [['←', '→', '↑', '↓']],   description: 'Move bbox 1px',                  surface: 'Bbox' },
{ id: 'bbox-move-shift',  keyGroups: [['Shift', '←/→/↑/↓']],   description: 'Move bbox 10px',                 surface: 'Bbox' },
{ id: 'bbox-scale',       keyGroups: [[']'], ['[']],            description: 'Grow / shrink bbox',             surface: 'Bbox' },
{ id: 'bbox-scale-shift', keyGroups: [['Shift', ']/[']],        description: 'Grow / shrink bbox (larger step)', surface: 'Bbox' },
{ id: 'bbox-constrain',   keyGroups: [['Shift']],               description: 'Axis / square constraint (drag)', surface: 'Bbox' },
```

Note: the `'←/→/↑/↓'` and `']/['` strings are single chip values rendered as one `<kbd>` chip. This re-uses the convention that was in the original (pre-task-005) shortcuts list. No change to the `keyGroups: string[][]` schema.

### `src/components/HelpPanel.tsx`

1. **Surface order**: change `SURFACE_ORDER` to `['Bbox', 'Player', 'Timeline', 'Help']`.

2. **Inter-section dividers**: add a subtle horizontal rule between sections. Suggested approach: render a `<div className="my-3 border-t border-border-subtle" />` (or similar) between sections, _but not before the first or after the last_. The simplest implementation is to render the divider inside each section as the first child for all sections after the first — track whether the section is the first rendered (filtered list, since some surfaces could be empty).

3. **Remove the panel-level top border**: drop `border-t border-border-subtle` from the root `<div>` in HelpPanel. The TrackPanel↔HelpPanel divider now lives in `App.tsx` (see below).

### `src/App.tsx`

Currently:
```tsx
{helpPanelOpen && (
  <div className="max-h-[60%] min-h-0 overflow-y-auto">
    <HelpPanel />
  </div>
)}
```

Change to render a sibling divider above the scroll wrapper, so the divider does not scroll with the panel content:

```tsx
{helpPanelOpen && (
  <>
    <div className="border-t border-border-subtle" />
    <div className="max-h-[60%] min-h-0 overflow-y-auto">
      <HelpPanel />
    </div>
  </>
)}
```

Use a fragment so we don't change the flex layout of the parent `<aside>`.

### Tests

Update `src/components/__tests__/HelpPanel.test.tsx`:
- Adjust row count to 17 (was 15).
- Verify all 5 bbox rows render.
- Verify the section order matches the new `SURFACE_ORDER`.
- Verify inter-section dividers are present (e.g. count separator elements, or assert at least 3 dividers exist between the 4 sections).
- The HelpPanel root no longer has `border-t` — adjust any selector that depended on that.

No other tests should need changes (the keyboard handler is independent).

## Non-goals / Later

- Changing the divider styling beyond "subtle horizontal rule using existing tokens".
- Restructuring the App.tsx layout beyond the divider sibling.
- Adding sticky section headers.

## Constraints / Caveats

- Use only existing design tokens (`border-border-subtle`, etc.). No new colors.
- Don't introduce a top-padding gap above the first section that doesn't match the spacing between subsequent sections.
- The fragment in `App.tsx` is important — wrapping the divider + scroll-wrapper in another `<div>` would break the parent flex column's sizing.
- Keep the inner `KeyGroup`/`ShortcutRow` components unchanged. The `'←/→/↑/↓'` and `']/['` strings already work with the existing chip rendering (they're just single keys with slashes inside).
- The total bbox count in the help panel goes from 3 to 5; the panel grows from 15 to 17 rows total.

## Acceptance criteria

- Sections appear in this order from top to bottom: Bounding Box, Player, Timeline, Help.
- Bbox section shows 5 rows, with `Shift+arrows` and `Shift+brackets` as their own rows. The Shift modifier appears exactly once per row, paired with a single combined chip.
- Subtle horizontal dividers separate each section but not before the first or after the last.
- Scrolling inside the help panel does not move the divider that separates it from TrackPanel above — that divider stays put.
- Full test suite passes.
