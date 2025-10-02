/**
 * Stereographic projection via the Riemann sphere.
 *
 * Pipeline (inverse mapping for rendering):
 *   output pixel (x,y) → complex w = ((x-cx) + i (y-cy)) / S
 *   w → point on unit sphere P = (X,Y,Z) through inverse stereographic
 *   rotate P by yaw/pitch/roll (intrinsic ZYX)
 *   P_rot → w' by forward stereographic
 *   sample source at (u,v) = (cx + Re(w')*S, cy + Im(w')*S)
 *
 * Inverse stereographic (plane → sphere), north-pole projection:
 *   r2 = u^2 + v^2
 *   X = 2u / (r2 + 1)
 *   Y = 2v / (r2 + 1)
 *   Z = (r2 - 1) / (r2 + 1)
 *
 * Forward stereographic (sphere → plane):
 *   u' = X / (1 - Z)
 *   v' = Y / (1 - Z)
 *
 * Notes:
 * - S is a linear scale in pixels per complex unit (100% ≈ min(W,H)/2 px).
 * - The map is conformal. Rotations produce "looking around the sphere" effects.
 * - We guard the pole (Z→1) to avoid blow-ups; such pixels are made transparent.
 */

export default {
  id: "stereographic",
  name: "Riemann Sphere (stereographic)",

  params: {
    // Frame in pixels
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 38 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 45 },
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 70 },

    // Sphere rotation (degrees). Intrinsic ZYX: roll about Z, then pitch about X, then yaw about Y.
    yaw:   { label: "Yaw (°)",   type: "range", min: -180, max: 180, step: 1, default: -90 },
    pitch: { label: "Pitch (°)", type: "range", min: -90,  max: 90,  step: 1, default: -18 },
    roll:  { label: "Roll (°)",  type: "range", min: -180, max: 180, step: 1, default: -13 },

    // Optional soft clamp after projection back to plane (in source pixels from center)
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 20, max: 400, step: 1, default: 250 },

    edgeMode: { label: "Edges", type: "select", options: ["clamp","wrap","mirror","transparent"], default: "mirror" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // Pixels → complex plane w
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per 1.0
    const u = (x - cx) / S;
    const v = (y - cy) / S;

    // Plane → unit sphere (inverse stereographic)
    const r2 = u*u + v*v;
    const inv = 1 / (r2 + 1);
    let X = 2 * u * inv;
    let Y = 2 * v * inv;
    let Z = (r2 - 1) * inv;

    // Rotate sphere point by yaw(Y), pitch(X), roll(Z) — intrinsic ZYX
    const ya = (p.yaw   || 0) * Math.PI / 180;
    const pa = (p.pitch || 0) * Math.PI / 180;
    const ra = (p.roll  || 0) * Math.PI / 180;

    // Precompute sines/cosines
    const cyaw = Math.cos(ya), syaw = Math.sin(ya);
    const cpit = Math.cos(pa), spit = Math.sin(pa);
    const crol = Math.cos(ra), srol = Math.sin(ra);

    // Apply roll around Z
    let x1 =  crol * X - srol * Y;
    let y1 =  srol * X + crol * Y;
    let z1 =  Z;

    // Apply pitch around X
    let x2 = x1;
    let y2 =  cpit * y1 - spit * z1;
    let z2 =  spit * y1 + cpit * z1;

    // Apply yaw around Y
    let Xr =  cyaw * x2 + syaw * z2;
    let Yr =  y2;
    let Zr = -syaw * x2 + cyaw * z2;

    // Sphere → plane (forward stereographic), guard the pole Z≈1
    const denom = 1 - Zr;
    if (Math.abs(denom) < 1e-6) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }
    const u2 = Xr / denom;
    const v2 = Yr / denom;

    // Complex → source pixels
    let U = cx + u2 * S;
    let V = cy + v2 * S;

    // Optional soft clamp
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = U - cx, dv = V - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(U) || !isFinite(V)) return { u: x, v: y };
    return { u: U, v: V };
  }
};
