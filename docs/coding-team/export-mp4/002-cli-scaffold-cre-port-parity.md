# Task 002 — CLI scaffolding, CRE port, parity tests, setup scripts

## Context

Create the Python CLI tool's directory structure and the **first piece of real logic**: the CRE port (`cre.py`). The CRE math must produce *identical* `sourceRect` outputs to [src/engine/cre.ts](src/engine/cre.ts) for the same inputs — this is enforced by a shared fixture file that both TS and Python tests assert against. The actual export pipeline (HLS parsing, decode, encode) is Task 3 and is *not* in scope here.

Relevant existing files:
- [src/engine/cre.ts](src/engine/cre.ts) — the canonical implementation (~150 lines, pure functions)
- [src/types/index.ts](src/types/index.ts) — shapes of `Keyframe`, `SourceRect`, `VideoBounds`, `CREOutput`

## Objective

A new `tools/export-cli/` directory containing the Python CRE port, a CRE parity fixture file, working parity tests on both sides (TS via Vitest, Python via its own runner), and bootstrap scripts that future tasks will hang the rest of the export pipeline on.

## Scope

### Directory layout
```
tools/export-cli/
├── README.md                  # skeleton: title, "Usage TBD", "Requirements"
├── requirements.txt           # pinned versions of av and m3u8
├── setup.sh                   # macOS/Linux: create venv, pip install -r requirements.txt
├── setup.bat                  # Windows equivalent
├── export.sh                  # macOS/Linux wrapper: activate venv, exec export.py "$@"
├── export.bat                 # Windows equivalent
├── cre.py                     # the port — public API: resolve(time, keyframes, bounds, fps) -> CREOutput
├── export.py                  # stub: prints "Not yet implemented" and exits 1
└── tests/
    ├── cre_fixtures.json      # shared fixture (also imported by Vitest)
    ├── test_cre.py            # Python parity test
    └── README.md              # optional, one paragraph
```

### `cre.py`

Port [src/engine/cre.ts](src/engine/cre.ts) faithfully. Use Python dataclasses or plain `TypedDict` for `SourceRect` / `Keyframe` / `Bounds` — your call, just stay readable. Public API:

```python
def resolve(time: float, keyframes: list[Keyframe], bounds: Bounds, fps: float) -> CREOutput
def snap_to_frame(time: float, fps: float) -> float
def derive_segments(keyframes: list[Keyframe]) -> list[Segment]   # mirrors TS; needed for symmetry, may be unused by Task 3
```

Numerical behavior **must** match the TS exactly:
- `snap_to_frame`: `floor(time * fps) / fps`
- Clamp order and bounds identical to TS `clampRect`
- Linear lerp formula identical
- Cut transition: `kf2.sourceRect` when `frameTime >= kf2.time`, else `kf1.sourceRect`

Don't sort the keyframes inside `cre.py` — TS doesn't either; sorting is the caller's responsibility (also true in the upcoming `export.py`).

### `cre_fixtures.json`

Hand-write a JSON file at `tools/export-cli/tests/cre_fixtures.json` with this shape:

```jsonc
{
  "cases": [
    {
      "name": "single keyframe — hold for all sample times",
      "fps": 30,
      "bounds": { "width": 1920, "height": 1080 },
      "keyframes": [
        { "time": 0.5, "sourceRect": { "x": 100, "y": 100, "width": 800, "height": 600 }, "transitionToNext": null }
      ],
      "samples": [
        { "time": 0.0, "expected": { "x": 100, "y": 100, "width": 800, "height": 600 } },
        { "time": 0.5, "expected": { "x": 100, "y": 100, "width": 800, "height": 600 } },
        { "time": 2.0, "expected": { "x": 100, "y": 100, "width": 800, "height": 600 } }
      ]
    },
    /* more cases below */
  ]
}
```

Required coverage (≥ 8 cases total — keep them small and focused):
1. Empty keyframes → full-bounds rect.
2. Single keyframe, sample before / on / after.
3. Two keyframes with `smooth` transition: sample on kf1, midpoint, on kf2.
4. Two keyframes with `cut` transition: sample just before kf2, exactly at kf2, after kf2.
5. Three keyframes spanning smooth→cut sequences: sample within each segment.
6. Clamping: a keyframe with rect spilling outside bounds; sample on it and verify clamped output.
7. Sub-frame `time` (e.g. `time = 1.0/30 + 0.001`, fps=30) → snapped to a frame boundary.
8. Frame-rate snapping with non-integer fps (e.g. fps = 29.97), pick samples that exercise the snap math.

Compute expected outputs by **running the TS implementation mentally / via a quick scratch — or by writing the file and running both sides; if Python differs, fix Python. The TS is canonical.** If during writing you find the TS doesn't match the rule you expected, surface this immediately rather than silently changing TS.

Floats: use a tolerance of `1e-9` on both sides when comparing.

### Python test (`tests/test_cre.py`)

Use the standard library `unittest` (no extra deps). The test reads `cre_fixtures.json`, iterates all cases × samples, and asserts each component of `sourceRect` matches expected within `1e-9`. Also test `snap_to_frame` directly for a couple of values.

Make the test runnable with `python -m unittest discover tools/export-cli/tests`. Don't add Python paths via `sys.path` hacks; place an empty `__init__.py` if needed, or set `PYTHONPATH` in the test command in `requirements.txt` comments / README.

### TS parity test

Add `src/engine/__tests__/cre.parity.test.ts` that:
1. Reads the JSON file using Vite/Vitest's JSON import or `fs.readFileSync(path.resolve(__dirname, '../../../tools/export-cli/tests/cre_fixtures.json'), 'utf8')`.
2. Runs `resolve()` against every case × sample.
3. Asserts each component within `1e-9` of expected.

If `src/engine/cre.ts` already has a unit test, leave it alone — this is a *new* parity test sitting alongside it.

### `requirements.txt`

Pin both:
```
av==13.1.0
m3u8==6.0.0
```
(These are the latest stable as of late 2025. If those exact versions don't install on Python 3.10, drop to the highest compatible version and note it.)

### `setup.sh` / `setup.bat`

- Create venv at `tools/export-cli/.venv`.
- Activate it (the script's own subshell), then `pip install -r requirements.txt`.
- Echo a one-liner on success: "Setup complete. Run ./export.sh <track.json> to export a clip."

### `export.sh` / `export.bat`

Activate the venv and `exec python tools/export-cli/export.py "$@"` (Windows: `python tools\export-cli\export.py %*`).

### `export.py`

For now: just `print("Not yet implemented", file=sys.stderr); sys.exit(1)`. Task 3 fills it in.

### `README.md` (in `tools/export-cli/`)

A skeleton:
```markdown
# Export MP4 CLI

Tool for rendering reframed MP4 clips from Track JSON files.

## Requirements
- Python 3.10+

## Setup (once)
- macOS/Linux: `./tools/export-cli/setup.sh`
- Windows: `tools\export-cli\setup.bat`

## Usage
- TBD (implemented in Task 3)
```

### Verification

Before requesting review, manually run:
1. `python -m unittest discover tools/export-cli/tests` — all green.
2. `npm test` — the new parity test runs and is green.
3. `npm run build` — passes.

You do **not** need to verify `setup.sh` end-to-end (PyAV install can be slow) — just make sure the shell logic is correct and the requirements file is syntactically valid pip input.

## Non-goals / Later

- No HLS / video / audio code. `export.py` is intentionally a stub.
- No actual `pip install` is required during verification.
- No CI changes.
- Don't touch `src/engine/cre.ts` itself unless you discover a genuine bug that breaks the fixture — and if you do, surface it before changing.

## Constraints / Caveats

- The CRE port must be a faithful translation, not a "Pythonic rewrite". Keep variable names, control flow, and clamping order close to the TS so future drift is easy to spot in diff.
- The fixture file is the contract. Adding new fixture cases later is fine; changing existing cases requires updating both test sides simultaneously.
- All shell scripts must use LF line endings (yes, even `.bat` — Windows tolerates LF) and be marked executable in the git index (`git update-index --chmod=+x`).
