# Task 003 — Core export pipeline (`export.py`)

## Context

Task 2 scaffolded `tools/export-cli/` and ported the CRE math. This task fills in `export.py` with the actual decode → reframe → encode pipeline. After this task, running

```
./tools/export-cli/export.sh path/to/track.json
```

produces an MP4 next to the input JSON.

Read [docs/coding-team/export-mp4/PLAN.md](docs/coding-team/export-mp4/PLAN.md) for the design rationale. This brief tells you the *how*.

Inputs you'll be working with:
- The CRE port: [tools/export-cli/cre.py](tools/export-cli/cre.py)
- Track JSON shape: see [src/utils/trackFile.ts](src/utils/trackFile.ts) — top-level `{ schemaVersion: 2, videoUrl, videoMetadata: {width, height, fps}, track }` where `track` has `range: {inTime, outTime}` and `keyframes: [{time, sourceRect, transitionToNext, ...}]`.
- Preview geometry, for reference: [src/components/PreviewCanvas.tsx](src/components/PreviewCanvas.tsx)

## Objective

`tools/export-cli/export.py <track.json> [--out <path>]` reads the JSON, opens the highest-bandwidth HLS variant via PyAV, reframes each frame per CRE, encodes H.264 + AAC, and writes an MP4 next to the JSON (or to `--out`). Preview ≡ export geometry within rounding.

## Scope

### CLI surface
```
python export.py <track-json-path> [--out <output-path>]
```
- Positional: path to track JSON. Required.
- `--out`: optional MP4 output path. Default: same dir as input, same basename, `.mp4` extension.
- Use `argparse`. No other flags.
- Print progress to stderr (e.g., `"Decoded 240 / 720 frames (33%)"` every ~30 frames or every second of wall-clock, whichever; pick one and stick to it). Final line on success: `"Wrote <out.mp4>"`.
- On error: print a single human-readable line to stderr, exit code 1. No tracebacks for user-facing errors (file-not-found, missing schemaVersion, no master playlist, etc.) — keep them for internal bugs.

### Module structure inside `export.py`

Single file is fine, but factor into small helpers:
```python
def parse_track_file(path: Path) -> ParsedTrack: ...
def pick_highest_variant(master_url: str) -> str: ...      # returns the chosen media-playlist URL
def compute_output_canvas(first_kf_aspect: float, decoded_w: int, decoded_h: int) -> tuple[int, int]: ...
def render_video(input_url: str, parsed: ParsedTrack, out_path: Path, audio_codec_ctx) -> None: ...
def render_audio(input_url: str, parsed: ParsedTrack, container_out) -> None: ...
def main() -> int: ...
```
You may also split helpers into separate `.py` modules if it stays readable. Keep public surface small.

### Parsing the Track JSON

- Validate `schemaVersion == 2`. Reject otherwise with: `"Unsupported schemaVersion: expected 2, got <X>"`.
- Reject missing/malformed `videoUrl`, `videoMetadata`, `track.range`, `track.keyframes`.
- Sort `keyframes` by `time` ascending (defensive — TS store guarantees it, but file could be hand-edited).
- Extract `inTime`, `outTime`, `authoringW`, `authoringH`, `authoringFps`.

### Highest-variant selection

Use the `m3u8` library:
```python
import m3u8
master = m3u8.load(video_url)
if master.is_variant:                       # this is a master playlist
    variants = master.playlists
    chosen = max(variants, key=lambda p: (
        p.stream_info.bandwidth or 0,
        (p.stream_info.resolution[0] * p.stream_info.resolution[1]) if p.stream_info.resolution else 0,
    ))
    chosen_url = chosen.absolute_uri
else:
    chosen_url = video_url                   # already a media playlist; nothing to choose
```
Print: `"Selected variant: <resolution or 'unknown'> @ <bandwidth> bps"` for transparency.

### Output canvas (first-keyframe aspect, fits inside decoded source)

After opening the chosen variant with PyAV and reading the first decoded frame to learn `decodedW × decodedH`:
- `firstAspect = keyframes[0].sourceRect.width / keyframes[0].sourceRect.height`
- Fit a rectangle of that aspect inside `(decodedW, decodedH)`:
  ```
  if decodedW / decodedH > firstAspect:
      outH = decodedH
      outW = round(outH * firstAspect)
  else:
      outW = decodedW
      outH = round(outW / firstAspect)
  ```
- Ensure outW and outH are even (H.264 requires even dimensions for yuv420p): `outW -= outW % 2; outH -= outH % 2`.

### Decode loop (video)

1. Open the chosen variant URL with `av.open(chosen_url)`.
2. Find the video stream. Compute `start_pts_seconds` and `end_pts_seconds` from `inTime` / `outTime`.
3. **Seek** to a keyframe at or before `inTime`:
   ```
   container.seek(int(start_pts_seconds * av.time_base), backward=True, stream=video_stream)
   ```
   (PyAV uses microsecond seek by default; check the docs and convert correctly.)
4. Decode frames. For each frame:
   - Compute `pts_seconds = float(frame.pts * frame.time_base)`. Skip frames where `pts_seconds < inTime - 0.5/authoringFps` (small epsilon to avoid dropping the legitimate first frame).
   - Stop when `pts_seconds >= outTime`.
   - Call `cre.resolve(pts_seconds, keyframes, bounds=(authoringW, authoringH), fps=authoringFps)` → gets `sourceRect` in authoring coords.
   - Scale to decoded coords: `scaleX = decodedW / authoringW`, `scaleY = decodedH / authoringH`. Multiply rect's x/y/width/height accordingly.
   - **Crop** that rect from the decoded frame: convert frame to a numpy array (`frame.to_ndarray(format='rgb24')`), slice. Round rect coordinates to ints using `int(round(...))`; clamp into the array bounds defensively.
   - **Fit-into-canvas**: scale the cropped numpy slice to fit inside `(outW, outH)` preserving its aspect, letterbox/pillarbox to the canvas with black fill. Use `cv2.resize` if you're willing to add `opencv-python-headless` to requirements; otherwise use `PIL.Image.resize` (already an `av` dep? — verify). Pillow is acceptable and avoids opencv.

     **Decision:** prefer Pillow (no new heavyweight dep). If Pillow is not already pulled in by `av`, add `Pillow` (pinned, e.g. `Pillow==10.4.0`) to `requirements.txt`.
   - Build a new `av.VideoFrame.from_ndarray(canvas_rgb, format='rgb24')`, reformat to yuv420p, encode, mux.

### Encoder settings

Output container: `mp4`. Video stream: `libx264`, options `{'crf': '18', 'preset': 'medium'}`, `pix_fmt='yuv420p'`. Audio stream: `aac`, bit_rate `128_000`.

Frame rate of the output: use the **input video stream's average frame rate** (`stream.average_rate`). Pass this to `container.add_stream('libx264', rate=stream.average_rate)`. The output preserves input fps; we don't resample.

Set PTS on output video frames: a simple counter `frame_index` × `1/output_rate` is the most robust. Don't try to preserve the input PTS — it's offset and we've trimmed.

After the decode loop, flush the encoder (`for packet in stream.encode(): out.mux(packet)`).

### Audio

After video is done (or interleaved — your call; sequential is simpler):
1. Reopen the same chosen_url with a *new* `av.open` for audio (separate iteration cleanly skirts seek-state shared with video).
2. Find the audio stream. Seek to `inTime` (same way as video).
3. Decode audio frames. For each:
   - `pts_seconds = float(frame.pts * frame.time_base)`.
   - If `pts_seconds < inTime`: drop entirely (the brief calls out a ≤20 ms gap is acceptable).
   - If `pts_seconds + frame_duration > outTime`: this is the last frame — trim or just drop (whichever is simpler). Dropping is fine.
   - Otherwise: encode through the AAC output stream, mux.
4. Flush AAC encoder, close container.

If the source has no audio stream, skip audio entirely without erroring.

### Filename derivation

```
default_out = input_json_path.with_suffix('.mp4')
out_path = Path(args.out) if args.out else default_out
```

Refuse to overwrite an existing file unless `--out` is explicitly provided? **No.** Just overwrite silently. POC simplicity.

### README

Replace the skeleton in `tools/export-cli/README.md` with:
```markdown
# Export MP4 CLI

Renders reframed MP4 clips from Track JSON files exported by the Video Reframing app.

## Requirements
- Python 3.10+
- Internet access (the tool fetches HLS playlists and segments)

## Setup (once)
- macOS/Linux: `./tools/export-cli/setup.sh`
- Windows: `tools\export-cli\setup.bat`

## Usage
- macOS/Linux: `./tools/export-cli/export.sh <track.json> [--out <output.mp4>]`
- Windows: `tools\export-cli\export.bat <track.json> [--out <output.mp4>]`

Output defaults to the same directory and basename as the input JSON, with extension `.mp4`.

## Known limitations
- Up to ~20 ms of audio may be missing at the very start of the clip.
- Output is reproducible-enough, not bit-deterministic, across PyAV/FFmpeg versions or thread counts.
- The tool always selects the highest-bandwidth variant from a master HLS playlist. Single-variant (non-master) playlists are used as-is.
```

## Non-goals / Later

- No browser integration (Task 4).
- No tests for the pipeline beyond the existing CRE parity test. Manually verify against a real Track JSON.
- No GPU/hardware acceleration. CPU encode only.
- No progress reporting back to the browser.

## Constraints / Caveats

- The Pillow choice is mandatory unless you discover Pillow won't install cleanly with PyAV — if so, surface the conflict; we may fall back to numpy-only resize (slower, fine for POC).
- Don't tolerate silent failures in PyAV. If `av.open` raises, surface a clean stderr line. If decoding produces zero frames in `[inTime, outTime]`, error with `"No frames decoded in clip range — check inTime/outTime."`.
- Even output dimensions are non-negotiable (libx264 + yuv420p constraint).
- Don't import `cv2` / opencv. Pillow + numpy only.
- The `cre_fixtures.json` from Task 2 is the parity contract — do not modify it as part of this task.

## Verification (before review)

1. Pick a real Track JSON saved from the app (or hand-craft one — schemaVersion=2, real HLS URL, in/out times, two or three keyframes).
2. Run `setup.sh` (one-time install).
3. Run `export.sh path/to/track.json`. Confirm an MP4 lands next to it.
4. Open the MP4 and eyeball that framing roughly matches what the app's preview showed for those keyframes.
5. `npm test` and `npm run build` still pass (you shouldn't have touched the TS side; verify anyway).
6. `python -m unittest discover tools/export-cli/tests` — CRE parity tests still pass (you may or may not add new tests; if you do, keep them focused).

If you can't actually run an end-to-end export (e.g., no internet, no real HLS URL handy), say so explicitly in your report and describe what *was* exercised. The reviewer may still approve based on a static read of the pipeline.
