/**
 * Joukowski transform:
 *   w = z + a^2 / z,   a > 0 (real radius of the preimage circle)
 *
 * For inverse mapping (output w -> source z), solve the quadratic:
 *   z^2 - w z + a^2 = 0
 *   z = (w ± sqrt(w^2 - 4 a^2)) / 2
 *
 * Branch choice:
 * - "auto" (default): pick the root with |z| >= a, i.e., the exterior branch.
 *   This is the standard choice for mapping the outside of the circle to the
 *   outside of the Joukowski airfoil-like curve.
 * - "plus"/"minus": force a specific sign in the quadratic formula.
 *
 * Notes:
 * - We operate in an inverse-mapping renderer: each output pixel is treated as w.
 * - Coordinates: w = ((x - cx) + i (y - cy)) / S, where S is pixels per unit.
 * - Optional pre-rotation in w-plane rotates the observed airfoil.
 * - We guard the branch points where the discriminant ~ 0 (w ≈ ±2a), and map
 *   them to transparent to avoid numerical blow-ups.
 */

export default {
  id: "joukowski",
  name: "Joukowski (w = z + a^2/z)",

  params: {
    // Output (w-plane) frame
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    // Pixels per 1.0 complex unit (100% ≈ min(W,H)/2 px per unit)
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 120 },

    // Rotate the observed w-plane (visual airfoil orientation)
    rotate:  { label: "Rotate (°)",   type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Joukowski parameter a (in complex units). In UI it's given as % of min(W,H)/2.
    aPercent: { label: "a (% of half-min)", type: "range", min: 1, max: 200, step: 1, default: 30 },

    // Branch selection
    branch:  { label: "Branch", type: "select", options: ["auto","plus","minus"], default: "auto" },

    // Soft clamp in source pixel space
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 20, max: 400, step: 1, default: 250 },

    edgeMode: { label: "Edges", type: "select",
      options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels → complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Optional pre-rotation in w-plane
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const c = Math.cos(-rot), s = Math.sin(-rot);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // Parameter a in complex units; UI is percent of half-min dimension
    const a = Math.max(1e-6, (p.aPercent / 100) * 1.0); // since 1.0 unit = half-min dimension

    // Discriminant D = w^2 - 4 a^2 (complex)
    // w^2
    const w2Re = wRe*wRe - wIm*wIm;
    const w2Im = 2*wRe*wIm;

    const fourA2 = 4 * a * a;
    const DRe = w2Re - fourA2;
    const DIm = w2Im;

    // sqrt(D) with principal branch
    const { re: sRe, im: sIm } = csqrt(DRe, DIm);

    // If |D| very small, we're near the branch point -> transparent
    const Dabs = Math.hypot(DRe, DIm);
    if (Dabs < 1e-12) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    // Roots: z± = (w ± sqrt(D)) / 2
    const zPlusRe  = 0.5 * (wRe + sRe);
    const zPlusIm  = 0.5 * (wIm + sIm);
    const zMinusRe = 0.5 * (wRe - sRe);
    const zMinusIm = 0.5 * (wIm - sIm);

    // Choose branch
    let zRe, zIm;
    const mode = p.branch || "auto";
    if (mode === "plus") {
      zRe = zPlusRe; zIm = zPlusIm;
    } else if (mode === "minus") {
      zRe = zMinusRe; zIm = zMinusIm;
    } else {
      // auto: prefer |z| >= a (exterior branch)
      const rPlus  = Math.hypot(zPlusRe,  zPlusIm);
      const rMinus = Math.hypot(zMinusRe, zMinusIm);
      const choosePlus = (rPlus >= a) && (rPlus >= rMinus || rMinus < a);
      if (choosePlus) { zRe = zPlusRe; zIm = zPlusIm; }
      else            { zRe = zMinusRe; zIm = zMinusIm; }
    }

    // Back to source pixels
    const U = cx + zRe * S;
    const V = cy + zIm * S;

    // Soft clamp to limit far sampling
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = U - cx, dv = V - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(U) || !isFinite(V)) return { u: x, v: y };
    return { u: U, v: V };
  }
};

/**
 * Complex square root (principal branch).
 * Returns s such that s^2 = re + i im, with Re(s) >= 0.
 */
function csqrt(re, im) {
  const r = Math.hypot(re, im);
  if (r === 0) return { re: 0, im: 0 };
  let sRe = Math.sqrt(0.5 * (r + re));
  let sIm = Math.sqrt(0.5 * (r - re));
  if (im < 0) sIm = -sIm;
  return { re: sRe, im: sIm };
}
