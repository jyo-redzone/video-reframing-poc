# 007 — Help panel: alternative-chip rendering

## Context

Two related rendering bugs in the help panel:

1. **Player `speed-cycle`** still repeats Shift twice: `Shift+, / Shift+.`. Should be `Shift + , .` (Shift once, two key alternatives).
2. **Bbox arrow rows** are wrong:
   - `bbox-move` (4 arrows) currently renders as a chord `[←]+[→]+[↑]+[↓]` (with `+` between every chip). Should be 4 chips in a row with no separator: `[←] [→] [↑] [↓]`.
   - `bbox-move-shift` renders the four arrows as a *single chip with text* `←/→/↑/↓`. Should be `[Shift] + [←] [→] [↑] [↓]` — Shift once, then four chips.
   - Same problem with `bbox-scale-shift`: currently `[Shift]+[]/[`. Should be `[Shift] + []] [[]`.

The fix is a small schema change so the renderer can distinguish "chord" (chips joined by `+`) from "alternatives" (chips rendered with no separator between them).

## Objective

- Schema for a key binding allows nested arrays to mean "alternative chips, no `+` between".
- Player and Bbox rows are updated to use the new shape where appropriate.
- HelpPanel renderer handles the new shape.

## Scope

### `src/shortcuts.ts` — schema change

Change the binding element type from `string` to `string | string[]`:

```ts
export type Shortcut = {
  id: string;
  /**
   * Each inner array is one binding. Within a binding, items separate with '+':
   *   - string item → one chip
   *   - string[] item → multiple alternative chips rendered with no separator
   * Multiple bindings (top-level groups) render separated by '/'.
   */
  keyGroups: (string | string[])[][];
  description: string;
  surface: ShortcutSurface;
};
```

Update these entries:

| id | before | after | description change |
|---|---|---|---|
| `speed-cycle` | `[['Shift', ','], ['Shift', '.']]` | `[['Shift', [',', '.']]]` | "Cycle playback speed down / up" → "Cycle playback speed" |
| `bbox-move` | `[['←', '→', '↑', '↓']]` | `[[['←', '→', '↑', '↓']]]` | unchanged |
| `bbox-move-shift` | `[['Shift', '←/→/↑/↓']]` | `[['Shift', ['←', '→', '↑', '↓']]]` | unchanged |
| `bbox-scale-shift` | `[['Shift', ']/[']]` | `[['Shift', [']', '[']]]` | unchanged |

All other entries stay as plain `string[][]` — they're still valid under the wider type.

### `src/components/HelpPanel.tsx` — renderer update

The `KeyGroup` component currently maps `keys: string[]` to chips with `+` between every pair. Update it to handle `(string | string[])[]`:

- For each element in the binding:
  - If it's a string → render one `<kbd>` chip.
  - If it's a string array → render multiple `<kbd>` chips with **no `+` between them**, but still with the small `gap-0.5` so they read as a set.
- Between binding elements (whether string or array), keep the existing `+` separator.

Example outputs:
- `['Shift', ',']` → `[Shift] + [,]`
- `['Shift', [',', '.']]` → `[Shift] + [,] [.]`
- `[['←', '→', '↑', '↓']]` → `[←] [→] [↑] [↓]`
- `['Shift', ['←', '→', '↑', '↓']]` → `[Shift] + [←] [→] [↑] [↓]`

The `ShortcutRow` and outer `/` separator between keyGroups stay unchanged.

### Tests

Update `src/components/__tests__/HelpPanel.test.tsx`:
- Adjust the speed-cycle test (description is now "Cycle playback speed", and the chip layout is different).
- Add or update assertions verifying:
  - The four arrow chips for `bbox-move` render as four `<kbd>` elements without `+` between them.
  - `bbox-move-shift` renders one Shift chip plus four arrow chips (5 chips total in that row).
  - `bbox-scale-shift` renders Shift + two bracket chips (3 chips total).

No changes outside HelpPanel + shortcuts.ts + the HelpPanel test.

## Non-goals / Later

- Refactoring other entries to use alternative-chip rendering (e.g. `delete-keyframe` could become `[['Delete', 'Backspace']]` instead of two `/`-separated groups, but the user wants distinct counter-action pairs to keep the `/`).
- Changing styling of the chips themselves.

## Constraints / Caveats

- Keep the chord `+` separator visually identical to today.
- Inside an alternative-array, no separator at all between chips (just the small `gap-0.5`). Don't add `,` or `/`.
- The schema is wider, not breaking — every existing `string[]` literal still type-checks against `(string | string[])[]`.
- Don't change `keyGroups` in any entry beyond the four listed in the table.

## Acceptance criteria

- Player section: `Cycle playback speed` row shows `[Shift] + [,] [.]` — Shift appears once.
- Bbox section: `bbox-move` row shows four arrow chips with no `+` between them. `bbox-move-shift` shows Shift + four arrow chips. `bbox-scale-shift` shows Shift + `]` + `[` chips, with no separator between the brackets.
- All other rows render exactly as before.
- Test suite green.
