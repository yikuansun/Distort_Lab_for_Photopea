/**
 * Power/fractal map:
 *   w = z^k,  with real k (can be fractional or negative).
 *
 * For inverse mapping (output -> source sampling) we compute:
 *   z = w^(1/k) = exp( (1/k) * Log(w) )
 * where Log is the multivalued complex logarithm:
 *   Log(w) = ln|w| + i (Arg(w) + 2π * branchK)
 *
 * Notes:
 * - k near 0 is numerically unstable; we clamp |k| to a small epsilon.
 * - w≈0 (exactly at the canvas center in our frame) maps to z≈0 or undefined:
 *   we return transparent there (alpha=0) so edge handling can hide it if needed.
 */

export default {
  id: "pow",
  name: "Power (w = z^k)",

  params: {
    // Exponent k (real-valued)
    k:       { label: "Exponent k", type: "number", min: -5, max: 5, step: 0.01, default: 2.00 },

    // Complex frame (pixels <-> complex w)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },

    // Scale S: pixels per 1.0 complex unit. 100% ≈ min(W,H)/2 px per unit.
    scale:   { label: "Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 120 },

    // Optional pre-rotation in w-space (rotates the power "petals")
    rotate:  { label: "Rotate (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Branch selector for the complex logarithm (fine-grained)
    branchK: { label: "Branch k", type: "number", min: -10, max: 10, step: 0.01, default: 0 },

    // Optional soft clamp in source pixel space after root extraction
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 150 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  /**
   * Inverse mapping: given output pixel (x, y), compute source coords (u, v).
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels -> complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Optional pre-rotation in w-space (by -rotate so visual looks rotated by +rotate)
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cos = Math.cos(-rot), sin = Math.sin(-rot);
      const r = wRe * cos - wIm * sin;
      const i = wRe * sin + wIm * cos;
      wRe = r; wIm = i;
    }

    // Handle w ≈ 0 (singularity for Log)
    const absW = Math.hypot(wRe, wIm);
    if (absW < 1e-6) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    // Compute z = exp( (1/k) * Log(w) )
    let k = Number(p.k);
    if (!isFinite(k)) k = 2;
    const invk = 1 / Math.max(1e-6, Math.abs(k)) * Math.sign(k); // preserve sign, avoid division by 0

    const lnR = Math.log(absW);
    const theta = Math.atan2(wIm, wRe) + 2 * Math.PI * (Number(p.branchK) || 0);

    const reL = invk * lnR;
    const imL = invk * theta;

    const expRe = Math.exp(reL);
    if (!isFinite(expRe) || expRe > 1e8) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    const zRe = expRe * Math.cos(imL);
    const zIm = expRe * Math.sin(imL);

    // Complex -> source pixels using the same S
    let u = cx + zRe * S;
    let v = cy + zIm * S;

    // Optional soft clamp by radius in source space
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = u - cx, dv = v - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
