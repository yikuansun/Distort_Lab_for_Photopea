/**
 * Angular Modulation (conformal angular warping)
 *
 * Forward model (conceptual):
 *   w = r * exp(i * (theta + f(theta))),   f(theta) = A * sin(m * theta + phi)
 *
 * Rendering needs inverse mapping: given output pixel (x,y) ~ w,
 * find source pixel (u,v) ~ z such that:
 *   Theta = theta + f(theta)            where Theta = arg(w)
 * We solve g(theta) = theta + A*sin(m*theta + phi) - Theta = 0
 * with a few Newton steps (fallback to fixed-point when derivative ~ 0).
 *
 * NOTE about Scale:
 * - We use TWO scales:
 *     S0 : fixed base pixels-per-unit (depends on image size)
 *     S  : user-controlled scale (UI slider) applied only on the INPUT
 * - Pixels -> complex uses S
 * - Complex -> pixels uses S0 (not S), so the effect does not cancel out.
 *   Intuitively: larger Scale (%) → you see a "zoomed-out" complex plane,
 *   so modulation per pixel is denser/weaker; smaller Scale (%) → stronger effect.
 */

export default {
  id: "angular",
  name: "Angular Modulation",

  params: {
    // f(theta) = A * sin(m*theta + phi) ; A, phi in degrees for UI
    amplitudeDeg: { label: "Amplitude (°)", type: "range",  min: -180, max: 180, step: 1, default: -6 },
    harmonic:     { label: "Harmonic m",    type: "number", min: 0,    max: 50,  step: 1, default: 8 },
    phaseDeg:     { label: "Phase (°)",     type: "range",  min: 0,    max: 360, step: 1, default: 0 },

    // Frame (pixels <-> complex)
    centerX: { label: "Center X (%)", type: "range",  min: 0,   max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range",  min: 0,   max: 100, step: 1, default: 50 },
    scale:   { label: "Scale (%)",    type: "range",  min: 10,  max: 400, step: 1, default: 120 },

    // Visual rotation of the w-plane (degrees)
    rotate:  { label: "Rotate (°)",   type: "range",  min: -180, max: 180, step: 1, default: 0 },

    // Numerical solver tuning
    iterations: { label: "Solver iters", type: "number", min: 1, max: 20, step: 1, default: 6 },

    // Optional soft clamp (in source pixels from center) to cut extreme samples
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 10, max: 300, step: 1, default: 200 },

    // Edge behavior when sampling goes out of bounds (handled in engine)
    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "transparent" }
  },

  /**
   * Inverse map from output pixel (x,y) to source UV.
   * W,H are source dimensions. p contains UI parameters and derived center/radius.
   */
  map(x, y, W, H, p) {
    const cx = p.cx;
    const cy = p.cy;

    // Base pixel-per-unit (fixed) and controllable input scale:
    const S0 = Math.max(1e-6, Math.min(W, H) * 0.5);                 // fixed base scale (px per unit)
    const S  = Math.max(1e-6, (Number(p.scale) / 100) * S0);         // input scale (UI)

    // Pixels -> complex w (apply input scale S)
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Pre-rotate w-space (negative angle so UI is intuitive)
    const rot = (Number(p.rotate) || 0) * Math.PI / 180;
    if (rot !== 0) {
      const c = Math.cos(-rot), s = Math.sin(-rot);
      const rw = wRe * c - wIm * s;
      const iw = wRe * s + wIm * c;
      wRe = rw; wIm = iw;
    }

    // Polar of w
    const R = Math.hypot(wRe, wIm);
    if (R < 1e-6) {
      // At singularity; mark transparent to avoid ringing
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }
    const Theta = Math.atan2(wIm, wRe);

    // f(theta) = A * sin(m*theta + phi), A,phi in radians
    const A   = (Number(p.amplitudeDeg) || 0) * Math.PI / 180;
    const m   = Math.max(0, Math.floor(Number(p.harmonic) || 0));
    const phi = (Number(p.phaseDeg) || 0) * Math.PI / 180;

    // Solve g(theta) = theta + A*sin(m*theta + phi) - Theta = 0
    // Initial guess: theta0 = Theta
    let theta = Theta;
    const maxIters = Math.max(1, Math.min(20, Math.floor(Number(p.iterations) || 6)));

    for (let k = 0; k < maxIters; k++) {
      const t  = m * theta + phi;
      const s  = Math.sin(t);
      const c  = Math.cos(t);
      const g  = theta + A * s - Theta;
      const gp = 1 + A * m * c;

      if (Math.abs(gp) < 1e-4) {
        // Derivative too small → one fixed-point step (robust fallback)
        theta = Theta - A * s;
      } else {
        theta = theta - g / gp; // Newton step
      }

      if (!isFinite(theta)) { theta = Theta; break; }
    }

    // Source z has radius R and found angle theta
    const zRe = R * Math.cos(theta);
    const zIm = R * Math.sin(theta);

    // Complex -> source pixels: use FIXED S0 (do not cancel S)
    let u = cx + zRe * S0;
    let v = cy + zIm * S0;

    // Optional soft clamp by radius (in pixels, relative to S0)
    const clampPx = (Number(p.clampRadius) / 100) * (Math.min(W, H) * 0.5);
    const du = u - cx, dv = v - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(u) || !isFinite(v)) return { u: x, v: y };
    return { u, v };
  }
};
