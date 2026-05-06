# 008 — Bbox grow/shrink step → 1.05×

## Context

Bbox grow/shrink shortcuts (`]` / `[`) currently use a 1.1× factor per press. That's a 10% jump — too coarse for fine adjustments. Reduce to 1.05× (5% per press). Shift variants stay at 1.25×.

## Scope

- **`src/hooks/useKeyboardShortcuts.ts`** — in the bracket scale handler, change the unshifted factor from `1.1` to `1.05` (both grow and shrink: `1.05` and `1/1.05`). Shift variants stay at `1.25` and `1/1.25`.
- **`docs/keyboard-shortcuts.md`** — update the `]` and `[` rows that say "1.1× per press" to "1.05× per press".
- **`src/hooks/__tests__/useKeyboardShortcuts.test.tsx`** — any test asserting on the 1.1 factor or its result rect dimensions needs updated expected values for 1.05.

## Acceptance criteria

- Pressing `]` once on a 1000×800 rect (in a larger frame) produces width `1050`, height `840`. Pressing `[` once produces `1000/1.05`, `800/1.05`.
- `Shift+]` / `Shift+[` continue to use 1.25.
- Test suite green.
