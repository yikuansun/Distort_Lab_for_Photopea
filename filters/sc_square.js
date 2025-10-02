/**
 * Schwarz–Christoffel map: unit disk → square (fixed coefficients).
 *
 * Formula:
 *   z(w) = C ∫_0^w dt / sqrt(1 - t^4),    C ≈ 0.762000138 (1 / 1.311028777)
 *
 * Notes:
 * - We evaluate the complex integral along the straight segment t = s*w, s∈[0,1],
 *   using 8-point Gauss–Legendre quadrature on [0,1]. This is fast and stable.
 * - The result maps the unit disk conformally onto the square [-1,1]^2
 *   in our complex coordinate units. Pixel scaling handled by 'Scale (%)'.
 * - Near the unit circle |w|≈1 and directions toward the 4 prevertices (±1, ±i),
 *   the integrand's denominator tends to 0; we guard with 'Edge Guard'.
 */

export default {
  id: "sc_square",
  name: "Square ↔ Disk (SC, fixed)",

  params: {
    // w-plane frame (output pixels → unit disk coordinates)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 120 },

    rotateW: { label: "Rotate w (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Safety
    edgeGuard:   { label: "Edge Guard (0..1)", type: "number", min: 0, max: 0.999, step: 0.001, default: 0.990 },
    clampRadius: { label: "Clamp Radius (%)",  type: "range",  min: 20, max: 400, step: 1, default: 250 },

    edgeMode: { label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  /**
   * Inverse mapping (output → source):
   *  - Treat output pixel as w in unit disk coordinates (after rotation/scale);
   *  - Compute z = SC(w) via numeric integral;
   *  - Map (Re z, Im z) back to source pixels with the same S scaling.
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Output → complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per 1.0
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Rotate w-plane if requested
    const rot = (p.rotateW || 0) * Math.PI / 180;
    if (rot !== 0) {
      const c = Math.cos(-rot), s = Math.sin(-rot);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // Edge guard: keep inside a circle of radius < 1 to avoid singularities
    const R = Math.hypot(wRe, wIm);
    const guard = Math.max(0, Math.min(0.999, Number(p.edgeGuard) || 0.99));
    const maxR = Math.min(0.999, guard);
    if (R >= maxR) {
      // outside (or too close to) unit circle — make transparent
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    // z = C * ∫_0^1 [ w / sqrt(1 - (s*w)^4) ] ds  (substitute t = s*w)
    const z = scIntegralDiskToSquare(wRe, wIm);

    // Back to source pixels (square coords measured in complex "units")
    const U = cx + z.re * S;
    const V = cy + z.im * S;

    // Soft clamp for far samples in source
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    if (Math.hypot(U - cx, V - cy) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(U) || !isFinite(V)) return { u: x, v: y };
    return { u: U, v: V };
  }
};

/* ---------------- Numerical SC integral (disk → square) ------------------ */

// Normalization constant C = 1 / ∫_0^1 dt / sqrt(1 - t^4)
const Cnorm = 1.0 / 1.3110287771460598; // ≈ 0.762000138

// 8-point Gauss–Legendre nodes/weights on [0,1]
const GL8_x = [
  0.0198550717512319, 0.101666761293187, 0.237233795041836,
  0.408282678752175, 0.591717321247825, 0.762766204958164,
  0.898333238706813, 0.980144928248768
];
const GL8_w = [
  0.0506142681451881, 0.111190517226687, 0.156853322938944,
  0.181341891689181, 0.181341891689181, 0.156853322938944,
  0.111190517226687, 0.0506142681451881
];

function scIntegralDiskToSquare(wRe, wIm) {
  // integral ≈ C * sum_j w / sqrt(1 - (s_j w)^4) * w_j
  // Precompute powers of w
  // Compute w^2 and w^4 (complex)
  const w2 = cmul(wRe, wIm, wRe, wIm);
  const w4 = cmul(w2.re, w2.im, w2.re, w2.im);

  let sumRe = 0, sumIm = 0;

  for (let j = 0; j < 8; j++) {
    const s = GL8_x[j];
    const sj2 = s * s;
    const sj4 = sj2 * sj2; // s^4

    // denom = sqrt(1 - (s^4) * w^4)
    const sw4Re = w4.re * sj4;
    const sw4Im = w4.im * sj4;

    const oneMinusRe = 1 - sw4Re;
    const oneMinusIm =    - sw4Im;

    const sqrtDen = csqrt(oneMinusRe, oneMinusIm);

    // term = w / sqrt(...)
    const term = cdiv(wRe, wIm, sqrtDen.re, sqrtDen.im);

    sumRe += GL8_w[j] * term.re;
    sumIm += GL8_w[j] * term.im;
  }

  return { re: Cnorm * sumRe, im: Cnorm * sumIm };
}

/* ----------------------- Complex helpers --------------------------------- */

function cmul(aRe, aIm, bRe, bIm) {
  return { re: aRe*bRe - aIm*bIm, im: aRe*bIm + aIm*bRe };
}

function cdiv(aRe, aIm, bRe, bIm) {
  const den = bRe*bRe + bIm*bIm || 1e-18;
  return { re: (aRe*bRe + aIm*bIm)/den, im: (aIm*bRe - aRe*bIm)/den };
}

/** Principal complex sqrt: returns s with s^2 = re + i im, Re(s) >= 0 */
function csqrt(re, im) {
  const r = Math.hypot(re, im);
  if (r === 0) return { re: 0, im: 0 };
  let sRe = Math.sqrt(0.5 * (r + re));
  let sIm = Math.sqrt(0.5 * (r - re));
  if (im < 0) sIm = -sIm;
  return { re: sRe, im: sIm };
}
