/**
 * Hyperbolic mirror: w = tanh(z)
 * Inverse for rendering:
 *   z = atanh(w) = 0.5 * (Log(1 + w) - Log(1 - w))
 *
 * We expose a branch *difference* parameter:
 *   Log(re + i*im) = ln|z| + i (Arg(z) + 2π * k)
 * Only the difference between the two branches affects atanh:
 *   0.5 * [ (Arg(1+w) + 2π*k_plus) - (Arg(1-w) + 2π*k_minus) ]
 * → 0.5 * (Arg(1+w) - Arg(1-w)) + π * (k_plus - k_minus)
 * So we control Δk = k_plus - k_minus directly via a single parameter.
 */

export default {
  id: "hyperbolic",
  name: "Hyperbolic Mirror (tanh)",

  params: {
    // Frame (pixels <-> complex w)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    // Pixels per 1.0 complex unit (100% ≈ min(W,H)/2 px per unit)
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 120 },
    // Visual rotation of the w-plane
    rotate:  { label: "Rotate (°)",    type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Effective branch *difference* between Log(1+w) and Log(1-w).
    // We apply +Δk/2 to Log(1+w) and -Δk/2 to Log(1-w), so their difference
    // contributes π * Δk to Im[atanh(w)].
    branchDelta: { label: "Branch Δk", type: "number", min: -10, max: 10, step: 0.01, default: 0 },

    // Soft clamp in source pixel space after atanh
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 180 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels -> complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Optional pre-rotation in w-space (negative angle so UI feels direct)
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const c = Math.cos(-rot), s = Math.sin(-rot);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // atanh(w) = 0.5 * (Log(1+w) - Log(1-w))
    // Check singularities when 1±w ≈ 0
    const onePlusRe  = 1 + wRe, onePlusIm  = wIm;
    const oneMinusRe = 1 - wRe, oneMinusIm = -wIm;

    const eps = 1e-7;
    const magPlus  = Math.hypot(onePlusRe,  onePlusIm);
    const magMinus = Math.hypot(oneMinusRe, oneMinusIm);
    if (magPlus < eps || magMinus < eps) {
      // Too close to poles (|w| ~ 1): make it transparent
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    // Complex Log with independent branch offsets: k_plus = +Δk/2, k_minus = -Δk/2
    const halfDelta = 0.5 * (Number(p.branchDelta) || 0);
    const logPlus  = clog(onePlusRe,  onePlusIm,  +halfDelta);
    const logMinus = clog(oneMinusRe, oneMinusIm, -halfDelta);

    const zRe = 0.5 * (logPlus.re - logMinus.re);
    const zIm = 0.5 * (logPlus.im - logMinus.im);

    // Complex -> source pixels
    let u = cx + zRe * S;
    let v = cy + zIm * S;

    // Soft clamp by radius in source space
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = u - cx, dv = v - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};

function clog(re, im, k) {
  const r = Math.hypot(re, im);
  const a = Math.atan2(im, re) + 2 * Math.PI * k;
  return { re: Math.log(r), im: a };
}
