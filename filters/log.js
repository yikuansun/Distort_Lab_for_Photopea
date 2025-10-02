/**
 * Logarithm map (forward): w = log(z)
 * For inverse mapping (output -> source sampling) we compute:
 *   z = exp(w) = e^{Re(w)} * (cos(Im(w)) + i sin(Im(w)))
 *
 * Implementation:
 * - Output pixel (x,y) is treated as complex w = (x - cx + i(y - cy)) / S,
 *   optionally pre-rotated by 'rotate'.
 * - We compute z = exp(w), then convert back to source pixels using the same S.
 * - Since exp can grow very quickly, we include a "Clamp Radius (%)" that
 *   cuts off sampling outside the given radius in source pixels (alpha=0).
 */

export default {
  id: "log",
  name: "Log (z) → exp inverse",

  params: {
    // Coordinate frame (pixels <-> complex w)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },

    // Scale S: pixels per 1.0 in complex space. 100% ≈ min(W,H)/2 px per unit.
    scale:   { label: "Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 120 },

    // Rotate the w-plane before applying exp (visually rotates the log grid)
    rotate:  { label: "Rotate (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Soft clamp in source pixel space after exp() (prevents infinite blow-ups)
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 120 },

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

    // Optional pre-rotation in w-space
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const cos = Math.cos(-rot), sin = Math.sin(-rot);
      const r = wRe * cos - wIm * sin;
      const i = wRe * sin + wIm * cos;
      wRe = r; wIm = i;
    }

    // z = exp(w) = e^{wRe} (cos wIm + i sin wIm)
    const expRe = Math.exp(wRe);
    // Guard huge exponentials to avoid NaNs; beyond ~1e6 px it's not useful visually
    if (!isFinite(expRe) || expRe > 1e8) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }
    const zRe = expRe * Math.cos(wIm);
    const zIm = expRe * Math.sin(wIm);

    // Complex -> source pixels using the same S
    let u = cx + zRe * S;
    let v = cy + zIm * S;

    // Soft clamp by radius in source pixel space
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = u - cx, dv = v - cy;
    const rPix = Math.hypot(du, dv);
    if (rPix > clampPx) {
      // map outside and make transparent so edge handler can hide it
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
