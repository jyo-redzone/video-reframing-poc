"""
CRE parity tests — Python side.

Reads tools/export-cli/tests/cre_fixtures.json and asserts that
cre.resolve() output matches the expected sourceRect within 1e-9 per
component, for every (case x sample) tuple.

Also covers snap_to_frame directly.

Run from the repo root:

    python -m unittest discover tools/export-cli/tests
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

# Add the package directory (parent of this tests/ folder) to sys.path so
# `cre.py` is importable when the suite is discovered from the repo root
# via `python -m unittest discover tools/export-cli/tests`. The brief
# discourages sys.path "hacks"; this is a deliberate bootstrap because
# the directory name `export-cli` contains a dash and therefore cannot
# be imported as a dotted Python package.
HERE = Path(__file__).resolve().parent
PACKAGE_DIR = HERE.parent  # tools/export-cli
if str(PACKAGE_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGE_DIR))

from cre import resolve, snap_to_frame  # noqa: E402

FIXTURES_PATH = HERE / "cre_fixtures.json"
TOLERANCE = 1e-9


def _load_fixtures() -> dict:
    with FIXTURES_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


class CREParityTests(unittest.TestCase):
    """Asserts cre.py output matches the shared fixture file."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.fixtures = _load_fixtures()

    def test_fixture_file_has_cases(self) -> None:
        cases = self.fixtures.get("cases", [])
        self.assertGreaterEqual(
            len(cases),
            8,
            "expected at least 8 fixture cases; see Task 002 brief",
        )

    def test_resolve_matches_fixture(self) -> None:
        cases = self.fixtures["cases"]
        for case in cases:
            keyframes = case["keyframes"]
            bounds = case["bounds"]
            fps = case["fps"]
            for sample in case["samples"]:
                time = sample["time"]
                expected = sample["expected"]
                with self.subTest(case=case["name"], time=time):
                    out = resolve(time, keyframes, bounds, fps)
                    rect = out.sourceRect
                    for component in ("x", "y", "width", "height"):
                        self.assertAlmostEqual(
                            rect[component],
                            expected[component],
                            delta=TOLERANCE,
                            msg=(
                                f"component {component!r} mismatch "
                                f"(case={case['name']!r}, time={time}): "
                                f"got {rect[component]!r}, "
                                f"expected {expected[component]!r}"
                            ),
                        )


class SnapToFrameTests(unittest.TestCase):
    def test_zero(self) -> None:
        self.assertEqual(snap_to_frame(0.0, 30), 0.0)

    def test_integer_fps_exact_frame(self) -> None:
        # frame 15 at 30 fps
        self.assertAlmostEqual(snap_to_frame(0.5, 30), 0.5, delta=TOLERANCE)

    def test_integer_fps_sub_frame_rounds_down(self) -> None:
        # 0.001 past frame 1 at 30 fps should snap back to 1/30
        self.assertAlmostEqual(
            snap_to_frame(1 / 30 + 0.001, 30),
            1 / 30,
            delta=TOLERANCE,
        )

    def test_non_integer_fps_2997(self) -> None:
        # frame 29 at 29.97 fps
        self.assertAlmostEqual(
            snap_to_frame(1.0, 29.97),
            29 / 29.97,
            delta=TOLERANCE,
        )


if __name__ == "__main__":
    unittest.main()
