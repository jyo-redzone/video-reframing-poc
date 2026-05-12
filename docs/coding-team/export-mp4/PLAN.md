# Export MP4 — POC Plan

## Goal

Add a local, cross-platform CLI tool that takes a saved Track JSON + the source HLS URL it references and produces a reframed MP4 clip. Wire the existing "Export mp4" button to drive this flow end-to-end from the browser.

The tool is a Python program built on PyAV. The browser cannot invoke local processes directly, so the flow is: browser saves the Track JSON to disk and shows a copy-paste command **template**; user fills in the path to the saved JSON and runs the command in a terminal; tool writes the MP4 next to the JSON.

## Design summary

- **Engine:** Python + PyAV. PyAV ships pre-built wheels with FFmpeg libraries bundled — no separate FFmpeg install needed by the user.
- **CRE math:** Ported to `tools/export-cli/cre.py`, kept in lockstep with `src/engine/cre.ts`. A shared fixture file drives parity tests on both sides (see "CRE parity" below).
- **Pipeline:** Parse Track JSON → resolve highest-bandwidth variant URL from the master HLS playlist → open that variant via PyAV → decode frame-by-frame in `[inTime, outTime]` → resolve `sourceRect` per frame via `cre.py` → scale SourceRect from authoring dims to decoded dims → crop → scale-to-fit (preserve aspect) into the output canvas → fill remainder with black → encode H.264 → write MP4.
- **Variant selection:** The tool parses the master m3u8 itself (using the `m3u8` Python library) and picks the variant with the highest `BANDWIDTH` (tiebreak: highest pixel area). The chosen *media* playlist URL is what gets handed to PyAV. Deterministic and reproducible.
- **Geometry parity with preview:** Track JSON carries the authoring dimensions (`videoMetadata.width/height`). At export, decoded variant may differ from authoring variant. Tool computes `scaleX = decodedW / authoringW` and applies to every SourceRect before cropping — mirrors the math in [PreviewCanvas.tsx:82-94](src/components/PreviewCanvas.tsx#L82-L94). HLD goal "Preview ≡ Export geometry" preserved.
- **Output canvas size:** Determined by the **first keyframe's aspect ratio**. The output canvas is sized so that it fits within the decoded source dimensions while matching the first keyframe's aspect (width = decodedW, height = decodedW / firstAspect, capped at decodedH; or vice versa). This avoids the wasted black-pillarbox that would occur if the canvas were always source-sized. Every subsequent frame's cropped rect is scaled-to-fit (preserving its own aspect) into this canvas; mismatched aspects letterbox/pillarbox in black. No stretching ever.
- **fps semantics at export:** CRE snapping always uses the **authoring fps** from Track JSON (matches preview behavior). The decode loop iterates over decoded frames in PTS order and calls `cre.resolve(pts_seconds, keyframes, bounds, authoring_fps)` per frame.
- **Seek strategy:** PyAV seek lands on a keyframe with PTS ≤ `inTime`. Decode and discard frames until `pts >= inTime`; from there forward, every frame is rendered until `pts >= outTime`.
- **Output filename:** input JSON's basename with extension swapped to `.mp4`, written next to the JSON. Override via `--out`.
- **CLI surface:** positional `<track-json>` and optional `--out <path>`. Nothing else.
- **Audio:** preserved. Source HLS audio (typically AAC) is decoded, trimmed to `[inTime, outTime]`, re-encoded to AAC, and muxed into the output MP4. Partial audio frame at `inTime` boundary is dropped (≤20 ms gap, imperceptible). Audio is clipped to the duration of the produced video so the file ends cleanly.
- **Encoder settings:** consistent output settings (libx264, `crf=18`, `preset=medium`, `pix_fmt=yuv420p`; AAC 128 kbps). Not bit-deterministic across encoder versions or thread counts — but reproducible-enough for POC.
- **Track JSON schema additions:** `videoMetadata` (width, height, fps) is added at the **top level** of the JSON payload, alongside `videoUrl` — *not* inside `track`. The `Track` domain type stays clean.
- **No npm involvement:** standalone Python tool, lifts directly into a future backend export worker.

## CRE parity

A single fixture file `tools/export-cli/tests/cre_fixtures.json` enumerates `(keyframes, fps, bounds, sample_times)` cases with expected `sourceRect` outputs. Both the TS test suite (Vitest) and the Python test suite import the same JSON and assert their CRE implementation matches it. Drift between the two implementations is caught at test time.

## Browser → terminal handoff

Click "Export mp4" → save the Track JSON via the existing download flow → open a modal showing:

1. A short instruction ("Open a terminal, then paste the command below — replace `<path-to-json>` with the file you just downloaded.").
2. A copy-paste **command template** with a placeholder:
   - macOS/Linux: `./tools/export-cli/export.sh <path-to-json>`
   - Windows: `tools\export-cli\export.bat <path-to-json>`
3. A Copy button (copies the platform-detected template verbatim).

No attempt is made to guess the download directory.

## End-user prerequisites

- Python 3.10+ installed once.
- One-time `setup.sh` / `setup.bat` run that creates a venv and `pip install -r requirements.txt`. `requirements.txt` pins exact versions of `av` and `m3u8`.

## Out of scope

- No backend service / queue / API integration.
- No progress streaming back to the browser (terminal output only).
- No long-running local export service ("Flow B" upgrade may be revisited later).
- No structural redesign of the Track JSON schema — only adding the top-level `videoMetadata` field. Schema version bumped to 2; older v1 JSONs are not supported and must be re-saved from the app.

## Known limitations to document in the README

- Up to ~20 ms of audio may be missing at the very start of the clip (partial audio frame at the trim boundary is dropped).
- Output is bit-reproducible only when run with the same PyAV/FFmpeg version and `--threads` setting; otherwise byte-identical output is not guaranteed.

## Tasks

1. **Track JSON: include source dimensions + schema bump** — Extend `serializeTrack` and `parseTrackFile` (in `src/utils/trackFile.ts`) so saved JSONs carry top-level `videoMetadata` (width, height, fps). `serializeTrack` takes `videoMetadata` as a new argument; the field lives at the top level of the payload, not inside `track`. Bump `TRACK_FILE_SCHEMA_VERSION` to 2 and require the field on parse — no fallback for old v1 JSONs. Update `TrackPanel.handleSave` to pass `videoMetadata`. Update existing tests.

2. **Tool scaffolding, CRE port, parity tests, setup scripts** — Create `tools/export-cli/` with `cre.py` (port of `src/engine/cre.ts`), `requirements.txt` (pinned `av` + `m3u8`), `setup.sh`, `setup.bat`, `export.sh`, `export.bat` wrappers, README skeleton, and `tests/cre_fixtures.json`. Add a Python test that runs `cre.py` against the fixtures. Add a Vitest test that runs `src/engine/cre.ts` against the same fixtures. Verify PyAV imports successfully end-to-end on at least one platform.

3. **Core export pipeline (`export.py`)** — Implement: Track JSON parsing, master playlist parsing (highest-bandwidth variant URL), open chosen variant via PyAV, seek strategy (seek to ≤ inTime, decode-discard until PTS ≥ inTime), video decode loop with per-frame CRE resolve + scale-to-decoded-dims + crop + letterbox into first-keyframe-aspect canvas + H.264 encode, audio decode/trim/re-encode (AAC) muxed alongside video and clipped to video duration, output filename derivation, `--out` flag, terminal progress output. Fill in README with usage, prerequisites, and known limitations.

4. **Browser integration — wire "Export mp4" button** — Replace the placeholder `alert` in `TrackPanel.tsx`. Click triggers Track JSON download (reusing `serializeTrack` / `buildTrackFilename` / `downloadJsonFile`) and opens a modal showing the platform-detected copy-paste **command template** with a `<path-to-json>` placeholder plus a Copy button and a short instruction line.

## Acceptance criteria for the feature as a whole

- Running the CLI on a Track JSON saved from the app produces an MP4 whose framing matches the in-browser preview within rounding error, for both `'smooth'` and `'cut'` transitions, regardless of which variant PyAV decodes.
- Tool runs unchanged on Mac, Windows, Linux (after one-time setup).
- Browser "Export mp4" button surfaces a working command template the user can paste into their terminal after filling in the JSON path.
- CRE parity tests pass on both TS and Python sides against the shared fixture file.
