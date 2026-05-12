"""
Camera Reframing Engine — Python port.

Faithful port of src/engine/cre.ts. Public API mirrors the TS module:
- snap_to_frame(time, fps)
- resolve(time, keyframes, bounds, fps) -> CREOutput
- derive_segments(keyframes) -> list[Segment]

Numerical behaviour must match the TS exactly. Variable names and control
flow are kept close to the TS so future drift between the two
implementations is easy to spot in a side-by-side diff. Do not "Pythonify"
beyond readability.

A single fixture file at tools/export-cli/tests/cre_fixtures.json is the
parity contract — both the Vitest suite and the unittest suite in this
package assert against it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Optional, TypedDict


Transition = Literal["smooth", "cut"]


class SourceRect(TypedDict):
    x: float
    y: float
    width: float
    height: float


class VideoBounds(TypedDict):
    width: float
    height: float


class Keyframe(TypedDict):
    # We deliberately keep only the fields cre.ts reads. `id` / `trackId` on
    # the TS Keyframe shape are not needed for resolve() and are omitted
    # here; the caller can pass extra keys — TypedDict doesn't reject them
    # at runtime.
    time: float
    sourceRect: SourceRect
    transitionToNext: Optional[Transition]


@dataclass
class Segment:
    startKeyframe: Keyframe
    endKeyframe: Keyframe
    startTime: float
    endTime: float
    transition: Transition


@dataclass
class CREOutput:
    frameTime: float
    sourceRect: SourceRect


def snap_to_frame(time: float, fps: float) -> float:
    """
    Snap a continuous time value to the nearest frame boundary.

        frameIndex = floor(time * fps)
        frameTime  = frameIndex / fps
    """
    frame_index = math.floor(time * fps)
    return frame_index / fps


def _clamp_rect(rect: SourceRect, bounds: VideoBounds) -> SourceRect:
    """
    Clamp a resolved SourceRect so it stays within the video bounds.

        w in [1, W], h in [1, H]
        x in [0, W - w], y in [0, H - h]
    """
    w = min(max(rect["width"], 1), bounds["width"])
    h = min(max(rect["height"], 1), bounds["height"])
    x = min(max(rect["x"], 0), bounds["width"] - w)
    y = min(max(rect["y"], 0), bounds["height"] - h)
    return {"x": x, "y": y, "width": w, "height": h}


def _lerp(a: SourceRect, b: SourceRect, alpha: float) -> SourceRect:
    """Linearly interpolate between two SourceRects at normalised time alpha."""
    return {
        "x": a["x"] + alpha * (b["x"] - a["x"]),
        "y": a["y"] + alpha * (b["y"] - a["y"]),
        "width": a["width"] + alpha * (b["width"] - a["width"]),
        "height": a["height"] + alpha * (b["height"] - a["height"]),
    }


def resolve(
    time: float,
    keyframes: list[Keyframe],
    bounds: VideoBounds,
    fps: float,
) -> CREOutput:
    """
    Resolve the camera rectangle at a given time.

    The keyframes list must already be sorted by time (caller's responsibility).

    Rules:
      - Time is snapped to frame boundaries first.
      - Before the first keyframe -> hold first keyframe's rect.
      - After the last keyframe  -> hold last keyframe's rect.
      - Exactly on a keyframe    -> return that keyframe's rect.
      - Between two keyframes:
          smooth -> linear interpolation per component
          cut    -> start KF's rect for t < t2, end KF's rect for t >= t2
      - Result is clamped to bounds.
    """
    frame_time = snap_to_frame(time, fps)

    if len(keyframes) == 0:
        return CREOutput(
            frameTime=frame_time,
            sourceRect={
                "x": 0,
                "y": 0,
                "width": bounds["width"],
                "height": bounds["height"],
            },
        )

    # Before first keyframe — hold
    if frame_time <= keyframes[0]["time"]:
        return CREOutput(
            frameTime=frame_time,
            sourceRect=_clamp_rect(keyframes[0]["sourceRect"], bounds),
        )

    # After last keyframe — hold
    last = keyframes[-1]
    if frame_time >= last["time"]:
        return CREOutput(
            frameTime=frame_time,
            sourceRect=_clamp_rect(last["sourceRect"], bounds),
        )

    # Find surrounding keyframes
    # The list is small so a linear scan is fine.
    start_idx = 0
    for i in range(len(keyframes) - 1):
        if keyframes[i + 1]["time"] > frame_time:
            start_idx = i
            break

    kf1 = keyframes[start_idx]
    kf2 = keyframes[start_idx + 1]

    # Exactly on kf1 (already covered by the <= check above for the first KF)
    if frame_time == kf1["time"]:
        return CREOutput(
            frameTime=frame_time,
            sourceRect=_clamp_rect(kf1["sourceRect"], bounds),
        )

    transition: Transition = kf1["transitionToNext"] or "smooth"

    if transition == "cut":
        # Cut: hold kf1 for t < t2, snap to kf2 at t >= t2
        rect = kf2["sourceRect"] if frame_time >= kf2["time"] else kf1["sourceRect"]
        return CREOutput(
            frameTime=frame_time,
            sourceRect=_clamp_rect(rect, bounds),
        )

    # Smooth (linear interpolation)
    alpha = (frame_time - kf1["time"]) / (kf2["time"] - kf1["time"])
    interpolated = _lerp(kf1["sourceRect"], kf2["sourceRect"], alpha)

    return CREOutput(
        frameTime=frame_time,
        sourceRect=_clamp_rect(interpolated, bounds),
    )


def derive_segments(keyframes: list[Keyframe]) -> list[Segment]:
    """
    Derive segments from consecutive keyframe pairs.

    Each segment spans [kf_i, kf_{i+1}] and carries the transition type.
    """
    segments: list[Segment] = []

    for i in range(len(keyframes) - 1):
        start = keyframes[i]
        end = keyframes[i + 1]
        transition: Transition = start["transitionToNext"] or "smooth"

        segments.append(
            Segment(
                startKeyframe=start,
                endKeyframe=end,
                startTime=start["time"],
                endTime=end["time"],
                transition=transition,
            )
        )

    return segments
