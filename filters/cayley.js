/**
 * Cayley transform: Half-plane ↔ Disk
 *
 * Inverse mapping for rendering (output w -> source z):
 *   z0 = i * (1 + w) / (1 - w)      // disk -> upper half-plane
 * Then apply an affine transform in z-plane for user control:
 *   z = scaleZ * e^{i*phi} * z0 + (shiftX + i*shiftY)
 *
 * Params:
 * - Center/Scale: define how output pixels map to w (unit disk) in complex units.
 * - RotateW: pre-rotation in w-plane (visual spin of the disk).
 * - Plane controls (scaleZ, rotateZ, shiftX/Y): adjust the half-plane before sampling.
 * - Clamp radius: soft cut to avoid extreme sampling; near singularity w≈1 we make pixel transparent.
 */

export default {
  id: "cayley",
  name: "Half-plane ↔ Disk (Cayley)",

  params: {
    // Output-plane (w) frame
    centerX: { label: "Center X (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    centerY: { label: "Center Y (%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    // Pixels per 1.0 complex unit (for w), 100% ≈ min(W,H)/2 px
    scale:   { label: "Scale (%)",    type: "range", min: 10, max: 400, step: 1, default: 120 },
    // Visual rotation of the disk (w-plane)
    rotateW: { label: "Rotate w (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },

    // Half-plane (z) controls after inverse Cayley
    scaleZ:  { label: "Plane Scale (%)", type: "range", min: 10, max: 400, step: 1, default: 100 },
    rotateZ: { label: "Plane Rotate (°)", type: "range", min: -180, max: 180, step: 1, default: 0 },
    shiftX:  { label: "Plane Shift X (px)", type: "range", min: -500, max: 500, step: 1, default: 0 },
    shiftY:  { label: "Plane Shift Y (px)", type: "range", min: -500, max: 500, step: 1, default: 0 },

    // Safety
    clampRadius: { label: "Clamp Radius (%)", type: "range", min: 20, max: 400, step: 1, default: 250 },

    edgeMode: { label: "Edges", type: "select",
      options: ["clamp","wrap","mirror","transparent"],
      default: "clamp" }
  },

  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;

    // --- Output pixels -> complex w (unit disk coordinates) ---
    const S = Math.max(1e-6, (p.scale / 100) * (Math.min(W, H) * 0.5)); // px per 1.0 in w
    let wRe = (x - cx) / S;
    let wIm = (y - cy) / S;

    // Pre-rotate disk (w-plane) for a nicer control
    const rotW = (p.rotateW || 0) * Math.PI / 180;
    if (rotW !== 0) {
      const c = Math.cos(-rotW), s = Math.sin(-rotW);
      const r = wRe * c - wIm * s;
      const i = wRe * s + wIm * c;
      wRe = r; wIm = i;
    }

    // --- Inverse Cayley: disk -> upper half-plane ---
    // z0 = i * (1 + w) / (1 - w)
    // Handle singularity at w ≈ 1 (denominator → 0)
    const denRe = 1 - wRe;
    const denIm = -wIm;
    const den2 = denRe * denRe + denIm * denIm;
    if (den2 < 1e-10) {
      // very close to the pole -> transparent
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    const numRe = 1 + wRe;
    const numIm = wIm;

    // (1 + w) / (1 - w)
    const invDen = 1 / den2;
    const qRe = (numRe * denRe + numIm * denIm) * invDen;
    const qIm = (numIm * denRe - numRe * denIm) * invDen;

    // i * q = i*(qRe + i qIm) = -qIm + i*qRe
    let z0Re = -qIm;
    let z0Im =  qRe;

    // --- Plane (z) affine controls: scale, rotate, shift ---
    const scaleZ = Math.max(0.0001, (p.scaleZ || 100) / 100);
    const rotZ = (p.rotateZ || 0) * Math.PI / 180;
    let zRe = z0Re * scaleZ;
    let zIm = z0Im * scaleZ;

    if (rotZ !== 0) {
      const c = Math.cos(rotZ), s = Math.sin(rotZ);
      const r = zRe * c - zIm * s;
      const i = zRe * s + zIm * c;
      zRe = r; zIm = i;
    }

    // shiftX/shiftY given in pixels → convert to complex units of z-plane.
    // For simplicity we use the same S (pixel per unit) as w-plane so that
    // a 1:1 shift in px corresponds to 1/S complex units.
    const shiftRe = (p.shiftX || 0) / S;
    const shiftIm = (p.shiftY || 0) / S;
    zRe += shiftRe;
    zIm += shiftIm;

    // --- Back to source pixels ---
    const U = cx + zRe * S;
    const V = cy + zIm * S;

    // Optional soft clamp (limit how far we sample the source)
    const clampPx = (p.clampRadius / 100) * (Math.min(W, H) * 0.5);
    const du = U - cx, dv = V - cy;
    if (Math.hypot(du, dv) > clampPx) {
      return { u: W * 10, v: H * 10, aOverride: 0 };
    }

    if (!isFinite(U) || !isFinite(V)) return { u: x, v: y };
    return { u: U, v: V };
  }
};
