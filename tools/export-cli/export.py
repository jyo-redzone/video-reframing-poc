#!/usr/bin/env python3
"""
Export MP4 CLI entry point.

Downloads the relevant clip range from a Cloudflare Stream MP4, reframes every
frame using the CRE port (cre.py), and writes a reframed H.264 + AAC MP4.

Pipeline:
    --mp4-url (Cloudflare download URL)
        → ffmpeg clip download to a local temp file
        → PyAV decode video frames
            per frame: cre.resolve → scale to decoded dims → crop →
            Pillow fit-into-canvas (preserve aspect, black letterbox) →
            encode H.264, mux into MP4
        → PyAV decode audio frames → re-encode AAC → mux

Requires:
    pip install av pillow numpy
    ffmpeg in PATH

Example:
    python tools/export-cli/export.py \
      --mp4-url "https://customer-….cloudflarestream.com/…/downloads/default.mp4" \
      path/to/track.json \
      --out reframed.mp4
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any, Optional

import av
import numpy as np
from PIL import Image

import cre


class ExportError(Exception):
    """Clean user-facing error."""


@dataclass(frozen=True)
class SourceRect:
    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class ParsedTrack:
    authoring_w: int
    authoring_h: int
    authoring_fps: float
    in_time: float
    out_time: float
    keyframes: list[dict[str, Any]]


def is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def is_positive_finite_number(value: Any) -> bool:
    return is_finite_number(value) and value > 0


def parse_track_json(path: Path) -> ParsedTrack:
    if not path.exists():
        raise ExportError(f"Track JSON not found: {path}")

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ExportError(f"Invalid JSON in {path}: {exc.msg}") from None
    except OSError as exc:
        raise ExportError(f"Could not read {path}: {exc}") from None

    if not isinstance(raw, dict):
        raise ExportError("Invalid track JSON: top-level value must be an object")

    if raw.get("schemaVersion") != 2:
        raise ExportError(f"Unsupported schemaVersion: expected 2, got {raw.get('schemaVersion')!r}")

    metadata = raw.get("videoMetadata")
    if not isinstance(metadata, dict):
        raise ExportError("videoMetadata must be an object")

    width = metadata.get("width")
    height = metadata.get("height")
    fps = metadata.get("fps")

    if not is_positive_finite_number(width):
        raise ExportError("videoMetadata.width must be a positive finite number")
    if not is_positive_finite_number(height):
        raise ExportError("videoMetadata.height must be a positive finite number")
    if not is_positive_finite_number(fps):
        raise ExportError("videoMetadata.fps must be a positive finite number")

    track = raw.get("track")
    if not isinstance(track, dict):
        raise ExportError("track must be an object")

    range_obj = track.get("range")
    if not isinstance(range_obj, dict):
        raise ExportError("track.range must be an object")

    in_time = range_obj.get("inTime")
    out_time = range_obj.get("outTime")

    if not is_finite_number(in_time):
        raise ExportError("track.range.inTime must be a finite number")
    if not is_finite_number(out_time):
        raise ExportError("track.range.outTime must be a finite number")
    if out_time <= in_time:
        raise ExportError(f"track.range.outTime must be greater than inTime: {out_time} <= {in_time}")

    raw_keyframes = track.get("keyframes")
    if not isinstance(raw_keyframes, list) or not raw_keyframes:
        raise ExportError("track.keyframes must be a non-empty array")

    keyframes: list[dict[str, Any]] = []

    for idx, item in enumerate(raw_keyframes):
        if not isinstance(item, dict):
            raise ExportError(f"track.keyframes[{idx}] must be an object")

        kf_time = item.get("time")
        if not is_finite_number(kf_time):
            raise ExportError(f"track.keyframes[{idx}].time must be a finite number")

        rect = item.get("sourceRect")
        if not isinstance(rect, dict):
            raise ExportError(f"track.keyframes[{idx}].sourceRect must be an object")

        for name in ("x", "y", "width", "height"):
            if not is_finite_number(rect.get(name)):
                raise ExportError(f"track.keyframes[{idx}].sourceRect.{name} must be a finite number")

        if rect["width"] <= 0 or rect["height"] <= 0:
            raise ExportError(f"track.keyframes[{idx}].sourceRect width/height must be positive")

        transition = item.get("transitionToNext")
        if transition not in (None, "smooth", "cut"):
            raise ExportError(
                f"track.keyframes[{idx}].transitionToNext must be 'smooth', 'cut', or null"
            )

        keyframes.append(
            {
                "time": float(kf_time),
                "sourceRect": {
                    "x": float(rect["x"]),
                    "y": float(rect["y"]),
                    "width": float(rect["width"]),
                    "height": float(rect["height"]),
                },
                "transitionToNext": transition,
            }
        )

    keyframes.sort(key=lambda kf: kf["time"])

    return ParsedTrack(
        authoring_w=int(width),
        authoring_h=int(height),
        authoring_fps=float(fps),
        in_time=float(in_time),
        out_time=float(out_time),
        keyframes=keyframes,
    )


def even(value: int) -> int:
    value = int(value)
    return value if value % 2 == 0 else value - 1


def compute_default_output_size(first_rect: SourceRect, decoded_w: int, decoded_h: int) -> tuple[int, int]:
    """
    Fit the first crop aspect ratio inside the decoded video dimensions,
    and force even dimensions for yuv420p/H.264.
    """
    crop_aspect = first_rect.width / first_rect.height
    decoded_aspect = decoded_w / decoded_h

    if decoded_aspect > crop_aspect:
        out_h = decoded_h
        out_w = round(out_h * crop_aspect)
    else:
        out_w = decoded_w
        out_h = round(out_w / crop_aspect)

    out_w = even(out_w)
    out_h = even(out_h)

    if out_w < 2 or out_h < 2:
        raise ExportError(f"Computed invalid output size: {out_w}x{out_h}")

    return out_w, out_h


def clamp_crop_rect(rect: SourceRect, decoded_w: int, decoded_h: int) -> tuple[int, int, int, int]:
    x0 = int(round(rect.x))
    y0 = int(round(rect.y))
    x1 = int(round(rect.x + rect.width))
    y1 = int(round(rect.y + rect.height))

    x0 = max(0, min(x0, decoded_w - 1))
    y0 = max(0, min(y0, decoded_h - 1))
    x1 = max(x0 + 1, min(x1, decoded_w))
    y1 = max(y0 + 1, min(y1, decoded_h))

    return x0, y0, x1, y1


def crop_fit_letterbox(rgb: np.ndarray, rect: SourceRect, out_w: int, out_h: int) -> np.ndarray:
    """Crop source rect, resize preserving aspect, place into black output canvas."""
    decoded_h, decoded_w = rgb.shape[:2]
    x0, y0, x1, y1 = clamp_crop_rect(rect, decoded_w, decoded_h)

    crop = rgb[y0:y1, x0:x1]

    crop_h, crop_w = crop.shape[:2]
    crop_aspect = crop_w / crop_h
    canvas_aspect = out_w / out_h

    if crop_aspect > canvas_aspect:
        resized_w = out_w
        resized_h = max(1, round(out_w / crop_aspect))
    else:
        resized_h = out_h
        resized_w = max(1, round(out_h * crop_aspect))

    image = Image.fromarray(crop)

    if (resized_w, resized_h) != (crop_w, crop_h):
        image = image.resize((resized_w, resized_h), Image.Resampling.BILINEAR)

    resized = np.asarray(image)

    canvas = np.zeros((out_h, out_w, 3), dtype=np.uint8)
    dx = (out_w - resized_w) // 2
    dy = (out_h - resized_h) // 2
    canvas[dy: dy + resized_h, dx: dx + resized_w] = resized

    return canvas


def stream_start_seconds(stream: Any) -> float:
    if stream.start_time is None or stream.time_base is None:
        return 0.0

    return float(stream.start_time * stream.time_base)


def seek_to_time(
    container: av.container.InputContainer,
    stream: Any,
    current_time_s: float,
    preroll_s: float = 1.0,
) -> None:
    """
    Seek near the requested currentTime.
    """
    if stream.time_base is None:
        return

    target_source_time = max(0.0, current_time_s - preroll_s)
    target_pts_time = stream_start_seconds(stream) + target_source_time
    target_pts = int(target_pts_time / float(stream.time_base))

    try:
        container.seek(target_pts, stream=stream, backward=True, any_frame=False)
    except Exception as exc:
        print(f"Warning: seek failed; falling back to forward decode: {exc}", file=sys.stderr, flush=True)
        try:
            container.seek(0)
        except Exception:
            pass


def get_video_rate(video_stream: av.video.stream.VideoStream, fallback_fps: float) -> Fraction:
    rate = video_stream.average_rate or video_stream.guessed_rate

    if rate is not None and float(rate) > 0:
        return Fraction(rate)

    return Fraction(fallback_fps).limit_denominator(1_000_000)


def resolve_authoring_rect_with_cre(source_time_s: float, track: ParsedTrack) -> SourceRect:
    bounds = {
        "width": track.authoring_w,
        "height": track.authoring_h,
    }

    cre_out = cre.resolve(
        source_time_s,
        track.keyframes,
        bounds,
        track.authoring_fps,
    )

    rect = cre_out.sourceRect

    return SourceRect(
        x=float(rect["x"]),
        y=float(rect["y"]),
        width=float(rect["width"]),
        height=float(rect["height"]),
    )


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise ExportError("ffmpeg not found. Install ffmpeg and make sure it is available in PATH.")


def run_subprocess(cmd: list[str], label: str) -> None:
    print(f"{label} command:", file=sys.stderr, flush=True)
    print(" ".join(cmd), file=sys.stderr, flush=True)

    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as exc:
        raise ExportError(f"{label} failed with exit code {exc.returncode}") from None


def download_relevant_clip(
    mp4_url: str,
    track: ParsedTrack,
    work_dir: Path,
    clip_mode: str,
    temp_crf: int,
    temp_preset: str,
    include_audio: bool,
) -> Path:
    """
    Download only the relevant time range from the remote MP4 into a local file.

    clip_mode='encode':
      More reliable timing. The local file starts at 0s and maps cleanly to:
        original_source_time = track.in_time + local_time

    clip_mode='copy':
      Faster and avoids temporary re-encoding, but cuts may align to keyframes.
      This can be less precise depending on the input MP4.
    """
    require_ffmpeg()

    duration = track.out_time - track.in_time
    if duration <= 0:
        raise ExportError(f"Invalid clip duration: {duration}")

    local_clip = work_dir / "source_clip.mp4"

    common_prefix = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{track.in_time:.6f}",
        "-i",
        mp4_url,
        "-t",
        f"{duration:.6f}",
        "-map",
        "0:v:0",
    ]

    if include_audio:
        common_prefix += ["-map", "0:a?"]

    if clip_mode == "encode":
        cmd = common_prefix + [
            "-c:v",
            "libx264",
            "-preset",
            temp_preset,
            "-crf",
            str(temp_crf),
        ]

        if include_audio:
            cmd += ["-c:a", "aac", "-b:a", "128k"]
        else:
            cmd += ["-an"]

        cmd += [
            "-movflags",
            "+faststart",
            str(local_clip),
        ]

    elif clip_mode == "copy":
        cmd = common_prefix + [
            "-c",
            "copy",
            "-avoid_negative_ts",
            "make_zero",
            "-movflags",
            "+faststart",
            str(local_clip),
        ]

    else:
        raise ExportError(f"Unsupported clip mode: {clip_mode}")

    run_subprocess(cmd, "Local clip download")

    if not local_clip.exists() or local_clip.stat().st_size == 0:
        raise ExportError("Downloaded local clip is empty")

    print(f"Local source clip: {local_clip}", file=sys.stderr, flush=True)

    return local_clip


def probe_input(input_mp4: str) -> dict[str, Any]:
    """
    Open the MP4 once to collect stream metadata needed before output muxing starts.

    Important: all output streams must be added before the first muxed packet.
    Adding audio after video packets have already been muxed can leave the new
    stream with an invalid zero time_base in PyAV/FFmpeg.
    """
    container = av.open(input_mp4, mode="r")
    try:
        if not container.streams.video:
            raise ExportError("Input MP4 has no video stream")

        video = container.streams.video[0]

        decoded_w = int(video.codec_context.width or video.width or 0)
        decoded_h = int(video.codec_context.height or video.height or 0)

        if decoded_w <= 0 or decoded_h <= 0:
            raise ExportError("Could not determine input video dimensions")

        audio = container.streams.audio[0] if container.streams.audio else None
        audio_info = None

        if audio is not None:
            try:
                layout_name = audio.layout.name
            except Exception:
                layout_name = "stereo"

            audio_info = {
                "sample_rate": int(audio.rate or 48_000),
                "layout_name": layout_name,
            }

        return {
            "decoded_w": decoded_w,
            "decoded_h": decoded_h,
            "fps": get_video_rate(video, 25.0),
            "audio": audio_info,
        }

    finally:
        container.close()


def compute_output_size_for_track(
    track: ParsedTrack,
    decoded_w: int,
    decoded_h: int,
    out_w_arg: Optional[int],
    out_h_arg: Optional[int],
) -> tuple[int, int]:
    if out_w_arg is not None and out_h_arg is not None:
        out_w, out_h = even(out_w_arg), even(out_h_arg)

        if out_w < 2 or out_h < 2:
            raise ExportError(f"Invalid output size after even-rounding: {out_w}x{out_h}")

        return out_w, out_h

    if out_w_arg is None and out_h_arg is None:
        first = track.keyframes[0]["sourceRect"]

        first_rect = SourceRect(
            x=float(first["x"]),
            y=float(first["y"]),
            width=float(first["width"]),
            height=float(first["height"]),
        )

        return compute_default_output_size(first_rect, decoded_w, decoded_h)

    raise ExportError("Provide both --out-width and --out-height, or neither")


def add_video_output_stream(
    out_container: av.container.OutputContainer,
    out_w: int,
    out_h: int,
    fps: Fraction,
    crf: int,
    preset: str,
) -> Any:
    out_time_base = Fraction(fps.denominator, fps.numerator)

    video_out = out_container.add_stream("libx264", rate=fps)
    video_out.width = out_w
    video_out.height = out_h
    video_out.pix_fmt = "yuv420p"
    video_out.time_base = out_time_base
    video_out.codec_context.time_base = out_time_base
    video_out.options = {
        "crf": str(crf),
        "preset": preset,
    }

    return video_out


def add_audio_output_stream(
    out_container: av.container.OutputContainer,
    audio_info: Optional[dict[str, Any]],
) -> Optional[Any]:
    if not audio_info:
        return None

    sample_rate = int(audio_info["sample_rate"] or 48_000)
    layout_name = str(audio_info.get("layout_name") or "stereo")
    audio_time_base = Fraction(1, sample_rate)

    audio_out = out_container.add_stream("aac", rate=sample_rate)
    audio_out.bit_rate = 128_000
    audio_out.layout = layout_name
    audio_out.time_base = audio_time_base
    audio_out.codec_context.time_base = audio_time_base

    return audio_out


def render_video(
    input_mp4: str,
    track: ParsedTrack,
    out_container: av.container.OutputContainer,
    video_out: Any,
    decoded_w: int,
    decoded_h: int,
    out_w: int,
    out_h: int,
    fps: Fraction,
) -> int:
    """
    Render video from the local clipped MP4.

    The local clipped MP4 starts at approximately 0s.

    cre.py still needs original source timeline timestamps, so:
      original_source_time_s = track.in_time + local_time_s
    """
    in_container = av.open(input_mp4, mode="r")

    try:
        video_in = in_container.streams.video[0]
        out_time_base = Fraction(fps.denominator, fps.numerator)

        scale_x = decoded_w / track.authoring_w
        scale_y = decoded_h / track.authoring_h
        start_s = stream_start_seconds(video_in)

        clip_duration = track.out_time - track.in_time

        print(
            f"Video: decoded={decoded_w}x{decoded_h}, output={out_w}x{out_h}, fps={float(fps):.6f}",
            file=sys.stderr,
            flush=True,
        )
        print(
            f"Original clip window: {track.in_time:.3f}s to {track.out_time:.3f}s",
            file=sys.stderr,
            flush=True,
        )
        print(
            f"Local clip window: 0.000s to {clip_duration:.3f}s",
            file=sys.stderr,
            flush=True,
        )

        seek_to_time(in_container, video_in, 0.0)

        frame_idx = 0
        skipped = 0
        last_log = time.monotonic()
        expected = max(1, int(round(clip_duration * float(fps))))
        epsilon = 0.5 / float(fps)

        for frame in in_container.decode(video=0):
            if frame.pts is None:
                continue

            local_time_s = float(frame.pts * frame.time_base) - start_s

            if local_time_s < -epsilon:
                skipped += 1
                continue

            if local_time_s >= clip_duration:
                break

            original_source_time_s = track.in_time + max(0.0, local_time_s)

            authoring_rect = resolve_authoring_rect_with_cre(original_source_time_s, track)

            decoded_rect = SourceRect(
                x=authoring_rect.x * scale_x,
                y=authoring_rect.y * scale_y,
                width=authoring_rect.width * scale_x,
                height=authoring_rect.height * scale_y,
            )

            rgb = frame.to_ndarray(format="rgb24")
            composed = crop_fit_letterbox(rgb, decoded_rect, out_w, out_h)

            out_frame = av.VideoFrame.from_ndarray(composed, format="rgb24")
            out_frame = out_frame.reformat(format="yuv420p")
            out_frame.pts = frame_idx
            out_frame.time_base = out_time_base

            for packet in video_out.encode(out_frame):
                out_container.mux(packet)

            frame_idx += 1

            now = time.monotonic()
            if now - last_log >= 1.0:
                pct = min(100, round(100.0 * frame_idx / expected))
                print(f"Video frames: {frame_idx} / ~{expected} ({pct}%)", file=sys.stderr, flush=True)
                last_log = now

        for packet in video_out.encode():
            out_container.mux(packet)

        if frame_idx == 0:
            raise ExportError(
                f"No video frames were decoded inside local range 0..{clip_duration}; "
                "check that the downloaded local clip is valid."
            )

        print(f"Video done: {frame_idx} frames, skipped before range: {skipped}", file=sys.stderr, flush=True)

        return frame_idx

    finally:
        in_container.close()


def render_audio(
    input_mp4: str,
    track: ParsedTrack,
    out_container: av.container.OutputContainer,
    audio_out: Optional[Any],
) -> int:
    """
    Render audio from the local clipped MP4.

    Since the local source is already clipped, audio is copied from local time 0
    until clip duration.
    """
    if audio_out is None:
        print("Audio: no input audio stream", file=sys.stderr, flush=True)
        return 0

    in_container = av.open(input_mp4, mode="r")

    try:
        if not in_container.streams.audio:
            print("Audio: no input audio stream", file=sys.stderr, flush=True)
            return 0

        audio_in = in_container.streams.audio[0]
        sample_rate = int(audio_in.rate or audio_out.rate or 48_000)

        try:
            layout_name = audio_in.layout.name
        except Exception:
            layout_name = "stereo"

        resampler = av.audio.resampler.AudioResampler(
            format="fltp",
            layout=layout_name,
            rate=sample_rate,
        )

        start_s = stream_start_seconds(audio_in)
        clip_duration = track.out_time - track.in_time

        seek_to_time(in_container, audio_in, 0.0)

        frames_written = 0

        for frame in in_container.decode(audio=0):
            if frame.pts is None:
                continue

            local_time_s = float(frame.pts * frame.time_base) - start_s
            duration_s = float(frame.samples) / sample_rate if sample_rate else 0.0

            if local_time_s + duration_s < 0:
                continue

            if local_time_s >= clip_duration:
                break

            frame.pts = None

            for resampled in resampler.resample(frame):
                resampled.pts = None

                for packet in audio_out.encode(resampled):
                    if packet.time_base is None:
                        packet.time_base = audio_out.time_base
                    out_container.mux(packet)

                frames_written += 1

        for resampled in resampler.resample(None):
            resampled.pts = None

            for packet in audio_out.encode(resampled):
                if packet.time_base is None:
                    packet.time_base = audio_out.time_base
                out_container.mux(packet)

            frames_written += 1

        for packet in audio_out.encode():
            if packet.time_base is None:
                packet.time_base = audio_out.time_base
            out_container.mux(packet)

        print(f"Audio done: {frames_written} frames", file=sys.stderr, flush=True)

        return frames_written

    finally:
        in_container.close()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Download the relevant Cloudflare MP4 clip locally, then reframe it using a track JSON and cre.py"
    )

    parser.add_argument("track_json", type=Path, help="Path to track JSON")
    parser.add_argument("--mp4-url", required=True, help="Direct Cloudflare MP4 URL")

    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output MP4 path. Default: track_json stem + .reframed.mp4",
    )

    parser.add_argument(
        "--out-width",
        type=int,
        default=None,
        help="Optional fixed output width; must be used with --out-height",
    )

    parser.add_argument(
        "--out-height",
        type=int,
        default=None,
        help="Optional fixed output height; must be used with --out-width",
    )

    parser.add_argument(
        "--crf",
        type=int,
        default=18,
        help="Final H.264 CRF. Lower is higher quality. Default: 18",
    )

    parser.add_argument(
        "--preset",
        default="medium",
        help="Final libx264 preset. Default: medium",
    )

    parser.add_argument(
        "--no-audio",
        action="store_true",
        help="Do not include audio in the final output",
    )

    parser.add_argument(
        "--clip-mode",
        choices=["encode", "copy"],
        default="encode",
        help=(
            "How to create the temporary local clip. "
            "'encode' is more timing-accurate. "
            "'copy' is faster but may cut only at keyframes. "
            "Default: encode"
        ),
    )

    parser.add_argument(
        "--temp-crf",
        type=int,
        default=12,
        help="Temporary local clip H.264 CRF when --clip-mode encode is used. Default: 12",
    )

    parser.add_argument(
        "--temp-preset",
        default="veryfast",
        help="Temporary local clip x264 preset when --clip-mode encode is used. Default: veryfast",
    )

    parser.add_argument(
        "--work-dir",
        type=Path,
        default=None,
        help="Directory for temporary local clip. Default: system temp directory",
    )

    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep the downloaded temporary local clip for debugging",
    )

    return parser


def make_work_dir(args: argparse.Namespace) -> tuple[Path, Optional[tempfile.TemporaryDirectory[str]]]:
    """
    Returns:
      (work_dir, temp_context)

    If temp_context is not None, caller owns cleanup by calling temp_context.cleanup().
    """
    if args.work_dir is not None:
        args.work_dir.mkdir(parents=True, exist_ok=True)
        return args.work_dir, None

    if args.keep_temp:
        path = Path(tempfile.mkdtemp(prefix="reframe_clip_"))
        return path, None

    temp_context = tempfile.TemporaryDirectory(prefix="reframe_clip_")
    return Path(temp_context.name), temp_context


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    temp_context: Optional[tempfile.TemporaryDirectory[str]] = None

    try:
        track = parse_track_json(args.track_json)

        out_path = args.out or args.track_json.with_suffix(".reframed.mp4")
        out_path.parent.mkdir(parents=True, exist_ok=True)

        work_dir, temp_context = make_work_dir(args)

        print(f"Track: {args.track_json}", file=sys.stderr, flush=True)
        print(f"Remote MP4: {args.mp4_url}", file=sys.stderr, flush=True)
        print(f"Output: {out_path}", file=sys.stderr, flush=True)
        print(f"Work dir: {work_dir}", file=sys.stderr, flush=True)

        print(
            f"Authoring metadata: {track.authoring_w}x{track.authoring_h} @ {track.authoring_fps} fps, "
            f"keyframes={len(track.keyframes)}",
            file=sys.stderr,
            flush=True,
        )

        local_clip_path = download_relevant_clip(
            mp4_url=args.mp4_url,
            track=track,
            work_dir=work_dir,
            clip_mode=args.clip_mode,
            temp_crf=args.temp_crf,
            temp_preset=args.temp_preset,
            include_audio=not args.no_audio,
        )

        local_input_mp4 = str(local_clip_path)

        probe = probe_input(local_input_mp4)

        decoded_w = int(probe["decoded_w"])
        decoded_h = int(probe["decoded_h"])
        fps = Fraction(probe["fps"])

        out_w, out_h = compute_output_size_for_track(
            track=track,
            decoded_w=decoded_w,
            decoded_h=decoded_h,
            out_w_arg=args.out_width,
            out_h_arg=args.out_height,
        )

        out_container = av.open(str(out_path), mode="w", format="mp4")

        try:
            video_out = add_video_output_stream(
                out_container=out_container,
                out_w=out_w,
                out_h=out_h,
                fps=fps,
                crf=args.crf,
                preset=args.preset,
            )

            audio_out = None if args.no_audio else add_audio_output_stream(
                out_container=out_container,
                audio_info=probe.get("audio"),
            )

            render_video(
                input_mp4=local_input_mp4,
                track=track,
                out_container=out_container,
                video_out=video_out,
                decoded_w=decoded_w,
                decoded_h=decoded_h,
                out_w=out_w,
                out_h=out_h,
                fps=fps,
            )

            if not args.no_audio:
                render_audio(
                    input_mp4=local_input_mp4,
                    track=track,
                    out_container=out_container,
                    audio_out=audio_out,
                )

        finally:
            out_container.close()

        print(f"Wrote: {out_path}", file=sys.stderr, flush=True)

        if args.keep_temp or args.work_dir is not None:
            print(f"Kept local clip: {local_clip_path}", file=sys.stderr, flush=True)

        return 0

    except ExportError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    except av.AVError as exc:
        print(f"PyAV/FFmpeg error: {exc}", file=sys.stderr)
        return 1

    finally:
        if temp_context is not None:
            temp_context.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
