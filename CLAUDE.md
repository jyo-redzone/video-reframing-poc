# CLAUDE.md — VideoReframingPoc orientation

## Product

A browser-based video recutting tool. Users load an HLS video URL, draw a framing rectangle (SourceRect) on the video, then place and record keyframes over time. The Camera Reframing Engine (CRE) interpolates between keyframes — smooth transitions use linear lerp, cut transitions use an instant snap at the boundary. Multiple clips (Tracks) can be created per video. Output is a Track JSON payload for a downstream rendering pipeline.

## Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 + TypeScript 5.6 |
| Build | Vite 6 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Video | hls.js 1.6 |
| Tests | Vitest 3 |

## Commands

```
npm run dev     # start dev server
npm test        # run Vitest tests
npm run build   # type-check + production build
```

## Folder map (target state)

```
src/
├── types/          # Domain types (SourceRect, Keyframe, Track, Segment, …)
├── engine/         # Pure domain logic: CRE interpolation (cre.ts)
├── store/          # Zustand store split into slices/ + selectors.ts
├── hooks/          # usePlayback, useKeyboardShortcuts, useRecordingSampler
├── components/
│   ├── Timeline/   # TimelineBar shell + sub-components + timelineLayout.ts
│   ├── TrackPanel/ # TrackPanel shell + TrackSelectorRow, SaveDialog, VideoInfoPopover
│   └── Viewport/   # ViewportOverlay shell + useViewportDrag + BoundingBoxTool
├── utils/          # coordinates.ts (video ↔ container coord transforms)
└── config.ts       # All constants and magic numbers
```

## Domain model summary

```
Track → has many Keyframes → CRE derives Segments → resolve(time) = SourceRect
```

## Key invariants

- `track.keyframes` is always sorted by `time` ascending (enforced by store on every write)
- The last keyframe in a track always has `transitionToNext: null`; all others have `'smooth' | 'cut'`
- Keyframe dedup: adding/committing a KF within `KEYFRAME_TIME_EPSILON_FRAMES / fps` seconds of an existing KF updates the existing one in place

## Conventions

- **State**: Zustand `StateCreator` slices; named selectors in `store/selectors.ts`
- **Components**: sub-components receive computed props and do not subscribe to the store directly
- **Helpers**: pure logic extracted to `.ts` files alongside components (e.g. `timelineLayout.ts`)
- **Config**: all magic numbers live in `src/config.ts` — no inline literals in components
