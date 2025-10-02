/**
 * Weierstrass-like lattice distortion (zeta-style truncated lattice sum).
 *
 * Mapping (inverse; output → source):
 *   z_out = z_in + eps * F(z_in)
 * where
 *   F(z) ≈ Σ_{(m,n)≠(0,0), |m|,|n|≤K} [ 1/(z - ω_{mn}) - 1/ω_{mn} ],
 *   ω_{mn} = m + n τ,  τ = aspect * e^{i*theta}.
 *
 * Notes:
 * - Doubly-periodic, crystal-like distortion. Truncation K keeps it fast.
 * - 'Pole guard (px)' now correctly guards a radius around lattice nodes,
 *   expressed in **pixels** (converted to complex units internally).
 */

export default {
  id: "weierstrass",
  name: "Weierstrass Lattice",

  params: {
    // Frame (pixels <-> complex z)
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    // Scale: pixels per 1.0 complex unit (unit cell size). 100% ≈ min(W,H)/2 px.
    scale:   { label: "Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 120 },

    // Lattice shape τ = aspect * e^{i*theta}
    aspect:  { label: "Aspect |τ|", type: "number", min: 0.2, max: 3, step: 0.01, default: 1.0 },
    theta:   { label: "Angle τ (°)", type: "range", min: -90, max: 90, step: 1, default: 60 },

    // Truncation radius K for the lattice sum
    orderK:  { label: "Order K", type: "number", min: 1, max: 3, step: 1, default: 2 },

    // Distortion strength ε (pixels per unit when mapped back)
    strength:{ label: "Strength (px)", type: "range", min: -100, max: 100, step: 1, default: 15 },

    // Safety near poles and soft clamp of far samples
    poleRadius:  { label: "Pole guard (px)", type: "range", min: 1, max: 40, step: 1, default: 6 },
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 20, max: 400, step: 1, default: 250 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels → complex z (lattice units)
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    const zr = (x - cx) / S;
    const zi = (y - cy) / S;

    // Lattice parameter τ
    const ang = (p.theta || 0) * Math.PI / 180;
    const tauRe = (p.aspect || 1) * Math.cos(ang);
    const tauIm = (p.aspect || 1) * Math.sin(ang);

    const K = Math.max(1, Math.min(3, Math.floor(Number(p.orderK) || 1)));

    // Convert pole guard from px to complex units
    const guard = Math.max(1, Number(p.poleRadius) || 1) / S;
    const guard2 = guard * guard;

    // Compute F(z) truncated lattice sum; abort to transparent if inside guard
    let Fr = 0, Fi = 0;
    for (let m = -K; m <= K; m++) {
      for (let n = -K; n <= K; n++) {
        if (m === 0 && n === 0) continue;

        // ω = m + n τ
        const wRe = m + n * tauRe;
        const wIm = n * tauIm;

        // distance to lattice node
        const dRe = zr - wRe;
        const dIm = zi - wIm;
        const d2  = dRe*dRe + dIm*dIm;

        // If inside guarded radius around a pole — make pixel transparent
        if (d2 < guard2) {
          return { u: W * 10, v: H * 10, aOverride: 0 };
        }

        // term = 1/(z - ω) - 1/ω (convergence improvement)
        const invDen = 1 / d2;
        const invRe =  dRe * invDen;
        const invIm = -dIm * invDen;

        const w2 = wRe*wRe + wIm*wIm;
        const invwRe =  w2 > 0 ? ( wRe / w2) : 0;
        const invwIm =  w2 > 0 ? (-wIm / w2) : 0;

        Fr += (invRe - invwRe);
        Fi += (invIm - invwIm);
      }
    }

    // z' = z + ε * F(z). Convert ε from pixels to complex units by dividing by S
    const eps = (p.strength || 0) / S;
    const z2r = zr + eps * Fr;
    const z2i = zi + eps * Fi;

    // Back to pixels
    let u = cx + z2r * S;
    let v = cy + z2i * S;

    // Soft clamp far away to avoid extreme sampling
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = u - cx, dv = v - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
