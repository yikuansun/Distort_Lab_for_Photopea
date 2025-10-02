/**
 * Angular modulation:
 *   forward:  w = r * exp(i * (theta + f(theta)))
 *   where f(theta) = A * sin(m * theta + phi)
 *
 * Inverse for rendering:
 *   Given w = R * exp(i * Theta), solve for theta from:
 *     Theta = theta + f(theta)
 *   i.e., g(theta) = theta + f(theta) - Theta = 0
 *
 * We solve g(theta)=0 with a small number of Newton iterations:
 *   g'(theta) = 1 + f'(theta) = 1 + A * m * cos(m*theta + phi)
 * and fall back to simple fixed-point if the denominator becomes tiny.
 *
 * After theta is found, source z is:
 *   z = r * exp(i * theta)  with r = R  (radius preserved)
 */

export default {
  id: "angular",
  name: "Angular Modulation",

  params: {
    // f(theta) = A * sin(m*theta + phi). UI in degrees for A and phi.
    amplitudeDeg: { label: "Amplitude (°)", type: "range", min: -180, max: 180, step: 1, default: -6 },
    harmonic:     { label: "Harmonic m",    type: "number", min: 0,   max: 50,  step: 1, default: 8 },
    phaseDeg:     { label: "Phase (°)",     type: "range",  min: 0,   max: 360, step: 1, default: 0 },

    // Frame (pixels <-> complex)
    centerX: { label: "Center X (%)", type: "range",  min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range",  min: 0, max: 100, step: 1, default: 50 },
    scale:   { label: "Scale (%)",    type: "range",  min: 10, max: 400, step: 1, default: 120 },

    // Visual rotation of the w-plane
    rotate:  { label: "Rotate (°)",   type: "range",  min: -180, max: 180, step: 1, default: 0 },

    // Numerical solver tuning
    iterations: { label: "Solver iters", type: "number", min: 1, max: 20, step: 1, default: 6 },

    // Optional soft clamp (in source pixels from center) to cut extreme samples
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 200 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "transparent" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels -> complex w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per unit
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Pre-rotate w-space (negative so UI rotate is intuitive)
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
      // Near singularity; map outside and make transparent
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }
    const Theta = Math.atan2(wIm, wRe);

    // Prepare f(theta) = A * sin(m*theta + phi) with A,phi in radians
    const A   = (Number(p.amplitudeDeg) || 0) * Math.PI / 180;
    const m   = Math.max(0, Math.floor(Number(p.harmonic) || 0));
    const phi = (Number(p.phaseDeg) || 0) * Math.PI / 180;

    // Solve g(theta) = theta + A*sin(m*theta + phi) - Theta = 0
    // Start from theta0 = Theta
    let theta = Theta;
    const iters = Math.max(1, Math.min(20, Math.floor(Number(p.iterations) || 6)));

    for (let k = 0; k < iters; k++) {
      const t = m * theta + phi;
      const s = Math.sin(t);
      const c = Math.cos(t);
      const g  = theta + A * s - Theta;
      const gp = 1 + A * m * c;

      // If derivative is too small, fall back to fixed-point
      if (Math.abs(gp) < 1e-4) {
        theta = Theta - A * s;  // one fixed-point step
      } else {
        theta = theta - g / gp; // Newton step
      }

      if (!isFinite(theta)) { theta = Theta; break; }
    }

    // Source z has radius R and angle 'theta'
    const zRe = R * Math.cos(theta);
    const zIm = R * Math.sin(theta);

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
