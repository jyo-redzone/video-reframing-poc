# Export MP4 CLI

Renders reframed MP4 clips from Track JSON files exported by the Video Reframing app.

## Requirements

- Python 3.10+
- [ffmpeg](https://ffmpeg.org/download.html) installed and available in `PATH`

## Setup (once)

- macOS/Linux: `./tools/export-cli/setup.sh`
- Windows: `tools\export-cli\setup.bat`

## Usage

- macOS/Linux: `./tools/export-cli/export.sh --mp4-url <cloudflare-mp4-url> <track.json> [--out <output.mp4>]`
- Windows: `tools\export-cli\export.bat --mp4-url <cloudflare-mp4-url> <track.json> [--out <output.mp4>]`

`<cloudflare-mp4-url>` is the direct Cloudflare Stream download URL (e.g. `https://customer-….cloudflarestream.com/…/downloads/default.mp4`).

Output defaults to the same directory and basename as the input JSON, with extension `.reframed.mp4`.

## Optional flags

| Flag | Default | Description |
|---|---|---|
| `--out <path>` | `<json-stem>.reframed.mp4` | Output file path |
| `--crf <n>` | `18` | Final H.264 CRF (lower = higher quality) |
| `--preset <name>` | `medium` | libx264 preset |
| `--no-audio` | off | Omit audio from output |
| `--clip-mode encode\|copy` | `encode` | `encode` is timing-accurate; `copy` is faster but keyframe-aligned |
| `--out-width <n> --out-height <n>` | auto | Fixed output dimensions (both required together) |
| `--keep-temp` | off | Keep the intermediate local clip for debugging |
| `--work-dir <path>` | system temp | Directory for the intermediate local clip |

## Known limitations

- Up to ~20 ms of audio may be missing at the very start of the clip.
- Output is reproducible-enough, not bit-deterministic, across PyAV/FFmpeg versions or thread counts.
