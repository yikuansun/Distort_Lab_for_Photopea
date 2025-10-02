export default {
  id: "pinch",
  name: "Pinch",
  params: {
    // Positive values pinch inward (pull pixels toward center).
    // Negative values expand outward (bulge).
    amount:  { label:"Amount (-100..100)", type:"range", min:-100, max:100, step:1, default:50 },
    radius:  { label:"Radius (%)", type:"range", min:0, max:100, step:1, default:100 },
    centerX: { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY: { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  /**
   * Radial power scaling:
   *   r' = R * (r/R)^(gamma)
   * where gamma = 1 + k,  k = amount/100.
   * amount > 0  => gamma > 1: pulls points toward the center (pinch)
   * amount < 0  => gamma < 1: pushes points outward (expand)
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;
    const dx = x - cx, dy = y - cy;
    const r  = Math.hypot(dx, dy);

    const R = p.radiusPx || Math.min(W, H) * 0.5;
    if (R <= 0 || r >= R) return { u: x, v: y };

    const rho = r / R;
    const gamma = 1 + (p.amount || 0) / 100; // [-0..2] typical
    // Avoid negative/zero or extreme gamma; keep it reasonable
    const g = Math.max(0.05, Math.min(5, gamma));

    const r2 = R * Math.pow(Math.max(1e-6, rho), g);
    const theta = Math.atan2(dy, dx);

    const u = cx + r2 * Math.cos(theta);
    const v = cy + r2 * Math.sin(theta);
    return { u, v };
  }
};
