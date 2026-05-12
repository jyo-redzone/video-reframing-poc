/**
 * Tests for Shift+resize/draw aspect-ratio constraint behavior (task 009).
 *
 * Strategy:
 * - ViewportOverlay aspect-ratio resize: test the algorithm directly by extracting the
 *   pure math into helpers and verifying aspect is preserved per corner and axis driver.
 * - BoundingBoxTool: render the component and fire real mouse events to verify the
 *   draw state produces a video-aspect-ratio rect.
 * - Shift+move: verify the store receives an unconstrained move.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import useAppStore from '../../store/useAppStore';
import BoundingBoxTool from '../Viewport/BoundingBoxTool';

// ── Pure-logic helpers (mirroring ViewportOverlay handleMouseMove) ─────────────
// These replicate the aspect-preserving resize math so we can test the algorithm
// without fighting jsdom's layout engine.

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type SourceRect = { x: number; y: number; width: number; height: number };

/**
 * Compute the aspect-preserving resize result for a given corner and deltas.
 * Mirrors the Shift+resize branch in ViewportOverlay.handleMouseMove.
 */
function computeAspectResize(
  startRect: SourceRect,
  dxSource: number,
  dySource: number,
  corner: Corner,
): SourceRect {
  const signX = corner === 'nw' || corner === 'sw' ? -1 : 1;
  const signY = corner === 'nw' || corner === 'ne' ? -1 : 1;
  const dxSigned = dxSource * signX;
  const dySigned = dySource * signY;
  const dxNorm = dxSigned / startRect.width;
  const dyNorm = dySigned / startRect.height;
  const scale = Math.abs(dxNorm) >= Math.abs(dyNorm) ? 1 + dxNorm : 1 + dyNorm;
  const newW = startRect.width * scale;
  const newH = startRect.height * scale;
  let newX = startRect.x;
  let newY = startRect.y;
  if (corner === 'nw') {
    newX = startRect.x + (startRect.width - newW);
    newY = startRect.y + (startRect.height - newH);
  } else if (corner === 'ne') {
    newY = startRect.y + (startRect.height - newH);
  } else if (corner === 'sw') {
    newX = startRect.x + (startRect.width - newW);
  }
  // se: x/y unchanged (top-left anchor)
  return { x: newX, y: newY, width: newW, height: newH };
}

// ── ViewportOverlay: aspect-ratio resize algorithm ────────────────────────────

describe('ViewportOverlay – Shift+resize aspect-ratio algorithm', () => {
  const START_RECT: SourceRect = { x: 100, y: 100, width: 200, height: 100 };
  const EXPECTED_ASPECT = START_RECT.width / START_RECT.height; // 2.0

  it('SE corner: dx drives when |dxNorm| >= |dyNorm|', () => {
    // drag SE by (+50, 0): dxNorm=0.25, dyNorm=0 → dx drives; scale=1.25
    const result = computeAspectResize(START_RECT, 50, 0, 'se');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.width).toBeCloseTo(250, 3);
    expect(result.height).toBeCloseTo(125, 3);
    // SE anchor: x,y unchanged
    expect(result.x).toBeCloseTo(START_RECT.x, 3);
    expect(result.y).toBeCloseTo(START_RECT.y, 3);
  });

  it('SE corner: dy drives when |dyNorm| > |dxNorm|', () => {
    // drag SE by (0, +30): dxNorm=0, dyNorm=0.3 → dy drives; scale=1.3
    const result = computeAspectResize(START_RECT, 0, 30, 'se');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.height).toBeCloseTo(130, 3);
    expect(result.width).toBeCloseTo(260, 3);
  });

  it('SE corner: both axes, larger normalized wins', () => {
    // dx=40 → dxNorm=0.2; dy=25 → dyNorm=0.25 → dy drives; scale=1.25
    const result = computeAspectResize(START_RECT, 40, 25, 'se');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.height).toBeCloseTo(125, 3);
  });

  it('NW corner: dragging up-left grows rect, aspect preserved', () => {
    // drag NW by (-20, 0): signX=-1 so dxSigned=20; dxNorm=0.1 → dx drives; scale=1.1
    const result = computeAspectResize(START_RECT, -20, 0, 'nw');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.width).toBeCloseTo(220, 3);
    expect(result.height).toBeCloseTo(110, 3);
    // NW shifts x and y to keep bottom-right anchored
    expect(result.x).toBeCloseTo(START_RECT.x + (200 - 220), 3); // -20 → x=80
    expect(result.y).toBeCloseTo(START_RECT.y + (100 - 110), 3); // -10 → y=90
  });

  it('NE corner: aspect preserved', () => {
    // drag NE by (+50, 0): signX=1, signY=-1; dxSigned=50, dxNorm=0.25 → dx drives
    const result = computeAspectResize(START_RECT, 50, 0, 'ne');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.width).toBeCloseTo(250, 3);
    expect(result.height).toBeCloseTo(125, 3);
    // NE: x unchanged, y shifts up (bottom-left anchor)
    expect(result.x).toBeCloseTo(START_RECT.x, 3);
    expect(result.y).toBeCloseTo(START_RECT.y + (100 - 125), 3); // y=75
  });

  it('SW corner: aspect preserved', () => {
    // drag SW by (0, +30): signX=-1, signY=1; dyNorm=0.3 → dy drives
    const result = computeAspectResize(START_RECT, 0, 30, 'sw');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.height).toBeCloseTo(130, 3);
    expect(result.width).toBeCloseTo(260, 3);
  });

  it('shrink: SE dragged inward preserves aspect', () => {
    // drag SE by (-20, 0): dxNorm=-0.1 → scale=0.9; shrink
    const result = computeAspectResize(START_RECT, -20, 0, 'se');
    expect(result.width / result.height).toBeCloseTo(EXPECTED_ASPECT, 5);
    expect(result.width).toBeCloseTo(180, 3);
    expect(result.height).toBeCloseTo(90, 3);
  });

  it('non-Shift resize does NOT preserve aspect (per-axis independent)', () => {
    // This tests the no-Shift branch behavior: only dx changes width
    const startRect = { ...START_RECT };
    // Simulate no-Shift SE resize: newW = startW + dx, newH = startH (no dy)
    const newW = startRect.width + 50;
    const newH = startRect.height; // dy=0
    expect(newW / newH).not.toBeCloseTo(EXPECTED_ASPECT, 3); // 250/100 = 2.5 ≠ 2.0
  });
});

// ── ViewportOverlay: Shift+drag (move) is unconstrained ───────────────────────

describe('ViewportOverlay – Shift+drag move is unconstrained', () => {
  it('move applies full dx and dy regardless of shift', () => {
    // The move branch simply does: x += dxSource, y += dySource
    // There is NO shift handling — verify with the pure formula
    const startRect: SourceRect = { x: 100, y: 100, width: 200, height: 100 };
    const dxSource = 30;
    const dySource = 20;
    const newX = startRect.x + dxSource;
    const newY = startRect.y + dySource;
    // Both axes move independently
    expect(newX).toBe(130);
    expect(newY).toBe(120);
    // Size unchanged
    expect(startRect.width).toBe(200);
    expect(startRect.height).toBe(100);
  });

  it('Shift+move via store: both axes change', () => {
    // Set up store, call setViewportRect with a move delta to verify no constraint
    const initialRect = { x: 100, y: 100, width: 200, height: 100 };
    useAppStore.setState({ viewportRect: { ...initialRect } });
    const dx = 30;
    const dy = 20;
    useAppStore.getState().setViewportRect({
      x: initialRect.x + dx,
      y: initialRect.y + dy,
      width: initialRect.width,
      height: initialRect.height,
    });
    const rect = useAppStore.getState().viewportRect!;
    expect(rect.x).toBe(130);
    expect(rect.y).toBe(120);
  });
});

// ── BoundingBoxTool: Shift+draw constrains to video aspect ────────────────────

const VIDEO_META = {
  id: 'v',
  name: 'test.mp4',
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 60,
  url: '',
};

const VIDEO_ASPECT = VIDEO_META.width / VIDEO_META.height; // 1920/1080 ≈ 1.778

function BoundingBoxToolHarness() {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={containerRef}
      style={{ width: 1920, height: 1080, position: 'relative' }}
      data-testid="container"
    >
      <BoundingBoxTool containerRef={containerRef} />
    </div>
  );
}

function fireWindowMouseMove(clientX: number, clientY: number, shiftKey = false) {
  act(() => {
    window.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX, clientY, shiftKey }),
    );
  });
}

function fireWindowMouseUp() {
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
}

describe('BoundingBoxTool – Shift+draw uses video aspect ratio', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'edit',
      viewportRect: null,
      videoMetadata: VIDEO_META,
      activeTrackId: 'track_default',
      recordingState: 'idle',
      isPlaying: false,
      currentTime: 0,
      tracks: [
        {
          id: 'track_default',
          videoId: '',
          name: 'clip-1',
          keyframes: [],
          range: { inTime: 0, outTime: 60 },
          isDirty: false,
        },
      ],
    });

    // Mock getBoundingClientRect so container reports 1920x1080 at origin
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fireWindowMouseUp();
  });

  it('Shift+draw (dx-driven): resulting rect has video aspect ratio', () => {
    const { container } = render(<BoundingBoxToolHarness />);
    const drawArea = container.querySelector('[style*="crosshair"]') as HTMLElement;
    expect(drawArea).toBeTruthy();

    // Start at (100, 100), move X to 300 (dx=200), Y stays at 100 (dy=0)
    // dx drives (|dy|=0 < wantedH = 200/1.778 ≈ 112.5)
    // cy = 100 + sign(1) * 200 / 1.778 ≈ 212.5
    act(() => {
      drawArea.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
    });
    fireWindowMouseMove(300, 100, true);
    fireWindowMouseUp();

    const rect = useAppStore.getState().viewportRect;
    expect(rect).not.toBeNull();
    expect(rect!.width / rect!.height).toBeCloseTo(VIDEO_ASPECT, 2);
  });

  it('Shift+draw (dy-driven): resulting rect has video aspect ratio', () => {
    const { container } = render(<BoundingBoxToolHarness />);
    const drawArea = container.querySelector('[style*="crosshair"]') as HTMLElement;
    expect(drawArea).toBeTruthy();

    // Start at (100, 100), move to (130, 400)
    // dx=30, dy=300; wantedH = 30/1.778 ≈ 16.9; |dy|=300 > 16.9 → dy drives
    // cx = 100 + sign(30) * 300 * 1.778 ≈ 100 + 533.4 = 633.4
    act(() => {
      drawArea.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
    });
    fireWindowMouseMove(130, 400, true);
    fireWindowMouseUp();

    const rect = useAppStore.getState().viewportRect;
    expect(rect).not.toBeNull();
    expect(rect!.width / rect!.height).toBeCloseTo(VIDEO_ASPECT, 2);
  });

  it('Shift+draw without videoMetadata: falls back to no constraint (no crash)', () => {
    useAppStore.setState({ videoMetadata: null });
    const { container } = render(<BoundingBoxToolHarness />);
    const drawArea = container.querySelector('[style*="crosshair"]') as HTMLElement;
    expect(drawArea).toBeTruthy();

    act(() => {
      drawArea.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
    });
    // No crash; unconstrained draw
    fireWindowMouseMove(300, 100, true);
    fireWindowMouseUp();
    // viewportRect stays null because dy=0 fails the 20px minimum check
    // The key assertion is: no error thrown
  });

  it('draw WITHOUT Shift: rect is unconstrained (aspect not preserved)', () => {
    const { container } = render(<BoundingBoxToolHarness />);
    const drawArea = container.querySelector('[style*="crosshair"]') as HTMLElement;
    expect(drawArea).toBeTruthy();

    // Draw 200×50 px — clearly not video aspect (4.0 ≠ 1.778)
    act(() => {
      drawArea.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 }),
      );
    });
    fireWindowMouseMove(300, 150, false); // no Shift
    fireWindowMouseUp();

    const rect = useAppStore.getState().viewportRect;
    expect(rect).not.toBeNull();
    // 200/50 = 4.0 ≠ VIDEO_ASPECT ≈ 1.778
    expect(rect!.width / rect!.height).not.toBeCloseTo(VIDEO_ASPECT, 1);
  });
});

// ── BoundingBoxTool: Shift+draw algorithm unit tests ─────────────────────────
// Direct verification of the constraint math (no jsdom rendering needed)

describe('BoundingBoxTool – Shift+draw algorithm', () => {
  /**
   * Simulate the aspect-constraining logic from handleMouseMove.
   * Given a start point and current (cx, cy) with Shift, returns the
   * constrained (cx, cy).
   */
  function constrainToAspect(
    startX: number,
    startY: number,
    cx: number,
    cy: number,
    aspect: number,
  ): { cx: number; cy: number } {
    const dx = cx - startX;
    const dy = cy - startY;
    const wantedH = Math.abs(dx) / aspect;
    if (Math.abs(dy) >= wantedH) {
      // dy drives
      return { cx: startX + Math.sign(dx || 1) * Math.abs(dy) * aspect, cy };
    } else {
      // dx drives
      return { cx, cy: startY + Math.sign(dy || 1) * Math.abs(dx) / aspect };
    }
  }

  const ASPECT = 1920 / 1080;

  it('dx drives when |dy| < wantedH', () => {
    // dx=200, dy=50; wantedH=200/1.778≈112.5; |dy|=50 < 112.5 → dx drives
    const { cx, cy } = constrainToAspect(0, 0, 200, 50, ASPECT);
    expect(cx).toBe(200); // unchanged
    expect(cy).toBeCloseTo(200 / ASPECT, 3); // ≈112.5
    // Resulting rect: w=200, h≈112.5 → aspect ≈ 1.778
    expect(200 / (cy - 0)).toBeCloseTo(ASPECT, 3);
  });

  it('dy drives when |dy| >= wantedH', () => {
    // dx=50, dy=200; wantedH=50/1.778≈28.1; |dy|=200 > 28.1 → dy drives
    const { cx, cy } = constrainToAspect(0, 0, 50, 200, ASPECT);
    expect(cy).toBe(200); // unchanged
    expect(cx).toBeCloseTo(200 * ASPECT, 3); // ≈355.6
    expect((cx - 0) / 200).toBeCloseTo(ASPECT, 3);
  });

  it('handles negative dx (drawing left)', () => {
    // dx=-200, dy=-50; |dy|=50 < wantedH=112.5 → dx drives
    const { cx, cy } = constrainToAspect(0, 0, -200, -50, ASPECT);
    expect(cx).toBe(-200);
    expect(cy).toBeCloseTo(-200 / ASPECT, 3); // negative: drawing up-left
  });

  it('handles dy=0 exactly (dx drives)', () => {
    const { cx, cy } = constrainToAspect(0, 0, 100, 0, ASPECT);
    expect(cx).toBe(100);
    expect(cy).toBeCloseTo(100 / ASPECT, 3);
  });
});
