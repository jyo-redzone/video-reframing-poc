# 003 — Fix infinite loop when active track is deleted

## Context
After deleting the active clip, TimelineBar throws "Maximum update depth exceeded". Root cause: two Zustand selectors in [src/components/TimelineBar.tsx:52-57](src/components/TimelineBar.tsx#L52-L57) return fresh inline fallbacks (`[]` and `{ inTime: 0, outTime: 0 }`) on each call. With no active track, every store update produces a new reference → React/`useSyncExternalStore` sees a snapshot change → re-render → selector runs again → new reference → infinite loop.

Same anti-pattern was almost present in TrackPanel but is safe there because `find()` happens outside the selector. Verify and hoist anyway if needed.

## Objective
Stop the infinite loop by giving the selectors stable fallback references.

## Scope
1. **[src/components/TimelineBar.tsx](src/components/TimelineBar.tsx)** — Hoist module-level constants:
   ```ts
   const EMPTY_KEYFRAMES: Keyframe[] = [];
   const EMPTY_RANGE: ClipRange = { inTime: 0, outTime: 0 };
   ```
   Use them in the two selectors at lines 52-57. Import `Keyframe` and `ClipRange` from `../types` if not already.

2. **No other component changes required.** PreviewCanvas reads via `getState()` inside an effect (not reactive). TrackPanel does `find()` outside the selector against a stable `tracks` array.

3. **Test** — Add a single regression test (in any reasonable location, e.g., a new `src/store/__tests__/` test or extend an existing file) that verifies: starting with one track, deleting it, and then triggering an unrelated store update (e.g., `setCurrentTime`) does not cause infinite re-evaluation of `tracks.find(...).range` selector — OR more practically, a render-based test using `@testing-library/react` if it's already a dep; otherwise a pure-store test that just exercises the empty-state path with a few mutations and confirms no exceptions. If `@testing-library/react` is NOT installed, skip the render test and instead add a comment in TimelineBar.tsx warning future contributors not to inline non-primitive fallbacks in Zustand selectors.

## Non-goals / Later
- Generalized selector wrapper / `useShallow` adoption.
- Refactoring other components defensively.
- Any UI behavior change.

## Constraints / Caveats
- Don't introduce new dependencies.
- Don't change selector semantics — same inputs/outputs, just stable references.
- Verify `npm run build` and existing tests still pass.
- Manually verify: delete the only clip → no infinite loop, no crash, TimelineBar renders empty cleanly.
