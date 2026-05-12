# PTZ Virtual Camera — Mathematical Resolution Specification

> **Audience**: Engineers new to video systems, backend/frontend implementers, reviewers  
> **Purpose**: This document formalizes the mathematics used to resolve virtual camera behavior over time. It does not introduce new features; it precisely defines how persisted camera intent is converted into deterministic per-frame camera rectangles for preview and export.

---

## 1. Why a Maths Specification Exists

The PTZ system is intentionally data-driven. User gestures, UI interactions, and playback mechanisms are _not_ the source of truth. Instead, the system persists sparse **keyframes** that represent camera intent.

This specification answers one question only:

> Given a set of keyframes, how do we compute the exact camera rectangle at any time `t`?

Formalizing this math ensures:

- Preview and export behave identically
    
- Results are deterministic and reproducible
    
- The system is debuggable and auditable
    
- UI and backend implementations remain decoupled
    

---

## 2. Time Model

### 2.1 Continuous Time

All camera math operates in **continuous time**, measured in seconds from the start of the video.

Keyframes are defined at real-valued timestamps:

```
0.0 ≤ time ≤ videoDuration
```

### Example

A keyframe at `12.5s` represents the camera state exactly halfway between frames at 25 fps.

---

### 2.2 Frames (Discrete Sampling)

Rendering occurs at discrete frame times derived from the video frame rate (`fps`).

```
frameIndex = floor(time × fps)
frameTime  = frameIndex / fps
```

All camera evaluation occurs at `frameTime`, ensuring stable, frame-aligned behavior.

**Example**

- FPS = 25
    
- time = 12.04s
    

```
frameIndex = floor(12.04 × 25) = 301
frameTime  = 301 / 25 = 12.04s
```

---

## 3. Coordinate System

All geometry is expressed in **source-video pixel coordinates**.

- Origin `(0, 0)` is the **top-left** of the decoded source frame
    
- X increases to the right
    
- Y increases downward
    

Let the source video have:

```
width  = W
height = H
```

All camera rectangles must satisfy:

```
0 ≤ x ≤ W − width
0 ≤ y ≤ H − height
```

### Example

For a 3840×2160 source, a 1920×1080 viewport can move freely, but must remain within those bounds.

---

## 4. Camera State Representation

At any time `t`, the camera state is a 4-component vector:

```
C(t) = [ x(t), y(t), w(t), h(t) ]
```

This rectangle defines the portion of the source video visible at time `t`.

### Example

```
C(10s) = [960, 540, 1920, 1080]
```

Centers a 1080p view within a 4K source.

---

## 5. Keyframes as Boundary Conditions

A keyframe defines the camera state at an exact moment in time.

For keyframe `k` at time `tₖ`:

```
C(tₖ) = Cₖ
```

Keyframes describe _what must be true_, not _how motion occurs_.

---

## 6. Segments

A **segment** exists between two consecutive keyframes:

```
KF₁ at t₁
KF₂ at t₂
Segment S = [t₁, t₂]
```

Invariant:

```
∀ t ∈ [t₁, t₂], exactly one C(t) exists
```

---

## 7. Normalized Time (α)

For any `t ∈ [t₁, t₂]`:

```
α(t) = (t − t₁) / (t₂ − t₁)
```

### Example

If `t₁ = 10s`, `t₂ = 14s`, then `t = 12s` yields `α = 0.5`.

---

## 8. Linear Interpolation (Default Smooth)

Linear interpolation resolves each camera component independently:

```
v(t) = v₁ + α × (v₂ − v₁)
```

Applied to the camera rectangle:

```
x(t) = x₁ + α(x₂ − x₁)
y(t) = y₁ + α(y₂ − y₁)
w(t) = w₁ + α(w₂ − w₁)
h(t) = h₁ + α(h₂ − h₁)
```

### Worked Example

Keyframes:

```
K1 @ 10s: x = 100
K2 @ 14s: x = 300
```

At `t = 12s`:

```
α = 0.5
x(12) = 100 + 0.5 × (300 − 100) = 200
```

---

## 9. Cut Transition

For a cut segment:

```
C(t) = C₁   for t < t₂
C(t) = C₂   for t ≥ t₂
```

### Example

At `13.99s`, the camera still shows `C₁`; at `14.0s`, it jumps to `C₂`.

---

## 10. Hold (Implicit Static Segment)

If two consecutive keyframes are identical:

```
C₁ = C₂
```

Then:

```
∀ t ∈ [t₁, t₂], C(t) = C₁
```

### Example

A static wide shot held for 10 seconds produces no motion regardless of smooth style.

---

## 11. Natural Smooth (Continuity‑Preserving)

Natural smooth improves visual continuity by ensuring camera motion does not abruptly change speed or direction at keyframes.

### 11.1 Rationale

Linear interpolation treats each segment independently. When users make repeated framing corrections, this can cause mechanical motion.

Natural smooth enforces **continuous velocity** across segments while still hitting every keyframe exactly.

---

### 11.2 Curve Model

The curve exists in **camera parameter space**:

```
C(t) = [ x(t), y(t), w(t), h(t) ]
```

Each parameter is interpolated independently. There is no notion of subject tracking or gesture replay.

---

### 11.3 Required Properties

Any natural smooth implementation MUST satisfy:

1. Interpolation (exact keyframes)
    
2. First‑order continuity (no velocity jumps)
    
3. Locality (only neighboring keyframes influence motion)
    
4. Determinism
    

---

### 11.4 Piecewise Cubic Construction

For a segment between `K1` and `K2`, natural smooth may use:

```
K0 — K1 — K2 — K3
```

If either neighbor is missing, the segment falls back to linear interpolation.

---

### 11.5 Worked Example: Linear vs Natural Smooth

Keyframes (x‑coordinate only for clarity):

```
K0 @ 6s : x = 100
K1 @ 10s: x = 200
K2 @ 14s: x = 260
K3 @ 18s: x = 400
```

**Linear smooth**

- Motion from `K1 → K2` depends only on those two points
    
- Velocity changes abruptly at 10s and 14s
    

At `t = 12s`:

```
α = 0.5
x = 200 + 0.5 × (260 − 200) = 230
```

**Natural smooth**

- Motion from `K1 → K2` also considers `K0` and `K3`
    
- Velocity entering and exiting the segment is continuous
    
- The camera still passes through x=200 at 10s and x=260 at 14s
    

Result:

- Same positions at keyframes
    
- Smoother motion between them
    

---

### 11.6 Constraints and Clamping

After curve evaluation:

- Camera rectangles are clamped to source bounds
    
- Keyframe values are never altered
    

---

## 12. Aspect Ratio and Scaling

Export performs:

1. Crop source frame to `C(t)`
    
2. Scale to output resolution `(Wₒ, Hₒ)`
    

```
sₓ = Wₒ / w(t)
sᵧ = Hₒ / h(t)
```

### Example

Cropping a 1920×1080 region and scaling to 1280×720 applies uniform downscaling.

---

## 13. Quality Constraints

If:

```
w(t) < Wₒ  or  h(t) < Hₒ
```

Then upscaling occurs and quality loss is inevitable.

---

## 14. In / Out Ranges (Export Window)

Export frames satisfy:

```
In ≤ t < Out
```

### Example

- FPS = 25
    
- In = 10.0s → frame 250
    
- Out = 12.0s → frame 300
    

Exported frames: 250–299

---

## 15. Determinism Guarantees

- Same inputs always produce the same output
    
- Preview and export share identical math
    
- UI state never influences results
    

---

## 16. Common Misconceptions

- **Why not store zoom level?** Zoom is implicit in rectangle size.
    
- **Why not store gesture paths?** Gestures are noisy; keyframes capture intent.
    
- **Why not per‑frame camera data?** Sparse keyframes scale better and remain auditable.
    

---

## 17. Reference Resolution Algorithm (Pseudocode)

```
resolveCameraAtTime(t):
  snap t to frameTime
  find surrounding keyframes K1, K2

  if transition == CUT:
    return C1 or C2

  if C1 == C2:
    return C1

  α = normalized time

  if LINEAR:
    return lerp(C1, C2, α)

  if NATURAL:
    return cubicSmooth(C0, C1, C2, C3, α)
```

---

## 18. Summary

Keyframes define _what must be true_. Mathematics defines _everything in between_.

This separation keeps the PTZ system deterministic, scalable, and production‑safe.

## Appendix A — Reference Curve: Catmull–Rom Spline (Non‑Normative)

> This appendix is **informational only**. It provides a widely‑used reference that satisfies all natural smooth requirements. Implementations may use any equivalent formulation.

### A.1 Why Catmull–Rom

Catmull–Rom splines are commonly used in animation and camera systems because they:

- Interpolate all control points exactly
    
- Provide continuous position and velocity
    
- Are local to neighboring points
    
- Are simple to implement and reason about
    

---

### A.2 Conceptual Description

For a segment between `K₁` and `K₂`:

- The tangent at `K₁` is influenced by `(K₂ − K₀)`
    
- The tangent at `K₂` is influenced by `(K₃ − K₁)`
    

These tangents shape a cubic curve that smoothly connects the two keyframes while respecting surrounding context.

The curve is evaluated over normalized time:
```
α = (t − t₁) / (t₂ − t₁)
```

---

### A.3 Reference

Catmull, E., & Rom, R. (1974). _A Class of Local Interpolating Splines_. Computer Aided Geometric Design.

---

### A.4 Why This Is Only a Reference

The PTZ system does **not** mandate Catmull–Rom specifically. The only requirement is preservation of the mathematical properties defined in Section 11A.

This allows future refinement or substitution without breaking determinism or export correctness.