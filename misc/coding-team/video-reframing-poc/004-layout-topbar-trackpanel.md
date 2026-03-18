# Task 004: Layout Shell + TopBar + TrackPanel

## Context
The POC UI has 4 sections: TopBar (A), PlayerPanel (B), TrackPanel (C), TimelineBar (D). The HTML mock at `html_ui_mock.html` shows the exact layout and styling using Tailwind. The Zustand store is ready at `src/store/useAppStore.ts`. This task builds the outer shell and the right-side panel; the player and timeline are placeholder divs for now.

## Objective
Create the app layout grid, TopBar, and TrackPanel components. After this task, the app renders the full chrome with working dropdowns and buttons (wired to store), with placeholder areas for the player and timeline.

## Scope

### `src/App.tsx` — Layout shell
- Replace the placeholder heading with the full layout
- Structure:
  ```
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <TopBar />
    <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
      <section className="col-span-12 lg:col-span-8">
        {/* PlayerPanel placeholder */}
        <div className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="aspect-video w-full rounded-xl border bg-slate-900 flex items-center justify-center text-slate-500">
            Player (Task 005)
          </div>
        </div>
      </section>
      <aside className="col-span-12 lg:col-span-4">
        <TrackPanel />
      </aside>
      <section className="col-span-12">
        {/* TimelineBar placeholder */}
        <div className="rounded-2xl border bg-white shadow-sm p-4 h-40 flex items-center justify-center text-slate-400">
          Timeline (Task 006)
        </div>
      </section>
    </main>
  </div>
  ```

### `src/components/TopBar.tsx`
- Sticky top bar with white background, border-bottom
- Left: "Video:" label + video name badge (read from `useAppStore.videoMetadata?.name` or fallback "No video loaded")
- Right: "Info" button (onClick shows `window.alert('Video metadata info')` placeholder), "Jobs" button (onClick shows `window.alert('No jobs')` placeholder)
- Match the styling from `html_ui_mock.html`

### `src/components/TrackPanel.tsx`
- Card with border and shadow matching the mock
- Header row: "Track" label + "Export" button (shows toast/alert: "Export not available in POC")
- Track selector dropdown: options "Ball follow", "Player A", "Player B" (only "Ball follow" is functional — cosmetic)
- Mode dropdown: "Edit" / "View" — wired to `useAppStore.setMode()`
- View dropdown: "Source" / "Preview" — wired to `useAppStore.setViewType()`. **Only visible when mode === 'view'**
- Export ranges section: static display matching the mock (R1: 00:10 - 00:20, R2: 00:30 - 00:35, with edit icons and "+ Add range" button that does nothing)
- Output resolution dropdown: "1080p" / "720p" / "Source" (cosmetic, no store binding)
- Auto-keyframe toggle: checkbox labeled "Auto" with info tooltip on hover (matching the mock's tooltip). Cosmetic — not wired to anything
- "Add Manual KF" button: dark button at bottom. For now, onClick does nothing (will be wired in Task 007)

### Delete `src/components/.gitkeep`

## Non-Goals
- No video element or playback logic
- No timeline rendering
- No actual keyframe creation from "Add Manual KF" (just the button)
- No functional track switching
- No responsive mobile layout

## Constraints
- Use Tailwind utility classes matching the mock's visual style
- All interactive controls that are wired to the store (mode, viewType) should read from AND write to the store
- Use `useAppStore` with individual selectors (e.g., `useAppStore(s => s.mode)`) to avoid unnecessary rerenders
