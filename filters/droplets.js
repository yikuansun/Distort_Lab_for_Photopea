/**
 * Droplet Distortion — sum of several spherical "spherize" bubbles.
 *
 * Each droplet j has:
 *   center (px %, px %), radius (px), strength (px), falloff (quad/cubic)
 * Displacement is along the radial direction from the droplet center.
 */

export default {
  id: "droplets",
  name: "Droplet Distortion",

  params: {
    // Global
    centerX: { label: "Center X (%)", type: "range", min:0, max:100, step:1, default:50 },
    centerY: { label: "Center Y (%)", type: "range", min:0, max:100, step:1, default:50 },

    count:   { label: "Droplets count", type:"number", min:1, max:3, step:1, default:3 },

    // Droplet 1
    d1x: { label: "Drop 1 X (%)", type:"range", min:0, max:100, step:1, default:25 },
    d1y: { label: "Drop 1 Y (%)", type:"range", min:0, max:100, step:1, default:25 },
    r1:  { label: "Drop 1 Radius (px)", type:"range", min:10, max:600, step:1, default:160 },
    s1:  { label: "Drop 1 Strength (px)", type:"range", min:-300, max:300, step:1, default:120 },

    // Droplet 2
    d2x: { label: "Drop 2 X (%)", type:"range", min:0, max:100, step:1, default:75 },
    d2y: { label: "Drop 2 Y (%)", type:"range", min:0, max:100, step:1, default:75 },
    r2:  { label: "Drop 2 Radius (px)", type:"range", min:10, max:600, step:1, default:160 },
    s2:  { label: "Drop 2 Strength (px)", type:"range", min:-300, max:300, step:1, default:120 },

    // Droplet 3
    d3x: { label: "Drop 3 X (%)", type:"range", min:0, max:100, step:1, default:50 },
    d3y: { label: "Drop 3 Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    r3:  { label: "Drop 3 Radius (px)", type:"range", min:10, max:600, step:1, default:160 },
    s3:  { label: "Drop 3 Strength (px)", type:"range", min:-300, max:300, step:1, default:120 },

    falloff: { label:"Falloff", type:"select", options:["quad","cubic"], default:"quad" },

    edgeMode:  { label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  map(x, y, W, H, p) {
    let u = x, v = y;

    const N = Math.max(1, Math.min(3, p.count|0));
    for (let j = 1; j <= N; j++) {
      const cx = (p[`d${j}x`] / 100) * W;
      const cy = (p[`d${j}y`] / 100) * H;
      const R  = Math.max(1, p[`r${j}`] || 1);
      const S  = Number(p[`s${j}`] || 0);

      const dx = u - cx, dy = v - cy;
      const r  = Math.hypot(dx, dy);
      if (r >= R || r < 1e-6) continue;

      // Normalized radius t ∈ [0,1]
      const t = r / R;
      const w = (p.falloff === "cubic")
        ? (1 - t*t*t) ** 2
        : (1 - t*t) ** 2; // quad (sharper center)

      const amt = S * w;
      const nx = dx / r, ny = dy / r;

      u += nx * amt;
      v += ny * amt;
    }

    return { u, v };
  }
};
