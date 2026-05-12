# Task 004 — Wire "Export mp4" button to a copy-paste modal

## Context

The "Export mp4" button in [TrackPanel.tsx](src/components/TrackPanel/TrackPanel.tsx) currently shows `window.alert('Export not available in POC')`. Replace this with the real flow:

1. Download the active track as a JSON file (reuse existing helpers).
2. Open a modal showing a platform-detected command template that the user pastes into a terminal.

The user fills in the path to the downloaded JSON themselves (the brief in PLAN.md explicitly rules out guessing the download directory).

## Objective

Click "Export mp4" → JSON downloads → modal opens with a Copy button and a templated command string. User pastes the command into a terminal, fills in the path, runs it.

## Scope

### 1. New component: `ExportMp4Modal.tsx`

Path: `src/components/TrackPanel/ExportMp4Modal.tsx`

Style and a11y closely mirror [VideoInfoPopover.tsx](src/components/TrackPanel/VideoInfoPopover.tsx) — same surface colors, border radius, shadow, ESC-to-close, click-outside-to-close, `createPortal` to `document.body`. But this is a centered **modal** (full-screen dim overlay + centered card), not an anchored popover.

Props:
```ts
interface Props {
  open: boolean;
  onClose: () => void;
}
```

Body contents:
- Heading: `"Export MP4"`.
- One-line instruction: `"The track JSON has been downloaded. Paste the command below into a terminal and replace <path-to-json> with the path to the saved file."`
- A `<code>` block (or a `<pre>` with a `<code>` inside) showing the platform-detected command template. Use a `<pre>` so whitespace and the literal `<path-to-json>` survive copying. Style with the existing `font-mono` class and a subtle background. Make the text user-selectable.
- A "Copy" button next to / below the command. On click, write the command string to the clipboard via `navigator.clipboard.writeText(...)`. Show a transient `"Copied!"` indicator (state flag + `setTimeout` reset after ~1.5s) — replace the button label or show a small adjacent badge, your call.
- A "Close" button bottom-right.

Platform detection: derive from `navigator.platform` or `navigator.userAgentData?.platform` (fall back to `navigator.userAgent` substring check for "Win"). The result drives which template string is rendered:
- Windows → `tools\export-cli\export.bat <path-to-json>`
- everything else → `./tools/export-cli/export.sh <path-to-json>`

Put the platform-detection logic in a small pure helper near the top of the file (or in `src/utils/`) — a one-liner `getExportCommandTemplate(): string` is fine. Don't ship a giant abstraction; this is a single switch.

Keyboard / focus behavior:
- ESC closes the modal.
- Click outside the card closes the modal.
- On mount, focus the Copy button so it's ergonomic. Use a `ref` + `useEffect` for this.
- Trapping focus inside the modal is **out of scope** — POC.

ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the heading.

### 2. Wire it up in `TrackPanel.tsx`

- Add a `useState<boolean>` for modal-open state.
- Replace the placeholder `onClick={() => window.alert('Export not available in POC')}` on the "Export mp4" button with a handler that:
  1. Guards: bail if `!activeTrack || !videoMetadata` (same as Save).
  2. Serializes the track and triggers the download (reuse `serializeTrack` / `buildTrackFilename` / `downloadJsonFile` — same calls as `handleSave`, but **do not** call `markActiveTrackSaved` here; export doesn't change "dirty" state. Saving and exporting are separate intents.)
  3. Opens the modal.
- Render `<ExportMp4Modal open={…} onClose={…} />` at the bottom of the panel JSX.
- Keep the existing `disabled={!hasActive}` on the Export button — but also disable when `!videoMetadata`, matching the Save button.

### 3. Tests

Add `src/components/__tests__/ExportMp4Modal.test.tsx`:
- Renders nothing when `open={false}`.
- Renders heading + command template when `open={true}`.
- Shows the macOS/Linux template on a non-Windows `navigator.platform` mock; shows the Windows template when mocked accordingly. (Mock `navigator.platform` via `Object.defineProperty`. Two separate test cases.)
- Calling the Copy button calls `navigator.clipboard.writeText` with the exact template string (mock the clipboard API).
- ESC press calls `onClose`.

Lightly extend `TrackPanel.test.tsx` (if one exists; check first — only add if it'd be quick. If not, skip — the modal tests cover the meaningful behavior).

## Non-goals / Later

- No focus trap.
- No actual invocation of the CLI from the browser.
- No backend signalling, no progress bar.
- No internationalization of the modal copy.
- No persistence of "I've seen this before — don't show again."
- No download-location prefilling of any kind.

## Constraints / Caveats

- The command template strings must be the exact literal command users should paste — including the `<path-to-json>` placeholder. No prepending the repo root or anything that requires the user's filesystem layout. (Users running from inside the repo root will get a working command after they fill in the JSON path.)
- `navigator.clipboard.writeText` returns a Promise. Handle the rejection path quietly (it can fail when the page isn't focused) — a `console.warn` is fine for POC. Don't crash the modal.
- Don't introduce a new modal-library dependency. Use the existing portal + Tailwind pattern from `VideoInfoPopover`.
- Don't change `serializeTrack` or any utility signatures. Reuse them as-is.
- Don't touch the Save button or Save flow.

## Verification (before review)

1. `npm test` — all new tests green; pre-existing failures (HelpPanel etc.) unchanged.
2. `npm run build` — passes (the pre-existing TS6133 errors documented in Task 1's report are out of scope).
3. `npm run dev` — click "Export mp4", confirm a JSON downloads, confirm the modal opens with the correct platform-specific template and the Copy button copies the literal string.
