export default {
  id: "zigzag",
  name: "ZigZag",
  params: {
    // Angular modulation over radius: theta' = theta + A * sin(2π f * r/R)
    amount:  { label:"Amount (°)", type:"range", min:-360, max:360, step:1, default:5 },
    frequency:{ label:"Frequency (cycles)", type:"range", min:0, max:50, step:1, default:3 },
    radius:  { label:"Radius (%)", type:"range", min:0, max:100, step:1, default:85 },
    centerX: { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY: { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  /**
   * Radial "teeth" distortion by modulating the angle as a function of radius.
   * For r in [0, R]:
   *   theta' = theta + A * sin(2π * f * r/R)
   * Outside the radius, mapping is identity.
   */
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;
    const dx = x - cx, dy = y - cy;
    const r  = Math.hypot(dx, dy);
    const R  = p.radiusPx || Math.min(W, H) * 0.5;

    if (R <= 0 || r >= R || r === 0) return { u: x, v: y };

    const theta = Math.atan2(dy, dx);

    const A = (p.amount || 0) * Math.PI / 180; // degrees -> radians
    const f = (p.frequency || 0);
    const t = r / R;
    const theta2 = theta + A * Math.sin(2 * Math.PI * f * t);

    const u = cx + r * Math.cos(theta2);
    const v = cy + r * Math.sin(theta2);
    return { u, v };
  }
};
