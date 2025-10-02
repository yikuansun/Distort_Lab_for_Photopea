/**
 * Exponential map:
 *   w = exp(z)
 * For inverse mapping (output -> source), we use:
 *   z = log(w) = ln|w| + i * Arg(w)
 *
 * Notes:
 * - "Arg" is multivalued: Arg(w) = atan2(Im, Re) + 2πk. We expose a real-valued
 *   parameter "branchK" to select k (step 0.01 as requested).
 * - We work in a pixel-centered complex frame around (cx, cy) with a linear scale S:
 *     w = ((x - cx) + i(y - cy)) / S   (optionally pre-rotated)
 * - Singular point at w = 0 (exactly at (cx, cy) if no rotation/scale):
 *   we map it far outside and set alpha=0 so edge handling can make it transparent.
 */

export default {
  id: "exp",
  name: "Exp (z) → log inverse",

  params: {
    // Coordinate frame (pixels <-> complex)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },

    // Scale: pixels per 1.0 complex unit. 100% ≈ min(W,H)/2 px per unit.
    scale:   { label: "Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 120 },

    // Optional pre-rotation in output (w) space to rotate the "log grid".
    rotate:  { label: "Rotate (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Real-valued branch selector with fine step (0.01).
    branchK: { label: "Branch k", type: "number", min: -10, max: 10, step: 0.01, default: 0 },

    // Edge handling is still resolved by the engine, but present for consistency.
    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  /**
   * Inverse mapping: given output pixel (x, y), compute source coords (u, v).
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels -> complex "w"
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Pre-rotation in w-space by -rotate (to rotate the output pattern visually)
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cos = Math.cos(-rot), sin = Math.sin(-rot);
      const r = wRe * cos - wIm * sin;
      const i = wRe * sin + wIm * cos;
      wRe = r; wIm = i;
    }

    // Handle singularity at w ≈ 0
    const abs = Math.hypot(wRe, wIm);
    if (abs < 1e-6) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    // z = log(w) = ln|w| + i*(Arg(w) + 2πk)
    const lnR   = Math.log(abs);
    const k     = Number(p.branchK) || 0;        // ensure float
    const angle = Math.atan2(wIm, wRe) + 2 * Math.PI * k;

    const zRe = lnR;
    const zIm = angle;

    // Complex -> pixels in source space (same S)
    const u = cx + zRe * S;
    const v = cy + zIm * S;

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
