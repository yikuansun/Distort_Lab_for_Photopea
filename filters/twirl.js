import { clamp } from "../app/utils.js";

export default {
  id: "twirl",
  name: "Twirl",
  params: {
    angle:   { label:"Angle (°)", type:"range", min:-360, max:360, step:1, default:120 },
    radius:  { label:"Radius (%)", type:"range", min:0, max:100, step:1, default:60 },
    centerX: { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY: { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    falloff: { label:"Falloff", type:"select", options:["linear","quad"], default:"quad" },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    const R = p.radiusPx || Math.min(W,H)*0.5;
    if (r >= R || R<=0) return { u:x, v:y };

    const t = 1 - (r/R);
    const fall = (p.falloff === "quad") ? (t*t) : t;
    const k = (p.angle || 0) * (Math.PI/180) * fall;

    const theta = Math.atan2(dy, dx) + k;
    const u = cx + r * Math.cos(theta);
    const v = cy + r * Math.sin(theta);
    return { u, v };
  }
};
