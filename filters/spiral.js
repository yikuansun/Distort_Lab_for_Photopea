/**
 * Spiral unwrap:
 *   forward:  w = r * exp(i*(theta + alpha*ln r))
 *   inverse:  r = |w|, theta = Arg(w) - alpha*ln r, z = r * exp(i*theta)
 *
 * Coordinates:
 * - Output pixel (x,y) -> complex w around (cx,cy) with scale S (px per unit), optional pre-rotation.
 * - We compute z from (r, theta), then map back to source pixels.
 */

export default {
  id: "spiral",
  name: "Spiral Unwrap",

  params: {
    // Spiral tightness: alpha in radians per natural-log radius.
    alpha:   { label: "Alpha (rad)", type: "number", min: -10,  max: 10,  step: 0.01, default: 1.00 },

    // Frame (pixels <-> complex)
    centerX: { label: "Center X (%)", type: "range",  min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range",  min: 0, max: 100, step: 1, default: 50 },
    scale:   { label: "Scale (%)",    type: "range",  min: 10, max: 400, step: 1, default: 120 },

    // Visual rotation of the w-plane before inversion
    rotate:  { label: "Rotate (°)",   type: "range",  min: -180, max: 180, step: 1, default: 0 },

    // Optional soft clamp (in source pixels from center) to cut extreme samples
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 200 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels -> complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Pre-rotate w-space (negative angle so UI rotate feels intuitive)
    const rot = (p.rotate || 0) * Math.PI / 180;
    if (rot !== 0) {
      const c = Math.cos(-rot), s = Math.sin(-rot);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // Polar of w
    const R = Math.hypot(wRe, wIm);
    if (R < 1e-6) {
      // Near the singularity; map outside and make transparent
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }
    const Theta = Math.atan2(wIm, wRe);

    // Inverse to source: r = R, theta = Theta - alpha*ln R
    const alpha = Number(p.alpha) || 0;
    const thetaSrc = Theta - alpha * Math.log(R);

    // Back to Cartesian in z-space
    const zRe = R * Math.cos(thetaSrc);
    const zIm = R * Math.sin(thetaSrc);

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
