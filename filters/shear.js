export default {
  id: "shear",
  name: "Shear",
  params: {
    // Linear shear around an anchor (center by default).
    // kx: pixels of horizontal shift per 1px in Y, ky: vertical shift per 1px in X.
    kx:     { label:"Shear X (per px of Y)", type:"range", min:-2, max:2, step:0.01, default:0.24 },
    ky:     { label:"Shear Y (per px of X)", type:"range", min:-2, max:2, step:0.01, default:-0.48 },
    centerX:{ label:"Anchor X (%)", type:"range", min:0, max:100, step:1, default:20 },
    centerY:{ label:"Anchor Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    // Optional quadratic curvature for a "bent" shear
    curve:  { label:"Curvature", type:"range", min:-0.002, max:0.002, step:0.0001, default:0.0007 },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  /**
   * Inverse mapping for shear about an anchor point (cx, cy).
   * Base linear model:
   *   u = x + kx * (y - cy) + curve * (y - cy)^2
   *   v = y + ky * (x - cx) + curve * (x - cx)^2   (same curve applied symmetrically)
   * Set curve = 0 for a classic, strictly linear shear.
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;
    const dx = x - cx;
    const dy = y - cy;

    const u = x + (p.kx || 0) * dy + (p.curve || 0) * dy * dy;
    const v = y + (p.ky || 0) * dx + (p.curve || 0) * dx * dx;

    return { u, v };
  }
};
