/**
 * Möbius transform:
 *   w = (a z + b) / (c z + d),   with complex a,b,c,d and ad - bc != 0
 *
 * We need INVERSE mapping (from output w -> source z):
 *   z = (d w - b) / (-c w + a)
 *
 * Implementation details:
 * - Pixel (x,y) in output space is converted to complex w around (cx,cy) with a scale 'S'.
 * - We compute z via the inverse formula; then convert back to pixel coords (u,v) in source space.
 * - If denominator is near zero, we return transparent by mapping far outside (let edge handling do the rest).
 */

export default {
  id: "mobius",
  name: "Möbius",

  params: {
    // Complex coefficients (a, b, c, d). Defaults to identity.
    aRe: { label: "a.re", type: "number", min: -5, max: 5, step: 0.01, default: 0.77 },
    aIm: { label: "a.im", type: "number", min: -5, max: 5, step: 0.01, default: 0.35 },
    bRe: { label: "b.re", type: "number", min: -5, max: 5, step: 0.01, default: 0.05 },
    bIm: { label: "b.im", type: "number", min: -5, max: 5, step: 0.01, default: 0.00 },
    cRe: { label: "c.re", type: "number", min: -5, max: 5, step: 0.01, default: 0.22 },
    cIm: { label: "c.im", type: "number", min: -5, max: 5, step: 0.01, default: 0.26 },
    dRe: { label: "d.re", type: "number", min: -5, max: 5, step: 0.01, default: 1.07 },
    dIm: { label: "d.im", type: "number", min: -5, max: 5, step: 0.01, default: 0.1 },

    // Normalization: multiply all (a,b,c,d) by the same scalar so that |ad - bc| = 1 (helps stability).
    normalize: { label: "Normalize determinant", type: "checkbox", default: true },

    // Coordinate frame (pixels -> complex)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 55 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 85 },
    // Scale is relative to min(W,H)/2. At 100%, a unit length = min(W,H)/2 px
    scale:   { label: "Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 120 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  /**
   * Inverse mapping: given output pixel (x,y), compute source (u,v).
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixel -> complex (output space w)
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // pixels per 1.0 complex unit
    const wRe = (x - cx) / S;
    const wIm = (y - cy) / S;

    // Complex coefficients
    let aRe = p.aRe, aIm = p.aIm;
    let bRe = p.bRe, bIm = p.bIm;
    let cRe = p.cRe, cIm = p.cIm;
    let dRe = p.dRe, dIm = p.dIm;

    // Optionally normalize so that |ad - bc| ~= 1
    if (p.normalize) {
      const adRe = aRe*dRe - aIm*dIm;
      const adIm = aRe*dIm + aIm*dRe;
      const bcRe = bRe*cRe - bIm*cIm;
      const bcIm = bRe*cIm + bIm*cRe;
      const detRe = adRe - bcRe;
      const detIm = adIm - bcIm;
      const detAbs = Math.hypot(detRe, detIm);
      if (detAbs > 1e-6) {
        const s = 1 / Math.sqrt(detAbs);
        aRe*=s; aIm*=s; bRe*=s; bIm*=s; cRe*=s; cIm*=s; dRe*=s; dIm*=s;
      }
    }

    // Compute z = (d w - b) / (-c w + a)
    // First compute d*w - b
    const dwRe = dRe*wRe - dIm*wIm;
    const dwIm = dRe*wIm + dIm*wRe;
    const numRe = dwRe - bRe;
    const numIm = dwIm - bIm;

    // Compute -c*w + a
    const cwRe = cRe*wRe - cIm*wIm;
    const cwIm = cRe*wIm + cIm*wRe;
    const denRe = -cwRe + aRe;
    const denIm = -cwIm + aIm;

    const denAbs2 = denRe*denRe + denIm*denIm;
    if (denAbs2 < 1e-12) {
      // Close to pole: map outside so edge handling can make it transparent or clamped
      return { u: W*10, v: H*10, aOverride: 0 };
    }

    // Complex division (num / den)
    const zRe = (numRe*denRe + numIm*denIm) / denAbs2;
    const zIm = (numIm*denRe - numRe*denIm) / denAbs2;

    // Complex -> pixel (source space)
    const u = cx + zRe * S;
    const v = cy + zIm * S;

    // If NaN for any reason, fall back to identity
    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
