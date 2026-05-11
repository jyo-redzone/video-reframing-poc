# Export MP4 — POC Plan

## Goal

Add a local, cross-platform CLI tool that takes a saved Track JSON + the source HLS URL it references and produces a reframed MP4 clip. Wire the existing "Export mp4" button to drive this flow end-to-end from the browser.

The tool is a Python program built on PyAV. The browser cannot invoke local processes directly, so the flow is: browser saves the Track JSON to disk and shows a copy-paste command; user runs the command in a terminal; tool writes the MP4 next to the JSON.

## Design summary

- **Engine:** Python + PyAV. PyAV ships pre-built wheels with FFmpeg libraries bundled — no separate FFmpeg install needed by the user.
- **CRE math:** Ported to `tools/export-cli/cre.py`, kept in lockstep with `src/engine/cre.ts`.
- **Pipeline:** Parse Track JSON → open HLS via PyAV (forced to highest variant) → decode frame-by-frame in `[inTime, outTime]` → resolve `sourceRect` per frame via `cre.py` → scale SourceRect from authoring dims to decoded dims → crop → scale-to-fit (preserve aspect) into output canvas → fill remainder with black → encode H.264 → write MP4.
- **Variant selection:** PyAV always selects the **highest-resolution variant** available in the master playlist. Deterministic and best quality.
- **Geometry parity with preview:** Track JSON carries the authoring dimensions (`videoMetadata.width/height`). At export, decoded variant may differ from authoring variant. Tool computes `scaleX = decodedW / authoringW` and applies to every SourceRect before cropping — mirrors the math in [PreviewCanvas.tsx:82-94](src/components/PreviewCanvas.tsx#L82-L94). HLD goal "Preview ≡ Export geometry" preserved.
- **Output resolution:** **Same as the decoded source video** (e.g., 1920×1080 source → 1920×1080 output). No CLI knob — this keeps the tool dead-simple and preserves maximum source quality.
- **Aspect-ratio handling:** Each frame's cropped rect is scaled-to-fit (preserving its own aspect) into the source-sized output canvas. Mismatched areas filled with black (letterbox / pillarbox). No stretching ever — keyframes with varying aspects are all rendered without distortion.
- **Output filename:** input JSON's basename with extension swapped to `.mp4`, written next to the JSON. Override via `--out`.
- **CLI surface:** positional `<track-json>` and optional `--out <path>`. Nothing else.
- **Audio:** preserved. Source HLS audio (typically AAC) is decoded, trimmed to `[inTime, outTime]`, re-encoded to AAC, and muxed into the output MP4. Partial audio frame at `inTime` boundary is dropped (≤20 ms gap, imperceptible).
- **Determinism:** fixed encoder settings (libx264, `crf=18`, `preset=medium`, `pix_fmt=yuv420p`; AAC 128 kbps).
- **No npm involvement:** standalone Python tool, lifts directly into a future backend export worker.

## End-user prerequisites

- Python 3.10+ installed once.
- One-time `setup.sh` / `setup.bat` run that creates a venv and `pip install av`.

## Out of scope

- No backend service / queue / API integration.
- No progress streaming back to the browser (terminal output only).
- No long-running local export service ("Flow B" upgrade may be revisited later).
- No structural redesign of the Track JSON schema — only adding the source dimensions field. Schema version bumped to 2; older v1 JSONs are not supported.

## Known limitations to document in the README

- Up to ~20 ms of audio may be missing at the very start of the clip (partial audio frame at the trim boundary is dropped).

## Tasks

1. **Track JSON: include source dimensions** — Extend `serializeTrack` and `parseTrackFile` (in `src/utils/trackFile.ts`) so saved JSONs carry `videoMetadata` (width, height, fps). Bump `TRACK_FILE_SCHEMA_VERSION` to 2 and require the field on parse — no fallback for old v1 JSONs. Update store-side save action to populate the field from the existing `videoMetadata` state.

2. **Tool scaffolding, CRE port, setup scripts** — Create `tools/export-cli/` directory with `cre.py` (port of `src/engine/cre.ts`), `requirements.txt`, `setup.sh`, `setup.bat`, `export.sh`, `export.bat` wrappers, and a README skeleton. Verify PyAV imports successfully end-to-end.

3. **Core export pipeline (`export.py`)** — Implement Track JSON parsing, open HLS via PyAV forcing the highest-resolution variant, video decode loop with per-frame CRE resolve + scale-to-decoded-dims + crop + letterbox/pillarbox into source-sized canvas + H.264 encode, audio decode/trim/re-encode (AAC) muxed alongside video, output filename derivation, `--out` flag, terminal progress output. Fill in README with usage and limitations.

4. **Browser integration — wire "Export mp4" button** — Replace the placeholder `alert` in `TrackPanel.tsx`. Click triggers Track JSON download (reusing `serializeTrack` / `buildTrackFilename` / `downloadJsonFile`) and opens a modal showing the platform-detected copy-paste command plus a Copy button.

## Acceptance criteria for the feature as a whole

- Running the CLI on a Track JSON saved from the app produces an MP4 whose framing matches the in-browser preview within rounding error, for both `'smooth'` and `'cut'` transitions, regardless of which variant PyAV decodes.
- Tool runs unchanged on Mac, Windows, Linux (after one-time setup).
- Browser "Export mp4" button surfaces a working command the user can paste into their terminal.
