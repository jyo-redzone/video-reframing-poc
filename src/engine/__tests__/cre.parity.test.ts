/**
 * CRE parity tests — TypeScript side.
 *
 * Reads the shared fixture file at tools/export-cli/tests/cre_fixtures.json
 * and asserts that src/engine/cre.ts produces the expected sourceRect within
 * 1e-9 per component for every (case x sample) tuple. The same fixture is
 * loaded by the Python unittest suite in tools/export-cli/tests/test_cre.py.
 *
 * If either side drifts, both tests should fail and the canonical TS
 * implementation wins (the Python port is updated to match).
 */
import { describe, it, expect } from 'vitest';
import { resolve } from '../cre.ts';
import type { Keyframe, SourceRect, VideoBounds } from '../../types/index.ts';
// Vite/Vitest resolve relative JSON imports at test-time. Keeping the
// fixture in tools/export-cli/tests/ (the Python side's package layout)
// rather than copying it into src/ ensures both runners read the same
// bytes.
import fixtures from '../../../tools/export-cli/tests/cre_fixtures.json' with { type: 'json' };

const TOLERANCE = 1e-9;

type FixtureKeyframe = {
  time: number;
  sourceRect: SourceRect;
  transitionToNext: 'smooth' | 'cut' | null;
};

type FixtureSample = {
  time: number;
  expected: SourceRect;
};

type FixtureCase = {
  name: string;
  fps: number;
  bounds: VideoBounds;
  keyframes: FixtureKeyframe[];
  samples: FixtureSample[];
};

type FixtureFile = {
  cases: FixtureCase[];
};

const typedFixtures = fixtures as unknown as FixtureFile;

/**
 * The fixture file omits the `id` / `trackId` fields that the runtime
 * Keyframe type carries — cre.resolve() does not read them. Synthesise
 * stubs so the type checker is happy.
 */
function asKeyframe(kf: FixtureKeyframe, idx: number): Keyframe {
  return {
    id: `fixture-kf-${idx}`,
    trackId: 'fixture-track',
    time: kf.time,
    sourceRect: kf.sourceRect,
    transitionToNext: kf.transitionToNext,
  };
}

describe('CRE parity — shared fixture file', () => {
  it('fixture file contains at least 8 cases', () => {
    expect(typedFixtures.cases.length).toBeGreaterThanOrEqual(8);
  });

  for (const fcase of typedFixtures.cases) {
    describe(fcase.name, () => {
      const keyframes = fcase.keyframes.map(asKeyframe);

      for (const sample of fcase.samples) {
        it(`time=${sample.time}`, () => {
          const out = resolve(sample.time, keyframes, fcase.bounds, fcase.fps);
          for (const component of ['x', 'y', 'width', 'height'] as const) {
            const got = out.sourceRect[component];
            const want = sample.expected[component];
            expect(
              Math.abs(got - want),
              `component ${component} mismatch: got ${got}, expected ${want}`,
            ).toBeLessThanOrEqual(TOLERANCE);
          }
        });
      }
    });
  }
});
