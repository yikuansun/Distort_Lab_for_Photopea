/**
 * Blaschke product with user-controlled zeros (control points inside unit disk).
 *
 * Forward map:
 *   B(z) = e^{i*phi} Π_{k=1..N} (z - a_k) / (1 - conj(a_k) * z),  |a_k| < 1
 *
 * Inverse mapping for rendering (output w -> source z):
 *   w0 = w * e^{-i*phi}
 *   for k = N..1:
 *     w_{k-1} = (w_k + a_k) / (1 + conj(a_k) * w_k)
 *   z = w_0
 *
 * Coordinates:
 * - Output pixel (x,y) is treated as complex w = ((x-cx) + i(y-cy)) / S,
 *   optionally pre-rotated in w-plane.
 * - 'a_k' are given in *unit-disk* complex units (radius ∈ [0,1)).
 * - Map back to source pixels by (u,v) = (cx + Re(z)*S, cy + Im(z)*S).
 */

export default {
  id: "blaschke",
  name: "Blaschke Product",

  params: {
    // Output (w-plane) frame
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 120 },
    rotateW: { label: "Rotate w (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Global phase exp(i*phi)
    phase:   { label: "Global Phase (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Number of zeros to use (0..3). If 0 → pure rotation by 'phase'.
    count:   { label: "Zeros count", type: "number", min: 0, max: 3, step: 1, default: 2 },

    // Zeros a1..a3 in polar coords (radius is % of unit disk, angle in degrees)
    r1:   { label: "Zero 1 radius (%)", type: "range", min: 0, max: 99, step: 1, default: 40 },
    th1:  { label: "Zero 1 angle (°)",  type: "range", min: -180, max: 180, step: 1, default: -20 },

    r2:   { label: "Zero 2 radius (%)", type: "range", min: 0, max: 99, step: 1, default: 55 },
    th2:  { label: "Zero 2 angle (°)",  type: "range", min: -180, max: 180, step: 1, default: 60 },

    r3:   { label: "Zero 3 radius (%)", type: "range", min: 0, max: 99, step: 1, default: 30 },
    th3:  { label: "Zero 3 angle (°)",  type: "range", min: -180, max: 180, step: 1, default: 140 },

    // Safety / edges
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 20, max: 400, step: 1, default: 250 },
    edgeMode: { label: "Edges", type: "select",
      options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // --- output pixels -> complex w (disk coordinates) ---
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per 1.0
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Optional pre-rotation in w-plane (visual spin)
    const rotW = (p.rotateW || 0) * Math.PI / 180;
    if (rotW !== 0) {
      const c = Math.cos(-rotW), s = Math.sin(-rotW);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // Remove global phase: w0 = w * e^{-i*phi}
    const phi = (p.phase || 0) * Math.PI / 180;
    if (phi !== 0) {
      const c = Math.cos(-phi), s = Math.sin(-phi);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // Build zeros array (up to 'count'), as complex a_k inside unit disk
    const N = Math.max(0, Math.min(3, Math.floor(Number(p.count) || 0)));
    const zeros = [];
    if (N >= 1) zeros.push(polarToComplex((p.r1 || 0) / 100, (p.th1 || 0) * Math.PI/180));
    if (N >= 2) zeros.push(polarToComplex((p.r2 || 0) / 100, (p.th2 || 0) * Math.PI/180));
    if (N >= 3) zeros.push(polarToComplex((p.r3 || 0) / 100, (p.th3 || 0) * Math.PI/180));

    // Apply inverse factors in reverse order:
    // w_{k-1} = (w_k + a_k) / (1 + conj(a_k) * w_k)
    let zRe = wRe, zIm = wIm; // start with w0
    for (let k = N - 1; k >= 0; k--) {
      const a = zeros[k];
      const aRe = a.re, aIm = a.im;

      // numerator: w + a
      const numRe = zRe + aRe;
      const numIm = zIm + aIm;

      // denominator: 1 + conj(a) * w = 1 + (aRe - i aIm)*(zRe + i zIm)
      const denRe = 1 + (aRe * zRe + aIm * zIm);
      const denIm =      (aRe * zIm - aIm * zRe);

      const den2 = denRe*denRe + denIm*denIm;
      if (den2 < 1e-10) {
        // very close to singularity -> transparent
        return { u: W * 10, v: H * 10, aOverride: 0 };
      }

      const inv = 1 / den2;
      const qRe = (numRe * denRe + numIm * denIm) * inv;
      const qIm = (numIm * denRe - numRe * denIm) * inv;

      zRe = qRe; zIm = qIm;
    }

    // --- back to source pixels ---
    const U = cx + zRe * S;
    const V = cy + zIm * S;

    // Optional soft clamp to limit far sampling
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = U - cx, dv = V - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(U) || !isFinite(V)) return { u: x, v: y };
    return { u: U, v: V };
  }
};

function polarToComplex(r, theta) {
  // Clamp r to (0..0.999) to keep |a|<1 for numerical safety
  const rr = Math.max(0, Math.min(0.999, Number(r) || 0));
  return { re: rr * Math.cos(theta), im: rr * Math.sin(theta) };
}
