export default {
  id: "spherize",
  name: "Spherize",
  params: {
    amount:  { label:"Amount (-100..100)", type:"range", min:-100, max:100, step:1, default:50 },
    radius:  { label:"Radius (%)", type:"range", min:0, max:100, step:1, default:100 },
    centerX: { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY: { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    mode:    { label:"Mode", type:"select", options:["linear","quad"], default:"quad" },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },
  map(x, y, W, H, p) {
    const cx=p.cx, cy=p.cy; const dx=x-cx, dy=y-cy;
    const r = Math.hypot(dx,dy);
    const R = p.radiusPx || Math.min(W,H)*0.5;
    if (R<=0 || r>=R) return { u:x, v:y };

    const t = 1 - (r/R);
    const fall = (p.mode === "quad") ? t*t : t;
    const amt = (p.amount||0)/100;
    const scale = 1 + amt * fall; // inflate if positive, deflate if negative
    const r2 = r * Math.max(0, scale);
    const theta = Math.atan2(dy,dx);
    const u = cx + r2*Math.cos(theta);
    const v = cy + r2*Math.sin(theta);
    return { u, v };
  }
};
